// Indigo Studio — jeden Worker servuje statickou vizitku indigostudio.cz
// a obsluhuje poptávkový formulář (POST /api/poptavka → e-mail přes Email Routing).

import { EmailMessage } from "cloudflare:email";
import { handleStatusboard } from "./statusboard.js";
import { handleOdber } from "./odber.js";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
};

// odesílatel — adresa v naší doméně, ověřená v Resendu (DKIM)
const MAIL_FROM = "poptavka@indigostudio.cz";
// příjemce poptávek přes Resend — reálná schránka v Zoho
const MAIL_TO = "info@indigostudio.cz";
// fallback příjemce pro Cloudflare send_email — musí být ověřená destinace v Email Routingu
const MAIL_TO_FALLBACK = "hromada.dan@gmail.com";

// ----- Jazykové verze -----
// Čeština žije na kořeni (/hosting), angličtina a vietnamština pod /en/ a /vi/ se společnými
// anglickými adresami (/en/training, /vi/training). Klíč = česká cesta, hodnota = cesta pod
// jazykovou předponou. Nová přeložená stránka = řádek tady + hreflang a přepínač ve všech verzích.
const LANGS = ["cs", "en", "vi"];
const PAGES = {
  "/": "/",
  "/hosting": "/hosting",
  "/skoleni": "/training",
  "/projekty": "/projects",
  "/projekty/mblue": "/projects/mblue",
  "/projekty/pasek": "/projects/pasek",
  "/projekty/aseko": "/projects/aseko",
  "/prevzeti-vyvoje": "/development-takeover",
  "/cookies": "/cookies",
};
// roboti a náhledy odkazů dostanou vždy adresu, na kterou se ptají (indexace jde přes hreflang)
const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|whatsapp|telegram|discord|slack|linkedin|lighthouse|headless/i;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Jedna kanonická adresa: http a www trvale na https://indigostudio.cz,
    // aby vyhledávače neviděly tentýž web pod třemi adresami. Schéma bereme z hlavičky Cloudflare,
    // protože wrangler dev dosazuje do url produkční doménu a lokální vývoj běží na http.
    if (url.hostname === "www.indigostudio.cz" || (url.hostname === "indigostudio.cz" && request.headers.get("X-Forwarded-Proto") === "http")) {
      return Response.redirect(`https://indigostudio.cz${url.pathname}${url.search}`, 301);
    }

    // Online nástroje se odstěhovaly do vlastního Workeru (IndigoStudioCZ/nastroje).
    // Dřív sdílené náhledy odkazují na obrázky OG tady, proto je přesměruj na novou adresu.
    if (url.pathname.startsWith("/tools/og/")) {
      return Response.redirect(`https://nastroje.indigostudio.cz${url.pathname}`, 301);
    }

    // Statusboard mBlue žije na vlastní subdoméně a je celý za přihlášením.
    // Na apexu ho schválně nespouštíme — jedna adresa, jedno místo.
    if (url.hostname === "mblue.indigostudio.cz") {
      if (url.pathname === "/" || url.pathname === "") {
        return Response.redirect(new URL("/statusboard", url.origin), 302);
      }
      return handleStatusboard(request, env, url);
    }

    // Web Editor se odstěhoval na vlastní doménu. Stará adresa jen přesměruje
    // se zachovanou cestou — starší buildy appky a opsané odkazy na ni vedou
    // dál a nový web si staré cesty (/soukromi, /stahnout/…) přeloží sám.
    if (url.hostname === "weed.indigostudio.cz") {
      return Response.redirect(`https://webeditor.click${url.pathname}${url.search}`, 301);
    }

    // odběr novinek o školeních (double opt-in, D1 + Resend)
    if (url.pathname === "/api/odber" || url.pathname.startsWith("/api/odber/")) {
      return handleOdber(request, env, url);
    }

    if (url.pathname === "/api/poptavka") {
      if (request.method !== "POST") return json({ error: "Method Not Allowed" }, 405);
      return handlePoptavka(request, env);
    }

    // /rampa byla nahrazena článkem /cookies — starý odkaz (i z rozeslaného mailu)
    // trvale přesměruj na aktuální obsah.
    if (url.pathname === "/rampa" || url.pathname === "/rampa/" || url.pathname === "/rampa.html") {
      return Response.redirect(new URL("/cookies", url.origin), 301);
    }

    // Klientský PoC má vlastní stránku; HTML asset se servíruje interně jako TXT,
    // aby ho automatická kanonizace Cloudflare neposílala zpět do smyčky.
    if (url.pathname === "/lada-poc") {
      return Response.redirect(new URL("/lada-poc/", url.origin), 307);
    }

    // Česká adresa otevřená zvenku → jazyková verze podle volby v přepínači (cookie lang)
    // nebo jazyka prohlížeče. Anglické a vietnamské adresy se nepřesměrovávají nikdy.
    const redirect = languageRedirect(request, url);
    if (redirect) return redirect;

    let assetRequest = request;
    const isLadaPoc = url.pathname === "/lada-poc/";
    if (isLadaPoc) {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = "/lada-poc/page.txt";
      assetRequest = new Request(assetUrl, request);
    }

    // Ověřovací soubor Google Search Console musí odpovědět 200 přesně na /googleXXXX.html.
    // Assets by .html přesměrovaly na adresu bez přípony, proto se ptáme rovnou na ni.
    if (/^\/google[0-9a-f]+\.html$/.test(url.pathname)) {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = url.pathname.slice(0, -".html".length);
      assetRequest = new Request(assetUrl, request);
    }

    // statika + bezpečnostní hlavičky
    const res = await env.ASSETS.fetch(assetRequest);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
    if (isLadaPoc) headers.set("Content-Type", "text/html; charset=utf-8");
    if ((headers.get("Content-Type") || "").startsWith("text/html")) {
      headers.set("Content-Language", pathLang(url.pathname));
      // česká stránka může pro jiný jazyk prohlížeče odpovědět přesměrováním
      if (url.pathname in PAGES) headers.append("Vary", "Accept-Language, Cookie");
      // strojově čitelné odkazy pro agenty (RFC 8288)
      headers.set("Link", '<https://indigostudio.cz/llms.txt>; rel="describedby"; type="text/plain", <https://indigostudio.cz/sitemap.xml>; rel="sitemap"; type="application/xml"');
    }
    // Assets kanonizují adresy (/hosting.html, /hosting/) přes 307; vyhledávačům patří trvalé 301.
    if (res.status === 307) return new Response(null, { status: 301, headers });
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },
};

// jazyk stránky podle předpony adresy
function pathLang(pathname) {
  const m = /^\/(en|vi)(?:\/|$)/.exec(pathname);
  return m ? m[1] : "cs";
}

function languageRedirect(request, url) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const target = PAGES[url.pathname];
  if (target === undefined) return null;

  // Proklik uvnitř webu (i přepínačem jazyka) nepřesměrováváme — kdo je tu, vybral si sám.
  const referer = request.headers.get("Referer");
  if (referer) {
    try {
      if (new URL(referer).host === url.host) return null;
    } catch {}
  }
  if (BOTS.test(request.headers.get("User-Agent") || "")) return null;

  const lang = preferredLang(request);
  if (lang === "cs") return null;
  return new Response(null, {
    status: 302,
    headers: {
      Location: new URL(`/${lang}${target}${url.search}`, url.origin).href,
      "Cache-Control": "private, no-store",
      Vary: "Accept-Language, Cookie",
    },
  });
}

// Volba z přepínače (cookie lang) má přednost. Jinak Accept-Language: slovenština padá
// k češtině, kdo nechce ani jeden z našich jazyků, dostane angličtinu. Bez hlavičky čeština.
function preferredLang(request) {
  const cookie = /(?:^|;\s*)lang=(cs|en|vi)(?:;|$)/.exec(request.headers.get("Cookie") || "");
  if (cookie) return cookie[1];

  const ranked = (request.headers.get("Accept-Language") || "")
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { lang: tag.trim().toLowerCase().split("-")[0], q: q ? Number(q.slice(2)) : 1 };
    })
    .filter((t) => t.lang && t.lang !== "*" && t.q > 0)
    .sort((a, b) => b.q - a.q);
  if (!ranked.length) return "cs";

  for (const { lang } of ranked) {
    if (lang === "cs" || lang === "sk") return "cs";
    if (LANGS.includes(lang)) return lang;
  }
  return "en";
}

// hlášky formuláře v jazyce stránky, ze které poptávka přišla (body.lang)
const POPTAVKA_ERRORS = {
  cs: {
    invalid: "Neplatný požadavek.",
    missing: "Vyplňte prosím jméno, e-mail i zprávu.",
    email: "Zadejte prosím platný e-mail.",
    failed: "Odeslání se nezdařilo. Napište prosím na info@indigostudio.cz.",
  },
  en: {
    invalid: "Invalid request.",
    missing: "Please fill in your name, email and message.",
    email: "Please enter a valid email address.",
    failed: "Sending failed. Please write to info@indigostudio.cz.",
  },
  vi: {
    invalid: "Yêu cầu không hợp lệ.",
    missing: "Vui lòng điền họ tên, email và nội dung tin nhắn.",
    email: "Vui lòng nhập địa chỉ email hợp lệ.",
    failed: "Gửi không thành công. Vui lòng viết thư tới info@indigostudio.cz.",
  },
};
// do e-mailu pro nás, ať je hned vidět, v jakém jazyce odpovědět
const LANG_NAMES = { cs: "čeština", en: "angličtina", vi: "vietnamština" };

async function handlePoptavka(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: POPTAVKA_ERRORS.cs.invalid }, 400);
  }

  const lang = LANGS.includes(body?.lang) ? body.lang : "cs";
  const t = POPTAVKA_ERRORS[lang];

  // honeypot — bot vyplní skryté pole; tváříme se, že je odesláno
  if (body && typeof body.company === "string" && body.company.trim() !== "") {
    return json({ ok: true });
  }

  const name = String(body?.name ?? "").trim().slice(0, 100);
  const email = String(body?.email ?? "").trim().replace(/[\r\n]/g, "").slice(0, 200);
  const message = String(body?.message ?? "").trim().slice(0, 5000);

  if (!name || !email || !message) return json({ error: t.missing }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: t.email }, 400);

  const ip = request.headers.get("CF-Connecting-IP") || "neznámá";

  try {
    // primární cesta: Resend HTTP API (nezávislé na MX → funguje i když poštu drží Zoho)
    if (env.RESEND_API_KEY) {
      await sendViaResend(env.RESEND_API_KEY, { name, email, message, ip, lang });
    } else {
      // fallback: Cloudflare send_email binding na ověřenou destinaci v Email Routingu
      const raw = buildEmail({ name, email, message, ip, lang, to: MAIL_TO_FALLBACK });
      await env.SEB.send(new EmailMessage(MAIL_FROM, MAIL_TO_FALLBACK, raw));
    }
  } catch (err) {
    console.log("poptavka send error:", err && err.message);
    return json({ error: t.failed }, 502);
  }

  return json({ ok: true });
}

// --- odeslání přes Resend (https://resend.com) ---
async function sendViaResend(apiKey, { name, email, message, ip, lang }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Indigo Studio <${MAIL_FROM}>`,
      to: [MAIL_TO],
      reply_to: `${name.replace(/[\r\n]/g, "")} <${email}>`,
      subject: buildSubject(name, lang),
      text: buildText({ name, email, message, ip, lang }),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${detail.slice(0, 300)}`);
  }
}

// --- text zprávy (sdílí Resend i CF fallback) ---
function buildSubject(name, lang) {
  return `Poptávka z webu — ${name}` + (lang === "cs" ? "" : ` [${lang.toUpperCase()}]`);
}

function buildText({ name, email, message, ip, lang }) {
  return (
    `Nová poptávka z indigostudio.cz\n\n` +
    `Jméno:  ${name}\n` +
    `E-mail: ${email}\n` +
    `Jazyk:  ${LANG_NAMES[lang]}\n\n` +
    `Zpráva:\n${message}\n\n` +
    `—\nOdesláno z webového formuláře, IP: ${ip}\n`
  );
}

// --- sestavení RFC822 zprávy pro CF send_email (UTF-8 bezpečně přes base64) ---
function buildEmail({ name, email, message, ip, lang, to }) {
  const subject = buildSubject(name, lang);
  const text = buildText({ name, email, message, ip, lang });

  const headers = [
    `From: Indigo Studio <${MAIL_FROM}>`,
    `To: ${to}`,
    `Reply-To: ${name.replace(/[\r\n]/g, "")} <${email}>`,
    `Subject: =?UTF-8?B?${b64Utf8(subject)}?=`,
    `Message-ID: <${crypto.randomUUID()}@indigostudio.cz>`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: base64`,
  ];

  return headers.join("\r\n") + "\r\n\r\n" + wrap76(b64Utf8(text)) + "\r\n";
}

function b64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function wrap76(s) {
  return s.replace(/.{1,76}/g, "$&\r\n").replace(/\r\n$/, "");
}
