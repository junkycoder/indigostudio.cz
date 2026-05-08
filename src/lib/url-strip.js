/**
 * Vrátí URL bez query stringu a hash (jen origin + pathname). Viz `projects/landing-v2/risk-check.md` § 1.3.
 *
 * @param {string} input - vstupní URL jako string
 * @returns {string} origin + pathname (např. `https://example.cz/page`)
 * @throws {TypeError} když `new URL(input)` selže (neplatná URL)
 */
export function stripUrl(input) {
  const u = new URL(input);
  return `${u.origin}${u.pathname}`;
}
