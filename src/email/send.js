// src/email/send.js
//
// Transakční mail přes Resend (suggestion done, domain register done, …).
// Dispatcher.js jede jen drip queue (cron-driven). Tohle je „pošli teď".
//
// Vrátí { ok: true, resendId } nebo { ok: false, status, error }.

export async function sendTransactional(env, { to, subject, html, text, listUnsubUrl }) {
  if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY není nastaveno');
  if (!to || !subject || !html) throw new Error('sendTransactional: chybí to/subject/html');

  const headers = {};
  if (listUnsubUrl) {
    headers['List-Unsubscribe'] = `<${listUnsubUrl}>`;
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
  }

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${env.RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Indigo Studio <daniel@indigostudio.cz>',
      to,
      subject,
      html,
      text: text || stripTags(html),
      headers,
    }),
  });

  if (resp.ok) {
    const data = await resp.json().catch(() => ({}));
    return { ok: true, resendId: data.id };
  }

  const errBody = await resp.text();
  console.error(`resend transactional fail ${resp.status}: ${errBody.slice(0, 300)}`);
  return { ok: false, status: resp.status, error: errBody.slice(0, 300) };
}

function stripTags(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}
