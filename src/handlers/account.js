// src/handlers/account.js
//
// POST /api/account/start  { email }   — vyrobí magic link a pošle ho mailem.
// GET  /api/account/verify ?t={token}  — ověří, sváže device s accountem,
//                                        sjednotí anonymní journeys.
// POST /api/account/logout              — odpojí current device od accountu
//                                        a zneplatní cookie. Bez těla.
//
// Žádné heslo, žádný registrační formulář. Magic link single-use, TTL 30 min.
// Při verify použijeme aktuální device (klient může kliknout z jiného browseru).

import { sendTransactional } from '../email/send.js';
import { tplMagicLink }      from '../email/templates.js';
import {
  getOrCreateDevice,
  attachDeviceToAccount,
  isValidEmail,
  randomTokenHex,
} from '../lib/identity.js';

const MAGIC_LINK_TTL = 60 * 30;     // 30 minut

const json = (status, data, extraHeaders) => new Response(
  JSON.stringify(data),
  {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...(extraHeaders || {}),
    },
  },
);

export async function handleAccountStart(request, env, ctx) {
  if (request.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  const body = await request.json().catch(() => null);
  if (!body) return json(400, { ok: false, error: 'Bad JSON' });

  const email = String(body.email || '').trim().toLowerCase();
  if (!isValidEmail(email)) return json(400, { ok: false, error: 'Zadejte platný e-mail.' });

  // Anti-spam: max 3 magic linky na email / 10 min.
  const rlKey = `ml:email:${email}`;
  const cnt   = parseInt((await env.RATELIMIT.get(rlKey)) || '0', 10);
  if (cnt >= 3) return json(429, { ok: false, error: 'Moc požadavků. Zkuste za 10 minut.' });
  await env.RATELIMIT.put(rlKey, String(cnt + 1), { expirationTtl: 600 });

  const { device, setCookieHeader } = await getOrCreateDevice(env, request);
  const now   = Math.floor(Date.now() / 1000);
  const token = randomTokenHex(32);
  const host  = env.PUBLIC_HOST || 'fakan.cz';

  await env.DB.prepare(
    `INSERT INTO magic_links (token, email, device_id, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(token, email, device.id, now + MAGIC_LINK_TTL, now).run();

  const link = `https://${host}/api/account/verify?t=${token}`;
  const tpl  = tplMagicLink({ link, email });

  ctx.waitUntil(sendTransactional(env, {
    to: email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
  }));

  // Vždy 200 OK bez ohledu na to, jestli email v DB existuje (anti-enumeration).
  return json(200,
    { ok: true, message: 'Zkontrolujte schránku — odkaz Vám právě dorazil.' },
    setCookieHeader ? { 'Set-Cookie': setCookieHeader } : null,
  );
}

export async function handleAccountVerify(request, env, ctx) {
  if (request.method !== 'GET') return json(405, { ok: false, error: 'Method not allowed' });

  const url   = new URL(request.url);
  const token = url.searchParams.get('t') || '';
  const host  = env.PUBLIC_HOST || 'fakan.cz';
  if (!token) return redirectErr(host, 'invalid');

  const now = Math.floor(Date.now() / 1000);
  const ml  = await env.DB.prepare(
    `SELECT token, email, device_id, expires_at, used_at
     FROM magic_links WHERE token = ? LIMIT 1`
  ).bind(token).first();

  if (!ml)                 return redirectErr(host, 'invalid');
  if (ml.used_at)          return redirectErr(host, 'used');
  if (ml.expires_at < now) return redirectErr(host, 'expired');

  // Aktuální device — může být jiný než originating_device.
  const { device, setCookieHeader } = await getOrCreateDevice(env, request);

  // Mark used (single-use replay protection).
  await env.DB.prepare(
    `UPDATE magic_links SET used_at = ? WHERE token = ?`
  ).bind(now, token).run();

  await attachDeviceToAccount(env, device.id, ml.email);

  const headers = new Headers({ 'Location': `https://${host}/?prihlaseni=ok` });
  if (setCookieHeader) headers.set('Set-Cookie', setCookieHeader);
  return new Response(null, { status: 302, headers });
}

function redirectErr(host, reason) {
  return Response.redirect(`https://${host}/?prihlaseni_chyba=${reason}`, 302);
}

// Odhlášení: odpojí current device od accountu (account_id = NULL)
// a expiruje cookie 'fakan_device'. Idempotentní — bez cookie / s neplatnou
// cookie projde stejně 200 OK. Account row + journeys zůstávají, jen tenhle
// browser je odpojený. Po /api/me si klient vyrobí čerstvý anonymní device.
export async function handleAccountLogout(request, env, _ctx) {
  if (request.method !== 'POST') return json(405, { ok: false, error: 'Method not allowed' });

  const cookieHeader = request.headers.get('Cookie') || '';
  const m = cookieHeader.match(/(?:^|;\s*)fakan_device=([^;]+)/);
  const deviceToken = m ? m[1] : null;

  if (deviceToken) {
    await env.DB.prepare(
      `UPDATE account_devices SET account_id = NULL WHERE device_token = ?`
    ).bind(deviceToken).run();
  }

  const expireCookie = `fakan_device=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
  return json(200, { ok: true }, { 'Set-Cookie': expireCookie });
}
