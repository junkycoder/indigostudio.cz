// src/optout.js
// Worker handler GET /odhlasit?t=<token> — opt-out endpoint.
// Per design.md § 3.3 + tasks.md TASK-09 + risk-check.md § 5.1.
//
// Pravidla:
//   * Validace `t` formátu (64 hex). Fail → 200 generic stránka (NE 400/404),
//     aby útočník neviděl jestli token "vypadá platně" nebo ne.
//   * Lookup v D1: pokud nenalezen → 200 generic stránka (NE leak existence).
//   * Pokud nalezen a status != 'opted_out' → UPDATE + ctx.waitUntil(sendMail).
//   * Pokud nalezen a už `opted_out` → idempotentně render stránku, žádný UPDATE,
//     žádný duplicitní mail.
//   * DB error → 503 s lidskou hláškou.
//   * Žádné cookies, žádný Set-Cookie. Cache-Control: no-store. noindex meta.
//
// Routing tohohle handleru řeší TASK-10 (úprava src/worker.js + wrangler.toml).
// Tento modul jen exportuje `handleOptout`.

import { sendMail } from './lib/mail.js';

const TOKEN_RE = /^[a-f0-9]{64}$/;

/**
 * Hlavní handler. Vrací vždy `Response`. Nikdy netrhne — DB chybu
 * převádí na 503 stránku, ostatní chyby na 200 generic (security).
 *
 * @param {Request} request
 * @param {{ DB: D1Database, EMAIL?: any }} env
 * @param {{ waitUntil: (p: Promise<any>) => void }} ctx
 * @returns {Promise<Response>}
 */
export async function handleOptout(request, env, ctx) {
  const url = new URL(request.url);
  const token = url.searchParams.get('t');

  // 1) Formátová validace tokenu. Vše co neodpovídá formátu → generic stránka.
  // Per risk-check § 5.4 + design § 8: nesmíme dát útočníkovi signál.
  if (!token || !TOKEN_RE.test(token)) {
    return renderDonePage();
  }

  // 2) Lookup v D1. DB error → 503 s česky lidskou hláškou (per AC).
  let row;
  try {
    row = await env.DB
      .prepare('SELECT id, email, status FROM leads WHERE unsubscribe_token = ? LIMIT 1')
      .bind(token)
      .first();
  } catch (err) {
    console.error('[optout] DB lookup failed', err);
    return renderTempErrorPage();
  }

  // 3) Token nenalezen → render generic stránku jako by nalezen byl.
  // (Bez DB write, bez mailu.)
  if (!row) {
    return renderDonePage();
  }

  // 4) Idempotence: pokud už opted_out, jen render stránku, NIC neupdatovat
  // a NEPOSÍLAT druhý confirmation mail.
  if (row.status === 'opted_out') {
    return renderDonePage();
  }

  // 5) Update + odeslání confirmation mailu (paralelně, neblokuje response).
  const nowIso = new Date().toISOString();
  try {
    await env.DB
      .prepare('UPDATE leads SET status = ?, opted_out_at = ?, last_contact_at = ? WHERE id = ?')
      .bind('opted_out', nowIso, nowIso, row.id)
      .run();
  } catch (err) {
    console.error('[optout] DB update failed', err);
    return renderTempErrorPage();
  }

  // optout-confirmation šablona chce čas v "HH:MM" (per src/email/optout-confirmation.js).
  const optedOutTime = nowIso.slice(11, 16); // ISO "2026-05-08T14:30:00.000Z" → "14:30"

  // ctx.waitUntil prodlouží životnost requestu, aby mail stihl odejít,
  // ale neblokuje response uživateli.
  if (ctx && typeof ctx.waitUntil === 'function') {
    ctx.waitUntil(
      sendMail({
        env,
        template: 'optout-confirmation',
        to: row.email,
        vars: { email: row.email, opted_out_at: optedOutTime },
      }).catch((err) => {
        // sendMail sám nikdy netrhne, ale safety net.
        console.error('[optout] sendMail crashed', err);
      })
    );
  }

  return renderDonePage();
}

// --- HTML rendery ------------------------------------------------------------

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store, max-age=0',
  // Žádný Set-Cookie. Žádný third-party origin.
};

/**
 * Generic „odhlášeno" stránka. Vrací se i pro neplatný token, neexistující
 * token i úspěšný opt-out — uživatel nepozná rozdíl (security).
 *
 * Inline CSS, brand barvy z fakan.cz/index.html, dark mode přes
 * prefers-color-scheme. Vykání per copy.md.
 */
function renderDonePage() {
  return new Response(DONE_HTML, { status: 200, headers: HTML_HEADERS });
}

/**
 * Stránka pro DB chybu. 503 + lidská česká hláška.
 */
function renderTempErrorPage() {
  return new Response(TEMP_ERROR_HTML, { status: 503, headers: HTML_HEADERS });
}

const DONE_HTML = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#0B1221" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#F9F6F0" media="(prefers-color-scheme: light)">
<title>Odhlášeno — Fakan</title>
<style>
  :root { --bg:#F9F6F0; --fg:#0B1221; --muted:#6B7280; --border:#E2E8F0; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0B1221; --fg:#F9F6F0; --muted:#94A3B8; --border:#1F2937; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; line-height:1.5; }
  main { max-width:560px; margin:0 auto; padding:64px 24px 32px; }
  h1 { font-size:28px; line-height:1.2; margin:0 0 16px; }
  p { margin:0 0 16px; }
  a { color:var(--fg); }
  .muted { color:var(--muted); font-size:14px; }
  .back { display:inline-block; margin-top:8px; }
  footer { border-top:1px solid var(--border); margin-top:48px; padding:24px; text-align:center; color:var(--muted); font-size:13px; }
</style>
</head>
<body>
<main>
  <h1>Hotovo, odhlásili jsme vás.</h1>
  <p>Z naší strany už od nás žádný e-mail nepřijde. Pokud byste chtěl něco jiného, ozvěte se nám na <a href="mailto:jsem@fakan.cz">jsem@fakan.cz</a>.</p>
  <p><a class="back" href="/">← Zpět na fakan.cz</a></p>
</main>
<footer>
  &copy; 2026 fakan.cz &middot; provozuje Indigo Studio s.r.o.
</footer>
</body>
</html>`;

const TEMP_ERROR_HTML = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Dočasná chyba — Fakan</title>
<style>
  :root { --bg:#F9F6F0; --fg:#0B1221; --muted:#6B7280; --border:#E2E8F0; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0B1221; --fg:#F9F6F0; --muted:#94A3B8; --border:#1F2937; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; line-height:1.5; }
  main { max-width:560px; margin:0 auto; padding:64px 24px 32px; }
  h1 { font-size:28px; line-height:1.2; margin:0 0 16px; }
  p { margin:0 0 16px; }
  a { color:var(--fg); }
  .muted { color:var(--muted); font-size:14px; }
  footer { border-top:1px solid var(--border); margin-top:48px; padding:24px; text-align:center; color:var(--muted); font-size:13px; }
</style>
</head>
<body>
<main>
  <h1>Dočasná chyba.</h1>
  <p>Zkuste to prosím znovu za pár minut. Pokud to nepůjde, napište nám na <a href="mailto:jsem@fakan.cz">jsem@fakan.cz</a> a odhlásíme vás ručně.</p>
</main>
<footer>
  &copy; 2026 fakan.cz &middot; provozuje Indigo Studio s.r.o.
</footer>
</body>
</html>`;
