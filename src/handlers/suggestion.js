// src/handlers/suggestion.js
//
// POST /api/suggestion
// Multipart formdata: url, email, brief, consent, website (honeypot), file_0..N
// Header: Idempotency-Key (volitelně, ale doporučujeme — chrání proti retry)
//
// Flow:
//   1) Validace + honeypot + rate limit (IP + email)
//   2) Idempotency lookup
//   3) Parse uploads (MIME sniff) → R2
//   4) Lead lookup / create
//   5) Hledat poslední úspěšný audit pro tenhle email+domain (= baseline screenshot)
//   6) DB batch: orders + suggestions
//   7) Stripe getOrCreateCustomer + createPaymentIntent (500 Kč)
//   8) Update order o stripe IDs
//   9) Save idempotency + return { orderId, clientSecret }

import { collectUploads, storeUploadsToR2 } from '../lib/files.js';
import { checkIdempotency, saveIdempotency } from '../lib/idempotency.js';
import { getOrCreateCustomer, createPaymentIntent } from '../lib/stripe.js';

const PRICE_CZK = 500;
const AMOUNT_CENTS = PRICE_CZK * 100;        // CZK má 2 decimal places (haléře)
const RX_URL   = /^https?:\/\/[^\s]+$/i;
const RX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_BRIEF_CHARS = 10;
const MAX_BRIEF_CHARS = 4000;

const ok   = (data, status = 200) => Response.json({ ok: true,  ...data }, { status });
const fail = (msg, status = 400)  => Response.json({ ok: false, error: msg }, { status });

export async function handleSuggestion(request, env, ctx) {
  if (request.method !== 'POST') return fail('Method not allowed', 405);

  // Multipart formdata. Cloudflare Workers nativně podporuje request.formData().
  let form;
  try { form = await request.formData(); }
  catch { return fail('Bad form data'); }

  // 1) Honeypot — tichý OK, ať boti nedostanou signal
  const honeypot = String(form.get('website') || '').trim();
  if (honeypot) return ok({ message: 'Pracujeme na tom.' });

  // 2) Validace
  const rawUrl = normalizeUrl(form.get('url'));
  if (!rawUrl || !RX_URL.test(rawUrl)) return fail('Zadejte platnou URL.');

  const email = String(form.get('email') || '').trim().toLowerCase();
  if (!RX_EMAIL.test(email)) return fail('Zadejte platný e-mail.');

  const brief = String(form.get('brief') || '').trim();
  if (brief.length < MIN_BRIEF_CHARS) return fail(`Popište prosím alespoň ${MIN_BRIEF_CHARS} znaky, co chcete předělat.`);
  if (brief.length > MAX_BRIEF_CHARS) return fail('Brief je moc dlouhý. Zkraťte ho prosím.');

  const consent = form.get('consent');
  if (consent !== '1' && consent !== 'true' && consent !== true) return fail('Bez souhlasu to nepůjde.');

  const domain = new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, '');

  // 3) Rate limit IP (3/h) + per email (5/24h). IP chrání proti scriptu, email
  // chrání proti útočníkovi co rotuje IP ale spamuje Resend kvótu (každý
  // PaymentIntent generuje receipt mail).
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const ipKey    = `rl:sugg:ip:${ip}`;
  const emailKey = `rl:sugg:email:${email}`;
  const [ipCntRaw, emailCntRaw] = await Promise.all([
    env.RATELIMIT.get(ipKey),
    env.RATELIMIT.get(emailKey),
  ]);
  const ipCnt    = parseInt(ipCntRaw    || '0', 10);
  const emailCnt = parseInt(emailCntRaw || '0', 10);
  if (ipCnt    >= 3) return fail('Moc pokusů z jedné IP. Zkuste za hodinu.', 429);
  if (emailCnt >= 5) return fail('Moc objednávek na tuto adresu. Zkuste za 24 hodin.', 429);
  await Promise.all([
    env.RATELIMIT.put(ipKey,    String(ipCnt + 1),    { expirationTtl: 3600 }),
    env.RATELIMIT.put(emailKey, String(emailCnt + 1), { expirationTtl: 86400 }),
  ]);

  // 4) Idempotency lookup. Při shodě vrátíme cached response — Stripe PI
  // je idempotentní per orderId (viz lib/stripe.js), takže client_secret
  // bude tentýž a Payment Element ho ucucne.
  const idempotencyKey = request.headers.get('Idempotency-Key') || '';
  // Hash počítáme z fieldů, ne z multipart bodu (ten se mění s boundary).
  const idemBody = JSON.stringify({ url: rawUrl, email, brief, fileCount: countFiles(form) });
  const idem = await checkIdempotency(env, { key: idempotencyKey, bodyText: idemBody });
  if (idem.conflict) return fail('Stejný Idempotency-Key s jiným tělem.', 409);
  if (idem.hit) return idem.response;

  // 5) Uploads — nejdřív validovat (cheap), pak ukládat (drahé)
  let uploads;
  try { uploads = await collectUploads(form); }
  catch (err) {
    if (err.code === 'LIMIT' || err.code === 'TYPE') return fail(err.message);
    throw err;
  }

  // 6) Lead lookup / create
  const now = Math.floor(Date.now() / 1000);
  let leadId = null;
  const existingLead = await env.DB.prepare(
    `SELECT id FROM leads WHERE email = ? AND domain = ? LIMIT 1`
  ).bind(email, domain).first();

  if (existingLead) {
    leadId = existingLead.id;
  } else {
    leadId = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO leads (id, email, domain, consent_at, ip, source, status, unsub_token, created_at)
       VALUES (?, ?, ?, ?, ?, 'suggestion', 'new', ?, ?)`
    ).bind(leadId, email, domain, now, ip, randomToken(), now).run();
  }

  // 7) Najdi nejnovější dokončený audit pro stejný lead+domain (baseline screenshot).
  // Když není, suggestion-render worker spustí krátký screenshot capture sám.
  const audit = await env.DB.prepare(
    `SELECT id FROM audits
       WHERE lead_id = ? AND domain = ? AND status = 'done'
       ORDER BY finished_at DESC LIMIT 1`
  ).bind(leadId, domain).first();
  const auditId = audit?.id || null;

  // 8) Order + suggestion. UUID generujeme předem, abychom mohli R2 uploady
  // pojmenovat pod orderId (jednodušší cleanup).
  const orderId = crypto.randomUUID();

  // Uložení do R2 (drahá operace, ale max 20 MB)
  let filesMeta = [];
  try {
    filesMeta = await storeUploadsToR2(env, orderId, uploads);
  } catch (err) {
    console.error('suggestion: R2 upload failed', err);
    return fail('Nepodařilo se uložit přílohy. Zkuste to prosím za chvíli.', 502);
  }

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO orders
         (id, kind, lead_id, email, amount_cents, currency, status,
          metadata_json, created_at, updated_at)
       VALUES (?, 'suggestion', ?, ?, ?, 'czk', 'created', ?, ?, ?)`
    ).bind(orderId, leadId, email, AMOUNT_CENTS, JSON.stringify({ ip, source: 'web' }), now, now),
    env.DB.prepare(
      `INSERT INTO suggestions (order_id, audit_id, url, brief, files_json)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(orderId, auditId, rawUrl, brief, JSON.stringify(filesMeta)),
  ]);

  // 9) Stripe — Customer + PaymentIntent (idempotentní per orderId)
  let pi;
  try {
    const customer = await getOrCreateCustomer(env, { email });
    pi = await createPaymentIntent(env, {
      amountCents: AMOUNT_CENTS,
      currency: 'czk',
      customerId: customer.id,
      orderId,
      description: `AI návrh úprav webu — ${domain}`,
      receiptEmail: email,
      metadata: { kind: 'suggestion', domain, lead_id: leadId },
    });
    await env.DB.prepare(
      `UPDATE orders
         SET stripe_payment_intent_id = ?, stripe_customer_id = ?,
             status = 'awaiting_payment', updated_at = ?
       WHERE id = ?`
    ).bind(pi.id, customer.id, Math.floor(Date.now() / 1000), orderId).run();
  } catch (err) {
    console.error('suggestion: Stripe error', err);
    await env.DB.prepare(
      `UPDATE orders SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?`
    ).bind(`Stripe: ${err.message}`, Math.floor(Date.now() / 1000), orderId).run();
    return fail('Platba se nepodařila navázat. Zkuste to prosím za chvíli.', 502);
  }

  const response = ok({
    orderId,
    clientSecret: pi.client_secret,
    paymentIntentId: pi.id,
    amountCents: AMOUNT_CENTS,
    currency: 'czk',
    publishableKey: env.STRIPE_PUBLISHABLE_KEY || '',
  });

  // 10) Idempotency save (best-effort, errs ignorujeme)
  await saveIdempotency(env, { key: idempotencyKey, hash: idem.hash, response: response.clone() })
    .catch((err) => console.warn('suggestion: idempotency save failed', err));

  return response;
}

// ---- helpers --------------------------------------------------------------

function normalizeUrl(input) {
  try {
    let s = String(input || '').trim();
    if (!s) return null;
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    const u = new URL(s);
    u.hash = ''; u.username = ''; u.password = '';
    return u.toString();
  } catch { return null; }
}

function randomToken() {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function countFiles(form) {
  let n = 0;
  for (const [key, value] of form.entries()) {
    if (key.startsWith('file_') && typeof value !== 'string') n++;
  }
  return n;
}
