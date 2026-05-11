// src/audit/checks/ai-review.js
//
// AI hodnocení vizuálu a obsahu webu pomocí Claude Sonnet 4.5 Vision.
// Volá se po deterministických visual checkech a před výpočtem score.
//
// Vstup:
//   - 4 screenshoty z R2 (mobile portrait, landscape, desktop, dark)
//   - Extrahovaný text stránky (max 5000 znaků)
//   - Kontextová data (segment leadu, CMS, tech findings, score)
//
// Výstup:
//   {
//     findings: [{category:'visual'|'content', severity, title, detail, fix_hint, weight}],
//     scores:   { visual_ai: 0-100, content: 0-100 },
//     summary:  '1-2 věty celkového dojmu',
//     usage:    { input_tokens, output_tokens },
//   }
//
// Selhání AI nesmí shodit audit — volající wrap-uje try/catch a fallback je
// { findings: [], scores: {}, summary: null, error: '...' }.

import { callVision, bufferToBase64 } from '../../lib/claude-vision.js';

const MAX_PAGE_TEXT_CHARS = 5000;
const SCREENSHOT_KEYS = ['mobilePortrait', 'mobileLandscape', 'desktop', 'mobileDark'];

const SEVERITY_WHITELIST = new Set(['critical', 'high', 'medium', 'low']);
const CATEGORY_WHITELIST = new Set(['visual', 'content']);

const SYSTEM_PROMPT = `Jste vizuální a obsahový redaktor Indigo Studia. Hodnotíte weby českých malých podnikatelů a spolků.

VSTUP, KTERÝ DOSTÁVÁTE:
- 4 screenshoty webu (mobil na výšku, mobil na šířku, desktop, mobil v tmavém režimu)
- Text z homepage (do 5000 znaků)
- Doplňková data v briefu (CMS, technické skóre, segment klienta)

CO HODNOTÍTE — VIZUÁL:
1. typografie — čitelnost, výběr fontů
2. hierarchie — jasnost nadpisů a vizuální struktura
3. whitespace a density — vzdušnost vs. přeplácanost
4. konzistence vizuálního stylu
5. dark mode kvalita — má web vlastní tmavou variantu, nebo je v dark režimu rozbitý

CO HODNOTÍTE — OBSAH:
6. jasnost USP — na první pohled je zřejmé, co firma dělá
7. srozumitelnost copy — text pochopí běžný návštěvník bez žargonu
8. jazyk a gramatika — chyby v češtině, kostrbatost, kalky z angličtiny
9. struktura informací — logické řazení, dohledatelnost
10. CTA (call-to-action) — viditelnost, jasnost konkrétní akce

PRAVIDLA PRO FINDINGS:
- Vraťte JEN problémy, ne pochvaly. "Stránka vypadá dobře" nepatří mezi findingy.
- Title ≤ 60 znaků, vykání, žádná emoji.
- Detail = 1–2 věty s konkrétním pozorováním ze screenshotu nebo textu. Např. "Modré odkazy na světlém pozadí mají nedostatečný kontrast." NE "kontrast by mohl být lepší".
- Fix_hint = praktická rada bez technického žargonu, jednou větou.
- Severity:
  • critical = rozbitý layout, nečitelný text, totální absence USP
  • high = vážná překážka (nejasný CTA, gramatické chyby v hlavičce)
  • medium = znatelný nedostatek (slabá hierarchie, dark mode invert)
  • low = drobnost (mírně překážející detail)
- Category vždy "visual" NEBO "content".

VÝSTUP: STRIKTNĚ JSON, ŽÁDNÝ OKOLNÍ TEXT, ŽÁDNÉ MARKDOWN BLOCKY.

{
  "summary": "max 2 věty — celkový dojem ve vykání, asertivně",
  "scores": {
    "typography":   1-10 nebo null,
    "hierarchy":    1-10 nebo null,
    "whitespace":   1-10 nebo null,
    "consistency":  1-10 nebo null,
    "darkmode":     1-10 nebo null,
    "usp_clarity":  1-10 nebo null,
    "copy_clarity": 1-10 nebo null,
    "language":     1-10 nebo null,
    "structure":    1-10 nebo null,
    "cta":          1-10 nebo null
  },
  "visual_score": 0-100,
  "content_score": 0-100,
  "findings": [
    { "category": "visual", "severity": "high", "title": "…", "detail": "…", "fix_hint": "…" }
  ]
}

Pokud screenshot některé varianty chybí (uvedeno v briefu), dejte score té položky null a finding o ní nevracejte.`;

export async function runAiReview(page, visualScreenshots, env, ctx) {
  if (!env.ANTHROPIC_API_KEY) {
    return { findings: [], scores: {}, summary: null, error: 'ANTHROPIC_API_KEY missing' };
  }

  // 1. Stáhnout screenshoty z R2 a převést na base64.
  const images = [];
  const presentKinds = [];
  for (const key of SCREENSHOT_KEYS) {
    const r2Key = visualScreenshots?.[key];
    if (!r2Key) continue;
    const obj = await env.REPORTS.get(r2Key);
    if (!obj) continue;
    const buf = await obj.arrayBuffer();
    images.push({
      mimeType: obj.httpMetadata?.contentType || 'image/jpeg',
      base64:   bufferToBase64(buf),
    });
    presentKinds.push(key);
  }
  if (images.length === 0) {
    return { findings: [], scores: {}, summary: null, error: 'no screenshots' };
  }

  // 2. Extrahovat text stránky.
  const pageText = await extractPageText(page);

  // 3. Sestavit user message brief.
  const briefText = buildBrief({
    pageText,
    presentKinds,
    domain: ctx.domain,
    url: ctx.url,
    cms: ctx.cms,
    segment: ctx.segment,
    techScores: ctx.techScores,
  });

  // 4. Zavolat Claude.
  let resp;
  try {
    resp = await callVision(env, {
      systemPrompt: SYSTEM_PROMPT,
      briefText,
      images,
    });
  } catch (err) {
    return { findings: [], scores: {}, summary: null, error: `claude: ${err.message?.slice(0, 200)}` };
  }

  // 5. Parsovat JSON odpověď.
  const parsed = parseJsonResponse(resp.text);
  if (!parsed) {
    return { findings: [], scores: {}, summary: null, error: 'invalid json from claude', raw: resp.text?.slice(0, 200) };
  }

  // 6. Sanitovat findings (whitelist polí, oříznout délky, severity validace).
  const sanitizedFindings = sanitizeFindings(parsed.findings || []);

  return {
    findings: sanitizedFindings,
    scores: {
      visual_ai: clampScore(parsed.visual_score),
      content:   clampScore(parsed.content_score),
      detail:    parsed.scores || {},
    },
    summary: typeof parsed.summary === 'string' ? parsed.summary.slice(0, 400) : null,
    usage:   resp.usage || {},
    requestId: resp.requestId,
  };
}

// --- Helpery ---

async function extractPageText(page) {
  try {
    const text = await page.evaluate(() => {
      // Sebrat hlavní text bez script/style/nav noise.
      const clones = document.body.cloneNode(true);
      clones.querySelectorAll('script, style, noscript, iframe').forEach((n) => n.remove());
      return (clones.innerText || '').replace(/\s+/g, ' ').trim();
    });
    return (text || '').slice(0, MAX_PAGE_TEXT_CHARS);
  } catch {
    return '';
  }
}

function buildBrief({ pageText, presentKinds, domain, url, cms, segment, techScores }) {
  const missing = SCREENSHOT_KEYS.filter((k) => !presentKinds.includes(k));
  const missingNote = missing.length
    ? `\nChybějící screenshoty: ${missing.join(', ')} — pro tyto varianty nehodnotit.`
    : '';

  const techLines = techScores
    ? `Technické skóre — perf ${techScores.perf ?? '?'}, a11y ${techScores.a11y ?? '?'}, sec ${techScores.sec ?? '?'}, cookie ${techScores.cookie ?? '?'}.`
    : '';

  return `Hodnocený web: ${domain} (${url})
CMS: ${cms || 'neznámý'}
Segment klienta: ${segment || 'unknown'}
${techLines}${missingNote}

--- Text z homepage (zkrácený na ${MAX_PAGE_TEXT_CHARS} znaků) ---
${pageText || '(žádný text se nepodařilo extrahovat)'}

--- Konec textu ---

Vraťte hodnocení dle systémových instrukcí. JSON, nic jiného.`;
}

function parseJsonResponse(text) {
  if (typeof text !== 'string') return null;
  // Claude občas zabalí JSON do markdown bloku, i když řekneme aby ne.
  const stripped = text.trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    return JSON.parse(stripped);
  } catch {
    // Jinak najít první { a poslední } a zkusit
    const start = stripped.indexOf('{');
    const end = stripped.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) return null;
    try {
      return JSON.parse(stripped.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function sanitizeFindings(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const f of arr) {
    if (!f || typeof f !== 'object') continue;
    const category = String(f.category || '').toLowerCase();
    const severity = String(f.severity || '').toLowerCase();
    if (!CATEGORY_WHITELIST.has(category)) continue;
    if (!SEVERITY_WHITELIST.has(severity)) continue;
    const title = String(f.title || '').slice(0, 80).trim();
    if (!title) continue;
    out.push({
      category,
      severity,
      title,
      detail:   String(f.detail   || '').slice(0, 400).trim(),
      fix_hint: String(f.fix_hint || '').slice(0, 400).trim(),
      weight:   1,
    });
    if (out.length >= 20) break;  // tvrdý strop, nechceme zaplevelený report
  }
  return out;
}

function clampScore(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.max(0, Math.min(100, Math.round(v)));
}
