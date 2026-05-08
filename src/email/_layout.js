// Společný layout pro mail šablony fakan.cz.
// Obaluje obsah do minimálního inline-styled HTML mailu (table-based pro Outlook).
// Plain-text twin se píše ručně v každé šabloně, layout ho jen wrapuje s patičkou.
//
// Patička (Indigo Studio s.r.o., IČO, OR spisovka) je tady na jednom místě —
// změna identifikace = jeden edit, ne čtyři.
//
// Žádný tracking pixel. Žádný `<img>` z externí domény. Per legal autorita
// (decisions.md) a risk-check § 5.2.

const FOOTER_LINES = {
  identity: 'Indigo Studio s.r.o., Chudenická 1059/30, 102 00 Praha',
  ico: 'IČO: 14389096, zapsáno v Obchodním rejstříku vedeném Městským soudem v Praze, oddíl C, vložka 364981',
  contact: 'Kontakt: jsem@fakan.cz · +420 604 690 539',
};

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderFooterHtml({ withOptout, unsubscribe_url } = {}) {
  const optoutLine = withOptout && unsubscribe_url
    ? `<br><a href="${escapeHtml(unsubscribe_url)}" style="color:#6B7280;text-decoration:underline;">Odhlásit z e-mailů od fakan.cz</a> · <a href="https://fakan.cz/ochrana-udaju" style="color:#6B7280;text-decoration:underline;">Ochrana osobních údajů</a>`
    : '';

  return `
        <tr>
          <td style="padding-top:32px;border-top:1px solid #E2E8F0;font-size:13px;line-height:1.5;color:#6B7280;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <strong>${escapeHtml(FOOTER_LINES.identity.split(',')[0])}</strong>${escapeHtml(FOOTER_LINES.identity.slice(FOOTER_LINES.identity.indexOf(',')))}<br>
            ${escapeHtml(FOOTER_LINES.ico)}<br>
            ${escapeHtml(FOOTER_LINES.contact)}${optoutLine}
          </td>
        </tr>`;
}

function renderFooterText({ withOptout, unsubscribe_url } = {}) {
  const base = `---

${FOOTER_LINES.identity}
${FOOTER_LINES.ico.replace('zapsáno v Obchodním rejstříku', 'zapsáno v Obchodním rejstříku').replace(', oddíl C, vložka 364981', '.\n                                                  ').trim()}

${FOOTER_LINES.contact}`;

  // Jednodušší: nepouštíme se do hezkého wrapování — držíme jednu řádku za jednu věcí
  const clean = `---

${FOOTER_LINES.identity}
IČO: 14389096, zapsáno v Obchodním rejstříku vedeném Městským soudem
v Praze, oddíl C, vložka 364981.

${FOOTER_LINES.contact}`;

  if (withOptout && unsubscribe_url) {
    return `${clean}

Odhlásit z e-mailů od fakan.cz:
${unsubscribe_url}

Ochrana osobních údajů:
https://fakan.cz/ochrana-udaju
`;
  }
  return `${clean}\n`;
}

/**
 * Wrap HTML body + plain text body do kompletního mailu.
 *
 * @param {object} args
 * @param {string} args.title – pro <title>
 * @param {string} args.bodyHtml – už hotový HTML obsah (před patičkou)
 * @param {string} args.bodyText – už hotový plain-text obsah (před patičkou)
 * @param {boolean} [args.withOptout] – přidat opt-out odkaz do patičky
 * @param {string} [args.unsubscribe_url] – URL pro opt-out (jen když withOptout)
 * @returns {{ html: string, text: string }}
 */
export function layout({ title, bodyHtml, bodyText, withOptout = false, unsubscribe_url = '' }) {
  const html = `<!DOCTYPE html>
<html lang="cs">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#F9F6F0;">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F9F6F0;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;background:#FFFFFF;border-radius:8px;">
        <tr>
          <td style="padding:24px 32px 8px 32px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <div style="font-weight:700;font-size:20px;color:#FF5722;">Fakan</div>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 32px 24px 32px;font-family:system-ui,-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#0B1221;">
${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 32px 32px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${renderFooterHtml({ withOptout, unsubscribe_url })}
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = `${bodyText}

${renderFooterText({ withOptout, unsubscribe_url })}`;

  return { html, text };
}

export { escapeHtml };
