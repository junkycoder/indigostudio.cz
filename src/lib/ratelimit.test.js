// src/lib/ratelimit.test.js
// Mock test pro `checkRateLimit` + `checkHoneypot` — jednoduché pole assertů, žádný framework.
// Spuštění:
//   node src/lib/ratelimit.test.js
//
// Mockuje `env.RATELIMIT` (KV binding) jako Map in-memory, ignoruje TTL.
// Žádné dependency, jen Node 20+ (kvůli Web Crypto API v hash.js).

import { checkRateLimit, checkHoneypot } from './ratelimit.js';

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

function mockEnv() {
  const store = new Map();
  return {
    CONSENT_SALT: 'test-salt',
    RATELIMIT: {
      store,
      get: async (k) => store.get(k) ?? null,
      put: async (k, v /*, opts */) => {
        // Ignoruje TTL — pro test nám stačí, aby si KV pamatoval hodnotu.
        store.set(k, v);
      },
    },
  };
}

function mockRequest(ip) {
  return {
    headers: {
      get: (name) => (name.toLowerCase() === 'cf-connecting-ip' ? ip : null),
    },
  };
}

// --- Testy: checkRateLimit -------------------------------------------------

async function testRateLimitFiveAllowedSixthBlocked() {
  console.log('\n# checkRateLimit: 5 leadů projde, 6. je blokovaný');
  const env = mockEnv();
  const req = mockRequest('1.2.3.4');

  const results = [];
  for (let i = 0; i < 6; i++) {
    const r = await checkRateLimit({
      env,
      request: req,
      scope: 'lead-capture',
      limit: 5,
      windowSeconds: 3600,
    });
    results.push(r);
  }

  for (let i = 0; i < 5; i++) {
    assert(`call #${i + 1} ok=true`, results[i].ok === true, results[i]);
  }
  assert('call #6 ok=false', results[5].ok === false, results[5]);
  assert('call #6 remaining=0', results[5].remaining === 0, results[5]);
  assert('call #1 remaining=4', results[0].remaining === 4, results[0]);
  assert('call #5 remaining=0', results[4].remaining === 0, results[4]);
}

async function testRateLimitDifferentIpResets() {
  console.log('\n# checkRateLimit: jiná IP má vlastní counter');
  const env = mockEnv();

  // Vyčerpáme limit pro IP A
  for (let i = 0; i < 5; i++) {
    await checkRateLimit({
      env,
      request: mockRequest('1.1.1.1'),
      scope: 'lead-capture',
      limit: 5,
      windowSeconds: 3600,
    });
  }

  // IP A — 6. má být blocked
  const blocked = await checkRateLimit({
    env,
    request: mockRequest('1.1.1.1'),
    scope: 'lead-capture',
    limit: 5,
    windowSeconds: 3600,
  });
  assert('IP A 6. call blocked', blocked.ok === false, blocked);

  // IP B — 1. má projít
  const fresh = await checkRateLimit({
    env,
    request: mockRequest('2.2.2.2'),
    scope: 'lead-capture',
    limit: 5,
    windowSeconds: 3600,
  });
  assert('IP B 1. call ok', fresh.ok === true, fresh);
  assert('IP B remaining=4', fresh.remaining === 4, fresh);
}

async function testRateLimitAnalyzeScope() {
  console.log('\n# checkRateLimit: scope analyze (3/24h)');
  const env = mockEnv();
  const req = mockRequest('3.3.3.3');

  const r1 = await checkRateLimit({ env, request: req, scope: 'analyze', limit: 3, windowSeconds: 86400 });
  const r2 = await checkRateLimit({ env, request: req, scope: 'analyze', limit: 3, windowSeconds: 86400 });
  const r3 = await checkRateLimit({ env, request: req, scope: 'analyze', limit: 3, windowSeconds: 86400 });
  const r4 = await checkRateLimit({ env, request: req, scope: 'analyze', limit: 3, windowSeconds: 86400 });

  assert('analyze #1 ok', r1.ok === true);
  assert('analyze #2 ok', r2.ok === true);
  assert('analyze #3 ok', r3.ok === true);
  assert('analyze #4 blocked', r4.ok === false);
}

async function testRateLimitMissingSaltPermissive() {
  console.log('\n# checkRateLimit: chybí CONSENT_SALT → permissive');
  const env = { CONSENT_SALT: '', RATELIMIT: mockEnv().RATELIMIT };
  const req = mockRequest('4.4.4.4');

  const r = await checkRateLimit({
    env,
    request: req,
    scope: 'lead-capture',
    limit: 5,
    windowSeconds: 3600,
  });
  assert('permissive ok=true', r.ok === true, r);
  assert('permissive remaining=-1', r.remaining === -1, r);
}

async function testRateLimitUnknownScopePermissive() {
  console.log('\n# checkRateLimit: neznámý scope → permissive');
  const env = mockEnv();
  const req = mockRequest('5.5.5.5');

  const r = await checkRateLimit({
    env,
    request: req,
    scope: 'evil-scope',
    limit: 5,
    windowSeconds: 3600,
  });
  assert('unknown scope ok=true', r.ok === true, r);
  assert('unknown scope remaining=-1', r.remaining === -1, r);
}

async function testRateLimitMissingIpPermissive() {
  console.log('\n# checkRateLimit: chybí cf-connecting-ip → permissive');
  const env = mockEnv();
  const req = mockRequest(null);

  const r = await checkRateLimit({
    env,
    request: req,
    scope: 'lead-capture',
    limit: 5,
    windowSeconds: 3600,
  });
  assert('missing IP ok=true', r.ok === true, r);
}

// --- Testy: checkHoneypot --------------------------------------------------

function testHoneypotWebsiteFilledIsBot() {
  console.log('\n# checkHoneypot: website=spam → bot');
  const r = checkHoneypot(new URLSearchParams('website=spam'));
  assert('website filled → false', r === false, { result: r });
}

function testHoneypotCompanyFilledIsBot() {
  console.log('\n# checkHoneypot: company=Acme → bot');
  const r = checkHoneypot(new URLSearchParams('company=Acme'));
  assert('company filled → false', r === false, { result: r });
}

function testHoneypotEmptyIsHuman() {
  console.log('\n# checkHoneypot: jen email → člověk');
  const r = checkHoneypot(new URLSearchParams('email=ok@example.com'));
  assert('no honeypot → true', r === true, { result: r });
}

function testHoneypotWhitespaceIsHuman() {
  console.log('\n# checkHoneypot: whitespace v honeypot → člověk (trim)');
  const r = checkHoneypot(new URLSearchParams('website=%20%20'));
  assert('whitespace → true', r === true, { result: r });
}

function testHoneypotNullInputIsHuman() {
  console.log('\n# checkHoneypot: null input → permissive');
  const r = checkHoneypot(null);
  assert('null input → true', r === true, { result: r });
}

// --- Run -------------------------------------------------------------------

async function run() {
  await testRateLimitFiveAllowedSixthBlocked();
  await testRateLimitDifferentIpResets();
  await testRateLimitAnalyzeScope();
  await testRateLimitMissingSaltPermissive();
  await testRateLimitUnknownScopePermissive();
  await testRateLimitMissingIpPermissive();
  testHoneypotWebsiteFilledIsBot();
  testHoneypotCompanyFilledIsBot();
  testHoneypotEmptyIsHuman();
  testHoneypotWhitespaceIsHuman();
  testHoneypotNullInputIsHuman();

  console.log(`\n--- ${pass} pass, ${fail} fail ---`);
  if (fail > 0) {
    console.log('Failures:', JSON.stringify(failures, null, 2));
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('test crash', err);
  process.exit(1);
});
