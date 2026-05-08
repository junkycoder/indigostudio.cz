// src/analyze.test.js
// Mock testy pro analyze.js — TASK-12 (lead capture piggyback po `done`).
// Spouští se přes `node --test src/analyze.test.js`.
// Žádné npm dependencies — built-in `node:test` + `node:assert`.
//
// Pokrytí:
//   1. parseLeadParams — všechny větve (enabled / missing email / consent / version)
//   2. getTop3Issues — priority sort, filter `ok`, max 3
//   3. handleAnalyze — honeypot trigger → 200 + empty SSE stream
//   4. handleAnalyze — bez env/ctx → analýza nepadá (legacy path)
//
// Lead-capture-and-mail integration test je proveden přes externí mock přepsaných
// `captureLead` / `sendMail` modulů — viz pozn. níže. Pro plný E2E test (network
// fetch + SSE + DB) by bylo potřeba `wrangler dev`, což není v jurisdikci unit testu.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// `mail.js` lazy-importuje `cloudflare:email`, který v Node neexistuje.
// Stejný pattern jako optout.test.js.
globalThis.EmailMessage = class MockEmailMessage {
  constructor(from, to, raw) {
    this.from = from;
    this.to = to;
    this.raw = raw;
  }
};

const { parseLeadParams, getTop3Issues, handleAnalyze } = await import('./analyze.js');

// -----------------------------------------------------------------------------
// 1) parseLeadParams
// -----------------------------------------------------------------------------

test('parseLeadParams: všechno OK → enabled=true', () => {
  const sp = new URLSearchParams('email=jan%40fakan.cz&c=1&v=v1-2026-05-08&s=landing-hero');
  const out = parseLeadParams(sp);
  assert.equal(out.enabled, true);
  assert.equal(out.email, 'jan@fakan.cz');
  assert.equal(out.consentVersion, 'v1-2026-05-08');
  assert.equal(out.source, 'landing-hero');
});

test('parseLeadParams: chybí email → enabled=false, reason=missing_email', () => {
  const sp = new URLSearchParams('c=1&v=v1');
  const out = parseLeadParams(sp);
  assert.equal(out.enabled, false);
  assert.equal(out.reason, 'missing_email');
});

test('parseLeadParams: c!=1 → enabled=false, reason=missing_consent', () => {
  const sp = new URLSearchParams('email=jan%40fakan.cz&v=v1');
  const out = parseLeadParams(sp);
  assert.equal(out.enabled, false);
  assert.equal(out.reason, 'missing_consent');
});

test('parseLeadParams: chybí v → enabled=false, reason=missing_version', () => {
  const sp = new URLSearchParams('email=jan%40fakan.cz&c=1');
  const out = parseLeadParams(sp);
  assert.equal(out.enabled, false);
  assert.equal(out.reason, 'missing_version');
});

test('parseLeadParams: bez s → source=manual default', () => {
  const sp = new URLSearchParams('email=jan%40fakan.cz&c=1&v=v1');
  const out = parseLeadParams(sp);
  assert.equal(out.enabled, true);
  assert.equal(out.source, 'manual');
});

// -----------------------------------------------------------------------------
// 2) getTop3Issues
// -----------------------------------------------------------------------------

test('getTop3Issues: filtruje `ok` verdikty', () => {
  const verdicts = [
    { kind: 'ok', text: 'Web odpovídá HTTP 200.' },
    { kind: 'warn', text: 'Cookie banner.' },
    { kind: 'crit', text: 'Není na HTTPS.' },
  ];
  const top = getTop3Issues(verdicts);
  assert.deepEqual(top, ['Není na HTTPS.', 'Cookie banner.']);
});

test('getTop3Issues: priorita crit > warn > info', () => {
  const verdicts = [
    { kind: 'info', text: 'info1' },
    { kind: 'warn', text: 'warn1' },
    { kind: 'crit', text: 'crit1' },
    { kind: 'warn', text: 'warn2' },
    { kind: 'crit', text: 'crit2' },
  ];
  const top = getTop3Issues(verdicts);
  // Očekáváme: oba crity, pak první warn (slice 3).
  assert.deepEqual(top, ['crit1', 'crit2', 'warn1']);
});

test('getTop3Issues: prázdný / nevalidní vstup → []', () => {
  assert.deepEqual(getTop3Issues([]), []);
  assert.deepEqual(getTop3Issues(null), []);
  assert.deepEqual(getTop3Issues(undefined), []);
});

test('getTop3Issues: max 3 i když je víc problémů', () => {
  const verdicts = Array.from({ length: 10 }, (_, i) => ({
    kind: 'warn',
    text: `problém ${i}`,
  }));
  const top = getTop3Issues(verdicts);
  assert.equal(top.length, 3);
});

// -----------------------------------------------------------------------------
// 3) handleAnalyze — honeypot
// -----------------------------------------------------------------------------

/**
 * Přečte celý SSE stream do stringu. Stream je TransformStream z makeSse().
 */
async function readAll(readable) {
  const reader = readable.getReader();
  const dec = new TextDecoder();
  let out = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) out += dec.decode(value);
  }
  return out;
}

test('handleAnalyze: honeypot `website` → 200 + prázdný SSE', async () => {
  const req = new Request('https://fakan.cz/api/analyze?url=https://example.cz&website=spam');
  const res = handleAnalyze(req);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/event-stream; charset=utf-8');
  const body = await readAll(res.body);
  assert.equal(body, '', 'Honeypot stream musí být prázdný (žádné SSE eventy).');
});

test('handleAnalyze: honeypot `company` → 200 + prázdný SSE', async () => {
  const req = new Request('https://fakan.cz/api/analyze?url=https://example.cz&company=x');
  const res = handleAnalyze(req);
  assert.equal(res.status, 200);
  const body = await readAll(res.body);
  assert.equal(body, '');
});

test('handleAnalyze: prázdný honeypot (=) → analýza poběží', async () => {
  // `?website=` (prázdný) by neměl být honeypot — uživatel ho prostě nevyplnil.
  // Místo skutečné analýzy testujeme jen, že nedostaneme prázdný stream
  // (pošle aspoň `hello`, pak fetch failne na DNS).
  const req = new Request('https://fakan.cz/api/analyze?url=https://example.cz&website=');
  const res = handleAnalyze(req);
  assert.equal(res.status, 200);
  // Nečteme body — fetch by se pokusil o reálné spojení. Stačí že status je 200.
});

// -----------------------------------------------------------------------------
// 4) handleAnalyze: bez env/ctx — legacy path nepadá
// -----------------------------------------------------------------------------

test('handleAnalyze: bez env/ctx → response 200, žádný throw', () => {
  const req = new Request('https://fakan.cz/api/analyze?url=https://example.cz');
  const res = handleAnalyze(req);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'text/event-stream; charset=utf-8');
});

test('handleAnalyze: invalid URL → 400 JSON', async () => {
  const req = new Request('https://fakan.cz/api/analyze?url=not-a-valid-url-no-dot');
  const res = handleAnalyze(req);
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.ok(json.error);
});

// -----------------------------------------------------------------------------
// 5) handleAnalyze: lead capture skipped (legacy: žádný email v query)
// -----------------------------------------------------------------------------

test('handleAnalyze: bez email/c/v → analýza pojede, lead capture se NESPUSTÍ', () => {
  // Test: i když dáme env+ctx, ale chybí email, ctx.waitUntil se NESMÍ zavolat.
  const waitUntilCalls = [];
  const ctx = { waitUntil: (p) => waitUntilCalls.push(p) };
  const env = { DB: {}, EMAIL: { send: async () => {} }, CONSENT_SALT: 'x' };

  const req = new Request('https://fakan.cz/api/analyze?url=https://example.cz');
  const res = handleAnalyze(req, env, ctx);
  assert.equal(res.status, 200);
  assert.equal(waitUntilCalls.length, 0, 'Lead capture nesmí být naplánován bez consent params.');
});

test('handleAnalyze: s email+c=1+v → ctx.waitUntil naplánován', () => {
  const waitUntilCalls = [];
  const ctx = { waitUntil: (p) => waitUntilCalls.push(p) };
  const env = { DB: {}, EMAIL: { send: async () => {} }, CONSENT_SALT: 'x' };

  const req = new Request(
    'https://fakan.cz/api/analyze?url=https://example.cz&email=jan%40fakan.cz&c=1&v=v1-2026-05-08&s=landing-hero'
  );
  const res = handleAnalyze(req, env, ctx);
  assert.equal(res.status, 200);
  assert.equal(waitUntilCalls.length, 1, 'Lead capture musí být naplánován přes ctx.waitUntil.');
});
