// src/email/dispatcher.js
// Naplánuje mail (řádek do email_events) a `dispatchPendingMail` ho v cronu odešle přes Resend.

import { renderEmail } from './templates.js';

export async function scheduleEmail(env, { leadId, auditId, template, sendInSeconds = 0 }) {
  const sendAt = Math.floor(Date.now()/1000) + sendInSeconds;
  await env.DB.prepare(
    `INSERT INTO email_events (id, lead_id, audit_id, template, status, send_at)
     VALUES (?, ?, ?, ?, 'queued', ?)`
  ).bind(crypto.randomUUID(), leadId, auditId, template, sendAt).run();
}

export async function dispatchPendingMail(env) {
  const now = Math.floor(Date.now()/1000);
  // PROMPT past: LIMIT 50 per cron tick drží Resend pod 429.
  const pending = await env.DB.prepare(
    `SELECT e.*, l.email, l.unsub_token, l.status as lead_status,
            a.domain, a.score, a.report_token,
            a.status as audit_status, a.error as audit_error
     FROM email_events e
     JOIN leads  l ON l.id = e.lead_id
     LEFT JOIN audits a ON a.id = e.audit_id
     WHERE e.status='queued' AND e.send_at <= ?
     LIMIT 50`
  ).bind(now).all();

  for (const ev of pending.results) {
    if (ev.lead_status === 'unsubscribed') {
      await env.DB.prepare(`UPDATE email_events SET status='cancelled' WHERE id=?`).bind(ev.id).run();
      continue;
    }

    let rendered;
    try {
      rendered = await renderEmail(ev, env);
    } catch (err) {
      console.error(`render fail event=${ev.id} template=${ev.template}: ${err.message}`);
      await env.DB.prepare(`UPDATE email_events SET status='failed' WHERE id=?`).bind(ev.id).run();
      continue;
    }
    const { subject, html, text } = rendered;

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from:    'Fakan <jsem@fakan.cz>',
        to:      ev.email,
        subject, html, text,
        headers: {
          'List-Unsubscribe': `<https://${env.PUBLIC_HOST || 'fakan.cz'}/odhlasit/${ev.unsub_token}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    });

    if (resp.ok) {
      const r = await resp.json().catch(() => ({}));
      const sentAt = Math.floor(Date.now()/1000);
      await env.DB.prepare(
        `UPDATE email_events SET status='sent', sent_at=?, resend_id=? WHERE id=?`
      ).bind(sentAt, r.id || null, ev.id).run();
      continue;
    }

    // Recoverable: 429 (rate limit) a 5xx (Resend down) → posunout send_at,
    // status zůstává 'queued', příští cron tick to vyzvedne.
    if (resp.status === 429 || resp.status >= 500) {
      const retryIn = resp.status === 429 ? 600 : 60;
      await env.DB.prepare(
        `UPDATE email_events SET send_at=? WHERE id=?`
      ).bind(now + retryIn, ev.id).run();
      console.warn(`resend ${resp.status}, retry za ${retryIn}s, event=${ev.id}`);
      continue;
    }

    // Permanent: 403 (unverified domain), 422 (bad email), atd. Žádný retry.
    // PROMPT past: "Resend vrátí 403, dispatcher to musí zalogovat a označit
    // status='failed', ne padat celý cron".
    const body = await resp.text();
    console.error(`resend permanent fail ${resp.status} event=${ev.id}: ${body}`);
    await env.DB.prepare(`UPDATE email_events SET status='failed' WHERE id=?`).bind(ev.id).run();
  }
}
