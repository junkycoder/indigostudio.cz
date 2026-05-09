// Mail šablona: optout-confirmation
// Posílá se po úspěšném klik na opt-out odkaz (per design § 5.3).
// Bez opt-out odkazu v patičce — uživatel je už odhlášený, dávat mu znova
// opt-out je absurdní (per copy.md § 9).
//
// Plný copy z projects/landing-v2/copy.md § 9.

import { layout, escapeHtml } from './_layout.js';

/**
 * @param {object} vars
 * @param {string} vars.email – odhlášená adresa
 * @param {string} vars.opted_out_at – formát "14:30" (jen čas, datum už je v textu "dnes")
 */
export function render({ email, opted_out_at }) {
  const subject = 'Odhlášeno z fakan.cz';

  const bodyHtml = `            <p>Dobrý den,</p>

            <p>odhlásili jsme Vás z e-mailové komunikace fakan.cz. <strong>Hotovo.</strong></p>

            <p>Adresa <code>${escapeHtml(email)}</code> byla v našem seznamu označena jako odhlášená dnes v ${escapeHtml(opted_out_at)}. Žádný další e-mail Vám už neodejde.</p>

            <p>Pokud to byla chyba a chcete se vrátit, napište nám prostě na <a href="mailto:jsem@fakan.cz">jsem@fakan.cz</a> — vrátíme Vás zpět ručně.</p>

            <p>Díky za zájem a hezký den.</p>

            <p>Daniel „Fakan" Hromada<br>fakan.cz</p>`;

  const bodyText = `Dobrý den,

odhlásili jsme Vás z e-mailové komunikace fakan.cz. Hotovo.

Adresa ${email} byla v našem seznamu označena jako odhlášená dnes
v ${opted_out_at}. Žádný další e-mail Vám už neodejde.

Pokud to byla chyba a chcete se vrátit, napište nám prostě na
jsem@fakan.cz — vrátíme Vás zpět ručně.

Díky za zájem a hezký den.

Daniel „Fakan" Hromada
fakan.cz`;

  const wrapped = layout({
    title: subject,
    bodyHtml,
    bodyText,
    withOptout: false,
  });

  return { subject, html: wrapped.html, text: wrapped.text };
}
