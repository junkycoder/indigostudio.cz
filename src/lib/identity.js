// src/lib/identity.js
//
// Anonymní device_token v cookie + opt-in account přes magic link.
//
// Anonymní flow:
//   - Frontend volá /api/me → middleware vyrobí device_token, pošle Set-Cookie.
//   - Cookie 'fakan_device' (httpOnly, Secure, SameSite=Lax, 1 rok).
//   - Token sám stačí pro plný UX (vidí svoje journeys v profilu).
//
// Verifikace emailu:
//   - POST /api/account/start   { email }    → magic_links row + mail.
//   - GET  /api/account/verify  ?t={token}   → mark used, sváže aktuální
//                                              device s accountem, sjednotí
//                                              všechny journeys s lead.email = email.
//
// Magic link váže 'originating_device' (kdo si link vyžádal) jen pro audit log.
// Při verify použijeme aktuální device (klient může kliknout z jiného browseru).

const COOKIE_NAME    = 'fakan_device';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365;     // 1 rok

const RX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email) {
  return typeof email === 'string' && RX_EMAIL.test(email.trim().toLowerCase());
}

export function randomTokenHex(bytes = 32) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map(b => b.toString(16).padStart(2, '0')).join('');
}

function parseCookie(request, name) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const m = cookieHeader.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? m[1] : null;
}

export function deviceCookieHeader(token) {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
}

// Načte aktuální device (cookie / X-Device-Token header) nebo vyrobí nový.
// Vrací { device, account, setCookieHeader }.
//   device:  { id, deviceToken, accountId, createdAt, lastSeenAt }
//   account: { id, email, emailVerifiedAt } | null
//   setCookieHeader: string pro Set-Cookie, jen u nově vyrobeného (jinak null).
export async function getOrCreateDevice(env, request) {
  const headerToken = request.headers.get('X-Device-Token');
  const cookieToken = parseCookie(request, COOKIE_NAME);
  const token = headerToken || cookieToken;
  const now   = Math.floor(Date.now() / 1000);

  if (token) {
    const row = await env.DB.prepare(
      `SELECT d.id, d.device_token, d.account_id, d.created_at, d.last_seen_at,
              a.email AS account_email, a.email_verified_at
       FROM account_devices d
       LEFT JOIN accounts a ON a.id = d.account_id
       WHERE d.device_token = ? LIMIT 1`
    ).bind(token).first();

    if (row) {
      // Touch last_seen_at jen 1× za hodinu (šetříme zápisy do D1).
      if (row.last_seen_at < now - 3600) {
        await env.DB.prepare(
          `UPDATE account_devices SET last_seen_at = ? WHERE id = ?`
        ).bind(now, row.id).run();
      }
      return {
        device: {
          id: row.id,
          deviceToken: row.device_token,
          accountId: row.account_id,
          createdAt: row.created_at,
          lastSeenAt: row.last_seen_at,
        },
        account: row.account_id ? {
          id: row.account_id,
          email: row.account_email,
          emailVerifiedAt: row.email_verified_at,
        } : null,
        setCookieHeader: null,
      };
    }
    // Token nesedí (smazaný / podstrčený). Vyrobíme nový, starý zahodíme.
  }

  const newToken = randomTokenHex(32);
  const id       = crypto.randomUUID();
  const ua       = (request.headers.get('User-Agent') || '').slice(0, 255);
  const ip       = request.headers.get('cf-connecting-ip') || null;

  await env.DB.prepare(
    `INSERT INTO account_devices (id, account_id, device_token, user_agent, ip, created_at, last_seen_at)
     VALUES (?, NULL, ?, ?, ?, ?, ?)`
  ).bind(id, newToken, ua, ip, now, now).run();

  return {
    device: {
      id,
      deviceToken: newToken,
      accountId: null,
      createdAt: now,
      lastSeenAt: now,
    },
    account: null,
    setCookieHeader: deviceCookieHeader(newToken),
  };
}

// Spojí current device s accountem (existujícím nebo nově vyrobeným)
// a sjednotí všechny anonymní journeys, kde lead.email == email.
// Vrací { account, mergedJourneys }.
export async function attachDeviceToAccount(env, deviceId, email) {
  const now      = Math.floor(Date.now() / 1000);
  const newId    = crypto.randomUUID();
  const lcEmail  = email.trim().toLowerCase();

  // Atomický UPSERT: existing → bump last_login_at, fresh → vyrobit ověřený.
  // COALESCE drží původní email_verified_at, pokud už byl ověřen dříve.
  await env.DB.prepare(
    `INSERT INTO accounts (id, email, email_verified_at, created_at, last_login_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       email_verified_at = COALESCE(accounts.email_verified_at, excluded.email_verified_at),
       last_login_at = excluded.last_login_at`
  ).bind(newId, lcEmail, now, now, now).run();

  const account = await env.DB.prepare(
    `SELECT id, email, email_verified_at FROM accounts WHERE email = ? LIMIT 1`
  ).bind(lcEmail).first();

  // Sváže device s accountem.
  await env.DB.prepare(
    `UPDATE account_devices SET account_id = ? WHERE id = ?`
  ).bind(account.id, deviceId).run();

  // Sjednotí existující anonymní journeys podle emailu (cross-device merge).
  const merge = await env.DB.prepare(
    `UPDATE journeys SET account_id = ?, updated_at = ?
     WHERE account_id IS NULL
       AND lead_id IN (SELECT id FROM leads WHERE email = ?)`
  ).bind(account.id, now, lcEmail).run();

  return {
    account: {
      id: account.id,
      email: account.email,
      emailVerifiedAt: account.email_verified_at,
    },
    mergedJourneys: merge.meta?.changes || 0,
  };
}
