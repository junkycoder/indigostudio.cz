// src/optout.test.js
// Mock testy pro handleOptout. Spouští se přes `node --test src/optout.test.js`.
// Žádné npm dependencies — built-in `node:test` + `node:assert`.

import { test } from 'node:test';
import assert from 'node:assert/strict';

// `mail.js` lazy-importuje `cloudflare:email`, který v Node neexistuje.
// `mail.js` ho ale resolveuje přes globalThis.EmailMessage, když je nastavený.
// Stačí tedy mock před importem optout.js.
globalThis.EmailMessage = class MockEmailMessage {
  constructor(from, to, raw) {
    this.from = from;
    this.to = to;
    this.raw = raw;
  }
};

const { handleOptout } = await import('./optout.js');

const VALID_TOKEN = 'a'.repeat(64); // 64 znaků hex
const INVALID_TOKEN_FORMAT = 'foo'; // krátké, non-hex
const URL_BASE = 'https://fakan.cz/odhlasit';

/**
 * Postaví mock D1 + collector volání.
 * `firstResult` = co vrátí `.first()` (řádek z `leads`) nebo null.
 * `runError` / `firstError` umožní simulovat DB chybu.
 */
function makeMockEnv({ firstResult = null, firstError = null, runError = null } = {}) {
  const calls = { prepare: [], bind: [], first: 0, run: 0 };

  const stmt = {
    bind(...args) {
      calls.bind.push(args);
      return stmt;
    },
    async first() {
      calls.first++;
      if (firstError) throw firstError;
      return firstResult;
    },
    async run() {
      calls.run++;
      if (runError) throw runError;
      return { success: true };
    },
  };

  const env = {
    DB: {
      prepare(sql) {
        calls.prepare.push(sql);
        return stmt;
      },
    },
    EMAIL: {
      sendCalls: [],
      async send(msg) {
        env.EMAIL.sendCalls.push(msg);
      },
    },
  };

  return { env, calls };
}

function makeMockCtx() {
  const waitedPromises = [];
  return {
    waitedPromises,
    waitUntil(p) {
      waitedPromises.push(p);
    },
  };
}

function makeRequest(t) {
  const url = t === undefined ? URL_BASE : `${URL_BASE}?t=${encodeURIComponent(t)}`;
  return new Request(url, { method: 'GET' });
}

// ---- Scenario 1: Valid token, row exists with status='new' ------------------
test('valid token + existující řádek → DB UPDATE volaný, response 200, ctx.waitUntil zavolaný', async () => {
  const { env, calls } = makeMockEnv({
    firstResult: { id: 'lead-uuid-1', email: 'kdosi@example.cz', status: 'new' },
  });
  const ctx = makeMockCtx();

  const res = await handleOptout(makeRequest(VALID_TOKEN), env, ctx);

  assert.equal(res.status, 200, 'odpověď je 200');
  assert.match(res.headers.get('content-type') || '', /text\/html/);
  assert.match(res.headers.get('cache-control') || '', /no-store/);
  assert.equal(res.headers.get('set-cookie'), null, 'žádný Set-Cookie');

  const body = await res.text();
  assert.match(body, /Hotovo, odhlásili jsme vás\./);
  assert.match(body, /noindex/, 'meta robots noindex');
  assert.match(body, /Indigo Studio s\.r\.o\./, 'footer s patičkou');

  // SELECT + UPDATE
  assert.equal(calls.prepare.length, 2, '2 SQL: SELECT + UPDATE');
  assert.match(calls.prepare[0], /SELECT/);
  assert.match(calls.prepare[1], /UPDATE leads SET status/);
  assert.equal(calls.first, 1);
  assert.equal(calls.run, 1, 'UPDATE byl proveden');

  // ctx.waitUntil zavolaný
  assert.equal(ctx.waitedPromises.length, 1, 'ctx.waitUntil zavolaný 1×');

  // Po dokončení paralelního mailu by měl `EMAIL.send` být zavolaný.
  await Promise.all(ctx.waitedPromises);
  assert.equal(env.EMAIL.sendCalls.length, 1, 'sendMail došel až do EMAIL.send');
});

// ---- Scenario 2: Valid format, row not found --------------------------------
test('valid hex format ale řádek neexistuje → žádný UPDATE, žádný mail, response 200 generic', async () => {
  const { env, calls } = makeMockEnv({ firstResult: null });
  const ctx = makeMockCtx();

  const res = await handleOptout(makeRequest(VALID_TOKEN), env, ctx);

  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /Hotovo, odhlásili jsme vás\./, 'stejná stránka jako úspěch');

  assert.equal(calls.prepare.length, 1, 'jen SELECT, žádný UPDATE');
  assert.equal(calls.run, 0, 'žádný UPDATE run');
  assert.equal(ctx.waitedPromises.length, 0, 'žádný mail neposílán');
  assert.equal(env.EMAIL.sendCalls.length, 0);
});

// ---- Scenario 3: Invalid format ---------------------------------------------
test("invalid format t=foo → žádné DB volání, response 200 generic", async () => {
  const { env, calls } = makeMockEnv({ firstResult: null });
  const ctx = makeMockCtx();

  const res = await handleOptout(makeRequest(INVALID_TOKEN_FORMAT), env, ctx);

  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body, /Hotovo, odhlásili jsme vás\./);

  assert.equal(calls.prepare.length, 0, 'žádný DB call');
  assert.equal(calls.run, 0);
  assert.equal(ctx.waitedPromises.length, 0);
});

// ---- Scenario 4: Missing `t` parameter --------------------------------------
test("chybějící parametr t → response 200 generic (NE 400, per AC § risk-check)", async () => {
  const { env, calls } = makeMockEnv();
  const ctx = makeMockCtx();

  const res = await handleOptout(makeRequest(undefined), env, ctx);

  // tasks.md AC: „regex fail → 200 generic, ne 400 ani 404"
  // chybějící parametr je podmnožina „neplatného tokenu" → 200 generic.
  assert.equal(res.status, 200, '200 generic, ne 400');
  const body = await res.text();
  assert.match(body, /Hotovo, odhlásili jsme vás\./);
  assert.equal(calls.prepare.length, 0, 'žádný DB call');
});

// ---- Scenario 5 (bonus): Idempotence — token už opted_out -------------------
test("idempotence: 2× klik (status už opted_out) → žádný UPDATE, žádný duplicitní mail", async () => {
  const { env, calls } = makeMockEnv({
    firstResult: { id: 'lead-uuid-1', email: 'kdosi@example.cz', status: 'opted_out' },
  });
  const ctx = makeMockCtx();

  const res = await handleOptout(makeRequest(VALID_TOKEN), env, ctx);

  assert.equal(res.status, 200);
  assert.equal(calls.prepare.length, 1, 'jen SELECT');
  assert.equal(calls.run, 0, 'žádný UPDATE');
  assert.equal(ctx.waitedPromises.length, 0, 'žádný duplicitní mail');
  assert.equal(env.EMAIL.sendCalls.length, 0);
});

// ---- Scenario 6 (bonus): DB error → 503 -------------------------------------
test('DB error při SELECT → 503 s lidskou hláškou', async () => {
  const { env } = makeMockEnv({ firstError: new Error('D1 timeout') });
  const ctx = makeMockCtx();

  const res = await handleOptout(makeRequest(VALID_TOKEN), env, ctx);

  assert.equal(res.status, 503);
  const body = await res.text();
  assert.match(body, /Dočasná chyba/);
  assert.match(body, /Zkuste to prosím znovu/);
});
