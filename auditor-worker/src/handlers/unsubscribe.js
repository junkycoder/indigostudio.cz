// src/handlers/unsubscribe.js
// GET /unsubscribe?token=...

export async function handleUnsubscribe(request, env) {
  const token = new URL(request.url).searchParams.get('token');
  if (!token) return new Response('Bad token', { status: 400 });

  const r = await env.DB.prepare(
    `UPDATE leads SET status='unsubscribed' WHERE unsub_token = ?`
  ).bind(token).run();

  const ok = (r.meta?.changes || 0) > 0;
  const msg = ok
    ? 'Hotovo. Už vás nebudeme obtěžovat.'
    : 'Tenhle odkaz nefunguje. Napište nám: jsem@fakan.cz';

  return new Response(`<!doctype html><meta charset="utf-8"><title>Odhlášeno</title>
<style>body{font-family:Georgia,serif;max-width:520px;margin:6em auto;padding:1em;color:#1F1B16;background:#F9F6F0}</style>
<h1>${msg}</h1><p><a href="https://fakan.cz">Zpět na fakan.cz</a></p>`,
    { headers: { 'content-type': 'text/html; charset=utf-8' } });
}
