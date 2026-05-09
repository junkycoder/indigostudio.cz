// src/handlers/audit.js
//
// POST /api/audit
// Body: { url, email, consent, website /* honeypot */ }

const ok    = (data)               => Response.json({ ok: true,  ...data });
const fail  = (msg, status = 400)  => Response.json({ ok: false, error: msg }, { status });

const RX_URL   = /^https?:\/\/[^\s]+$/i;
const RX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function handleAudit(request, env, ctx) {
  if (request.method !== 'POST') return fail('Method not allowed', 405);

  const body = await request.json().catch(() => null);
  if (!body) return fail('Bad JSON');

  // 1) Honeypot — tiše zahodit. Boti dostanou 200, neopravujem ne-existující bug.
  if (body.website && String(body.website).length > 0) {
    return ok({ message: 'Pracujeme na tom.' });
  }

  // 2) Validace
  const rawUrl = normalizeUrl(body.url);
  if (!rawUrl || !RX_URL.test(rawUrl)) return fail('Zadejte platnou URL.');
  const email  = String(body.email || '').trim().toLowerCase();
  if (!RX_EMAIL.test(email))           return fail('Zadejte platný e-mail.');
  if (body.consent !== true && body.consent !== 'true') return fail('Bez souhlasu to nepůjde.');

  const domain = new URL(rawUrl).hostname.toLowerCase().replace(/^www\./, '');

  // 3) Rate-limit IP (5/h)
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const ipKey = `rl:ip:${ip}`;
  const ipCnt = parseInt((await env.RATELIMIT.get(ipKey)) || '0', 10);
  if (ipCnt >= 5) return fail('Moc dotazů z jedné IP. Zkuste za hodinu.', 429);
  await env.RATELIMIT.put(ipKey, String(ipCnt + 1), { expirationTtl: 3600 });

  // 4) Cache 7 dní per doména — když už audit proběhl, mail znova z R2/D1
  const cached = await env.AUDIT_CACHE.get(`audit:${domain}`);
  if (cached) {
    const { auditId } = JSON.parse(cached);
    ctx.waitUntil(scheduleResend(env, auditId, email));
    return ok({ message: 'Tenhle web jsme nedávno auditovali. Posíláme výsledek.' });
  }

  // 5) Vytvořit lead + audit row
  const leadId      = crypto.randomUUID();
  const auditId     = crypto.randomUUID();
  const reportToken = randomToken();
  const unsubToken  = randomToken();
  const now         = Math.floor(Date.now() / 1000);

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO leads (id, email, domain, consent_at, ip, source, status, unsub_token, created_at)
       VALUES (?, ?, ?, ?, ?, 'form', 'new', ?, ?)`
    ).bind(leadId, email, domain, now, ip, unsubToken, now),
    env.DB.prepare(
      `INSERT INTO audits (id, lead_id, domain, url, status, report_token, created_at)
       VALUES (?, ?, ?, ?, 'queued', ?, ?)`
    ).bind(auditId, leadId, domain, rawUrl, reportToken, now),
    // Mail #1 — placeholder řádek, dispatcher ho rozjede až po doběhnutí auditu
    // (processor mu posune `send_at` na now). Garantuje, že lead nikdy nezůstane bez mailu.
    env.DB.prepare(
      `INSERT INTO email_events (id, lead_id, audit_id, template, status, send_at)
       VALUES (?, ?, ?, 'audit_done', 'queued', ?)`
    ).bind(crypto.randomUUID(), leadId, auditId, now + 24 * 3600),
  ]);

  // 6) Enqueue
  await env.AUDIT_QUEUE.send({
    kind: 'audit',
    auditId, leadId, url: rawUrl, domain, email, reportToken,
  });

  return ok({
    auditId,
    message: 'Pracujeme na tom. Výsledek mailem do 5 minut.',
  });
}

// ---- helpers ----

function normalizeUrl(input) {
  try {
    let s = String(input || '').trim();
    if (!s) return null;
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    const u = new URL(s);
    u.hash = ''; u.username = ''; u.password = '';
    return u.toString();
  } catch { return null; }
}

function randomToken() {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  return [...buf].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function scheduleResend(env, auditId, email) {
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `INSERT INTO email_events (id, lead_id, audit_id, template, status, send_at)
     SELECT ?, lead_id, id, 'audit_done', 'queued', ? FROM audits WHERE id = ?`
  ).bind(crypto.randomUUID(), now, auditId).run();
}
