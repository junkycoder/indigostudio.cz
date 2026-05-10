// src/handlers/domain-order.js
//
// POST /api/domain/order      — vytvoří order na registraci nebo převod, vrátí Stripe PI
// GET  /api/domain/{id}/status — polling stav (status, expires, ns)
//
// Body POSTu (JSON):
//   {
//     fqdn: 'kavarna-u-sojky.cz',
//     opKind: 'register' | 'transfer',
//     periodYears: 1,
//     authInfo: 'XYZ',                    // jen u transfer
//     registrant: {
//       name, email, phone,
//       street, city, zip, country,       // adresa
//       ico, dic                          // volitelné pro fyzické osoby
//     }
//   }
// Header: Idempotency-Key: <uuid>

import { checkIdempotency, saveIdempotency } from '../lib/idempotency.js';
import { getOrCreateCustomer, createPaymentIntent } from '../lib/stripe.js';
import { checkDomain } from '../lib/subreg.js';

const ALLOWED_TLDS = ['cz', 'com', 'eu', 'sk', 'net', 'org'];

// Klientská cena per TLD per rok (zahrnuje marži). Stejná tabulka jako
// v handlers/domain-check.js — duplicate by-design pro samostatnost handlerů.
// Po stabilizaci přesunout do D1 tabulky a načítat společně.
const CLIENT_PRICES_CZK = {
  cz: 299, com: 399, eu: 349, sk: 499, net: 449, org: 449,
};
const TRANSFER_PREMIUM_CZK = 50;       // mírná přirážka za převod (extra práce, AuthInfo handover)

const RX_FQDN  = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.[a-z]{2,}$/i;
const RX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RX_ICO   = /^\d{6,12}$/;          // CZ IČO 8 znaků, ale buďme tolerantní
const RX_ZIP   = /^[A-Z0-9 -]{3,12}$/i;

const ok   = (data, status = 200) => Response.json({ ok: true,  ...data }, { status });
const fail = (msg, status = 400)  => Response.json({ ok: false, error: msg }, { status });

const RX_ORDER_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export async function handleDomainOrder(request, env, ctx) {
  if (request.method !== 'POST') return fail('Method not allowed', 405);

  const bodyText = await request.text();
  let body;
  try { body = JSON.parse(bodyText); }
  catch { return fail('Bad JSON'); }

  // Validace
  const fqdn = String(body.fqdn || '').trim().toLowerCase();
  if (!RX_FQDN.test(fqdn)) return fail('Neplatný formát domény.');
  const tld = fqdn.split('.').slice(1).join('.');
  if (!ALLOWED_TLDS.includes(tld)) return fail(`Doména s koncovkou .${tld} zatím nepodporujeme.`);

  const opKind = body.opKind === 'transfer' ? 'transfer' : 'register';
  const periodYears = Number(body.periodYears || 1);
  if (!Number.isInteger(periodYears) || periodYears < 1 || periodYears > 10) {
    return fail('Délka registrace musí být mezi 1 a 10 lety.');
  }
  const authInfo = String(body.authInfo || '').trim();
  if (opKind === 'transfer' && authInfo.length < 4) {
    return fail('Pro převod potřebujeme AuthInfo kód od stávajícího registrátora.');
  }

  const r = body.registrant || {};
  const errReg = validateRegistrant(r);
  if (errReg) return fail(errReg);

  // Honeypot (frontend ho posílá pro consistency)
  const honeypot = String(body.website || '').trim();
  if (honeypot) return ok({ message: 'Pracujeme na tom.' });

  // Rate limit IP (3/h) + per email registranta (10/24h). Klient může objednat
  // víc domén najednou (e-shop, brand variants, .cz + .com) — stropy schválně
  // velkorysejší než suggestion.
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const ipKey    = `rl:dom-order:ip:${ip}`;
  const emailRl  = `rl:dom-order:email:${String(r.email || '').toLowerCase()}`;
  const [ipCntRaw, emailCntRaw] = await Promise.all([
    env.RATELIMIT.get(ipKey),
    env.RATELIMIT.get(emailRl),
  ]);
  const ipCnt    = parseInt(ipCntRaw    || '0', 10);
  const emailCnt = parseInt(emailCntRaw || '0', 10);
  if (ipCnt    >= 3)  return fail('Moc pokusů z jedné IP. Zkuste za hodinu.', 429);
  if (emailCnt >= 10) return fail('Moc objednávek na tuto adresu. Zkuste za 24 hodin.', 429);
  await Promise.all([
    env.RATELIMIT.put(ipKey,   String(ipCnt + 1),    { expirationTtl: 3600 }),
    env.RATELIMIT.put(emailRl, String(emailCnt + 1), { expirationTtl: 86400 }),
  ]);

  // Idempotency
  const idempotencyKey = request.headers.get('Idempotency-Key') || '';
  const idem = await checkIdempotency(env, { key: idempotencyKey, bodyText });
  if (idem.conflict) return fail('Stejný Idempotency-Key s jiným tělem.', 409);
  if (idem.hit) return idem.response;

  // Pro register: ověřit, že je doména volná (drží se to s frontend zobrazením,
  // ale za hodinu se může uvolnit/obsadit — chceme aktuální stav).
  if (opKind === 'register') {
    try {
      const status = await checkDomain(env, fqdn);
      if (!status.available) return fail(`Doména ${fqdn} už není volná.`, 409);
    } catch (err) {
      console.warn(`domain-order check fail ${fqdn}: ${err.message}`);
      return fail('Nepodařilo se ověřit dostupnost domény. Zkuste prosím za chvíli.', 503);
    }
  }

  // Cena
  const basePerYear = CLIENT_PRICES_CZK[tld];
  if (!basePerYear) return fail(`Doména .${tld} není v ceníku.`, 400);
  const totalCzk = basePerYear * periodYears + (opKind === 'transfer' ? TRANSFER_PREMIUM_CZK : 0);
  const amountCents = totalCzk * 100;

  // Order + lead
  const now = Math.floor(Date.now() / 1000);
  const email = r.email.toLowerCase();
  const orderId = crypto.randomUUID();

  let leadId;
  const existingLead = await env.DB.prepare(
    `SELECT id FROM leads WHERE email = ? AND domain = ? LIMIT 1`
  ).bind(email, fqdn).first();
  if (existingLead) {
    leadId = existingLead.id;
  } else {
    leadId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO leads (id, email, domain, consent_at, ip, source, status, unsub_token, created_at)
       VALUES (?, ?, ?, ?, ?, 'domain', 'new', ?, ?)`
    ).bind(leadId, email, fqdn, now, ip, randomToken(), now).run();
  }

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO orders
         (id, kind, lead_id, email, amount_cents, currency, status,
          metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'czk', 'created', ?, ?, ?)`
    ).bind(
      orderId,
      opKind === 'transfer' ? 'domain_transfer' : 'domain_register',
      leadId, email, amountCents,
      JSON.stringify({ ip, source: 'web', tld }),
      now, now,
    ),
    env.DB.prepare(
      `INSERT INTO domain_orders
         (order_id, fqdn, tld, op_kind, registrar, auth_info,
          registrant_name, registrant_email, registrant_phone,
          registrant_street, registrant_city, registrant_zip,
          registrant_country, registrant_ico, registrant_dic, period_years)
       VALUES (?, ?, ?, ?, 'subreg', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      orderId, fqdn, tld, opKind,
      opKind === 'transfer' ? authInfo : null,
      r.name, email, r.phone || null,
      r.street || null, r.city || null, r.zip || null,
      (r.country || 'CZ').toUpperCase(),
      r.ico || null, r.dic || null,
      periodYears,
    ),
  ]);

  // Stripe
  let pi;
  try {
    const customer = await getOrCreateCustomer(env, { email, name: r.name });
    pi = await createPaymentIntent(env, {
      amountCents,
      currency: 'czk',
      customerId: customer.id,
      orderId,
      description: opKind === 'transfer'
        ? `Převod domény ${fqdn} (${periodYears} rok${periodYears > 1 ? 'y/let' : ''})`
        : `Registrace domény ${fqdn} (${periodYears} rok${periodYears > 1 ? 'y/let' : ''})`,
      receiptEmail: email,
      metadata: { kind: opKind === 'transfer' ? 'domain_transfer' : 'domain_register', fqdn, lead_id: leadId },
    });
    await env.DB.prepare(
      `UPDATE orders
         SET stripe_payment_intent_id = ?, stripe_customer_id = ?,
             status = 'awaiting_payment', updated_at = ?
       WHERE id = ?`
    ).bind(pi.id, customer.id, Math.floor(Date.now() / 1000), orderId).run();
  } catch (err) {
    console.error('domain-order Stripe', err);
    await env.DB.prepare(
      `UPDATE orders SET status='failed', error_message=?, updated_at=? WHERE id=?`
    ).bind(`Stripe: ${err.message}`, Math.floor(Date.now() / 1000), orderId).run();
    return fail('Platba se nepodařila navázat. Zkuste prosím za chvíli.', 502);
  }

  const response = ok({
    orderId,
    fqdn,
    opKind,
    periodYears,
    amountCents,
    currency: 'czk',
    clientSecret: pi.client_secret,
    paymentIntentId: pi.id,
    publishableKey: env.STRIPE_PUBLISHABLE_KEY || '',
  });

  await saveIdempotency(env, { key: idempotencyKey, hash: idem.hash, response: response.clone() })
    .catch((err) => console.warn('domain-order idempotency save', err));

  return response;
}

// GET /api/domain/{orderId}/status
export async function handleDomainStatus(request, env) {
  const url = new URL(request.url);
  const m = url.pathname.match(/^\/api\/domain\/([^/]+)\/status$/);
  if (!m) return fail('Bad path', 404);

  const orderId = m[1];
  if (!RX_ORDER_ID.test(orderId)) return fail('Invalid order id', 400);

  const row = await env.DB.prepare(
    `SELECT o.id, o.kind, o.status, o.error_message, o.completed_at,
            o.amount_cents, o.currency,
            d.fqdn, d.op_kind, d.period_years, d.expires_at, d.ns_records_json,
            d.registrar_status
       FROM orders o
       JOIN domain_orders d ON d.order_id = o.id
      WHERE o.id = ? AND o.kind IN ('domain_register', 'domain_transfer') LIMIT 1`
  ).bind(orderId).first();

  if (!row) return fail('Not found', 404);

  let ns = [];
  if (row.ns_records_json) {
    try { ns = JSON.parse(row.ns_records_json); } catch {}
  }

  return ok({
    orderId,
    kind: row.kind,
    status: row.status,
    errorMessage: row.error_message,
    completedAt: row.completed_at,
    fqdn: row.fqdn,
    opKind: row.op_kind,
    periodYears: row.period_years,
    expiresAt: row.expires_at,
    ns,
    registrarStatus: row.registrar_status,
    amountCents: row.amount_cents,
    currency: row.currency,
  });
}

// ---- helpers --------------------------------------------------------------

function validateRegistrant(r) {
  if (!r || typeof r !== 'object') return 'Chybí kontaktní údaje.';
  if (!r.name || String(r.name).trim().length < 2) return 'Zadejte jméno nebo název firmy.';
  if (!r.email || !RX_EMAIL.test(String(r.email).toLowerCase())) return 'Zadejte platný e-mail.';
  if (!r.country || String(r.country).length !== 2) return 'Zadejte 2-písmenný kód země (CZ, SK, …).';
  if (r.ico && !RX_ICO.test(String(r.ico))) return 'IČO musí mít 6–12 číslic.';
  if (r.zip && !RX_ZIP.test(String(r.zip))) return 'PSČ má neplatný formát.';
  return null;
}

function randomToken() {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}
