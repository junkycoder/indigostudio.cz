// src/lib/mail.js
// Email Workers wrapper — sestaví MIME, odešle přes env.EMAIL.send(), 1× retry.
// Per design.md § 4.5 + research docs/research/2026-05-08-email-workers-dns-cz-patrny.md § 1.2.
//
// Pravidlo: NIKDY netrhne. Volající (`ctx.waitUntil`) nesmí padnout kvůli mailu.
// Vrací { ok: true, status: 'sent' } nebo { ok: false, status: 'bounced', error: string }.

import { buildMime } from './mime.js';

// Whitelist šablon. Jméno = filename bez .js v src/email/.
// Po deprekaci analyze flow zbývá jen transakční optout-confirmation.
const TEMPLATES = new Set([
  'optout-confirmation',
]);

const SENDERS = {
  'optout-confirmation': { name: 'Fakan — Indigo Studio', addr: 'nabidky@fakan.cz' },
};

/**
 * Lazy resolve `EmailMessage` — `cloudflare:email` je dostupné jen v Workers runtime.
 * V Node testu se za běhu naplní `globalThis.EmailMessage` s mockem.
 *
 * @returns {Promise<typeof import('cloudflare:email').EmailMessage>}
 */
async function getEmailMessage() {
  if (globalThis.EmailMessage) return globalThis.EmailMessage;
  const mod = await import('cloudflare:email');
  return mod.EmailMessage;
}

/**
 * Truncate error message na max 500 znaků (per design § 4.5).
 *
 * @param {unknown} err
 * @returns {string}
 */
function truncateError(err) {
  const msg = err && err.message ? String(err.message) : String(err);
  return msg.length > 500 ? msg.slice(0, 500) : msg;
}

/**
 * Sleep N ms.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Pošle e-mail přes Cloudflare Email Workers binding `env.EMAIL`.
 * 1× retry s 1s pauzou. Nikdy netrhne.
 *
 * @param {{
 *   env: { EMAIL: { send: (msg: any) => Promise<void> } },
 *   template: 'optout-confirmation',
 *   to: string,
 *   vars: Record<string, any>,
 * }} opts
 * @returns {Promise<{ ok: true, status: 'sent' } | { ok: false, status: 'bounced', error: string }>}
 */
export async function sendMail({ env, template, to, vars }) {
  // Validace vstupu — zachytíme tady, ať volajícímu nepadáme uvnitř try/catch jako runtime err.
  if (!env || !env.EMAIL || typeof env.EMAIL.send !== 'function') {
    return { ok: false, status: 'bounced', error: 'env.EMAIL binding chybí' };
  }
  if (!TEMPLATES.has(template)) {
    return { ok: false, status: 'bounced', error: `neznámá šablona: ${template}` };
  }
  if (!to || typeof to !== 'string') {
    return { ok: false, status: 'bounced', error: 'recipient (to) chybí' };
  }

  // Render šablony — dynamický import, ať nemusíme statické větve pro každý template.
  let rendered;
  try {
    const tpl = await import(`../email/${template}.js`);
    rendered = tpl.render(vars || {});
  } catch (err) {
    console.error('sendMail: render šablony selhal', template, err);
    return { ok: false, status: 'bounced', error: truncateError(err) };
  }

  const { subject, html, text } = rendered;
  const from = SENDERS[template];

  let raw;
  try {
    raw = buildMime({
      from,
      to,
      subject,
      replyTo: 'jsem@fakan.cz',
      headers: {},
      text,
      html,
    });
  } catch (err) {
    console.error('sendMail: buildMime selhal', err);
    return { ok: false, status: 'bounced', error: truncateError(err) };
  }

  // Resolve EmailMessage class (workers runtime nebo test mock).
  let EmailMessage;
  try {
    EmailMessage = await getEmailMessage();
  } catch (err) {
    console.error('sendMail: cloudflare:email import selhal', err);
    return { ok: false, status: 'bounced', error: truncateError(err) };
  }

  // 1× retry. Pokud i druhý pokus selže → bounced.
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const message = new EmailMessage(from.addr, to, raw);
      await env.EMAIL.send(message);
      return { ok: true, status: 'sent' };
    } catch (err) {
      lastErr = err;
      console.error(`sendMail: pokus ${attempt + 1}/2 selhal`, template, to, err);
      if (attempt === 0) {
        await sleep(1000);
      }
    }
  }

  return { ok: false, status: 'bounced', error: truncateError(lastErr) };
}
