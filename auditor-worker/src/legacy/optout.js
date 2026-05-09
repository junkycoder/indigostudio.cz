// src/legacy/optout.js
// Sjednocený opt-out handler pro celý fakan.cz.
//
// Zachytává:
//   /odhlasit/{token}        — nové hezké URL
//   /odhlasit?t=<token>      — legacy z fakan-cz (analyze flow)
//   /odhlasit?token=<token>  — varianta
//   /unsubscribe?token=...   — List-Unsubscribe header z auditor mailů
//
// Dva DB binding:
//   env.DB         — fakan_auditor.leads.unsub_token (32 hex)
//   env.LEGACY_DB  — fakan_leads.leads.unsubscribe_token (64 hex), z dávných mailů
//
// Pravidla (z původního design.md § 3.3 + risk-check § 5.1):
//   * Validace formátu tokenu. Fail → 200 generic stránka (NE 400/404),
//     aby útočník neviděl jestli token "vypadá platně" nebo ne.
//   * Token nenalezen v žádné DB → 200 generic (NE leak existence).
//   * Auditor flow: UPDATE status='unsubscribed', bez confirmation mailu.
//   * Legacy flow:  UPDATE status='opted_out', + confirmation mail (zachované chování).
//   * DB error → 503 s lidskou hláškou.
//   * Žádné cookies. Cache-Control: no-store. noindex meta.

import { sendMail } from './lib/mail.js';

const TOKEN_RE = /^[a-f0-9]{32,64}$/;

/**
 * Hlavní handler. Vrací vždy `Response`. Nikdy netrhne.
 *
 * @param {Request} request
 * @param {{ DB: D1Database, LEGACY_DB?: D1Database, EMAIL?: any }} env
 * @param {{ waitUntil: (p: Promise<any>) => void }} ctx
 * @returns {Promise<Response>}
 */
export async function handleOptout(request, env, ctx) {
  const url = new URL(request.url);
  const token = extractToken(url);

  // 1) Formátová validace. Vše co neodpovídá → generic stránka (security).
  if (!token || !TOKEN_RE.test(token)) {
    return renderDonePage();
  }

  // 2) Auditor DB (běžný případ — všechny nové leady)
  try {
    const row = await env.DB
      .prepare('SELECT id, email, status FROM leads WHERE unsub_token = ? LIMIT 1')
      .bind(token)
      .first();

    if (row) {
      if (row.status !== 'unsubscribed') {
        await env.DB
          .prepare(`UPDATE leads SET status = 'unsubscribed' WHERE id = ?`)
          .bind(row.id)
          .run();
      }
      return renderDonePage();
    }
  } catch (err) {
    console.error('[optout] auditor DB lookup failed', err);
    return renderTempErrorPage();
  }

  // 3) Legacy DB (analyze flow, dávné maily). Confirmation mail jako dřív.
  if (env.LEGACY_DB) {
    let legacyRow;
    try {
      legacyRow = await env.LEGACY_DB
        .prepare('SELECT id, email, status FROM leads WHERE unsubscribe_token = ? LIMIT 1')
        .bind(token)
        .first();
    } catch (err) {
      console.error('[optout] legacy DB lookup failed', err);
      return renderTempErrorPage();
    }

    if (legacyRow) {
      if (legacyRow.status === 'opted_out') {
        return renderDonePage();
      }

      const nowIso = new Date().toISOString();
      try {
        await env.LEGACY_DB
          .prepare('UPDATE leads SET status = ?, opted_out_at = ?, last_contact_at = ? WHERE id = ?')
          .bind('opted_out', nowIso, nowIso, legacyRow.id)
          .run();
      } catch (err) {
        console.error('[optout] legacy DB update failed', err);
        return renderTempErrorPage();
      }

      // Confirmation mail (legacy flow). HH:MM ze "2026-05-08T14:30:00.000Z".
      const optedOutTime = nowIso.slice(11, 16);
      if (ctx && typeof ctx.waitUntil === 'function') {
        ctx.waitUntil(
          sendMail({
            env,
            template: 'optout-confirmation',
            to: legacyRow.email,
            vars: { email: legacyRow.email, opted_out_at: optedOutTime },
          }).catch((err) => {
            console.error('[optout] sendMail crashed', err);
          })
        );
      }
      return renderDonePage();
    }
  }

  // 4) Token nenalezen ani v jedné DB → idempotentní generic page (security).
  return renderDonePage();
}

/**
 * Extrahuje token z URL — podporuje path i query variantu.
 * @param {URL} url
 * @returns {string | null}
 */
function extractToken(url) {
  const pathMatch = url.pathname.match(/^\/odhlasit\/([a-f0-9]+)\/?$/i);
  if (pathMatch) return pathMatch[1].toLowerCase();
  const t = url.searchParams.get('t') || url.searchParams.get('token');
  return t ? t.toLowerCase() : null;
}

// --- HTML rendery ------------------------------------------------------------

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store, max-age=0',
};

function renderDonePage() {
  return new Response(DONE_HTML, { status: 200, headers: HTML_HEADERS });
}

function renderTempErrorPage() {
  return new Response(TEMP_ERROR_HTML, { status: 503, headers: HTML_HEADERS });
}

const SHARED_CSS = `
  :root { --bg:#F9F6F0; --ink:#1F1B16; --muted:#8A7E6E; --line:#E5E0D6; --card:#FFFFFF; --accent:#C84B31; }
  *, *::before, *::after { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font-family:Georgia,'Times New Roman',serif; font-size:17px; line-height:1.65; min-height:100vh; display:flex; flex-direction:column; }
  a { color:var(--ink); text-decoration:underline; text-decoration-color:var(--line); text-underline-offset:3px; }
  a:hover { text-decoration-color:var(--accent); }
  header { border-bottom:1px solid var(--line); }
  .header-inner { max-width:720px; margin:0 auto; padding:18px 24px; display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; }
  .brand { font-weight:bold; font-size:18px; color:var(--ink); text-decoration:none; }
  .brand:hover { color:var(--accent); }
  .back { font-size:14px; color:var(--muted); text-decoration:none; }
  .back:hover { color:var(--ink); }
  main { max-width:720px; width:100%; margin:0 auto; padding:64px 24px 48px; flex:1; }
  .card { background:var(--card); border-left:3px solid var(--accent); border-radius:6px; padding:32px 28px; }
  h1 { font-size:clamp(26px, 4vw, 32px); font-weight:normal; line-height:1.25; margin:0 0 16px; }
  p { margin:0 0 16px; }
  p:last-child { margin-bottom:0; }
  footer { border-top:1px solid var(--line); margin-top:32px; }
  .footer-inner { max-width:720px; margin:0 auto; padding:24px; color:var(--muted); font-size:13px; line-height:1.5; text-align:center; }
  @media (max-width: 480px) { main { padding:40px 20px 32px; } .card { padding:24px 20px; } h1 { font-size:24px; } }
`;

const DONE_HTML = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#F9F6F0">
<title>Odhlášeno — fakan.cz</title>
<style>${SHARED_CSS}</style>
</head>
<body>
<header><div class="header-inner"><a class="brand" href="/">fakan.cz</a><a class="back" href="/">← Zpět na fakan.cz</a></div></header>
<main>
  <div class="card">
    <h1>Odhlásili jsme Vás z e-mailů.</h1>
    <p>Z naší strany už žádný e-mail nepřijde. Pokud byste cokoliv potřeboval(a), ozvěte se nám na <a href="mailto:jsem@fakan.cz">jsem@fakan.cz</a>.</p>
  </div>
</main>
<footer><div class="footer-inner">© 2026 fakan.cz · provozuje Indigo Studio s.r.o.</div></footer>
</body>
</html>`;

const TEMP_ERROR_HTML = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#F9F6F0">
<title>Dočasná chyba — fakan.cz</title>
<style>${SHARED_CSS}</style>
</head>
<body>
<header><div class="header-inner"><a class="brand" href="/">fakan.cz</a><a class="back" href="/">← Zpět na fakan.cz</a></div></header>
<main>
  <div class="card">
    <h1>Dočasná chyba.</h1>
    <p>Zkuste to prosím znovu za pár minut. Pokud to nepůjde, napište nám na <a href="mailto:jsem@fakan.cz">jsem@fakan.cz</a> a odhlásíme Vás ručně.</p>
  </div>
</main>
<footer><div class="footer-inner">© 2026 fakan.cz · provozuje Indigo Studio s.r.o.</div></footer>
</body>
</html>`;
