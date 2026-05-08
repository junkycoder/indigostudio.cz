// src/lib/lead.js
// Lead capture core — D1 insert + idempotence + IP hash.
// Iterace: landing-v2, TASK-06.
//
// Reference:
//   * projects/landing-v2/design.md § 2.3 (idempotence — UNIQUE index)
//   * projects/landing-v2/design.md § 3.1 (volání z /api/analyze přes ctx.waitUntil)
//   * projects/landing-v2/risk-check.md § 1.3 (URL strip — žádné tokeny v DB)
//   * projects/landing-v2/risk-check.md § 2.1 (právní titul = souhlas, server-side enforce)
//   * projects/landing-v2/risk-check.md § 2.2 (evidence souhlasu: at, version, ip_hash)
//   * migrations/0001_leads.sql (schema cílové tabulky)
//
// Pozor:
//   * Plnou IP NEUKLÁDÁME — jen sha256(ip + CONSENT_SALT). Recital 30 GDPR.
//   * `consent_at` nastavuje volající (frontend posílá `c=1`); tady to znamená
//     "kliknutí přišlo právě teď" → ISO timestamp v okamžiku INSERTu. Tahle funkce
//     se nesmí volat bez ověřeného `consent === true` na vyšší vrstvě (analyze.js).
//   * UNIQUE constraint na (email, url, day) → duplicita = tichý no-op, ne chyba.
//   * Žádné `console.log` debug výpisy — jen `console.error` u skutečné chyby.

import { stripUrl } from './url-strip.js';
import { sha256Hex, randomTokenHex } from './hash.js';

// Whitelist `source` hodnot — když přijde něco mimo, lead odmítáme.
// Řízeno z frontendu (index.html hero/CTA, vysledek.js, ruční API call).
const ALLOWED_SOURCES = new Set([
  'landing-hero',
  'landing-cta',
  'vysledek-cta',
  'manual',
]);

// Jednoduchý subset RFC 5322 — žádný "+" alias rozbití, akceptujeme vše,
// co obsahuje právě jeden `@` a alespoň jednu tečku v doméně.
// Schválně liberální: striktnější regex by odmítal valid emaily a špatný email
// stejně chytíme až při bounce odpovědi z mail relay.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Uloží lead do D1 tabulky `leads`. Pokud (email, url, den) už existuje,
 * vrátí `{ ok: true, lead: { duplicate: true } }` a nic nemění.
 *
 * Volající (typicky `analyze.js` přes `ctx.waitUntil`) musí předtím ověřit,
 * že uživatel dal souhlas (`c=1` v query stringu). Tahle funkce souhlas
 * sama negaruje — jen ho zaeviduje (consent_at, consent_text_version, consent_ip_hash).
 *
 * @param {object} args
 * @param {object} args.env - Worker env (DB binding, CONSENT_SALT)
 * @param {Request} args.request - originální Request (pro IP z hlaviček)
 * @param {string} args.url - URL k analýze (před stripUrl)
 * @param {string} args.email - email uživatele
 * @param {string} args.source - jeden z ALLOWED_SOURCES
 * @param {string} args.consentVersion - verze textu souhlasu, např. 'v1-2026-05-08'
 * @returns {Promise<{ok: true, lead: {id?: string, email?: string, url?: string, unsubscribe_token?: string, duplicate?: boolean}} | {ok: false, error: string, detail?: string}>}
 */
export async function captureLead({ env, request, url, email, source, consentVersion }) {
  // 1) Validace input — fail fast, žádný DB write.
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return { ok: false, error: 'invalid_email' };
  }

  if (typeof consentVersion !== 'string' || consentVersion.length === 0) {
    return { ok: false, error: 'invalid_consent_version' };
  }

  if (!ALLOWED_SOURCES.has(source)) {
    return { ok: false, error: 'invalid_source' };
  }

  // 2) URL strip — risk-check § 1.3. `stripUrl` hodí TypeError u neplatné URL.
  let strippedUrl;
  try {
    strippedUrl = stripUrl(url);
  } catch (e) {
    return { ok: false, error: 'invalid_url' };
  }

  // 3) Salt check — bez saltu nemůžeme bezpečně hashovat IP.
  // Před prvním produkčním deployem: `wrangler secret put CONSENT_SALT`.
  if (!env || typeof env.CONSENT_SALT !== 'string' || env.CONSENT_SALT.length === 0) {
    return { ok: false, error: 'salt_missing' };
  }

  // 4) IP z Cloudflare hlaviček. `cf-connecting-ip` je primary, `x-forwarded-for`
  // fallback (lokální dev / mock test). `unknown` jen kdyby ani jedno nebylo —
  // hash je deterministický, takže `unknown` je trvalá hodnota (ne PII).
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown';

  const consentIpHash = await sha256Hex(ip, env.CONSENT_SALT);

  // 5) Generování ID + tokenu. Ne-odvozené od emailu (risk-check § 5.3).
  const id = randomTokenHex(16); // 32 hex znaků
  const unsubscribeToken = randomTokenHex(32); // 64 hex znaků
  const nowIso = new Date().toISOString();
  const normalizedEmail = email.trim().toLowerCase();

  // 6) INSERT — prepared statement, žádná string interpolace.
  // 12 NOT NULL sloupců naplníme explicitně; `status='new'` přes default,
  // `mail_attempts=0` přes default, nullable sloupce (consent_ua_hash,
  // mail_sent_at, mail_last_error, opted_out_at, notes) necháváme NULL.
  try {
    await env.DB.prepare(
      `INSERT INTO leads (
         id, created_at, url, email,
         consent_at, consent_text_version, consent_ip_hash,
         source, status, unsubscribe_token,
         last_contact_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`
    )
      .bind(
        id,
        nowIso,
        strippedUrl,
        normalizedEmail,
        nowIso, // consent_at
        consentVersion,
        consentIpHash,
        source,
        unsubscribeToken,
        nowIso // last_contact_at = created_at při insertu
      )
      .run();

    return {
      ok: true,
      lead: {
        id,
        email: normalizedEmail,
        url: strippedUrl,
        unsubscribe_token: unsubscribeToken,
        duplicate: false,
      },
    };
  } catch (e) {
    // Idempotence — UNIQUE index `leads_idem` (email, url, day) zachytí
    // duplicitu z téhož dne. To není chyba, jen tichý no-op.
    const msg = (e && e.message) || String(e);
    if (msg.includes('UNIQUE constraint failed')) {
      return { ok: true, lead: { duplicate: true } };
    }

    // Jiná DB chyba — návrat error objektu, volající rozhodne (analyze.js
    // by měl logovat a pokračovat, ne shodit SSE stream).
    console.error('[captureLead] db_error:', msg);
    return { ok: false, error: 'db_error', detail: msg };
  }
}
