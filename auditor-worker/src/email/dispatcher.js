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
  const pending = await env.DB.prepare(
    `SELECT e.*, l.email, l.unsub_token, l.status as lead_status, a.domain, a.score, a.report_token
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

    const { subject, html, text } = await renderEmail(ev, env);

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
          'List-Unsubscribe': `<https://fakan.cz/unsubscribe?token=${ev.unsub_token}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      }),
    });

    if (resp.ok) {
      const r = await resp.json();
      await env.DB.prepare(
        `UPDATE email_events SET status='sent', sent_at=?, resend_id=? WHERE id=?`
      ).bind(now, r.id || null, ev.id).run();
    } else {
      console.error('resend fail', await resp.text());
      await env.DB.prepare(`UPDATE email_events SET status='failed' WHERE id=?`).bind(ev.id).run();
    }
  }
}
