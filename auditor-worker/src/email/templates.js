// src/email/templates.js
// 4 šablony: audit_done | strategist | offer | reaudit_30d

import { scoreLabel } from '../audit/scoring.js';

export async function renderEmail(ev, env) {
  switch (ev.template) {
    case 'audit_done':   return tplAuditDone(ev);
    case 'strategist':   return await tplStrategist(ev, env);
    case 'offer':        return await tplOffer(ev, env);
    case 'reaudit_30d':  return tplReaudit(ev);
    default: throw new Error(`Unknown template ${ev.template}`);
  }
}

const reportUrl = (ev) => `https://audit.fakan.cz/audit/${ev.report_token}`;
const unsubBlock = (ev) => `
<hr style="border:none;border-top:1px solid #e5e0d6;margin:32px 0 16px">
<p style="font-size:12px;color:#8A7E6E;line-height:1.5">
  Tenhle e-mail vám jde z fakan.cz, protože jste si nechali zanalyzovat web ${ev.domain}.
  <a href="https://fakan.cz/unsubscribe?token=${ev.unsub_token}" style="color:#8A7E6E">Odhlásit</a> · Indigo Studio s.r.o.
</p>`;

function shell(title, bodyHtml, ev) {
  return `<!doctype html><html lang="cs"><body style="font-family:Georgia,serif;background:#F9F6F0;color:#1F1B16;margin:0;padding:24px">
<div style="max-width:560px;margin:0 auto;background:#fff;padding:32px;border-radius:6px">
${bodyHtml}
${unsubBlock(ev)}
</div></body></html>`;
}

// ---------- Mail #1: výsledky auditu ----------
function tplAuditDone(ev) {
  const subject = `Skóre vašeho webu: ${ev.score}/100`;
  const text = `Audit ${ev.domain} hotov.

Skóre: ${ev.score}/100 — ${scoreLabel(ev.score)}

Detailní report: ${reportUrl(ev)}

Za 2 dny vám pošleme konkrétní návrh, co s tím.
— Fakan`;

  const html = shell(subject, `
<h1 style="font-size:28px;margin:0 0 8px">${ev.domain}</h1>
<p style="font-size:14px;color:#8A7E6E;margin:0 0 24px">Audit hotov.</p>

<div style="text-align:center;padding:24px;background:#F9F6F0;border-radius:6px;margin:0 0 24px">
  <div style="font-size:64px;font-weight:bold;color:#1F1B16;line-height:1">${ev.score}<span style="font-size:24px;color:#8A7E6E">/100</span></div>
  <p style="font-size:16px;font-style:italic;margin:12px 0 0;color:#1F1B16">${scoreLabel(ev.score)}</p>
</div>

<p style="font-size:16px;line-height:1.6">Pět kategorií, 5–10 konkrétních věcí k řešení a screenshot mobilu — vše v reportu:</p>

<p style="margin:24px 0">
  <a href="${reportUrl(ev)}" style="display:inline-block;background:#C84B31;color:#fff;padding:14px 24px;text-decoration:none;border-radius:4px;font-weight:bold">Otevřít report</a>
</p>

<p style="font-size:14px;color:#8A7E6E">Za 2 dny vám pošleme konkrétní návrh, co s tím můžeme udělat my. Nezávazně.</p>
`, ev);

  return { subject, html, text };
}

// ---------- Mail #2: strategist (3 varianty) ----------
async function tplStrategist(ev, env) {
  const s = await env.DB.prepare(`SELECT * FROM strategist_outputs WHERE audit_id=?`).bind(ev.audit_id).first();
  if (!s) return tplAuditDone(ev); // fallback

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
<p style="font-size:14px;line-height:1.6;margin:24px 0 0"><strong>Co se stane když nic neudělá:</strong> ${s.risks}</p>
<p style="margin:24px 0">
  <a href="mailto:jsem@fakan.cz?subject=${encodeURIComponent(ev.domain)}" style="display:inline-block;background:#1F1B16;color:#fff;padding:14px 24px;text-decoration:none;border-radius:4px;font-weight:bold">Odpovědět e-mailem</a>
</p>
`, ev);

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
`, ev);
  return { subject, html, text: subject };
}

// ---------- Mail #4: re-audit za 30 dní ----------
function tplReaudit(ev) {
  const subject = `Měsíc utekl. Co se na ${ev.domain} změnilo?`;
  const html = shell(subject, `
<h1 style="font-size:24px">Měsíc utekl.</h1>
<p style="font-size:16px;line-height:1.6">Pustil jsem audit znovu. Tady je nové skóre vs. minulé:</p>
<p style="font-size:16px"><a href="${reportUrl(ev)}">${reportUrl(ev)}</a></p>
<p style="font-size:14px;color:#8A7E6E">Když je skóre stejné, pravděpodobně je to čas na zásah. Když se zlepšilo, gratuluju — vy nebo někdo jiný odvedl práci.</p>
`, ev);
  return { subject, html, text: subject };
}
