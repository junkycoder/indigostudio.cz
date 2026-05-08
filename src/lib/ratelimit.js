// src/lib/ratelimit.js
// Anti-abuse helpers pro lead capture: KV-based fixed-window rate limit + honeypot detekce.
// Per design.md § 7.1 + § 7.2. Bez npm závislostí.

import { sha256Hex } from './hash.js';

// Whitelist scope hodnot — chráníme proti pollution KV namespace náhodným klíčem od callera.
const ALLOWED_SCOPES = new Set(['lead-capture', 'analyze']);

/**
 * Zkontroluje a inkrementuje rate limit counter pro daný scope + IP.
 *
 * Algoritmus: fixed-window counter v KV. Klíč `ratelimit:{scope}:{ipHash}`,
 * hodnota = integer (počet requestů v okně), TTL = `windowSeconds`.
 *
 * Trade-off: KV `put` po `get` není atomický. Při souběžných requestech ze stejné IP
 * se může counter resetovat a propustit o 1–2 requesty víc, než limit dovoluje.
 * Pro 5 leadů/h to nevadí, není to bezpečnostní hranice (per design § 7.1).
 *
 * Degradace v dev / když chybí salt nebo IP: vrací permissive `{ ok: true, remaining: -1 }`
 * a zaloguje warning. Lead capture pokračuje, rate limit se prostě neuplatní.
 *
 * @param {object} args
 * @param {object} args.env — Worker env (musí obsahovat `RATELIMIT` KV binding a `CONSENT_SALT`)
 * @param {Request} args.request — incoming request, použije se `cf-connecting-ip` header
 * @param {'lead-capture'|'analyze'} args.scope — typ akce
 * @param {number} args.limit — max requestů v okně
 * @param {number} args.windowSeconds — délka okna v sekundách
 * @returns {Promise<{ok: boolean, remaining: number, resetAt: number}>}
 */
export async function checkRateLimit({ env, request, scope, limit, windowSeconds }) {
  // Validace scope — whitelist, ať nikdo neudělá překlep a nezasere KV namespace.
  if (!ALLOWED_SCOPES.has(scope)) {
    console.warn(`[ratelimit] neznámý scope "${scope}" — degradace na permissive`);
    return { ok: true, remaining: -1, resetAt: 0 };
  }

  // Dev / chybějící salt → permissive mode.
  if (!env || !env.CONSENT_SALT) {
    console.warn('[ratelimit] CONSENT_SALT chybí — degradace na permissive (dev mode)');
    return { ok: true, remaining: -1, resetAt: 0 };
  }

  // Chybí KV binding → graceful degradation, nesmíme rozbít lead capture.
  if (!env.RATELIMIT) {
    console.warn('[ratelimit] RATELIMIT KV binding chybí — degradace na permissive');
    return { ok: true, remaining: -1, resetAt: 0 };
  }

  // IP — Cloudflare ji dává v `cf-connecting-ip`. Fallback na permissive, když chybí.
  const ip = request?.headers?.get?.('cf-connecting-ip');
  if (!ip) {
    console.warn('[ratelimit] cf-connecting-ip chybí — degradace na permissive');
    return { ok: true, remaining: -1, resetAt: 0 };
  }

  let ipHash;
  try {
    ipHash = await sha256Hex(ip, env.CONSENT_SALT);
  } catch (err) {
    console.warn('[ratelimit] hash selhal', err);
    return { ok: true, remaining: -1, resetAt: 0 };
  }

  const key = `ratelimit:${scope}:${ipHash}`;
  const now = Date.now();
  const resetAt = now + windowSeconds * 1000;

  try {
    const current = await env.RATELIMIT.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= limit) {
      return { ok: false, remaining: 0, resetAt };
    }

    await env.RATELIMIT.put(key, String(count + 1), { expirationTtl: windowSeconds });
    return { ok: true, remaining: limit - count - 1, resetAt };
  } catch (err) {
    // KV chyba nesmí shodit lead capture — log warning a propustit.
    console.warn('[ratelimit] KV operace selhala', err);
    return { ok: true, remaining: -1, resetAt: 0 };
  }
}

/**
 * Zkontroluje honeypot pole ve form datech.
 *
 * Honeypot je skryté pole, které lidi nevyplní, ale boti automaticky ano.
 * Per design § 7.2 je oficiální název pole `company`. Junior v TASK-16 použil
 * v `index.html` název `website` — držíme oba pro safety, ať to funguje
 * bez ohledu na to, který z nich form aktuálně posílá.
 *
 * @param {URLSearchParams|FormData|{get: (name: string) => string|null}} formData
 * @returns {boolean} true = vypadá to jako člověk (pole prázdná), false = bot (pole vyplněné)
 */
export function checkHoneypot(formData) {
  if (!formData || typeof formData.get !== 'function') {
    // Defenzivně: nemáme co zkontrolovat → propustíme jako člověka.
    return true;
  }

  const fields = ['company', 'website'];
  for (const name of fields) {
    const value = formData.get(name);
    if (value !== null && value !== undefined && String(value).trim() !== '') {
      // Bot vyplnil honeypot.
      return false;
    }
  }
  return true;
}
