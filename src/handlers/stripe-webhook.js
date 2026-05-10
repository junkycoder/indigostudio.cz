// src/handlers/stripe-webhook.js
//
// POST /api/stripe/webhook
// Stripe na tenhle endpoint posílá lifecycle eventy (payment_intent.succeeded,
// charge.refunded, …). Endpoint je veřejný — autenticitu ověřujeme HMAC
// podpisem v hlavičce Stripe-Signature.
//
// Pravidla (drží se Stripe best practices):
//   1. Signature ověřit PŘED parsováním. Bez podpisu = 400.
//   2. Idempotence per event.id přes payments tabulku (PK). Stripe doručuje
//      "at-least-once" — duplicate event = 200, nic nedělej znova.
//   3. Webhook handler vrací rychle. Těžké práce (AI render, doménová
//      registrace) jdou přes Queue. Stripe má 30s timeout.
//   4. Vždy 200 pro úspěšné zpracování. 4xx = Stripe to bude zkoušet znova,
//      což je správné chování pro chybu na naší straně.

import { verifyWebhookSignature } from '../lib/stripe.js';

export async function handleStripeWebhook(request, env, ctx) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.error('stripe-webhook: STRIPE_WEBHOOK_SECRET není nastaveno');
    return new Response('Misconfigured', { status: 500 });
  }

  // Raw body (NE request.json()) — pro signature musíme byte-exact text.
  const rawBody = await request.text();
  const sigHeader = request.headers.get('Stripe-Signature') || '';

  let event;
  try {
    event = await verifyWebhookSignature(rawBody, sigHeader, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.warn('stripe-webhook: signature reject', err.message);
    return new Response('Invalid signature', { status: 400 });
  }

  // Idempotence: zkus INSERT, na konfliktu (event.id už uložený) skonči 200.
  const now = Math.floor(Date.now() / 1000);
  const orderId = await resolveOrderIdFromEvent(env, event);

  let inserted = false;
  try {
    const result = await env.DB.prepare(
      `INSERT INTO payments (id, order_id, event_type, payload_json, received_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(event.id, orderId, event.type, rawBody, now).run();
    inserted = result.success === undefined ? true : result.success;
  } catch (err) {
    // UNIQUE constraint na PK = duplicate event. Logneme a vrátíme 200.
    if (/UNIQUE|constraint/i.test(String(err?.message))) {
      console.log('stripe-webhook: duplicate event', event.id);
      return new Response('OK', { status: 200 });
    }
    console.error('stripe-webhook: payments insert error', err);
    return new Response('DB error', { status: 500 });
  }

  if (!inserted) {
    return new Response('OK', { status: 200 });
  }

  try {
    await dispatchEvent(event, env, ctx);
  } catch (err) {
    // Nezdařený dispatch = neoznačíme event jako zpracovaný (Stripe pošle znovu).
    // Smazat z payments, ať příští doručení projde.
    console.error('stripe-webhook: dispatch error', err);
    await env.DB.prepare(`DELETE FROM payments WHERE id = ?`).bind(event.id).run().catch(() => {});
    return new Response('Processing error', { status: 500 });
  }

  return new Response('OK', { status: 200 });
}

// ---- helpers --------------------------------------------------------------

// Order ID je v PaymentIntent.metadata.order_id (nastavujeme při create).
// Některé eventy (charge.*, customer.*) ho nemají přímo — pokud to potřebujeme,
// projdeme přes payment_intent ID v event.data.object.payment_intent.
async function resolveOrderIdFromEvent(env, event) {
  const obj = event?.data?.object;
  if (!obj) return null;

  // PaymentIntent eventy
  if (obj.metadata?.order_id) return obj.metadata.order_id;

  // Charge / refund — má payment_intent ID, najdeme order podle něj
  if (obj.payment_intent) {
    const row = await env.DB.prepare(
      `SELECT id FROM orders WHERE stripe_payment_intent_id = ? LIMIT 1`
    ).bind(obj.payment_intent).first();
    return row?.id || null;
  }
  return null;
}

async function dispatchEvent(event, env, ctx) {
  const now = Math.floor(Date.now() / 1000);
  const obj = event.data.object;

  switch (event.type) {
    case 'payment_intent.succeeded': {
      // Najdi order, posuň status, enqueue na zpracování (AI render / registrace).
      const order = await loadOrderForPI(env, obj.id);
      if (!order) {
        // Stripe poslal úspěch pro PI bez orderu (test webhook, ručně vytvořený PI…) — ignoruj.
        console.warn('stripe-webhook: succeeded PI bez orderu', obj.id);
        return;
      }
      if (order.status === 'paid' || order.status === 'processing' || order.status === 'done') {
        return; // už jsme přes
      }
      await env.DB.prepare(
        `UPDATE orders SET status = 'paid', paid_at = ?, updated_at = ? WHERE id = ?`
      ).bind(now, now, order.id).run();
      await env.AUDIT_QUEUE.send({ kind: orderKindToQueueKind(order.kind), orderId: order.id });
      return;
    }

    case 'payment_intent.payment_failed': {
      const order = await loadOrderForPI(env, obj.id);
      if (!order) return;
      const err = obj.last_payment_error?.message || 'Platba selhala';
      await env.DB.prepare(
        `UPDATE orders SET status = 'failed', error_message = ?, updated_at = ? WHERE id = ?`
      ).bind(err, now, order.id).run();
      return;
    }

    case 'payment_intent.canceled': {
      const order = await loadOrderForPI(env, obj.id);
      if (!order) return;
      await env.DB.prepare(
        `UPDATE orders SET status = 'canceled', updated_at = ? WHERE id = ?`
      ).bind(now, order.id).run();
      return;
    }

    case 'charge.refunded': {
      // obj je charge, ne PI
      if (!obj.payment_intent) return;
      const order = await loadOrderForPI(env, obj.payment_intent);
      if (!order) return;
      await env.DB.prepare(
        `UPDATE orders SET status = 'refunded', updated_at = ? WHERE id = ?`
      ).bind(now, order.id).run();
      return;
    }

    default:
      // Nezpracováváme. Záznam v `payments` tabulce stačí pro audit.
      return;
  }
}

async function loadOrderForPI(env, paymentIntentId) {
  return env.DB.prepare(
    `SELECT id, kind, status, lead_id, email FROM orders WHERE stripe_payment_intent_id = ? LIMIT 1`
  ).bind(paymentIntentId).first();
}

function orderKindToQueueKind(kind) {
  switch (kind) {
    case 'suggestion':       return 'suggestion-render';
    case 'domain_register':  return 'domain-register';
    case 'domain_transfer':  return 'domain-transfer';
    default: throw new Error(`Neznámý order.kind: ${kind}`);
  }
}
