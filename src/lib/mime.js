// src/lib/mime.js
// Mini MIME builder pro Email Workers — multipart/alternative, UTF-8 safe.
// Bez npm závislostí. RFC 5322 + RFC 2047 (header encoding) + RFC 2045 (MIME).
// Architect veto na npm `mimetext` (design.md § 4.5) — vlastní implementace.

import { randomTokenHex } from './hash.js';

const CRLF = '\r\n';

/**
 * UTF-8 string → base64. Pracuje s `btoa` (Workers runtime + Node 20+ má globálně).
 * @param {string} str
 * @returns {string}
 */
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin);
}

/**
 * Zalomí dlouhý base64 string na řádky max 76 znaků (RFC 2045 § 6.8).
 * @param {string} b64
 * @returns {string}
 */
function wrapBase64(b64) {
  const lines = [];
  for (let i = 0; i < b64.length; i += 76) {
    lines.push(b64.slice(i, i + 76));
  }
  return lines.join(CRLF);
}

/**
 * Detekce ne-ASCII (vše > 0x7E nebo control chars kromě tab) → třeba MIME-encodovat.
 * @param {string} str
 * @returns {boolean}
 */
function isAscii(str) {
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c > 0x7E || (c < 0x20 && c !== 0x09)) return false;
  }
  return true;
}

/**
 * Header value → RFC 2047 encoded-word, pokud obsahuje ne-ASCII.
 * Formát: =?UTF-8?B?<base64>?=
 * @param {string} value
 * @returns {string}
 */
function encodeHeaderValue(value) {
  const v = String(value);
  if (isAscii(v)) return v;
  return '=?UTF-8?B?' + utf8ToBase64(v) + '?=';
}

/**
 * Zformátuje "Name <addr@host>" — name přes RFC 2047, pokud obsahuje ne-ASCII.
 * Pokud chybí name, vrátí jen `addr`.
 * @param {{ name?: string, addr: string } | string} input
 * @returns {string}
 */
function formatAddress(input) {
  if (typeof input === 'string') return input;
  const { name, addr } = input;
  if (!name) return addr;
  return `${encodeHeaderValue(name)} <${addr}>`;
}

/**
 * RFC 2822 / 5322 datum: `Day, DD Mon YYYY HH:MM:SS +0000`.
 * @param {Date} [date]
 * @returns {string}
 */
function rfc2822Date(date = new Date()) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const pad = (n) => String(n).padStart(2, '0');
  const day = days[date.getUTCDay()];
  const dd = pad(date.getUTCDate());
  const mon = months[date.getUTCMonth()];
  const yyyy = date.getUTCFullYear();
  const hh = pad(date.getUTCHours());
  const mm = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  return `${day}, ${dd} ${mon} ${yyyy} ${hh}:${mm}:${ss} +0000`;
}

/**
 * Postaví raw RFC 5322 multipart/alternative zprávu (text + html).
 *
 * @param {{
 *   from: { name?: string, addr: string },
 *   to: string,
 *   subject: string,
 *   replyTo?: string | { name?: string, addr: string },
 *   headers?: Record<string, string>,
 *   text: string,
 *   html: string,
 *   date?: Date,
 * }} opts
 * @returns {string} raw MIME message s CRLF line endings.
 */
export function buildMime(opts) {
  if (!opts || !opts.from || !opts.from.addr) throw new Error('buildMime: from.addr required');
  if (!opts.to) throw new Error('buildMime: to required');
  if (typeof opts.subject !== 'string') throw new Error('buildMime: subject required');
  if (typeof opts.text !== 'string') throw new Error('buildMime: text required');
  if (typeof opts.html !== 'string') throw new Error('buildMime: html required');

  const boundary = randomTokenHex(16); // 32 hex znaků
  const lines = [];

  // Headers — RFC 5322 doporučený order: From, To, Reply-To, Subject, Date, Message-ID, custom, MIME-Version, Content-Type
  lines.push(`From: ${formatAddress(opts.from)}`);
  lines.push(`To: ${opts.to}`);
  if (opts.replyTo) lines.push(`Reply-To: ${formatAddress(opts.replyTo)}`);
  lines.push(`Subject: ${encodeHeaderValue(opts.subject)}`);
  lines.push(`Date: ${rfc2822Date(opts.date)}`);

  // Custom headers (List-Unsubscribe, List-Unsubscribe-Post, …)
  if (opts.headers) {
    for (const [name, value] of Object.entries(opts.headers)) {
      lines.push(`${name}: ${encodeHeaderValue(value)}`);
    }
  }

  lines.push('MIME-Version: 1.0');
  lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  lines.push(''); // prázdný řádek = konec headerů

  // Part 1: text/plain
  lines.push(`--${boundary}`);
  lines.push('Content-Type: text/plain; charset=UTF-8');
  lines.push('Content-Transfer-Encoding: base64');
  lines.push('');
  lines.push(wrapBase64(utf8ToBase64(opts.text)));
  lines.push('');

  // Part 2: text/html
  lines.push(`--${boundary}`);
  lines.push('Content-Type: text/html; charset=UTF-8');
  lines.push('Content-Transfer-Encoding: base64');
  lines.push('');
  lines.push(wrapBase64(utf8ToBase64(opts.html)));
  lines.push('');

  // Closing boundary
  lines.push(`--${boundary}--`);
  lines.push('');

  return lines.join(CRLF);
}
