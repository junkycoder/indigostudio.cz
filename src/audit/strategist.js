// src/audit/strategist.js
// T+0 po Auditoru. Findings + segment → 3 cenované varianty řešení (mail #2 obsah).

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
Výstup: striktně JSON podle daného schématu, nic víc — žádný markdown blok,
žádná předmluva, žádný text za uzavřenou závorkou.

Cenotvorba (orientačně, ne dogma):
- varianta_fix       8.000 –  25.000 Kč  · 5–10 dní  · oprava na stávajícím CMS
- varianta_redesign 25.000 –  60.000 Kč  · 10–20 dní · redesign + content migration
- varianta_new      35.000 – 120.000 Kč  · 15–30 dní · nový web na Cloudflare/Vanilla
- spolek/OSVČ → spodní polovina; s.r.o. menší → střed; s.r.o. >50 lidí → horní.
- Hosting 99 / 249 / 590 Kč/měs (Lite/Standard/Pro), měsíčně, ZIP webu kdykoli.

Pravidla pro varianta_fix:
- Pokud je CMS Wix/Webnode/Squarespace nebo skóre < 30, oprava nedává smysl —
  fix.title = "Oprava nedává smysl" a fix.what vysvětlí proč.
- Pokud je WordPress outdated, fix MUSÍ obsahovat "update jádra a pluginů".

Risks (2 věty):
- Spojit konkrétní findings s byznysovým dopadem.
- a11y < 50 → zmínit EAA 2025 a možnost pokuty.
- cookie banner detekován → zmínit drop conversion rate.
- perf < 50 → zmínit, že 7/10 návštěvníků odejde do 3 s.

Výstupní JSON schéma (přesně tyto klíče, nic navíc):
{
  "headline": "1 věta — hlavní byznys problém klienta z auditu",
  "risks":    "2 věty — co se stane, když nic neudělá",
  "variant_fix":      { "title": "...", "what": ["..."], "price_from": 0, "price_to": 0, "days": 0, "best_for": "..." },
  "variant_redesign": { /* stejná struktura */ },
  "variant_new":      { /* stejná struktura */ }
}`;

// Few-shoty: 3 příklady přesně ve formátu, který chceme zpět.
// Po prvních ~50 reálných auditech vyhodit syntetické a nahradit reálnými dobrými výstupy
// (PROMPT.md: "Few-shoty v promptu nahrazuj reálnými dobrými výstupy postupně.").
const FEW_SHOTS = [
  // 1) zanedbaný WordPress, OSVČ řemeslník
  {
    user: {
      domain: 'obklady-novak.cz', score: 41, cms: 'wordpress', segment: 'osvc',
      findings: [
        { category: 'perf',   severity: 'high',   title: 'Stránka naskakuje pomalu', detail: 'FCP 4.2 s.' },
        { category: 'perf',   severity: 'medium', title: 'Stránka je těžká', detail: '3.4 MB.' },
        { category: 'cookie', severity: 'high',   title: 'Cookie okénko otravuje návštěvníka' },
        { category: 'cookie', severity: 'medium', title: '3 trackery', detail: 'GA, Facebook Pixel, Sklik' },
        { category: 'cms',    severity: 'high',   title: 'Zastaralý WordPress 5.9' },
        { category: 'a11y',   severity: 'high',   title: 'Nedostatečný kontrast textu', detail: '12 prvků' },
        { category: 'seo',    severity: 'medium', title: 'Chybí meta description' },
      ],
    },
    assistant: {
      headline: 'Na mobilu Váš web stojí každého druhého návštěvníka.',
      risks: 'Pomalý web a cookie banner berou až 50 % návštěvníků dřív, než vidí, co děláte. Přístupnost webu navíc od roku 2025 řeší zákon a hrozí pokuta.',
      variant_fix: {
        title: 'Oprava na stávajícím WordPressu',
        what: [
          'Update jádra WordPressu na aktuální verzi a všech pluginů',
          'Konverze obrázků na WebP, nastavení postupného načítání',
          'Odstranění Facebook Pixelu, místo Google Analytics jednoduchá analytika bez cookies',
          'Oprava kontrastu textu, popisky u obrázků pro čtečky',
          'Doplnění popisků stránek pro Google',
        ],
        price_from: 9000, price_to: 14000, days: 7,
        best_for: 'Když chcete co nejlevněji zachránit, co teď máte.',
      },
      variant_redesign: {
        title: 'Redesign na WordPressu',
        what: [
          'Nová šablona, mobile-first, fotky obkladaček ve velkém',
          'Galerie referencí s filtry (kuchyně, koupelny, exteriér)',
          'Poptávkový formulář s odeslaným reportem na Váš e-mail',
          'Bez cookies a bez bannerů',
          'Hosting Standard 249 Kč měsíčně',
        ],
        price_from: 28000, price_to: 42000, days: 14,
        best_for: 'Když chcete pořád WordPress, ale ať to konečně vypadá.',
      },
      variant_new: {
        title: 'Nový web na vlastní platformě',
        what: [
          'Statický web bez WordPressu, naskočí pod sekundu',
          'Šablona pro řemeslníka: úvod, reference, kontakt, časté dotazy',
          'Bez cookies, bez bannerů, splňuje zákon o přístupnosti',
          'Jednoduchá editace textů a fotek bez znalosti kódu',
          'Hosting Lite 99 Kč měsíčně, ZIP webu kdykoli zdarma',
        ],
        price_from: 35000, price_to: 48000, days: 21,
        best_for: 'Když máte plné zuby toho, že web každý měsíc něco rozbije.',
      },
    },
  },
  // 2) Wix kadeřnictví, s.r.o. menší — varianta_fix záměrně nesmí vzniknout
  {
    user: {
      domain: 'kadernictvi-praha2.cz', score: 58, cms: 'wix', segment: 'sro',
      findings: [
        { category: 'perf',   severity: 'medium', title: 'Stránka je těžká', detail: '5.1 MB' },
        { category: 'cookie', severity: 'high',   title: 'Cookie okénko otravuje' },
        { category: 'a11y',   severity: 'medium', title: 'Tlačítka bez popisků pro čtečky' },
        { category: 'seo',    severity: 'high',   title: 'Chybí Open Graph tagy' },
      ],
    },
    assistant: {
      headline: 'Web na Wixu Vás stojí 99 % rychlosti, kterou byste mohli mít.',
      risks: 'Wix nikdy nebude pod sekundu na mobilu, protože tahá půl megabajtu kódu ke každému kliknutí. Přístupnost webu navíc od roku 2025 řeší zákon a Wix ji negarantuje.',
      variant_fix: {
        title: 'Oprava nedává smysl',
        what: [
          'Wix Vám neumožní zrušit cookie banner ani odlehčit web.',
          'Změny obrázků a textů zvládnete sami v editoru — nepotřebujete nás.',
          'Pokud chcete reálně zlepšit stav, jediná cesta je přesun mimo Wix.',
        ],
        price_from: 0, price_to: 0, days: 0,
        best_for: 'Nedoporučujeme — Wix má architektonické limity, které opravou neobejdete.',
      },
      variant_redesign: {
        title: 'Redesign uvnitř Wixu',
        what: [
          'Nová šablona Wix, hlavní stránka přepsaná pod konverzi',
          'Online rezervace přes Reservio',
          'Open Graph tagy pro hezčí náhledy odkazů',
          'Hosting zůstává u Wixu (jejich měsíční poplatek)',
        ],
        price_from: 25000, price_to: 35000, days: 10,
        best_for: 'Když je Vám Wix sympatický a nechcete měnit ekosystém.',
      },
      variant_new: {
        title: 'Nový web na vlastní platformě, mimo Wix',
        what: [
          'Statický web, naskočí pod sekundu, žádný framework navíc',
          'Online rezervace (Cal.com nebo vlastní)',
          'Open Graph tagy a strukturovaná data pro Google',
          'Bez cookies, splňuje zákon o přístupnosti',
          'Hosting Standard 249 Kč měsíčně (vs. ~600 Kč Wix Premium)',
          'ZIP webu kdykoli zdarma',
        ],
        price_from: 42000, price_to: 58000, days: 18,
        best_for: 'Když chcete za menší měsíční náklad rychlejší a nezávislejší web.',
      },
    },
  },
  // 3) vlastní HTML, spolek
  {
    user: {
      domain: 'spolek-priroda-tynec.cz', score: 67, cms: 'unknown', segment: 'spolek',
      findings: [
        { category: 'perf', severity: 'low',    title: 'TTFB 1.1 s' },
        { category: 'a11y', severity: 'high',   title: 'Nedostatečný kontrast', detail: '8 prvků' },
        { category: 'a11y', severity: 'medium', title: 'Chybí lang atribut' },
        { category: 'seo',  severity: 'low',    title: 'Chybí canonical' },
        { category: 'sec',  severity: 'medium', title: 'Chybí HSTS' },
      ],
    },
    assistant: {
      headline: 'Web je v základu zdravý — chybí mu jen pár drobností a zákonné minimum.',
      risks: 'Bez splnění zákona o přístupnosti webu (platí od roku 2025) Vás může kontrola pokutovat. Drobnosti jako kontrast a označení jazyka jsou na hodinu práce, ale jejich absence bere body i v Googlu.',
      variant_fix: {
        title: 'Drobné opravy',
        what: [
          'Oprava kontrastu textů (8 prvků)',
          'Doplnění označení jazyka stránky (čeština)',
          'Doplnění odkazů na hlavní verze stránek',
          'Zapnutí trvalého HTTPS přes Cloudflare',
          'Drobné úpravy popisků stránek pro Google',
        ],
        price_from: 6000, price_to: 9000, days: 4,
        best_for: 'Spolková kasa to nepocítí a přístupnost budete mít z krku.',
      },
      variant_redesign: {
        title: 'Redesign s členskou sekcí',
        what: [
          'Nový vzhled, mobile-first',
          'Členská sekce: přihlášení, příspěvky, akce, hlasování',
          'Veřejný kalendář akcí',
          'Bez cookies, splňuje zákon o přístupnosti',
          'Hosting Lite 99 Kč měsíčně',
        ],
        price_from: 22000, price_to: 32000, days: 14,
        best_for: 'Když chcete spolek řídit přes web, ne přes WhatsApp.',
      },
      variant_new: {
        title: 'Nový web a spolková aplikace',
        what: [
          'Web a aplikace pro iOS i Android pro členy',
          'Akce, hlasování, příspěvky, upozornění do mobilu',
          'Kontrola IČO členů proti veřejnému rejstříku',
          'Hosting a aplikace 249 Kč měsíčně',
        ],
        price_from: 40000, price_to: 65000, days: 28,
        best_for: 'Spolek nad 50 členů, kde WhatsApp už nestíhá.',
      },
    },
  },
];

export async function runStrategist(job, env) {
  const { auditId, leadId, email } = job;

  const audit = await env.DB.prepare(`SELECT * FROM audits WHERE id=?`).bind(auditId).first();
  if (!audit) return;
  // Defensive: na failed audit nepouštět (LLM by halucinoval bez findings).
  // Processor strategistovi job neenequeuje při failed, tohle chrání před ručním re-runem.
  if (audit.status !== 'done') return;

  const findings = await env.DB.prepare(
    `SELECT category, severity, title, detail FROM findings WHERE audit_id=?`
  ).bind(auditId).all();
  const lead = await env.DB.prepare(
    `SELECT segment, ico FROM leads WHERE id=?`
  ).bind(leadId).first();

  const userPayload = {
    domain:   audit.domain,
    score:    audit.score,
    cms:      audit.cms,
    segment:  lead?.segment || 'unknown',
    findings: findings.results,
  };

  // Sestavit messages: few-shoty jako střídavé user/assistant turn-y, finální user na konci.
  const messages = [];
  for (const shot of FEW_SHOTS) {
    messages.push({ role: 'user',      content: JSON.stringify(shot.user) });
    messages.push({ role: 'assistant', content: JSON.stringify(shot.assistant) });
  }
  messages.push({ role: 'user', content: JSON.stringify(userPayload) });

  const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type':     'application/json',
      'x-api-key':        env.ANTHROPIC_API_KEY,
      'anthropic-version':'2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-sonnet-4-5',
      max_tokens: 1500,
      system:     SYSTEM_PROMPT,
      messages,
    }),
  });

  // 5xx + 429 → throw, ať queue handler v worker.js zavolá msg.retry({delaySeconds:60}).
  // 4xx (kromě 429) → permanent fail, nemá smysl retry.
  if (!claudeResp.ok) {
    const body = await claudeResp.text();
    console.error(`strategist HTTP ${claudeResp.status}`, body);
    if (claudeResp.status >= 500 || claudeResp.status === 429) {
      throw new Error(`anthropic ${claudeResp.status}`);
    }
    return;
  }

  const data = await claudeResp.json();
  const text = data.content?.[0]?.text || '';

  // Tolerantní parser: PROMPT.md past — Claude občas vrátí JSON v ```json``` nebo
  // s krátkou předmluvou. Najdi první { a poslední }, parsni mezi nimi.
  const jsonStart = text.indexOf('{');
  const jsonEnd   = text.lastIndexOf('}') + 1;
  if (jsonStart < 0 || jsonEnd <= jsonStart) {
    console.warn(`strategist: žádný JSON v odpovědi pro audit ${auditId}, output:`, text.slice(0, 200));
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(text.slice(jsonStart, jsonEnd));
  } catch (err) {
    console.warn(`strategist: parse fail pro audit ${auditId}: ${err.message}, slice:`, text.slice(jsonStart, jsonEnd).slice(0, 200));
    return;
  }

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

  // Maily #2 (T+2d), #3 (T+5d), #4 (T+30d). Mail #1 už šel z processoru.
  await scheduleEmail(env, { leadId, auditId, template: 'strategist',  sendInSeconds:  2 * 86400 });
  await scheduleEmail(env, { leadId, auditId, template: 'offer',       sendInSeconds:  5 * 86400 });
  await scheduleEmail(env, { leadId, auditId, template: 'reaudit_30d', sendInSeconds: 30 * 86400 });

  console.log(`strategist done audit=${auditId} headline="${(parsed.headline || '').slice(0, 60)}"`);
}
