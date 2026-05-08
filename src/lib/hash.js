// src/lib/hash.js
// Hash helpers pro lead capture (IP hash, unsubscribe token).
// Web Crypto API (globalThis.crypto) — funguje v Workers runtime i v Node 20+.
// Bez npm závislostí.

/**
 * Vrátí sha256(input + salt) jako 64znakový hex string. Async, používá Web Crypto.
 * @param {string} input
 * @param {string} salt
 * @returns {Promise<string>}
 */
export async function sha256Hex(input, salt) {
  const data = new TextEncoder().encode(String(input) + String(salt));
  const buf = await globalThis.crypto.subtle.digest('SHA-256', data);
  const bytes = new Uint8Array(buf);
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Vygeneruje náhodný token jako hex string délky `bytes * 2` (kryptograficky bezpečný).
 * @param {number} bytes
 * @returns {string}
 */
export function randomTokenHex(bytes) {
  const arr = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(arr);
  let hex = '';
  for (let i = 0; i < arr.length; i++) {
    hex += arr[i].toString(16).padStart(2, '0');
  }
  return hex;
}
