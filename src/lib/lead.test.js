// src/lib/lead.test.js
// Mock test pro `captureLead` — jednoduché pole assertů, žádný framework.
// Spuštění:
//   node src/lib/lead.test.js
//
// Mockuje `env.DB` (D1 binding) a `request.headers` aby se otestovaly:
//   * happy path → `{ ok: true, lead: { id, ... } }`
//   * invalid email → `{ ok: false, error: 'invalid_email' }`
//   * invalid consent version → `{ ok: false, error: 'invalid_consent_version' }`
//   * invalid source (mimo whitelist) → `{ ok: false, error: 'invalid_source' }`
//   * invalid url → `{ ok: false, error: 'invalid_url' }`
//   * missing salt → `{ ok: false, error: 'salt_missing' }`
//   * UNIQUE constraint failed → `{ ok: true, lead: { duplicate: true } }`
//   * jiná DB chyba → `{ ok: false, error: 'db_error', detail }`
//
// Žádné dependency, jen Node 20+ (kvůli Web Crypto API v hash.js).

import { captureLead } from './lead.js';

let pass = 0;
let fail = 0;
const failures = [];

function assert(name, cond, info) {
  if (cond) {
    pass++;
    console.log(`  ok  ${name}`);
  } else {
    fail++;
    failures.push({ name, info });
    console.log(`  FAIL  ${name}` + (info ? ` — ${JSON.stringify(info)}` : ''));
  }
}

// --- Mock builders ---------------------------------------------------------

function mockRequest(headers = {}) {
  return {
    headers: {
      get: (name) => headers[name.toLowerCase()] ?? null,
    },
  };
}

/**
 * @param {object} opts
 * @param {Error|null} [opts.throwOnRun] - když je nastaveno, `.run()` hodí tuhle chybu
 * @returns {{ DB: object, calls: Array<{sql: string, params: any[]}>, CONSENT_SALT: string }}
 */
function mockEnv(opts = {}) {
  const calls = [];
  return {
    CONSENT_SALT: 'test-salt-do-not-use-in-prod',
    DB: {
      prepare: (sql) => ({
        bind: (...params) => ({
          run: async () => {
            calls.push({ sql, params });
            if (opts.throwOnRun) throw opts.throwOnRun;
            return { success: true };
          },
        }),
      }),
    },
    _calls: calls,
  };
}

// --- Tests -----------------------------------------------------------------

const baseArgs = {
  url: 'https://example.cz/page?token=secret',
  email: 'Jan.Novak@Example.cz',
  source: 'landing-hero',
  consentVersion: 'v1-2026-05-08',
};

async function testHappyPath() {
  console.log('\n# happy path');
  const env = mockEnv();
  const request = mockRequest({ 'cf-connecting-ip': '203.0.113.42' });
  const r = await captureLead({ env, request, ...baseArgs });

  assert('ok=true', r.ok === true, r);
  assert('lead.id is 32 hex', typeof r.lead?.id === 'string' && /^[0-9a-f]{32}$/.test(r.lead.id), r);
  assert(
    'unsubscribe_token is 64 hex',
    typeof r.lead?.unsubscribe_token === 'string' && /^[0-9a-f]{64}$/.test(r.lead.unsubscribe_token),
    r
  );
  assert('duplicate=false', r.lead?.duplicate === false, r);
  assert(
    'email is lowercased+trimmed',
    r.lead?.email === 'jan.novak@example.cz',
    r
  );
  assert(
    'url is stripped (no query)',
    r.lead?.url === 'https://example.cz/page',
    r
  );
  assert('1 DB call', env._calls.length === 1, env._calls);

  // Ověř že prepared statement dostal správné parametry v očekávaném pořadí
  // (id, created_at, url, email, consent_at, consent_text_version, consent_ip_hash, source, unsubscribe_token, last_contact_at)
  const params = env._calls[0]?.params || [];
  assert('10 bound params', params.length === 10, params);
  assert('param[2] = stripped url', params[2] === 'https://example.cz/page', params);
  assert('param[3] = lowercased email', params[3] === 'jan.novak@example.cz', params);
  assert('param[5] = consent version', params[5] === 'v1-2026-05-08', params);
  assert(
    'param[6] = sha256 hex (64 chars)',
    typeof params[6] === 'string' && /^[0-9a-f]{64}$/.test(params[6]),
    params
  );
  assert('param[6] != plain ip', params[6] !== '203.0.113.42', params);
  assert('param[7] = source', params[7] === 'landing-hero', params);
  // created_at == consent_at == last_contact_at při insertu
  assert(
    'created_at == consent_at',
    params[1] === params[4],
    params
  );
  assert(
    'created_at == last_contact_at',
    params[1] === params[9],
    params
  );
}

async function testInvalidEmail() {
  console.log('\n# invalid email');
  const env = mockEnv();
  const request = mockRequest();
  const r = await captureLead({ env, request, ...baseArgs, email: 'not-an-email' });
  assert('ok=false', r.ok === false, r);
  assert('error=invalid_email', r.error === 'invalid_email', r);
  assert('no DB call', env._calls.length === 0, env._calls);
}

async function testInvalidConsentVersion() {
  console.log('\n# invalid consent version');
  const env = mockEnv();
  const request = mockRequest();
  const r = await captureLead({ env, request, ...baseArgs, consentVersion: '' });
  assert('ok=false', r.ok === false, r);
  assert('error=invalid_consent_version', r.error === 'invalid_consent_version', r);
  assert('no DB call', env._calls.length === 0, env._calls);
}

async function testInvalidSource() {
  console.log('\n# invalid source');
  const env = mockEnv();
  const request = mockRequest();
  const r = await captureLead({ env, request, ...baseArgs, source: 'wikipedia' });
  assert('ok=false', r.ok === false, r);
  assert('error=invalid_source', r.error === 'invalid_source', r);
  assert('no DB call', env._calls.length === 0, env._calls);
}

async function testInvalidUrl() {
  console.log('\n# invalid url');
  const env = mockEnv();
  const request = mockRequest();
  const r = await captureLead({ env, request, ...baseArgs, url: 'not a url at all' });
  assert('ok=false', r.ok === false, r);
  assert('error=invalid_url', r.error === 'invalid_url', r);
  assert('no DB call', env._calls.length === 0, env._calls);
}

async function testMissingSalt() {
  console.log('\n# missing salt');
  const env = mockEnv();
  env.CONSENT_SALT = ''; // simulace pre-deploy stavu
  const request = mockRequest({ 'cf-connecting-ip': '203.0.113.42' });
  const r = await captureLead({ env, request, ...baseArgs });
  assert('ok=false', r.ok === false, r);
  assert('error=salt_missing', r.error === 'salt_missing', r);
  assert('no DB call', env._calls.length === 0, env._calls);
}

async function testUniqueConstraint() {
  console.log('\n# unique constraint = duplicate');
  const env = mockEnv({ throwOnRun: new Error('D1_ERROR: UNIQUE constraint failed: leads.leads_idem') });
  const request = mockRequest({ 'cf-connecting-ip': '203.0.113.42' });
  const r = await captureLead({ env, request, ...baseArgs });
  assert('ok=true', r.ok === true, r);
  assert('lead.duplicate=true', r.lead?.duplicate === true, r);
  assert('no id leak', r.lead?.id === undefined, r);
  assert('no token leak', r.lead?.unsubscribe_token === undefined, r);
  assert('1 DB call attempted', env._calls.length === 1, env._calls);
}

async function testOtherDbError() {
  console.log('\n# other DB error');
  const env = mockEnv({ throwOnRun: new Error('D1_ERROR: no such table: leads') });
  const request = mockRequest({ 'cf-connecting-ip': '203.0.113.42' });
  // Potlač console.error v testu, ať není šum
  const origErr = console.error;
  console.error = () => {};
  const r = await captureLead({ env, request, ...baseArgs });
  console.error = origErr;

  assert('ok=false', r.ok === false, r);
  assert('error=db_error', r.error === 'db_error', r);
  assert('detail present', typeof r.detail === 'string' && r.detail.length > 0, r);
}

async function testFallbackIp() {
  console.log('\n# fallback to x-forwarded-for');
  const env = mockEnv();
  const request = mockRequest({ 'x-forwarded-for': '198.51.100.1, 10.0.0.1' });
  const r = await captureLead({ env, request, ...baseArgs });
  assert('ok=true', r.ok === true, r);
  // Hash by měl existovat (ne 'unknown' a ne plain IP)
  const params = env._calls[0]?.params || [];
  assert('hash exists', typeof params[6] === 'string' && params[6].length === 64, params);
  assert('hash != plain ip', params[6] !== '198.51.100.1', params);
}

async function testUnknownIp() {
  console.log('\n# unknown ip (no headers)');
  const env = mockEnv();
  const request = mockRequest();
  const r = await captureLead({ env, request, ...baseArgs });
  assert('ok=true (unknown is hashed)', r.ok === true, r);
}

// --- Run -------------------------------------------------------------------

(async () => {
  await testHappyPath();
  await testInvalidEmail();
  await testInvalidConsentVersion();
  await testInvalidSource();
  await testInvalidUrl();
  await testMissingSalt();
  await testUniqueConstraint();
  await testOtherDbError();
  await testFallbackIp();
  await testUnknownIp();

  console.log(`\n--- ${pass} pass, ${fail} fail ---`);
  if (fail > 0) {
    console.log('Failures:', failures);
    process.exit(1);
  }
})();
