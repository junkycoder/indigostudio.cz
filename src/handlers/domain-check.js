// src/handlers/domain-check.js
//
// GET /api/domain/check?base=vasefirma
// Backend si projde 6 TLD přes Subreg paralelně, vrátí {fqdn, available,
// price_kc_year}. Cache výsledků v KV 1h per fqdn — Subreg per-account quoty
// jsou citlivé, nejsme jediný uživatel API.
//
// Klientskou cenu drží tahle vrstva, ne frontend. Subreg vrací nákupní cenu
// (proměnná dle TLD a kurzu); my prodáváme za predikovatelný flat rate.

import { checkDomain } from '../lib/subreg.js';

const ALLOWED_TLDS = ['cz', 'com', 'eu', 'sk', 'net', 'org'];

// Klientská cena za rok registrace (incl. marže pro studio).
// Po stabilizaci přesunout do D1 tabulky `domain_prices` a Fakan upravuje
// přímo přes DB query.
const CLIENT_PRICES_CZK = {
  cz: 299, com: 399, eu: 349, sk: 499, net: 449, org: 449,
};

const ok   = (data, status = 200) => Response.json({ ok: true,  ...data }, { status });
const fail = (msg, status = 400)  => Response.json({ ok: false, error: msg }, { status });

export async function handleDomainCheck(request, env) {
  if (request.method !== 'GET') return fail('Method not allowed', 405);

  const url = new URL(request.url);
  const rawBase = url.searchParams.get('base') || '';
  const base = sanitizeBase(rawBase);
  if (!base) return fail('Zadejte platný název domény (písmena, číslice a pomlčky, max 63 znaků).');

  // Rate limit per IP — 30 dotazů/h, hladký pro klienty kteří hledají,
  // tvrdší než audit/suggestion (read-only check).
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const rlKey = `rl:domain:ip:${ip}`;
  const rlCnt = parseInt((await env.RATELIMIT.get(rlKey)) || '0', 10);
  if (rlCnt >= 30) return fail('Moc dotazů z jedné IP. Zkuste za hodinu.', 429);
  await env.RATELIMIT.put(rlKey, String(rlCnt + 1), { expirationTtl: 3600 });

  const results = await Promise.all(ALLOWED_TLDS.map((tld) => lookupOne(env, `${base}.${tld}`, tld)));
  return ok({ base, results });
}

async function lookupOne(env, fqdn, tld) {
  const cacheKey = `dom:${fqdn}`;
  const cached = await env.AUDIT_CACHE.get(cacheKey, { type: 'json' });
  if (cached) return cached;

  let entry = {
    fqdn,
    tld,
    status: 'unknown',
    available: false,
    price_kc_year: CLIENT_PRICES_CZK[tld] || null,
  };

  try {
    const r = await checkDomain(env, fqdn);
    entry = {
      fqdn,
      tld,
      status: r.available ? 'free' : (r.status === 'banned' ? 'banned' : 'taken'),
      available: r.available,
      price_kc_year: CLIENT_PRICES_CZK[tld] || null,
    };
  } catch (err) {
    console.warn(`domain-check ${fqdn}: ${err.message}`);
    // Neznámý stav (Subreg nedostupný / jiný problém) — frontend ho zobrazí
    // jako "neověřeno" a nabídne klientovi mailový dotaz.
  }

  // Cache 1h pro free/taken, 5 min pro unknown (rychlejší retry).
  const ttl = entry.status === 'unknown' ? 300 : 3600;
  await env.AUDIT_CACHE.put(cacheKey, JSON.stringify(entry), { expirationTtl: ttl });
  return entry;
}

function sanitizeBase(raw) {
  let s = String(raw || '').trim().toLowerCase();
  if (!s) return null;
  s = s.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  s = s.split('.')[0];
  // IDN → punycode přes URL parser
  try {
    const host = new URL('http://' + s + '.example').hostname;
    s = host.split('.')[0];
  } catch { /* fallback na raw */ }
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(s)) return null;
  return s;
}
