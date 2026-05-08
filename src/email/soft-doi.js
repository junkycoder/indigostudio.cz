// Mail šablona: soft-doi (na sklad, MVP nepoužívá)
// Per design § 4.6 a § 5.4 — šablona připravená pro hypotetický plný DOI flow.
// MVP nepoužívá (soft DOI je integrované do prvního odstavce lead-followup).
// Šablona se vytváří pro případ, že legal/marketer v budoucí iteraci řekne
// "přepneme na plný DOI".
//
// Plný copy z projects/landing-v2/copy.md § 10.

import { layout, escapeHtml } from './_layout.js';

function safeHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * @param {object} vars
 * @param {string} vars.url – adresa zadaná v formuláři
 * @param {string} vars.confirm_url – https://fakan.cz/potvrdit?t=<token>
 * @param {string|number} [vars.expires_in_hours] – typicky 24
 */
export function render({ url, confirm_url, expires_in_hours = 24 }) {
  const hostname = safeHostname(url);
  const subject = `Potvrďte, prosím, zájem o analýzu ${hostname}`;
  const expiresLabel = `${expires_in_hours} hodin`;

  const bodyHtml = `            <p>Dobrý den,</p>

            <p>na fakan.cz si někdo vyžádal bezplatnou analýzu webu <strong>${escapeHtml(url)}</strong> a uvedl jako kontaktní e-mail tuto adresu. Než vám analýzu pošleme, <strong>potřebujeme od vás potvrzení</strong>, že to opravdu jste vy.</p>

            <p style="margin:28px 0;">
              <a href="${escapeHtml(confirm_url)}" style="background:#FF5722;color:#fff;padding:14px 24px;text-decoration:none;border-radius:999px;font-weight:600;display:inline-block;">Ano, jsem to já — pošlete analýzu</a>
            </p>

            <p>Odkaz funguje <strong>${escapeHtml(expiresLabel)}</strong>. Pokud na něj nekliknete, žádná analýza se neodešle a vaši adresu z naší databáze automaticky smažeme.</p>

            <p>Pokud to nejste vy, prostě nic nedělejte. Bez kliku se nic neodehraje a za pár hodin vaše adresa zmizí.</p>

            <p>Díky a hezký den,<br>
            Daniel „Fakan" Hromada<br>
            fakan.cz</p>`;

  const bodyText = `Dobrý den,

na fakan.cz si někdo vyžádal bezplatnou analýzu webu ${url} a uvedl
jako kontaktní e-mail tuto adresu. Než vám analýzu pošleme, potřebujeme
od vás potvrzení, že to opravdu jste vy.

Pro potvrzení otevřete tento odkaz:

${confirm_url}

Odkaz funguje ${expiresLabel}. Pokud na něj nekliknete, žádná
analýza se neodešle a vaši adresu z naší databáze automaticky smažeme.

Pokud to nejste vy, prostě nic nedělejte. Bez kliku se nic neodehraje
a za pár hodin vaše adresa zmizí.

Díky a hezký den,
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
