// Statusboard mBlue — neveřejná ministránka pro tým: každý zařazuje funkce
// projektu do fází, vidí hlasy ostatních a společně se dojíždí ke shodě.
//
// Přihlášení je magic link (jednorázový odkaz s tokenem), oprávnění drží
// allowlist v `sb_members` — kdo v tabulce není, nedostane ani odkaz, ani obsah.
//
// Bot (`AI_EMAIL`) je členem týmu jako každý jiný: má vlastní hlasy v `sb_ratings`.
// ⚠️ Kontext, který dostane, je ZÁMĚRNĚ ÚZKÝ (zadání Dana 25. 8. 2026): checklist
// funkcí + soubory, které mu tým nahraje na stránce. Repozitářové markdowny,
// komentáře v kódu ani issues mu neposíláme — má se vyjádřit k tomu, co je vidět
// z produktu, ne převzít názor dev týmu.

import { EmailMessage } from "cloudflare:email";

import PAGE from "./statusboard.page.html";

const MAIL_FROM = "poptavka@indigostudio.cz";

const AI_EMAIL = "bot@statusboard";
const AI_NAME = "Bot";
const AI_MODEL = "claude-sonnet-5";

const SESSION_COOKIE = "sb_session";
const SESSION_DAYS = 30;
const MAGIC_MINUTES = 60;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

const TEXTUAL = /^(text\/|application\/json|application\/xml)/;

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const html = (body, status = 200) =>
  new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });

// ── pomocné ────────────────────────────────────────────────────────────────

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function readCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const iso = (date) => date.toISOString().slice(0, 19).replace("T", " ");

// ── přihlášení ─────────────────────────────────────────────────────────────

async function currentUser(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;

  const row = await env.DB.prepare(
    `SELECT s.email, m.name, m.role
       FROM sb_sessions s JOIN sb_members m ON m.email = s.email
      WHERE s.token = ?1 AND s.expires_at > datetime('now')`
  )
    .bind(await sha256(token))
    .first();

  return row || null;
}

async function consumeMagic(request, env, url) {
  const token = url.searchParams.get("token");
  if (!token) return loginPage("Odkaz je neúplný — chybí v něm token. Vyžádej si nový.", "err");

  const hashed = await sha256(token);
  const row = await env.DB.prepare(
    `SELECT email FROM sb_magic
      WHERE token = ?1 AND used_at IS NULL AND expires_at > datetime('now')`
  )
    .bind(hashed)
    .first();

  if (!row) return loginPage("Odkaz už byl použitý nebo vypršel. Vyžádej si nový.", "err");

  const member = await env.DB.prepare(`SELECT email FROM sb_members WHERE email = ?1`).bind(row.email).first();
  if (!member) return loginPage("Tenhle účet už na statusboard nemá přístup.", "err");

  const session = randomToken();
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);

  await env.DB.batch([
    env.DB.prepare(`UPDATE sb_magic SET used_at = datetime('now') WHERE token = ?1`).bind(hashed),
    env.DB.prepare(`INSERT INTO sb_sessions (token, email, expires_at) VALUES (?1, ?2, ?3)`).bind(
      await sha256(session),
      row.email,
      iso(expires)
    ),
  ]);

  return new Response(null, {
    status: 302,
    headers: {
      Location: "/statusboard",
      "Set-Cookie": `${SESSION_COOKIE}=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`,
    },
  });
}

async function logout(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) {
    await env.DB.prepare(`DELETE FROM sb_sessions WHERE token = ?1`).bind(await sha256(token)).run();
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/statusboard",
      "Set-Cookie": `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`,
    },
  });
}

function loginPage(message, tone = "info") {
  return html(
    `<title>Statusboard mBlue</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<style>
  :root { color-scheme: light dark; --ink: #0d1420; --muted: #64748b; --ground: #eef1f6; --surface: #fff;
          --line: #dbe2ed; --accent: #1746c8; --ok: #0f766e; --err: #b3261e; }
  @media (prefers-color-scheme: dark) { :root { --ink: #e6ecf6; --muted: #8695ab; --ground: #0a0e15;
          --surface: #121924; --line: #232e40; --accent: #7ba0ff; --ok: #4fd1c5; --err: #ff8a80; } }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--ground); color: var(--ink);
         font-family: "IBM Plex Sans", -apple-system, "Segoe UI", sans-serif; padding: 1.5rem; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 2rem; max-width: 30rem; width: 100%; }
  h1 { font-size: 1.35rem; margin: 0 0 .5rem; letter-spacing: -.02em; }
  p { color: var(--muted); font-size: .9rem; line-height: 1.55; margin: .4rem 0; }
  p.msg { color: var(--ink); }
  p.msg[data-tone="ok"] { color: var(--ok); }
  p.msg[data-tone="err"] { color: var(--err); }
  form { display: flex; gap: .5rem; margin: 1.1rem 0 .3rem; flex-wrap: wrap; }
  input { flex: 1 1 14rem; background: transparent; color: var(--ink); border: 1px solid var(--line);
          border-radius: 8px; padding: .55rem .7rem; font: inherit; font-size: .9rem; }
  input:focus { outline: 2px solid var(--accent); outline-offset: 1px; }
  button { background: var(--accent); color: #fff; border: 0; border-radius: 8px; padding: .55rem 1rem;
           font: inherit; font-size: .9rem; font-weight: 600; cursor: pointer; }
  button:disabled { opacity: .6; cursor: default; }
  .note { font-size: .8rem; }
</style>
<div class="card">
  <h1>Statusboard mBlue</h1>
  <p class="msg" data-tone="${tone}">${escapeHtml(message)}</p>
  <form id="f" novalidate>
    <input id="email" type="email" name="email" placeholder="tvůj e-mail" autocomplete="email" required>
    <button type="submit">Poslat přihlašovací odkaz</button>
  </form>
  <p class="note" id="out">Odkaz platí hodinu a použije se jednou. Chodí jen na adresy, které jsou v týmu projektu.</p>
</div>
<script>
  var form = document.getElementById('f');
  var out = document.getElementById('out');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = document.getElementById('email').value.trim();
    if (!email) return;
    var btn = form.querySelector('button');
    btn.disabled = true;
    out.textContent = 'Odesílám…';
    fetch('/api/statusboard/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email })
    }).then(function (r) { return r.json(); }).then(function (res) {
      out.textContent = res.message || 'Pokud je adresa v týmu, odkaz je na cestě.';
      btn.disabled = false;
    }).catch(function () {
      out.textContent = 'Odeslání se nepodařilo. Zkus to za chvíli znovu.';
      btn.disabled = false;
    });
  });
</script>`,
    401
  );
}

// Odkaz si vyžádá člověk sám zadáním e-mailu. Odpověď je vždycky stejná — jestli
// adresa v týmu je, nebo není, se z ní poznat nesmí.
async function requestMagic(request, env, url) {
  const NEUTRAL = "Pokud je adresa v týmu, odkaz je na cestě. Zkontroluj i spam.";

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ message: NEUTRAL });
  }

  const email = String(body?.email || "").toLowerCase().trim().slice(0, 200);
  if (!email || !email.includes("@")) return json({ message: NEUTRAL });

  const member = await env.DB.prepare(`SELECT email, name FROM sb_members WHERE email = ?1`).bind(email).first();
  if (!member || member.email === AI_EMAIL) return json({ message: NEUTRAL });

  // Brzda proti opakovanému rozesílání na tutéž adresu.
  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM sb_magic WHERE email = ?1 AND created_at > datetime('now', '-10 minutes')`
  )
    .bind(email)
    .first();
  if ((recent?.n || 0) >= 5) {
    return json({ message: "Odkazů už bylo posláno hodně. Zkus to za deset minut." });
  }

  const token = randomToken();
  await env.DB.prepare(`INSERT INTO sb_magic (token, email, expires_at) VALUES (?1, ?2, ?3)`)
    .bind(await sha256(token), email, iso(new Date(Date.now() + MAGIC_MINUTES * 60000)))
    .run();

  const link = `${url.origin}/statusboard/vstup?token=${token}`;

  try {
    await sendMagicLink(env, { email, name: member.name, link });
  } catch (err) {
    console.log("magic link send error:", err && err.message);
    return json({ message: "Odkaz se nepodařilo odeslat. Napiš Danovi, pošle ti ho ručně." });
  }

  return json({ message: NEUTRAL });
}

async function sendMagicLink(env, { email, name, link }) {
  const subject = "Přihlášení na statusboard mBlue";
  const text =
    `Ahoj ${name},\n\n` +
    `tady je tvůj přihlašovací odkaz na statusboard mBlue:\n\n${link}\n\n` +
    `Platí hodinu a použije se jednou. Když si ho nevyžádal, nic nedělej.\n`;

  if (env.RESEND_API_KEY) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Statusboard mBlue <poptavka@indigostudio.cz>",
        to: [email],
        subject,
        text,
      }),
    });
    if (!res.ok) throw new Error(`Resend ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);
    return;
  }

  // Bez Resendu zbývá Cloudflare send_email — ten doručí jen na adresy ověřené
  // v Email Routingu (dnes prakticky jen Danova). Ostatním se odkaz vygeneruje,
  // ale rozeslat ho musí admin přes /api/statusboard/admin/invite.
  if (!env.SEB) throw new Error("není nastavena cesta k odesílání pošty");

  const message =
    [
      `From: Statusboard mBlue <${MAIL_FROM}>`,
      `To: ${email}`,
      `Subject: =?UTF-8?B?${btoa(String.fromCharCode(...new TextEncoder().encode(subject)))}?=`,
      `Message-ID: <${crypto.randomUUID()}@indigostudio.cz>`,
      `Date: ${new Date().toUTCString()}`,
      "MIME-Version: 1.0",
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: base64",
    ].join("\r\n") +
    "\r\n\r\n" +
    btoa(String.fromCharCode(...new TextEncoder().encode(text))).replace(/.{1,76}/g, "$&\r\n");

  await env.SEB.send(new EmailMessage(MAIL_FROM, email, message));
}

// ── data pro stránku ───────────────────────────────────────────────────────

async function stateResponse(env) {
  const members = await env.DB.prepare(`SELECT email, name, role FROM sb_members ORDER BY name`).all();
  const ratings = await env.DB.prepare(
    `SELECT r.email, m.name, r.item_id, r.phase, r.weight, r.scope, r.updated_at
       FROM sb_ratings r LEFT JOIN sb_members m ON m.email = r.email`
  ).all();
  const notes = await env.DB.prepare(`SELECT item_id, reason FROM sb_ai_notes`).all();
  const files = await env.DB.prepare(
    `SELECT id, name, mime, size, uploaded_by, created_at FROM sb_files ORDER BY created_at DESC`
  ).all();

  return json({
    members: members.results || [],
    ratings: ratings.results || [],
    ai_notes: notes.results || [],
    files: files.results || [],
  });
}

async function saveRatings(request, env, user) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Neplatný požadavek." }, 400);
  }

  const rows = Array.isArray(body?.ratings) ? body.ratings.slice(0, 500) : [];
  if (!rows.length) return json({ error: "Nepřišlo nic k uložení." }, 400);

  const stmts = rows
    .filter((r) => typeof r?.item === "string" && r.item.length <= 40)
    .map((r) =>
      env.DB.prepare(
        `INSERT INTO sb_ratings (email, item_id, phase, weight, scope, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
         ON CONFLICT(email, item_id) DO UPDATE
            SET phase = excluded.phase, weight = excluded.weight,
                scope = excluded.scope, updated_at = datetime('now')`
      ).bind(
        user.email,
        r.item,
        r.phase ?? null,
        Number.isInteger(r.weight) ? r.weight : null,
        r.scope === null || r.scope === undefined ? null : r.scope ? 1 : 0
      )
    );

  if (!stmts.length) return json({ error: "Nepřišlo nic platného." }, 400);

  await env.DB.batch(stmts);
  return json({ ok: true, saved: stmts.length });
}

// ── podklady ───────────────────────────────────────────────────────────────

async function uploadFile(request, env, user) {
  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") return json({ error: "Chybí soubor." }, 400);
  if (file.size > MAX_FILE_BYTES) return json({ error: "Soubor je větší než 8 MB." }, 413);

  const id = randomToken().slice(0, 24);
  const key = `podklady/${id}`;
  const buffer = await file.arrayBuffer();

  await env.FILES.put(key, buffer, { httpMetadata: { contentType: file.type || "application/octet-stream" } });

  // Textové formáty si rovnou uložíme jako text — bot pak nemusí sahat do R2.
  let text = null;
  const mime = file.type || "";
  if (TEXTUAL.test(mime) || /\.(md|txt|csv|json)$/i.test(file.name)) {
    text = new TextDecoder().decode(buffer).slice(0, 120000);
  }

  await env.DB.prepare(
    `INSERT INTO sb_files (id, name, mime, size, r2_key, text, uploaded_by) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
  )
    .bind(id, file.name.slice(0, 200), mime, file.size, key, text, user.email)
    .run();

  return json({ ok: true, id, name: file.name, size: file.size, mime, uploaded_by: user.email });
}

async function deleteFile(env, id) {
  const row = await env.DB.prepare(`SELECT r2_key FROM sb_files WHERE id = ?1`).bind(id).first();
  if (!row) return json({ error: "Soubor neexistuje." }, 404);
  await env.FILES.delete(row.r2_key);
  await env.DB.prepare(`DELETE FROM sb_files WHERE id = ?1`).bind(id).run();
  return json({ ok: true });
}

async function downloadFile(env, id) {
  const row = await env.DB.prepare(`SELECT name, mime, r2_key FROM sb_files WHERE id = ?1`).bind(id).first();
  if (!row) return new Response("Nenalezeno", { status: 404 });
  const obj = await env.FILES.get(row.r2_key);
  if (!obj) return new Response("Soubor už v úložišti není", { status: 404 });
  return new Response(obj.body, {
    headers: {
      "Content-Type": row.mime || "application/octet-stream",
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(row.name)}`,
      "Cache-Control": "no-store",
    },
  });
}

// ── bot ────────────────────────────────────────────────────────────────────

const AI_SYSTEM = `Jsi člen týmu, který posuzuje rozsah softwarového projektu mBlue —
custom CRM/ATS, který nahrazuje patnáct let starý systém Atollon u české HR agentury.

Tvoje role: řekni vlastní názor na to, co patří do první fáze, aby šel starý systém co
nejdřív vypnout, a co se má odložit. Původní odhad byl 1 200 hodin, odpracováno je 900.

Dostaneš seznam funkcí se zjištěným stavem (hotovo / rozdělané / chybí) a případně
podklady, které tým nahrál. NEDOSTÁVÁŠ zdrojový kód, komentáře ani interní dokumentaci —
je to záměr. Posuzuj z pohledu člověka, který se dívá na produkt a na to, co dává
obchodní smysl, ne z pohledu vývojáře.

Ke každé položce vrať:
- phase: "jadro" (musí být hotové před vypnutím Atollonu), "pak" (hned po nasazení),
  "pozdeji" (další fáze), nebo "skrt" (nedělat vůbec)
- weight: 0-9, kde 0 = nemá hodnotu, 9 = jádro produktu
- scope: true, pokud to podle tebe je práce nad rámec náhrady původního systému
- reason: jedna věta česky, proč sis to takhle zařadil. Bez omáčky, konkrétně.

Buď přísný. Cílem je nejmenší možné jádro, se kterým firma může fungovat.`;

async function askAi(request, env, user) {
  if (!env.ANTHROPIC_API_KEY) {
    return json({ error: "Bot zatím nemá klíč k Anthropic API. Nastav secret ANTHROPIC_API_KEY." }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Neplatný požadavek." }, 400);
  }

  const items = Array.isArray(body?.items) ? body.items.slice(0, 40) : [];
  if (!items.length) return json({ error: "Nepřišly žádné položky k posouzení." }, 400);

  const files = await env.DB.prepare(
    `SELECT name, text FROM sb_files WHERE text IS NOT NULL ORDER BY created_at DESC LIMIT 6`
  ).all();

  const podklady = (files.results || [])
    .map((f) => `--- ${f.name} ---\n${String(f.text).slice(0, 20000)}`)
    .join("\n\n");

  const seznam = items
    .map((i) => `${i.id} | ${i.title} | stav: ${i.state} | blok: ${i.block}${i.desc ? ` | ${i.desc}` : ""}`)
    .join("\n");

  const prompt =
    (podklady ? `Podklady od týmu:\n\n${podklady}\n\n` : "") +
    `Posuď těchto ${items.length} položek. Vrať POUZE JSON pole, každý prvek ` +
    `{"id":"…","phase":"jadro|pak|pozdeji|skrt","weight":0-9,"scope":true|false,"reason":"…"}.\n\n` +
    seznam;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 8000,
      system: AI_SYSTEM,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    return json({ error: `Anthropic API vrátilo ${res.status}`, detail: detail.slice(0, 400) }, 502);
  }

  const data = await res.json();
  const text = (data.content || []).map((c) => c.text || "").join("");
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return json({ error: "Bot neodpověděl ve formátu, který umíme uložit." }, 502);

  let verdicts;
  try {
    verdicts = JSON.parse(match[0]);
  } catch {
    return json({ error: "Odpověď bota se nepodařilo přečíst." }, 502);
  }

  const stmts = [];
  for (const v of verdicts) {
    if (!v || typeof v.id !== "string") continue;
    stmts.push(
      env.DB.prepare(
        `INSERT INTO sb_ratings (email, item_id, phase, weight, scope, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, datetime('now'))
         ON CONFLICT(email, item_id) DO UPDATE
            SET phase = excluded.phase, weight = excluded.weight,
                scope = excluded.scope, updated_at = datetime('now')`
      ).bind(AI_EMAIL, v.id, v.phase || null, Number.isInteger(v.weight) ? v.weight : null, v.scope ? 1 : 0)
    );
    if (v.reason) {
      stmts.push(
        env.DB.prepare(
          `INSERT INTO sb_ai_notes (item_id, reason, model, created_at)
           VALUES (?1, ?2, ?3, datetime('now'))
           ON CONFLICT(item_id) DO UPDATE SET reason = excluded.reason, model = excluded.model, created_at = datetime('now')`
        ).bind(v.id, String(v.reason).slice(0, 600), AI_MODEL)
      );
    }
  }

  if (stmts.length) await env.DB.batch(stmts);

  return json({ ok: true, judged: verdicts.length, by: user.email });
}

// ── správa členů (jen admin) ───────────────────────────────────────────────

async function adminMembers(request, env) {
  if (request.method === "GET") {
    const rows = await env.DB.prepare(`SELECT email, name, role, created_at FROM sb_members ORDER BY name`).all();
    return json({ members: rows.results || [] });
  }

  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.name) return json({ error: "Chybí e-mail nebo jméno." }, 400);

  await env.DB.prepare(
    `INSERT INTO sb_members (email, name, role) VALUES (?1, ?2, ?3)
     ON CONFLICT(email) DO UPDATE SET name = excluded.name, role = excluded.role`
  )
    .bind(String(body.email).toLowerCase().trim(), String(body.name).trim(), body.role === "admin" ? "admin" : "member")
    .run();

  return json({ ok: true });
}

// Vyrobí jednorázové odkazy pro všechny členy (nebo pro jednoho) — admin je pak
// rozešle sám. Tokeny se vracejí jen tady a v DB leží jen jejich otisk.
async function adminInvite(request, env, url) {
  const only = url.searchParams.get("email");
  const rows = await env.DB.prepare(
    only ? `SELECT email, name FROM sb_members WHERE email = ?1` : `SELECT email, name FROM sb_members ORDER BY name`
  )
    .bind(...(only ? [only.toLowerCase()] : []))
    .all();

  const origin = url.origin;
  const out = [];
  const stmts = [];

  for (const m of rows.results || []) {
    if (m.email === AI_EMAIL) continue;
    const token = randomToken();
    stmts.push(
      env.DB.prepare(`INSERT INTO sb_magic (token, email, expires_at) VALUES (?1, ?2, ?3)`).bind(
        await sha256(token),
        m.email,
        iso(new Date(Date.now() + MAGIC_MINUTES * 60000))
      )
    );
    out.push({ email: m.email, name: m.name, link: `${origin}/statusboard/vstup?token=${token}` });
  }

  if (stmts.length) await env.DB.batch(stmts);

  return json({ links: out, platnost_minut: MAGIC_MINUTES });
}

function adminAuthorized(request, env) {
  const header = request.headers.get("X-Admin-Token") || "";
  return env.STATUSBOARD_ADMIN_TOKEN && header === env.STATUSBOARD_ADMIN_TOKEN;
}

// ── router ─────────────────────────────────────────────────────────────────

export async function handleStatusboard(request, env, url) {
  const path = url.pathname;

  // Admin cesty jedou na sdílený token, ne na session — používá je Dan z terminálu.
  if (path.startsWith("/api/statusboard/admin/")) {
    if (!adminAuthorized(request, env)) return json({ error: "Nepovoleno." }, 403);
    if (path === "/api/statusboard/admin/invite") return adminInvite(request, env, url);
    if (path === "/api/statusboard/admin/members") return adminMembers(request, env);
    return json({ error: "Neznámá admin akce." }, 404);
  }

  if (path === "/api/statusboard/login" && request.method === "POST") {
    const origin = request.headers.get("Origin");
    if (origin && new URL(origin).host !== url.host) return json({ error: "Cizí původ požadavku." }, 403);
    return requestMagic(request, env, url);
  }

  if (path === "/statusboard/vstup") return consumeMagic(request, env, url);
  if (path === "/statusboard/odhlasit") return logout(request, env);

  const user = await currentUser(request, env);
  if (!user) {
    if (path.startsWith("/api/")) return json({ error: "Nepřihlášeno." }, 401);
    return loginPage("Zadej e-mail a přijde ti přihlašovací odkaz.");
  }

  // Zápisové akce jen ze stránky samotné (jednoduchá CSRF pojistka).
  if (request.method !== "GET") {
    const origin = request.headers.get("Origin");
    if (origin && new URL(origin).host !== url.host) return json({ error: "Cizí původ požadavku." }, 403);
  }

  if (path === "/api/statusboard/state") return stateResponse(env);
  if (path === "/api/statusboard/rate" && request.method === "POST") return saveRatings(request, env, user);
  if (path === "/api/statusboard/files" && request.method === "POST") return uploadFile(request, env, user);
  if (path.startsWith("/api/statusboard/files/") && request.method === "DELETE") {
    return deleteFile(env, path.split("/").pop());
  }
  if (path.startsWith("/statusboard/soubor/")) return downloadFile(env, path.split("/").pop());
  if (path === "/api/statusboard/ai" && request.method === "POST") return askAi(request, env, user);

  if (path === "/statusboard" || path === "/statusboard/") {
    const me = JSON.stringify({ email: user.email, name: user.name, role: user.role });
    return html(`<script>window.SB_ME = ${me};</script>\n${PAGE}`);
  }

  return new Response("Nenalezeno", { status: 404 });
}

export const STATUSBOARD_AI_EMAIL = AI_EMAIL;
export const STATUSBOARD_AI_NAME = AI_NAME;
