// Mail šablona: lead-followup
// Posílá se po dokončení bezplatné analýzy webu (per design § 5.1).
// Obsahuje soft DOI úvod (per § 4.6) — uživatel, který nečekal mail,
// klikne opt-out a je odhlášen.
//
// Plný copy z projects/landing-v2/copy.md § 7.

import { layout, escapeHtml } from './_layout.js';

const CZ_MONTHS = [
  'ledna', 'února', 'března', 'dubna', 'května', 'června',
  'července', 'srpna', 'září', 'října', 'listopadu', 'prosince',
];

function formatCzDate(d) {
  return `${d.getDate()}. ${CZ_MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function safeHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * @param {object} vars
 * @param {string} vars.url – URL, kterou návštěvník zadal (po stripUrl)
 * @param {number} vars.score – skóre 0–100
 * @param {string[]} vars.top3issues – tři lidské věty (např. "nahrávání trvá 4,2 s")
 * @param {string} vars.unsubscribe_url – https://fakan.cz/odhlasit?t=<token>
 * @param {Date}   [vars.sentAt] – pro testovatelnost; default new Date()
 */
export function render({ url, score, top3issues, unsubscribe_url, sentAt }) {
  const hostname = safeHostname(url);
  const date = formatCzDate(sentAt instanceof Date ? sentAt : new Date());
  const urlEncoded = encodeURIComponent(url);
  const subject = `Analýza ${hostname} — našli jsme tři věci`;

  const issues = Array.isArray(top3issues) ? top3issues.slice(0, 3) : [];
  while (issues.length < 3) issues.push('—');

  const issuesHtml = issues.map(i => `              <li>${escapeHtml(i)}</li>`).join('\n');
  const issuesText = issues.map((i, idx) => `${idx + 1}. ${i}`).join('\n');

  const mailtoSubject = encodeURIComponent(`Nabídka pro ${hostname}`);
  const mailtoBody = encodeURIComponent(`Dobrý den,\n\nviděl jsem analýzu mého webu ${url} a zajímalo by mě, jak byste to vyřešili.\n\nS pozdravem`);

  const bodyHtml = `            <p>Dobrý den,</p>

            <p>posíláme vám výsledky bezplatné analýzy webu <strong>${escapeHtml(url)}</strong>, kterou jste si u nás na fakan.cz vyžádal/a ${escapeHtml(date)}. Pokud to nejste vy a tenhle e-mail jste nečekal/a, klikněte na <a href="${escapeHtml(unsubscribe_url)}">Odhlásit</a> v patičce a okamžitě vás z databáze smažeme. Nikomu nevolejte, žádné uživatelské heslo neměňte — prostě jeden klik.</p>

            <h2 style="font-size:18px;margin:24px 0 12px 0;">Co jsme zjistili</h2>

            <p>Váš web jsme projeli a celkové skóre vyšlo na <strong>${escapeHtml(String(score))} ze 100</strong>. Tady jsou tři věci, které stojí za pozornost nejdřív:</p>

            <ul>
${issuesHtml}
            </ul>

            <p>Detail najdete v plné analýze: <a href="https://fakan.cz/vysledek?url=${urlEncoded}">otevřít výsledky</a>.</p>

            <h2 style="font-size:18px;margin:24px 0 12px 0;">Co můžeme udělat</h2>

            <p>Pokud byste chtěl/a, abychom to vyřešili za vás, ozveme se a domluvíme detail. <strong>Tohle je jen návrh, nezávazná nabídka.</strong> Žádná smluvní oferta, žádný automatický odběr — než cokoliv potvrdíte, projdeme spolu rozsah, cenu a termín.</p>

            <p>Typicky to dopadne jednou ze tří cest:</p>

            <ol>
              <li><strong>Spravíme to.</strong> Tři vážné věci, které jsme našli, opravíme. Pevná cena, jasný termín.</li>
              <li><strong>Uděláme nový web.</strong> Když je toho víc nebo se vám současný stejně nelíbí.</li>
              <li><strong>Přejdete na náš hosting.</strong> Od 99 Kč měsíčně. Záloha, vlastní doména, žádné okénko se souhlasem. Web zůstává váš — kdykoliv si ho stáhnete v ZIPu.</li>
            </ol>

            <h2 style="font-size:18px;margin:24px 0 12px 0;">Kdy chcete, abychom se ozvali?</h2>

            <p>Stačí jednou kliknout: <a href="mailto:jsem@fakan.cz?subject=${mailtoSubject}&amp;body=${mailtoBody}"><strong>Pošlete mi nezávaznou nabídku</strong></a>.</p>

            <p>Nebo prostě odepište na tenhle e-mail. Píše vám člověk, ne robot.</p>

            <p>Hezký den,<br>
            <strong>Daniel „Fakan" Hromada</strong><br>
            fakan.cz</p>`;

  const bodyText = `Dobrý den,

posíláme vám výsledky bezplatné analýzy webu ${url}, kterou jste si
u nás na fakan.cz vyžádal/a ${date}.

Pokud to nejste vy a tenhle e-mail jste nečekal/a, otevřete tento
odkaz a okamžitě vás z databáze smažeme:

${unsubscribe_url}


CO JSME ZJISTILI

Váš web jsme projeli a celkové skóre vyšlo na ${score} ze 100.
Tady jsou tři věci, které stojí za pozornost nejdřív:

${issuesText}

Detail najdete v plné analýze:
https://fakan.cz/vysledek?url=${urlEncoded}


CO MŮŽEME UDĚLAT

Pokud byste chtěl/a, abychom to vyřešili za vás, ozveme se a domluvíme
detail. Tohle je jen návrh, nezávazná nabídka. Žádná smluvní oferta,
žádný automatický odběr — než cokoliv potvrdíte, projdeme spolu rozsah,
cenu a termín.

Typicky to dopadne jednou ze tří cest:

1. Spravíme to. Tři vážné věci, které jsme našli, opravíme.
   Pevná cena, jasný termín.
2. Uděláme nový web. Když je toho víc nebo se vám současný stejně nelíbí.
3. Přejdete na náš hosting. Od 99 Kč měsíčně. Záloha, vlastní doména,
   žádné okénko se souhlasem. Web zůstává váš — kdykoliv si ho stáhnete
   v ZIPu.


KDY CHCETE, ABYCHOM SE OZVALI?

Stačí odpovědět na tenhle e-mail. Nebo napsat na jsem@fakan.cz.
Píše vám člověk, ne robot.

Hezký den,
Daniel „Fakan" Hromada
fakan.cz`;

  const wrapped = layout({
    title: subject,
    bodyHtml,
    bodyText,
    withOptout: true,
    unsubscribe_url,
  });

  return { subject, html: wrapped.html, text: wrapped.text };
}
