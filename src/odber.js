// Odběr novinek (zatím jen o školeních) s ověřením e-mailu — double opt-in.
//
//   POST /api/odber            { email, topic, company(honeypot) } → uloží a pošle potvrzovací odkaz
//   GET  /api/odber/potvrdit?t= → ověří e-mail, přesměruje zpět na stránku
//   GET|POST /api/odber/odhlasit?u= → odhlásí (POST kvůli List-Unsubscribe-Post)
//
// Jazyk (cs/en/vi) přijde v těle POST jako `lang` a dál jede v odkazech jako `&l=` —
// podle něj se píše potvrzovací e-mail, hlášky a kam se člověk vrátí. Do databáze se neukládá.
//
// Adresa se počítá jako odběratel až po kliknutí na odkaz (confirmed_at).
// Potvrzovací token ukládáme jen jako hash; odhlašovací je trvalý a stačí na odhlášení.

const MAIL_FROM = "skoleni@indigostudio.cz";
const TOPICS = { skoleni: { page: { cs: "/skoleni", en: "/en/training", vi: "/vi/training" } } };
const LANGS = ["cs", "en", "vi"];
const CONFIRM_DAYS = 7;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// texty pro odběratele podle jazyka stránky
const T = {
  cs: {
    sent: "Poslali jsme vám e-mail s potvrzovacím odkazem. Odběr začne platit po kliknutí na něj.",
    invalid: "Neplatný požadavek.",
    topic: "Neznámý odběr.",
    email: "Zadejte prosím platný e-mail.",
    unavailable: "Odběr teď nejde spustit. Napište nám prosím na info@indigostudio.cz.",
    tooMany: "Odkazů už odešlo hodně. Zkuste to prosím za hodinu.",
    sendFailed: "E-mail se nepodařilo odeslat. Zkuste to prosím znovu, nebo napište na info@indigostudio.cz.",
    subject: "Potvrďte odběr novinek o školeních",
    body: (link, page) =>
      `Dobrý den,\n\n` +
      `děkujeme za zájem o novinky o školeních Indigo Studia. ` +
      `Odběr potvrdíte kliknutím na odkaz:\n\n${link}\n\n` +
      `Odkaz platí ${CONFIRM_DAYS} dní. Pokud jste o odběr nežádali, e-mail ignorujte ` +
      `a nic dalšího vám nepošleme.\n\n` +
      `Indigo Studio s.r.o.\nhttps://indigostudio.cz${page}\n`,
  },
  en: {
    sent: "We have sent you an email with a confirmation link. Your subscription starts once you click it.",
    invalid: "Invalid request.",
    topic: "Unknown subscription.",
    email: "Please enter a valid email address.",
    unavailable: "The subscription cannot be started right now. Please write to info@indigostudio.cz.",
    tooMany: "Too many links have been sent. Please try again in an hour.",
    sendFailed: "The email could not be sent. Please try again or write to info@indigostudio.cz.",
    subject: "Confirm your subscription to training updates",
    body: (link, page) =>
      `Hello,\n\n` +
      `thank you for your interest in updates about Indigo Studio training. ` +
      `Confirm your subscription by clicking the link:\n\n${link}\n\n` +
      `The link is valid for ${CONFIRM_DAYS} days. If you did not ask to subscribe, ignore this email ` +
      `and we will not send you anything else.\n\n` +
      `Indigo Studio s.r.o.\nhttps://indigostudio.cz${page}\n`,
  },
  vi: {
    sent: "Chúng tôi đã gửi email kèm liên kết xác nhận. Đăng ký có hiệu lực sau khi Quý khách nhấp vào liên kết.",
    invalid: "Yêu cầu không hợp lệ.",
    topic: "Loại đăng ký không xác định.",
    email: "Vui lòng nhập địa chỉ email hợp lệ.",
    unavailable: "Hiện không thể đăng ký. Vui lòng viết thư tới info@indigostudio.cz.",
    tooMany: "Đã gửi quá nhiều liên kết. Vui lòng thử lại sau một giờ.",
    sendFailed: "Không gửi được email. Vui lòng thử lại hoặc viết thư tới info@indigostudio.cz.",
    subject: "Xác nhận đăng ký nhận tin về các khóa đào tạo",
    body: (link, page) =>
      `Xin chào,\n\n` +
      `cảm ơn Quý khách đã quan tâm đến tin tức về các khóa đào tạo của Indigo Studio. ` +
      `Vui lòng xác nhận đăng ký bằng cách nhấp vào liên kết:\n\n${link}\n\n` +
      `Liên kết có hiệu lực trong ${CONFIRM_DAYS} ngày. Nếu Quý khách không yêu cầu đăng ký, ` +
      `vui lòng bỏ qua email này, chúng tôi sẽ không gửi thêm gì.\n\n` +
      `Indigo Studio s.r.o.\nhttps://indigostudio.cz${page}\n`,
  },
};
const pickLang = (value) => (LANGS.includes(value) ? value : "cs");
// jazyk do odkazu v e-mailu; čeština je výchozí, tu nepřidáváme
const langParam = (lang) => (lang === "cs" ? "" : `&l=${lang}`);

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

export async function handleOdber(request, env, url) {
  if (url.pathname === "/api/odber") {
    if (request.method !== "POST") return json({ error: "Method Not Allowed" }, 405);
    return subscribe(request, env, url);
  }
  if (url.pathname === "/api/odber/potvrdit" && request.method === "GET") return confirm(env, url);
  if (url.pathname === "/api/odber/odhlasit" && (request.method === "GET" || request.method === "POST")) {
    return unsubscribe(request, env, url);
  }
  return json({ error: "Not Found" }, 404);
}

async function subscribe(request, env, url) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: T.cs.invalid }, 400);
  }
  const lang = pickLang(body?.lang);
  const t = T[lang];
  const SENT = { ok: true, message: t.sent };

  // honeypot — bot vyplní skryté pole; tváříme se, že je odesláno
  if (body && typeof body.company === "string" && body.company.trim() !== "") return json(SENT);

  const email = String(body?.email ?? "").toLowerCase().trim().replace(/[\r\n]/g, "").slice(0, 200);
  const topic = String(body?.topic ?? "");
  if (!TOPICS[topic]) return json({ error: t.topic }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: t.email }, 400);

  // bez databáze nebo Resendu nejde potvrzení doručit na libovolnou adresu
  if (!env.ODBER || !env.RESEND_API_KEY) {
    return json({ error: t.unavailable }, 503);
  }

  const ip = request.headers.get("CF-Connecting-IP") || "";
  const row = await env.ODBER.prepare(
    `SELECT confirmed_at, unsubscribed_at, last_sent_at > datetime('now', '-10 minutes') AS recent
       FROM subscribers WHERE email = ?1 AND topic = ?2`
  )
    .bind(email, topic)
    .first();

  // Už potvrzený odběratel nebo čerstvě poslaný odkaz → nic neposíláme,
  // odpověď je stejná, aby formulář neprozrazoval, kdo odebírá.
  if (row && row.confirmed_at && !row.unsubscribed_at) return json(SENT);
  if (row && row.recent) return json(SENT);

  // Brzda proti rozesílání z jedné IP na mnoho adres.
  if (ip) {
    const fromIp = await env.ODBER.prepare(
      `SELECT COUNT(*) AS n FROM subscribers WHERE ip = ?1 AND last_sent_at > datetime('now', '-1 hour')`
    )
      .bind(ip)
      .first();
    if ((fromIp?.n || 0) >= 5) return json({ error: t.tooMany }, 429);
  }

  const token = randomToken();
  await env.ODBER.prepare(
    `INSERT INTO subscribers (email, topic, confirm_hash, confirm_expires_at, unsub_token, last_sent_at, ip)
     VALUES (?1, ?2, ?3, datetime('now', ?4), ?5, datetime('now'), ?6)
     ON CONFLICT (email, topic) DO UPDATE SET
       confirm_hash = excluded.confirm_hash,
       confirm_expires_at = excluded.confirm_expires_at,
       last_sent_at = excluded.last_sent_at,
       ip = excluded.ip`
  )
    .bind(email, topic, await sha256(token), `+${CONFIRM_DAYS} days`, randomToken(), ip)
    .run();

  try {
    await sendConfirm(env, { email, topic, lang, link: `${url.origin}/api/odber/potvrdit?t=${token}${langParam(lang)}` });
  } catch (err) {
    console.log("odber send error:", err && err.message);
    return json({ error: t.sendFailed }, 502);
  }

  return json(SENT);
}

async function confirm(env, url) {
  const token = url.searchParams.get("t") || "";
  const lang = pickLang(url.searchParams.get("l"));
  if (!env.ODBER || !/^[0-9a-f]{64}$/.test(token)) return back(url, "skoleni", "neplatny", lang);

  const row = await env.ODBER.prepare(
    `UPDATE subscribers
        SET confirmed_at = datetime('now'), unsubscribed_at = NULL, confirm_hash = NULL, confirm_expires_at = NULL
      WHERE confirm_hash = ?1 AND confirm_expires_at > datetime('now')
      RETURNING topic`
  )
    .bind(await sha256(token))
    .first();

  return back(url, row?.topic || "skoleni", row ? "potvrzeno" : "neplatny", lang);
}

async function unsubscribe(request, env, url) {
  const token = url.searchParams.get("u") || "";
  const row =
    env.ODBER && /^[0-9a-f]{64}$/.test(token)
      ? await env.ODBER.prepare(
          `UPDATE subscribers SET unsubscribed_at = COALESCE(unsubscribed_at, datetime('now'))
            WHERE unsub_token = ?1 RETURNING topic`
        )
          .bind(token)
          .first()
      : null;

  // one-click odhlášení z poštovního klienta (RFC 8058) čeká jen 200
  if (request.method === "POST") return json({ ok: Boolean(row) });
  return back(url, row?.topic || "skoleni", row ? "odhlaseno" : "neplatny", pickLang(url.searchParams.get("l")));
}

// zpět na stránku tématu v jazyce odběratele; výsledek ukáže formulář podle ?odber=
function back(url, topic, state, lang) {
  const page = (TOPICS[topic] || TOPICS.skoleni).page[lang];
  return Response.redirect(new URL(`${page}?odber=${state}#odber`, url.origin), 303);
}

async function sendConfirm(env, { email, topic, lang, link }) {
  const t = T[lang];
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `Indigo Studio <${MAIL_FROM}>`,
      to: [email],
      reply_to: "info@indigostudio.cz",
      subject: t.subject,
      text: t.body(link, TOPICS[topic].page[lang]),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${detail.slice(0, 300)}`);
  }
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
