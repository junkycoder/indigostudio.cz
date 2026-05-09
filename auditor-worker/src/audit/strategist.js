// src/audit/strategist.js
// T+30s po Auditoru. Findings + ARES → 3 cenované varianty řešení.

import { scheduleEmail } from '../email/dispatcher.js';

const SYSTEM_PROMPT = `Jsi obchodní stratég webového studia fakan.cz.
Z výsledků auditu vytvoříš 3 varianty nabídky pro českého malého klienta.

Tonalita textu (důležité, klient ho uvidí v mailu i v reportu):
- Vykání ("Váš web", "pošleme Vám", "klikněte"). NIKDY tykání.
- Mluv česky, věcně, bez prodejních klišé. Žádné emoji, žádné vykřičníky.
- Předpokládej minimální technické znalosti klienta — žargon (HSTS, CSP, FCP,
  EAA, CMS, CDN…) buď nepoužívej, nebo ho v jedné větě vysvětli lidsky.
- Asertivně: krátké věty, konkrétní čísla z findings, jasná doporučení.
  Žádné "možná by stálo za zvážení". Když je něco rozbité, řekni to rovnou.
- Konkrétní > obecné. "Optimalizace obrázků na WebP" ne "zrychlení".

Vstup: JSON s findings, CMS, segment klienta (osvc/sro/spolek).
Výstup: striktně JSON podle daného schématu, nic víc.

Pravidla cenotvorby (orientační, vstupy do prompts):
- Oprava existujícího webu (varianta_fix): 8.000–25.000 Kč
- Redesign na stávajícím CMS (varianta_redesign): 25.000–60.000 Kč
- Nový web na Cloudflare stacku (varianta_new): 35.000–120.000 Kč
- Spolek a OSVČ → spodní polovina rozpětí; s.r.o. → horní polovina.
- Hosting 99/249/590 Kč/měs uvedený jako recurring.

Výstupní JSON schéma:
{
  "headline": "1 věta — hlavní problém klienta z pohledu byznysu",
  "risks": "2 věty — co se stane, když nic neudělá (EAA pokuta, ztráta návštěv, …)",
  "variant_fix":      { "title": "Oprava", "what": ["bod1","bod2","bod3"], "price_from": 8000, "price_to": 18000, "days": 7, "best_for": "kdy dává smysl" },
  "variant_redesign": { "title": "Redesign", "what": [...], "price_from": ..., "price_to": ..., "days": 14, "best_for": "..." },
  "variant_new":      { "title": "Nový web", "what": [...], "price_from": ..., "price_to": ..., "days": 21, "best_for": "..." }
}`;

export async function runStrategist(job, env) {
  const { auditId, leadId, email } = job;

  const audit = await env.DB.prepare(`SELECT * FROM audits WHERE id=?`).bind(auditId).first();
  if (!audit) return;
  const findings = await env.DB.prepare(`SELECT category, severity, title, detail FROM findings WHERE audit_id=?`).bind(auditId).all();
  const lead = await env.DB.prepare(`SELECT segment, ico FROM leads WHERE id=?`).bind(leadId).first();

  const userPayload = {
    domain:   audit.domain,
    score:    audit.score,
    cms:      audit.cms,
    segment:  lead?.segment || 'unknown',
    findings: findings.results,
  };

  const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: JSON.stringify(userPayload) }],
    }),
  });

  if (!claudeResp.ok) {
    console.error('strategist failed', await claudeResp.text());
    return;
  }
  const data = await claudeResp.json();
  const text = data.content?.[0]?.text || '';
  const jsonStart = text.indexOf('{');
  const jsonEnd   = text.lastIndexOf('}') + 1;
  let parsed;
  try { parsed = JSON.parse(text.slice(jsonStart, jsonEnd)); } catch { return; }

  await env.DB.prepare(`
    INSERT OR REPLACE INTO strategist_outputs
      (audit_id, headline, variant_fix, variant_redesign, variant_new, risks, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).bind(
    auditId,
    parsed.headline || null,
    JSON.stringify(parsed.variant_fix || null),
    JSON.stringify(parsed.variant_redesign || null),
    JSON.stringify(parsed.variant_new || null),
    parsed.risks || null,
    Math.floor(Date.now()/1000),
  ).run();

  // mail #2 — za 2 dny
  await scheduleEmail(env, {
    leadId, auditId, template: 'strategist',
    sendInSeconds: 2 * 86400,
  });

  // mail #3 — za 5 dní (tvrdá nabídka)
  await scheduleEmail(env, {
    leadId, auditId, template: 'offer',
    sendInSeconds: 5 * 86400,
  });

  // mail #4 — re-audit upomínka za 30 dní
  await scheduleEmail(env, {
    leadId, auditId, template: 'reaudit_30d',
    sendInSeconds: 30 * 86400,
  });
}
