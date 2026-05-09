// src/lib/mail.test.js
// Mock test pro sendMail() — happy path, retry, bounced, unknown template, missing env.
// Email Workers runtime API se mockuje přes globalThis.EmailMessage,
// `env.EMAIL.send` přes injected handler.
//
// Spuštění: `node src/lib/mail.test.js`. Bez frameworku, bez deps.

globalThis.EmailMessage = class MockEmailMessage {
  constructor(from, to, raw) {
    this.from = from;
    this.to = to;
    this.raw = raw;
  }
};

const { sendMail } = await import('./mail.js');

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    passed++;
    console.log('  PASS', label);
  } else {
    failed++;
    console.log('  FAIL', label);
  }
}

// ---------------------------------------------------------------------------
// Test 1: happy path — optout-confirmation
// ---------------------------------------------------------------------------
console.log('Test 1: happy path optout-confirmation');
{
  let captured = null;
  const env = {
    EMAIL: {
      send: async (msg) => { captured = msg; },
    },
  };

  const result = await sendMail({
    env,
    template: 'optout-confirmation',
    to: 'host@example.cz',
    vars: { email: 'host@example.cz', opted_out_at: '14:30' },
  });

  assert(result.ok === true, 'result.ok === true');
  assert(result.status === 'sent', "result.status === 'sent'");
  assert(captured !== null, 'env.EMAIL.send byl zavolán');
  assert(captured && captured.from === 'nabidky@fakan.cz', "msg.from === 'nabidky@fakan.cz'");
  assert(captured && captured.to === 'host@example.cz', "msg.to === 'host@example.cz'");
  assert(
    captured && captured.raw.includes('Reply-To: jsem@fakan.cz'),
    'Reply-To: jsem@fakan.cz',
  );
  assert(
    captured && !captured.raw.includes('List-Unsubscribe:'),
    'transakční mail nemá List-Unsubscribe',
  );
  assert(
    captured && captured.raw.includes('Subject: '),
    'mail má Subject header',
  );
}

// ---------------------------------------------------------------------------
// Test 2: retry — první pokus selže, druhý projde
// ---------------------------------------------------------------------------
console.log('Test 2: retry — 1× fail, pak success');
{
  let calls = 0;
  const env = {
    EMAIL: {
      send: async () => {
        calls++;
        if (calls === 1) throw new Error('transient error');
      },
    },
  };

  const start = Date.now();
  const result = await sendMail({
    env,
    template: 'optout-confirmation',
    to: 'host@example.cz',
    vars: { email: 'host@example.cz', opted_out_at: '14:30' },
  });
  const elapsed = Date.now() - start;

  assert(result.ok === true, 'po retry result.ok === true');
  assert(calls === 2, 'env.EMAIL.send zavolán 2×');
  assert(elapsed >= 900, `mezi pokusy ~1s pauza (elapsed=${elapsed}ms)`);
}

// ---------------------------------------------------------------------------
// Test 3: oba pokusy selžou → bounced
// ---------------------------------------------------------------------------
console.log('Test 3: oba pokusy fail → bounced');
{
  let calls = 0;
  const env = {
    EMAIL: {
      send: async () => {
        calls++;
        throw new Error('persistent error');
      },
    },
  };

  const result = await sendMail({
    env,
    template: 'optout-confirmation',
    to: 'host@example.cz',
    vars: { email: 'host@example.cz', opted_out_at: '14:30' },
  });

  assert(result.ok === false, 'result.ok === false');
  assert(result.status === 'bounced', "result.status === 'bounced'");
  assert(typeof result.error === 'string' && result.error.length > 0, 'result.error má hodnotu');
  assert(calls === 2, 'env.EMAIL.send zavolán 2× (orig + 1 retry)');
}

// ---------------------------------------------------------------------------
// Test 4: neznámá šablona
// ---------------------------------------------------------------------------
console.log('Test 4: neznámá šablona → bounced bez crash');
{
  const env = { EMAIL: { send: async () => {} } };
  const result = await sendMail({
    env,
    template: 'neexistuje',
    to: 'host@example.cz',
    vars: {},
  });
  assert(result.ok === false, 'neznámá šablona ok=false');
  assert(result.status === 'bounced', 'neznámá šablona status=bounced');
}

// ---------------------------------------------------------------------------
// Test 5: chybí env.EMAIL — nesmí trhnout
// ---------------------------------------------------------------------------
console.log('Test 5: chybí env.EMAIL → graceful fail');
{
  const result = await sendMail({
    env: {},
    template: 'optout-confirmation',
    to: 'host@example.cz',
    vars: { email: 'host@example.cz', opted_out_at: '14:30' },
  });
  assert(result.ok === false, 'chybí binding → ok=false');
}

console.log(`\nSouhrn: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
