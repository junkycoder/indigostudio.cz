// src/email/templates.js
// Drip šablony (audit_done | strategist | offer | reaudit_30d) přes dispatcher.
// Transakční šablony (suggestion_done) jsou samostatné funkce volané přímo
// z workeru po dokončení (nejdou přes email_events tabulku).
// Hostname pro report a opt-out odkazy bere z env.PUBLIC_HOST (secret).

import { scoreLabel } from '../audit/scoring.js';

export async function renderEmail(ev, env) {
  switch (ev.template) {
    case 'audit_done':   return tplAuditDone(ev, env);
    case 'strategist':   return await tplStrategist(ev, env);
    case 'offer':        return await tplOffer(ev, env);
    case 'reaudit_30d':  return tplReaudit(ev, env);
    default: throw new Error(`Unknown template ${ev.template}`);
  }
}

const reportUrl  = (env, ev) => `https://${env.PUBLIC_HOST}/audit/${ev.report_token}`;
const optoutUrl  = (env, ev) => `https://${env.PUBLIC_HOST}/odhlasit/${ev.unsub_token}`;

// ---------- Transakční: magic link (přihlášení k profilu) ----------
// Volá se z handlers/account.js přes sendTransactional. Žádný unsub blok —
// klient si přihlášení sám vyžádal, není to marketingový mail.
export function tplMagicLink({ link, email }) {
  const subject = 'Přihlášení na fakan.cz';
  const text = `Klikněte na odkaz a uvidíte své audity, návrhy a domény u nás:

${link}

Odkaz platí 30 minut a dá se použít jen jednou.

Pokud jste o přihlášení nežádali, tenhle e-mail klidně ignorujte — bez kliku
se nic nestane.

— Fakan
`;

  const html = `<!doctype html><html lang="cs"><body style="font-family:Georgia,serif;background:#F9F6F0;color:#1F1B16;margin:0;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#fff;padding:32px;border-radius:6px">
  <h1 style="font-size:26px;margin:0 0 24px">Přihlášení na fakan.cz</h1>

  <p style="font-size:16px;line-height:1.6;margin:0 0 24px">Klikněte na tlačítko a uvidíte své audity, návrhy a domény u nás.</p>

  <p style="margin:24px 0">
    <a href="${link}" style="display:inline-block;background:#C84B31;color:#fff;padding:14px 24px;text-decoration:none;border-radius:4px;font-weight:bold">Přihlásit se</a>
  </p>

  <p style="font-size:14px;color:#8A7E6E;line-height:1.5">Odkaz platí 30 minut a dá se použít jen jednou.</p>

  <p style="font-size:14px;color:#8A7E6E;line-height:1.5">Pokud jste o přihlášení nežádali, tenhle e-mail klidně ignorujte — bez kliku se nic nestane.</p>

  <hr style="border:none;border-top:1px solid #e5e0d6;margin:32px 0 16px">
  <p style="font-size:12px;color:#8A7E6E;line-height:1.5">
    Zaslala fakan.cz na ${email} kvůli žádosti o přihlášení. Indigo Studio s.r.o.
  </p>
</div></body></html>`;

  return { subject, html, text };
}

// ---------- Transakční: suggestion done ----------
// Volá se přímo ze suggestion/render.js přes sendTransactional, ne přes drip.
// Vrací stejný { subject, html, text } tvar.
export function tplSuggestionDone(env, { domain, orderId, previewUrl, outputUrl }) {
  const host = env.PUBLIC_HOST || 'fakan.cz';
  const previewPageUrl = `https://${host}/navrh/${orderId}`;
  const subject = `Váš návrh úprav webu ${domain} je připraven`;
  const text = `Návrh máme hotový.

Adresa Vašeho webu: ${domain}
Náhled: ${previewPageUrl}

Z náhledu si stáhnete hotový HTML/CSS soubor. Stačí ho nahrát na hosting,
nebo nám napište — pomůžeme nasadit.

— Fakan`;

  const html = `<!doctype html><html lang="cs"><body style="font-family:Georgia,serif;background:#F9F6F0;color:#1F1B16;margin:0;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#fff;padding:32px;border-radius:6px">
  <h1 style="font-size:26px;margin:0 0 8px">Váš návrh je připraven</h1>
  <p style="font-size:14px;color:#8A7E6E;margin:0 0 24px">${domain}</p>

  ${previewUrl ? `<p style="margin:0 0 24px">
    <img src="${previewUrl}" alt="Náhled navrženého webu" style="display:block;width:100%;height:auto;border:1px solid #E5E0D6;border-radius:6px">
  </p>` : ''}

  <p style="font-size:16px;line-height:1.6">Hotový HTML/CSS soubor i náhled v plné velikosti najdete na:</p>

  <p style="margin:24px 0">
    <a href="${previewPageUrl}" style="display:inline-block;background:#C84B31;color:#fff;padding:14px 24px;text-decoration:none;border-radius:4px;font-weight:bold">Otevřít náhled</a>
  </p>

  <p style="font-size:14px;color:#8A7E6E;line-height:1.5">Stačí ho nahrát na Váš hosting. Pokud potřebujete pomoct s nasazením, ozvěte se na <a href="mailto:jsem@fakan.cz" style="color:#1F1B16">jsem@fakan.cz</a>.</p>

  <hr style="border:none;border-top:1px solid #e5e0d6;margin:32px 0 16px">
  <p style="font-size:12px;color:#8A7E6E;line-height:1.5">
    Tenhle e-mail jste dostali, protože jste si u nás objednali AI návrh úprav webu ${domain}.
    Indigo Studio s.r.o.
  </p>
</div></body></html>`;

  return { subject, html, text };
}

const unsubBlock = (env, ev) => `
<hr style="border:none;border-top:1px solid #e5e0d6;margin:32px 0 16px">
<p style="font-size:12px;color:#8A7E6E;line-height:1.5">
  Tenhle e-mail vám jde z fakan.cz, protože jste si nechali zanalyzovat web ${ev.domain}.
  <a href="${optoutUrl(env, ev)}" style="color:#8A7E6E">Odhlásit</a> · Indigo Studio s.r.o.
</p>`;

function shell(title, bodyHtml, env, ev) {
  return `<!doctype html><html lang="cs"><body style="font-family:Georgia,serif;background:#F9F6F0;color:#1F1B16;margin:0;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#fff;padding:32px;border-radius:6px">
${bodyHtml}
${unsubBlock(env, ev)}
</div></body></html>`;
}

// ---------- Mail #1: výsledky auditu ----------
function tplAuditDone(ev, env) {
  // PROMPT past: pokud audit selhal (Cloudflare bot challenge, login wall, timeout),
  // klient stejně dostane mail — ale s upozorněním, že se ozveme ručně.
  if (ev.audit_status === 'failed') return tplAuditFailed(ev, env);

  const subject = `Skóre Vašeho webu: ${ev.score}/100`;
  const text = `Audit ${ev.domain} máme hotový.

Skóre: ${ev.score}/100 — ${scoreLabel(ev.score)}

Detailní report: ${reportUrl(env, ev)}

Za 2 dny Vám pošleme konkrétní návrh, co s tím.
— Fakan`;

  const html = shell(subject, `
<h1 style="font-size:28px;margin:0 0 8px">${ev.domain}</h1>
<p style="font-size:14px;color:#8A7E6E;margin:0 0 24px">Audit máme hotový.</p>

<div style="text-align:center;padding:24px;background:#F9F6F0;border-radius:6px;margin:0 0 24px">
  <div style="font-size:64px;font-weight:bold;color:#1F1B16;line-height:1">${ev.score}<span style="font-size:24px;color:#8A7E6E">/100</span></div>
  <p style="font-size:16px;font-style:italic;margin:12px 0 0;color:#1F1B16">${scoreLabel(ev.score)}</p>
</div>

<p style="font-size:16px;line-height:1.6">Pět kategorií, 5–10 konkrétních věcí k řešení a náhled mobilu — vše v reportu:</p>

<p style="margin:24px 0">
  <a href="${reportUrl(env, ev)}" style="display:inline-block;background:#C84B31;color:#fff;padding:14px 24px;text-decoration:none;border-radius:4px;font-weight:bold">Otevřít report</a>
</p>

<p style="font-size:14px;color:#8A7E6E">Za 2 dny Vám pošleme konkrétní návrh, co s tím můžeme udělat. Nezávazně.</p>
`, env, ev);

  return { subject, html, text };
}

// ---------- Mail #1 (alternativa): audit nedoběhl ----------
function tplAuditFailed(ev, env) {
  const subject = `Audit ${ev.domain} — ozveme se ručně`;
  const text = `Web ${ev.domain} se nám nepodařilo automaticky proauditovat.

Důvod bývá obvykle jeden ze tří: web má ochranu proti robotům, vyžaduje přihlášení,
nebo se nestihl načíst včas. Žádná z těch věcí neznamená, že je s webem něco zásadně
špatně — jen na něj nesmí náš robot.

Podíváme se na něj sami a do 2 pracovních dnů Vám pošleme zhodnocení mailem.
Pokud by se mezitím něco hodilo doplnit, odpovězte na tuto zprávu.

— Fakan`;

  const html = shell(subject, `
<h1 style="font-size:24px;margin:0 0 8px">${ev.domain}</h1>
<p style="font-size:14px;color:#8A7E6E;margin:0 0 24px">Audit se automaticky nepodařil.</p>

<p style="font-size:16px;line-height:1.6">Web se nám nepodařilo automaticky proauditovat. Důvod bývá jeden ze tří:</p>
<ul style="font-size:15px;line-height:1.7;margin:0 0 16px">
  <li>web má ochranu proti robotům (Cloudflare challenge a podobně),</li>
  <li>vyžaduje přihlášení,</li>
  <li>nestihl se načíst včas.</li>
</ul>

<p style="font-size:16px;line-height:1.6">Žádná z těch věcí neznamená, že je s webem něco zásadně špatně — jen na něj nesmí náš automat.</p>

<p style="font-size:16px;line-height:1.6">Podíváme se na web sami a <strong>do 2 pracovních dnů Vám pošleme zhodnocení</strong>. Pokud by se mezitím něco hodilo doplnit, odpovězte přímo na tuto zprávu.</p>
`, env, ev);

  return { subject, html, text };
}

// ---------- Mail #2: strategist (3 varianty) ----------
async function tplStrategist(ev, env) {
  const s = await env.DB.prepare(`SELECT * FROM strategist_outputs WHERE audit_id=?`).bind(ev.audit_id).first();
  // Pokud strategist_outputs zmizel, fail loud — dispatcher chytne v render try/catch
  // a označí mail jako failed. NIKDY neposílat fallback na mail #1 (klient by ho měl
  // duplicitně). runStrategist schedule-uje #2 jen po úspěšném ukládání outputs,
  // takže tahle větev je defenzivní pro ruční zásahy.
  if (!s) throw new Error(`strategist_outputs missing for audit ${ev.audit_id}`);

  const subject = `${ev.domain} — 3 cesty, jak to řešit`;
  const fix = JSON.parse(s.variant_fix || '{}');
  const red = JSON.parse(s.variant_redesign || '{}');
  const neu = JSON.parse(s.variant_new || '{}');

  const variantBox = (v, accent) => `
<div style="border-left:3px solid ${accent};padding:16px 20px;margin:0 0 16px;background:#F9F6F0">
  <div style="font-weight:bold;font-size:18px;margin:0 0 4px">${v.title}</div>
  <div style="color:#8A7E6E;font-size:14px;margin:0 0 12px">${v.price_from?.toLocaleString('cs-CZ')}–${v.price_to?.toLocaleString('cs-CZ')} Kč · ${v.days} dní</div>
  <ul style="margin:0 0 12px;padding-left:18px;font-size:14px;line-height:1.6">${(v.what||[]).map(b => `<li>${b}</li>`).join('')}</ul>
  <div style="font-size:13px;color:#8A7E6E;font-style:italic">Hodí se: ${v.best_for}</div>
</div>`;

  const html = shell(subject, `
<h1 style="font-size:24px;margin:0 0 8px">${s.headline}</h1>
<p style="font-size:14px;color:#8A7E6E;margin:0 0 24px">${ev.domain} · skóre ${ev.score}/100</p>
${variantBox(fix, '#84A98C')}
${variantBox(red, '#D4783A')}
${variantBox(neu, '#C84B31')}
<p style="font-size:14px;line-height:1.6;margin:24px 0 0"><strong>Co se stane, když s tím nic neuděláte:</strong> ${s.risks}</p>
<p style="margin:24px 0">
  <a href="mailto:jsem@fakan.cz?subject=${encodeURIComponent(ev.domain)}" style="display:inline-block;background:#1F1B16;color:#fff;padding:14px 24px;text-decoration:none;border-radius:4px;font-weight:bold">Odpovědět e-mailem</a>
</p>
`, env, ev);

  return { subject, html, text: subject };
}

// ---------- Mail #3: tvrdá nabídka ----------
async function tplOffer(ev, env) {
  const subject = `${ev.domain} — pevná cena, 7 dní`;
  const html = shell(subject, `
<h1 style="font-size:24px">Pevná cena, jasný termín.</h1>
<p style="font-size:16px;line-height:1.6">Tři dny zticha, takže ještě jednou krátce. Když nás dnes pustíte do toho:</p>
<ul style="font-size:16px;line-height:1.8">
  <li>Audit jste viděli (skóre <strong>${ev.score}/100</strong>).</li>
  <li>Pevná cena, žádné víceúkoly v půlce.</li>
  <li>Hotovo do tří týdnů. Pokud ne, doplatek jde z naší strany.</li>
  <li>Hosting od 99 Kč/měs, kdykoli odejít zdarma s celým webem v ZIPu.</li>
</ul>
<p style="margin:24px 0">
  <a href="mailto:jsem@fakan.cz?subject=${encodeURIComponent('Chci nabídku pro ' + ev.domain)}" style="display:inline-block;background:#C84B31;color:#fff;padding:14px 24px;text-decoration:none;border-radius:4px;font-weight:bold">Chci nabídku</a>
</p>
<p style="font-size:14px;color:#8A7E6E">Nebo zavolejte: +420 604 690 539. Beze srandy.</p>
`, env, ev);
  return { subject, html, text: subject };
}

// ---------- Mail #4: re-audit za 30 dní ----------
function tplReaudit(ev, env) {
  const subject = `Měsíc utekl. Co se na ${ev.domain} změnilo?`;
  const html = shell(subject, `
<h1 style="font-size:24px">Měsíc utekl.</h1>
<p style="font-size:16px;line-height:1.6">Pustili jsme audit znovu. Tady je nové skóre vedle minulého:</p>
<p style="font-size:16px"><a href="${reportUrl(env, ev)}">${reportUrl(env, ev)}</a></p>
<p style="font-size:14px;color:#8A7E6E">Když je skóre stejné, je nejspíš čas na zásah. Když se zlepšilo, gratulujeme — Vy nebo někdo jiný odvedl práci.</p>
`, env, ev);
  return { subject, html, text: subject };
}

// ---------- Transakční: doménová operace dokončena ----------
export function tplDomainOperationDone(env, { fqdn, opKind, periodYears, ns, expiresAt, orderId }) {
  const host = env.PUBLIC_HOST || 'fakan.cz';
  const statusUrl = `https://${host}/domena/stav/${orderId}`;
  const opLabel = opKind === 'transfer' ? 'Převod' : 'Registrace';
  const subject = `${opLabel} domény ${fqdn} je hotová`;

  const expiryStr = expiresAt
    ? new Intl.DateTimeFormat('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })
        .format(new Date(expiresAt * 1000))
    : null;

  const text = `${opLabel} domény ${fqdn} je hotová.
${expiryStr ? `\nPlatnost do: ${expiryStr}` : ''}${ns?.length ? `\nNameservery:\n${ns.map((h) => '  - ' + h).join('\n')}` : ''}

Detail: ${statusUrl}

— Fakan`;

  const html = `<!doctype html><html lang="cs"><body style="font-family:Georgia,serif;background:#F9F6F0;color:#1F1B16;margin:0;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#fff;padding:32px;border-radius:6px">
  <h1 style="font-size:26px;margin:0 0 8px">${opLabel} domény je hotová</h1>
  <p style="font-size:18px;color:#1F1B16;margin:0 0 24px">${fqdn}</p>

  ${expiryStr ? `<p style="font-size:15px;line-height:1.6"><strong>Platnost do:</strong> ${expiryStr}</p>` : ''}
  ${ns?.length ? `<p style="font-size:15px;line-height:1.6;margin:0 0 8px"><strong>Nameservery:</strong></p>
  <ul style="font-size:14px;color:#1F1B16;background:#F9F6F0;padding:14px 32px;border-radius:4px;margin:0 0 16px">
    ${ns.map((h) => `<li style="margin-bottom:4px">${h}</li>`).join('')}
  </ul>` : ''}

  <p style="margin:24px 0">
    <a href="${statusUrl}" style="display:inline-block;background:#C84B31;color:#fff;padding:14px 24px;text-decoration:none;border-radius:4px;font-weight:bold">Detail objednávky</a>
  </p>

  <p style="font-size:14px;color:#8A7E6E;line-height:1.5">Pokud potřebujete pomoct s nasazením webu na novou doménu, ozvěte se na <a href="mailto:jsem@fakan.cz" style="color:#1F1B16">jsem@fakan.cz</a>.</p>

  <hr style="border:none;border-top:1px solid #e5e0d6;margin:32px 0 16px">
  <p style="font-size:12px;color:#8A7E6E;line-height:1.5">
    Tenhle e-mail jste dostali, protože jste si u nás objednali ${opKind === 'transfer' ? 'převod' : 'registraci'} domény ${fqdn}.
    Indigo Studio s.r.o.
  </p>
</div></body></html>`;

  return { subject, html, text };
}

// ---------- Transakční: doménová operace selhala ----------
export function tplDomainOperationFailed(env, { fqdn, opKind, errorMessage, orderId }) {
  const opLabel = opKind === 'transfer' ? 'Převod' : 'Registrace';
  const subject = `${opLabel} domény ${fqdn} se nepodařil/a`;

  const text = `Bohužel se nepodařilo dokončit ${opKind === 'transfer' ? 'převod' : 'registraci'} domény ${fqdn}.
${errorMessage ? `\nDůvod: ${errorMessage}` : ''}

Peníze Vám vrátíme do 3 pracovních dnů. Pokud chcete pomoct vyřešit jiným způsobem, napište na jsem@fakan.cz.

— Fakan`;

  const html = `<!doctype html><html lang="cs"><body style="font-family:Georgia,serif;background:#F9F6F0;color:#1F1B16;margin:0;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#fff;padding:32px;border-radius:6px;border-left:3px solid #C84B31">
  <h1 style="font-size:24px;margin:0 0 8px">${opLabel} se nepodařil/a</h1>
  <p style="font-size:16px;color:#1F1B16;margin:0 0 16px">${fqdn}</p>

  ${errorMessage ? `<p style="font-size:14px;background:#F9F6F0;padding:12px 14px;border-radius:4px;color:#1F1B16">${errorMessage}</p>` : ''}

  <p style="font-size:15px;line-height:1.6">Peníze Vám automaticky vrátíme do 3 pracovních dnů. Pokud chcete vyřešit jiným způsobem, napište nám na <a href="mailto:jsem@fakan.cz" style="color:#1F1B16">jsem@fakan.cz</a> a referencujte objednávku <code>${orderId}</code>.</p>

  <hr style="border:none;border-top:1px solid #e5e0d6;margin:32px 0 16px">
  <p style="font-size:12px;color:#8A7E6E;line-height:1.5">Indigo Studio s.r.o.</p>
</div></body></html>`;

  return { subject, html, text };
}
