// src/worker.test.js
// Mock testy pro top-level Worker routing. Spouští se: `node --test src/worker.test.js`.
// Žádné npm dependencies — built-in `node:test` + `node:assert`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// Mock pro `cloudflare:email` (lazy-importováno z mail.js přes optout.js).
globalThis.EmailMessage = class MockEmailMessage {
  constructor(from, to, raw) {
    this.from = from;
    this.to = to;
    this.raw = raw;
  }
};

const { default: worker } = await import('./worker.js');

// --- Pomocníci ---------------------------------------------------------------

function makeRequest(urlString, { method = 'GET', headers = {} } = {}) {
  // V Node 20+ existuje globální Request s plnou podporou. Spoléháme na něj.
  return new Request(urlString, { method, headers });
}

function makeCtx() {
  const calls = [];
  return {
    waitUntil(p) {
      calls.push(p);
    },
    _calls: calls,
  };
}

/**
 * Mock env — D1 + KV. KV defaultně vrací `null` (žádný counter), takže rate limit projde.
 * `kvCount` umožní nastavit aktuální counter pro test rate-limitu.
 */
function makeEnv({ kvCount = null, kvDisabled = false } = {}) {
  const env = {
    CONSENT_SALT: 'test-salt',
    DB: {
      prepare() {
        const stmt = {
          bind() {
            return stmt;
          },
          async first() {
            return null;
          },
          async run() {
            return { success: true };
          },
        };
        return stmt;
      },
    },
  };

  if (!kvDisabled) {
    env.RATELIMIT = {
      async get() {
        return kvCount === null ? null : String(kvCount);
      },
      async put() {
        return undefined;
      },
    };
  }

  return env;
}

// --- Testy -------------------------------------------------------------------

test('GET /odhlasit?t=<invalid> → 200 generic stránka (handleOptout)', async () => {
  const req = makeRequest('https://fakan.cz/odhlasit?t=foo', {
    headers: { 'cf-connecting-ip': '203.0.113.1' },
  });
  const res = await worker.fetch(req, makeEnv(), makeCtx());
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/html/);
});

test('GET /odhlasit/ (s lomítkem) → handleOptout (200)', async () => {
  const req = makeRequest('https://fakan.cz/odhlasit/', {
    headers: { 'cf-connecting-ip': '203.0.113.1' },
  });
  const res = await worker.fetch(req, makeEnv(), makeCtx());
  assert.equal(res.status, 200);
});

test('GET /api/analyze bez url → 400 (handleAnalyze běžel)', async () => {
  const req = makeRequest('https://fakan.cz/api/analyze', {
    headers: { 'cf-connecting-ip': '203.0.113.1' },
  });
  const res = await worker.fetch(req, makeEnv(), makeCtx());
  // analyze.js validuje `url` a vrací 400 při missing — důkaz že rate limit pustil.
  assert.equal(res.status, 400);
});

test('GET /api/analyze s honeypot website=spam → 200 SSE (handleAnalyze gateuje)', async () => {
  const req = makeRequest(
    'https://fakan.cz/api/analyze?url=https%3A%2F%2Fexample.cz&website=spam',
    { headers: { 'cf-connecting-ip': '203.0.113.1' } }
  );
  const res = await worker.fetch(req, makeEnv(), makeCtx());
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/event-stream/);
});

test('POST /api/analyze → 405', async () => {
  const req = makeRequest('https://fakan.cz/api/analyze', { method: 'POST' });
  const res = await worker.fetch(req, makeEnv(), makeCtx());
  assert.equal(res.status, 405);
  assert.equal(res.headers.get('allow'), 'GET');
});

test('GET /api/analyze s vyčerpaným rate limitem → 429 + Retry-After', async () => {
  const req = makeRequest('https://fakan.cz/api/analyze?url=https%3A%2F%2Fexample.cz', {
    headers: { 'cf-connecting-ip': '203.0.113.1' },
  });
  // Counter už je na limitu (3) → další request blokovaný.
  const res = await worker.fetch(req, makeEnv({ kvCount: 3 }), makeCtx());
  assert.equal(res.status, 429);
  const retryAfter = parseInt(res.headers.get('retry-after') || '0', 10);
  assert.ok(retryAfter > 0, 'Retry-After musí být kladné celé číslo');
  const body = await res.json();
  assert.equal(body.error, 'rate_limit');
  assert.ok(typeof body.resetAt === 'number');
});

test('POST /api/lead → 501 stub', async () => {
  const req = makeRequest('https://fakan.cz/api/lead', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
  });
  const res = await worker.fetch(req, makeEnv(), makeCtx());
  assert.equal(res.status, 501);
  const body = await res.json();
  assert.equal(body.error, 'not_implemented');
});

test('GET /api/neco-jineho → 501', async () => {
  const req = makeRequest('https://fakan.cz/api/foo');
  const res = await worker.fetch(req, makeEnv(), makeCtx());
  assert.equal(res.status, 501);
});

test('GET /něco-mimo-routy → 404 (defenzivně, jinak by to assets vzaly)', async () => {
  const req = makeRequest('https://fakan.cz/random-path');
  const res = await worker.fetch(req, makeEnv(), makeCtx());
  assert.equal(res.status, 404);
});
