// src/lib/stripe.js
// Tenký fetch klient pro Stripe API. Žádné npm SDK, držíme se Web Platform.
//
// Stripe API:
//   - https://api.stripe.com/v1/...
//   - Auth: Authorization: Bearer ${STRIPE_SECRET_KEY}
//   - Body: application/x-www-form-urlencoded (NE JSON, Stripe to nepřijme)
//   - Idempotency-Key header pro write operace (zaručí retry-safe)
//
// Webhook signature:
//   Stripe-Signature: t=1234567890,v1=hex,v0=hex
//   v1 = HMAC-SHA256 hex z `${t}.${rawBody}` s `STRIPE_WEBHOOK_SECRET`
//   Tolerance 5 minut na timestamp (replay protection).

const STRIPE_API = 'https://api.stripe.com/v1';

// ---- Encoding -------------------------------------------------------------

// Stripe form encoding podporuje vnořené objekty přes klíče typu
// `metadata[order_id]=…`. Pro pole `automatic_payment_methods[enabled]=true`
// stačí stejně.
function flattenForm(obj, prefix = '') {
  const params = new URLSearchParams();
  function walk(value, key) {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${key}[${i}]`));
    } else if (typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) walk(v, `${key}[${k}]`);
    } else {
      params.append(key, String(value));
    }
  }
  for (const [k, v] of Object.entries(obj)) walk(v, prefix ? `${prefix}[${k}]` : k);
  return params;
}

async function call(env, path, { method = 'POST', body, idempotencyKey } = {}) {
  if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY není nastaveno');
  const headers = {
    'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
    'Stripe-Version': '2024-12-18.acacia',
  };
  let payload;
  if (body) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    payload = flattenForm(body).toString();
  }
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  const resp = await fetch(`${STRIPE_API}${path}`, { method, headers, body: payload });
  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    const msg = data?.error?.message || `Stripe ${resp.status}`;
    const err = new Error(msg);
    err.status = resp.status;
    err.code = data?.error?.code;
    err.type = data?.error?.type;
    throw err;
  }
  return data;
}

// ---- Customers ------------------------------------------------------------

// Pamatovat si Customer per email — umožní víc plateb na jeden profil
// a hezčí UX (Apple Pay si nabídne uloženou kartu).
// Ne použijeme search (vyžaduje search index), ale list + filter.
export async function getOrCreateCustomer(env, { email, name, metadata }) {
  const list = await call(env, `/customers?email=${encodeURIComponent(email)}&limit=1`, { method: 'GET' });
  if (list.data && list.data.length > 0) return list.data[0];
  return call(env, '/customers', {
    body: { email, ...(name ? { name } : {}), ...(metadata ? { metadata } : {}) },
    idempotencyKey: `cust:${email}`,
  });
}

// ---- PaymentIntent --------------------------------------------------------

// `automatic_payment_methods` zapne všechny platební metody enabled v Stripe
// dashboardu. `allow_redirects: 'never'` vyloučí off-site redirect-based methods
// (Klarna, Bancontact, Sofort, EPS …) — chceme jen on-site instantní metody:
// karta + Apple Pay + Google Pay. Klarna/BNPL na 299 Kč doménu nedává smysl.
export async function createPaymentIntent(env, {
  amountCents,
  currency = 'czk',
  customerId,
  orderId,
  description,
  receiptEmail,
  metadata = {},
}) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error('amountCents musí být kladné celé číslo');
  }
  const body = {
    amount: amountCents,
    currency,
    automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
    metadata: { ...metadata, order_id: orderId },
  };
  if (customerId)    body.customer = customerId;
  if (description)   body.description = description;
  if (receiptEmail)  body.receipt_email = receiptEmail;

  return call(env, '/payment_intents', {
    body,
    idempotencyKey: `pi:${orderId}`,
  });
}

export async function retrievePaymentIntent(env, paymentIntentId) {
  return call(env, `/payment_intents/${encodeURIComponent(paymentIntentId)}`, { method: 'GET' });
}

// ---- Webhook signature ----------------------------------------------------

async function hmacSha256Hex(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// Vrátí parsed event nebo throws. Tolerance 5 min na clock drift / replay.
export async function verifyWebhookSignature(rawBody, signatureHeader, secret, toleranceSec = 300) {
  if (!signatureHeader || !secret) throw new Error('Chybí Stripe-Signature nebo secret');

  const parts = {};
  const v1List = [];
  for (const segment of signatureHeader.split(',')) {
    const [k, v] = segment.split('=', 2);
    if (k === 'v1') v1List.push(v);            // Stripe může poslat víc v1 hashů (key rotation)
    else if (k && v !== undefined) parts[k] = v;
  }
  const t = parseInt(parts.t, 10);
  if (!t || v1List.length === 0) throw new Error('Stripe-Signature je neúplný');

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - t) > toleranceSec) {
    throw new Error(`Stripe-Signature timestamp mimo toleranci (${now - t}s)`);
  }

  const expected = await hmacSha256Hex(secret, `${t}.${rawBody}`);
  const match = v1List.some((sig) => timingSafeEqualHex(expected, sig));
  if (!match) throw new Error('Stripe-Signature ověření selhalo');

  try {
    return JSON.parse(rawBody);
  } catch {
    throw new Error('Webhook body není validní JSON');
  }
}
