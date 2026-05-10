// src/lib/idempotency.js
//
// Klient pošle `Idempotency-Key` header při POST. Server uloží odpověď spolu
// s SHA-256 hashem těla. Při opakování:
//   - stejný klíč + stejný hash → vrátit cached response
//   - stejný klíč + jiný hash → 409 (replay s pozměněnými daty)
//   - klíč neexistuje → first request, zpracovat normálně
//
// TTL 24h zajistí cleanup cron (až přibude — zatím se to čistí ručně nebo
// opt-in `purgeOld`). 24h stačí pro retry-burst, delší by zbytečně držely DB.

const TTL_SECONDS = 24 * 60 * 60;

export async function sha256Hex(text) {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Vrací buď { hit: true, response } pokud je cached, { hit: false, hash } pokud first.
// Při konfliktu (jiný hash, stejný klíč) vrací { conflict: true }.
export async function checkIdempotency(env, { key, bodyText }) {
  if (!key) return { hit: false, hash: null }; // klient nedoplnil — neukládáme
  const hash = await sha256Hex(bodyText);
  const row = await env.DB.prepare(
    `SELECT request_hash, response_status, response_body, created_at
       FROM idempotency_keys WHERE key = ? LIMIT 1`
  ).bind(key).first();

  if (!row) return { hit: false, hash };

  // Stale klíč starší než TTL = ignoruj (chovej se jako first), ať klient s pomalým
  // retry po 25h dostane fresh response místo zastaralého 200.
  const now = Math.floor(Date.now() / 1000);
  if (now - row.created_at > TTL_SECONDS) return { hit: false, hash };

  if (row.request_hash !== hash) return { conflict: true };

  return {
    hit: true,
    response: new Response(row.response_body, {
      status: row.response_status,
      headers: { 'Content-Type': 'application/json' },
    }),
  };
}

export async function saveIdempotency(env, { key, hash, response }) {
  if (!key || !hash) return;
  // Klonujeme response, abychom mohli text() z těla a nepoškodili origin response
  const cloned = response.clone();
  const body = await cloned.text();
  const now = Math.floor(Date.now() / 1000);
  try {
    await env.DB.prepare(
      `INSERT INTO idempotency_keys (key, request_hash, response_status, response_body, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(key, hash, response.status, body, now).run();
  } catch (err) {
    // UNIQUE constraint = mezitím přišel paralelní request se stejným klíčem.
    // Není to chyba — ten druhý request už něco uložil. Ignoruj.
    if (!/UNIQUE|constraint/i.test(String(err?.message))) throw err;
  }
}

// Smaže klíče starší než 24h. Volat z cron handleru.
export async function purgeOldIdempotency(env) {
  const cutoff = Math.floor(Date.now() / 1000) - TTL_SECONDS;
  await env.DB.prepare(`DELETE FROM idempotency_keys WHERE created_at < ?`).bind(cutoff).run();
}
