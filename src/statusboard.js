// Statusboard mBlue — neveřejná ministránka pro tým: každý zařazuje funkce
// projektu do fází, vidí hlasy ostatních a společně se dojíždí ke shodě.
//
// Přihlášení je magic link (jednorázový odkaz s tokenem), oprávnění drží
// allowlist v `sb_members` — kdo v tabulce není, nedostane ani odkaz, ani obsah.

import { EmailMessage } from "cloudflare:email";

import PAGE from "./statusboard.page.html";

const MAIL_FROM = "poptavka@indigostudio.cz";

const SESSION_COOKIE = "sb_session";
const SESSION_DAYS = 30;
// Hodina stačí, když odkaz chodí mailem. Dokud se rozesílá ručně (bez
// RESEND_API_KEY), musí přežít, než si ho člověk přečte ve Slacku nebo v mailu
// od Dana — proto dva dny.
const MAGIC_MINUTES = 60 * 48;
// Jak dlouho se změny téže položky od téhož člověka slévají do jednoho záznamu.
const MERGE_WINDOW_SECONDS = 60;

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
  if (!member) return json({ message: NEUTRAL });

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
    `SELECT r.email, m.name, r.item_id, r.phase, r.weight, r.scope, r.pct, r.effort, r.nice, r.unsure, r.updated_at
       FROM sb_ratings r LEFT JOIN sb_members m ON m.email = r.email`
  ).all();
  return json({
    members: members.results || [],
    ratings: ratings.results || [],
  });
}

// Historie změn — buď posledních N napříč týmem (panel), nebo celá historie
// jedné položky (rozbalení v řádku).
async function historyResponse(env, url) {
  const item = url.searchParams.get("item");
  const email = url.searchParams.get("email");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 200, 500);

  const where = [];
  const binds = [];
  if (item) {
    where.push(`h.item_id = ?${binds.length + 1}`);
    binds.push(item);
  }
  if (email) {
    where.push(`h.email = ?${binds.length + 1}`);
    binds.push(email);
  }

  const rows = await env.DB.prepare(
    `SELECT h.id, h.email, m.name, h.item_id, h.phase_from, h.phase_to,
            h.weight_from, h.weight_to, h.scope_from, h.scope_to,
            h.pct_from, h.pct_to, h.effort_from, h.effort_to, h.nice_from, h.nice_to, h.unsure_from, h.unsure_to, h.changed_at
       FROM sb_history h LEFT JOIN sb_members m ON m.email = h.email
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY h.changed_at DESC, h.id DESC
      LIMIT ?${binds.length + 1}`
  )
    .bind(...binds, limit)
    .all();

  return json({ history: rows.results || [] });
}

async function saveRatings(request, env, user) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Neplatný požadavek." }, 400);
  }

  const rows = (Array.isArray(body?.ratings) ? body.ratings.slice(0, 500) : []).filter(
    (r) => typeof r?.item === "string" && r.item.length <= 40
  );
  if (!rows.length) return json({ error: "Nepřišlo nic k uložení." }, 400);

  // Stav před zápisem — z něj se skládá řádek historie. Jeden dotaz na celou
  // dávku, ne dotaz na položku: bulk akce jich posílá klidně sto najednou.
  const ids = rows.map((r) => r.item);
  const placeholders = ids.map((_, i) => `?${i + 2}`).join(", ");
  const before = await env.DB.prepare(
    `SELECT item_id, phase, weight, scope, pct, effort, nice, unsure FROM sb_ratings WHERE email = ?1 AND item_id IN (${placeholders})`
  )
    .bind(user.email, ...ids)
    .all();

  const prev = {};
  (before.results || []).forEach((row) => {
    prev[row.item_id] = row;
  });

  // Klikání se slévá: dokud je poslední záznam historie mladší než minuta,
  // přepisuje se místo zakládání nového. Kdo si během půl minuty rozmyslí fázi
  // třikrát, má v historii jednu změnu z původní hodnoty na konečnou — a když
  // skončí tam, kde začal, záznam se smaže úplně.
  const recent = await env.DB.prepare(
    `SELECT id, item_id, phase_from, weight_from, scope_from, pct_from, effort_from, nice_from, unsure_from
       FROM sb_history
      WHERE email = ?1 AND item_id IN (${placeholders})
        AND changed_at > datetime('now', '-${MERGE_WINDOW_SECONDS} seconds')
      ORDER BY id DESC`
  )
    .bind(user.email, ...ids)
    .all();

  const openEntry = {};
  (recent.results || []).forEach((row) => {
    if (!openEntry[row.item_id]) openEntry[row.item_id] = row;
  });

  const stmts = [];

  for (const r of rows) {
    const phase = r.phase ?? null;
    const weight = Number.isInteger(r.weight) ? r.weight : null;
    const scope = r.scope === null || r.scope === undefined ? null : r.scope ? 1 : 0;
    // Procento drží celé číslo 0–100; cokoli mimo rozsah je chyba klienta, ne
    // hodnota k uložení.
    const pct =
      Number.isInteger(r.pct) && r.pct >= 0 && r.pct <= 100 ? r.pct : null;
    // Náročnost je v hodinách; strop je tu proti překlepu, ne proti realitě.
    const effort =
      Number.isInteger(r.effort) && r.effort >= 0 && r.effort <= 500 ? r.effort : null;
    const nice = r.nice === null || r.nice === undefined ? null : r.nice ? 1 : 0;
    const unsure = r.unsure === null || r.unsure === undefined ? null : r.unsure ? 1 : 0;
    const was = prev[r.item] || {
      phase: null, weight: null, scope: null, pct: null, effort: null, nice: null, unsure: null
    };

    stmts.push(
      env.DB.prepare(
        `INSERT INTO sb_ratings (email, item_id, phase, weight, scope, pct, effort, nice, unsure, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, datetime('now'))
         ON CONFLICT(email, item_id) DO UPDATE
            SET phase = excluded.phase, weight = excluded.weight,
                scope = excluded.scope, pct = excluded.pct,
                effort = excluded.effort, nice = excluded.nice,
                unsure = excluded.unsure, updated_at = datetime('now')`
      ).bind(user.email, r.item, phase, weight, scope, pct, effort, nice, unsure)
    );

    // Zápis, který nic nemění (druhý klik na tutéž hodnotu, autosave beze změny),
    // do historie nepatří — jinak by ji zaplavil šum.
    const same =
      (was.phase ?? null) === phase &&
      (was.weight ?? null) === weight &&
      (was.scope ?? null) === scope &&
      (was.pct ?? null) === pct &&
      (was.effort ?? null) === effort &&
      (was.nice ?? null) === nice &&
      (was.unsure ?? null) === unsure;
    if (same) continue;

    const open = openEntry[r.item];

    if (open) {
      // Vrátil se přesně tam, kde záznam začínal? Pak se nic nestalo.
      const backToStart =
        (open.phase_from ?? null) === phase &&
        (open.weight_from ?? null) === weight &&
        (open.scope_from ?? null) === scope &&
        (open.pct_from ?? null) === pct &&
        (open.effort_from ?? null) === effort &&
        (open.nice_from ?? null) === nice &&
        (open.unsure_from ?? null) === unsure;

      stmts.push(
        backToStart
          ? env.DB.prepare(`DELETE FROM sb_history WHERE id = ?1`).bind(open.id)
          : env.DB.prepare(
              `UPDATE sb_history
                  SET phase_to = ?2, weight_to = ?3, scope_to = ?4, pct_to = ?5,
                      effort_to = ?6, nice_to = ?7, unsure_to = ?8, changed_at = datetime('now')
                WHERE id = ?1`
            ).bind(open.id, phase, weight, scope, pct, effort, nice, unsure)
      );
      continue;
    }

    stmts.push(
      env.DB.prepare(
        `INSERT INTO sb_history
           (email, item_id, phase_from, phase_to, weight_from, weight_to,
            scope_from, scope_to, pct_from, pct_to, effort_from, effort_to,
            nice_from, nice_to, unsure_from, unsure_to)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)`
      ).bind(
        user.email,
        r.item,
        was.phase ?? null,
        phase,
        was.weight ?? null,
        weight,
        was.scope ?? null,
        scope,
        was.pct ?? null,
        pct,
        was.effort ?? null,
        effort,
        was.nice ?? null,
        nice,
        was.unsure ?? null,
        unsure
      )
    );
  }

  await env.DB.batch(stmts);
  return json({ ok: true, saved: rows.length });
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
  if (path === "/api/statusboard/history") return historyResponse(env, url);
  if (path === "/statusboard" || path === "/statusboard/") {
    const me = JSON.stringify({ email: user.email, name: user.name, role: user.role });
    return html(`<script>window.SB_ME = ${me};</script>\n${PAGE}`);
  }

  return new Response("Nenalezeno", { status: 404 });
}
