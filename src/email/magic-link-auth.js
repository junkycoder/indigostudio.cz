// DRAFT v0, na sklad — magic link auth flow ještě není implementovaný.
// Šablonu nepoužívat v produkci, dokud nebude TASK Magic link auth z README hotový.
//
// Login mail je transakční (per design § 5.2 a copy.md § 8) — patička
// NEOBSAHUJE opt-out odkaz. Nelze ho vypnout, jen přestat používat fakan.cz.
//
// Plný copy z projects/landing-v2/copy.md § 8.

import { layout, escapeHtml } from './_layout.js';

/**
 * @param {object} vars
 * @param {string} vars.link – kompletní login URL s tokenem
 * @param {string|number} vars.expires_in – např. "15 minut" nebo 15
 * @param {string} [vars.ip] – IP žádosti (plain v mailu OK, do DB se neukládá)
 * @param {string} [vars.user_agent] – UA žádosti
 * @param {string} [vars.requested_at] – formát "14:30, 6. května 2026"
 */
export function render({ link, expires_in, ip = '', user_agent = '', requested_at = '' }) {
  const subject = 'Přihlašovací odkaz pro fakan.cz';
  const expiresLabel = typeof expires_in === 'number' ? `${expires_in} minut` : String(expires_in || '15 minut');

  const bodyHtml = `            <!-- DRAFT v0 — endpoint pro magic link auth ještě neimplementován -->
            <p>Dobrý den,</p>

            <p>někdo (snad vy) si požádal o přihlášení do fakan.cz. Pokud to nejste vy, tenhle e-mail prostě smažte — bez kliku se nic nestane.</p>

            <p style="margin:28px 0;">
              <a href="${escapeHtml(link)}" style="background:#FF5722;color:#fff;padding:14px 24px;text-decoration:none;border-radius:999px;font-weight:600;display:inline-block;">Přihlásit se</a>
            </p>

            <p>Odkaz funguje <strong>${escapeHtml(expiresLabel)}</strong>. Po té vyprší a budete muset požádat o nový.</p>

            <p style="font-size:13px;color:#6B7280;margin-top:28px;">
              Pro paranoidní:<br>
              Žádost přišla z IP <code>${escapeHtml(ip)}</code> a prohlížeče <code>${escapeHtml(user_agent)}</code> v <code>${escapeHtml(requested_at)}</code>.
              Pokud to nejste vy a chcete to nahlásit, napište na <a href="mailto:jsem@fakan.cz">jsem@fakan.cz</a>.
            </p>

            <p>Hezký den,<br>fakan.cz</p>`;

  const bodyText = `Dobrý den,

někdo (snad vy) si požádal o přihlášení do fakan.cz. Pokud to nejste vy,
tenhle e-mail prostě smažte — bez kliku se nic nestane.

Pro přihlášení otevřete tento odkaz:

${link}

Odkaz funguje ${expiresLabel}. Po té vyprší a budete muset
požádat o nový.


Pro paranoidní: žádost přišla z IP ${ip} a prohlížeče ${user_agent}
v ${requested_at}. Pokud to nejste vy a chcete to nahlásit, napište
na jsem@fakan.cz.

Hezký den,
fakan.cz`;

  const wrapped = layout({
    title: subject,
    bodyHtml,
    bodyText,
    withOptout: false,
  });

  return { subject, html: wrapped.html, text: wrapped.text };
}
