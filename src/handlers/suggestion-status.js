// src/handlers/suggestion-status.js
//
// GET /api/suggestion/{orderId}/status
// Bez autentizace — orderId je 36-znakové UUID, prakticky neuhodnutelné.
// Vrací jen polia bezpečné k prozrazení (status, has* příznaky, čas dokončení),
// nikdy email/brief/IP/payment-intent.

const ok   = (data, status = 200) => Response.json({ ok: true,  ...data }, { status });
const fail = (msg, status = 400)  => Response.json({ ok: false, error: msg }, { status });

const RX_ORDER_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export async function handleSuggestionStatus(request, env) {
  const url = new URL(request.url);
  const m = url.pathname.match(/^\/api\/suggestion\/([^/]+)\/status$/);
  if (!m) return fail('Bad path', 404);

  const orderId = m[1];
  if (!RX_ORDER_ID.test(orderId)) return fail('Invalid order id', 400);

  const row = await env.DB.prepare(
    `SELECT o.id, o.status, o.error_message, o.completed_at, o.amount_cents, o.currency,
            s.preview_image_key, s.html_output_key, s.url
       FROM orders o
       LEFT JOIN suggestions s ON s.order_id = o.id
      WHERE o.id = ? AND o.kind = 'suggestion' LIMIT 1`
  ).bind(orderId).first();

  if (!row) return fail('Not found', 404);

  return ok({
    orderId,
    status: row.status,                  // 'created' | 'awaiting_payment' | 'paid' | 'processing' | 'done' | 'failed' | 'refunded' | 'canceled'
    errorMessage: row.error_message,
    completedAt: row.completed_at,
    amountCents: row.amount_cents,
    currency: row.currency,
    url: row.url,
    hasPreview: !!row.preview_image_key,
    hasOutput: !!row.html_output_key,
    // Veřejné URL na preview obrázek a zdrojový HTML/CSS — frontend si je
    // zobrazí. R2 fetch handler musí být veřejný se stejnou ochranou
    // (orderId guess-resistance).
    previewUrl: row.preview_image_key ? `/api/suggestion/${orderId}/preview` : null,
    outputUrl:  row.html_output_key   ? `/api/suggestion/${orderId}/output`  : null,
  });
}

// GET /api/suggestion/{orderId}/preview  — stream PNG preview
// GET /api/suggestion/{orderId}/output   — stream HTML/CSS zdroják
export async function handleSuggestionAsset(request, env) {
  const url = new URL(request.url);
  const m = url.pathname.match(/^\/api\/suggestion\/([^/]+)\/(preview|output)$/);
  if (!m) return fail('Bad path', 404);

  const orderId = m[1];
  const which = m[2];
  if (!RX_ORDER_ID.test(orderId)) return fail('Invalid order id', 400);

  const row = await env.DB.prepare(
    `SELECT preview_image_key, html_output_key FROM suggestions WHERE order_id = ? LIMIT 1`
  ).bind(orderId).first();
  if (!row) return fail('Not found', 404);

  const key = which === 'preview' ? row.preview_image_key : row.html_output_key;
  if (!key) return fail('Not ready yet', 404);

  const obj = await env.REPORTS.get(key);
  if (!obj) return fail('Asset gone', 410);

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  if (which === 'preview' && !headers.get('Content-Type')) {
    headers.set('Content-Type', 'image/png');
  } else if (which === 'output' && !headers.get('Content-Type')) {
    headers.set('Content-Type', 'text/html; charset=utf-8');
  }
  // Cache stejně jako audit screenshot
  headers.set('Cache-Control', 'public, max-age=300');
  return new Response(obj.body, { headers });
}
