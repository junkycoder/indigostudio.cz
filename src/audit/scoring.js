// src/audit/scoring.js
// Vyrobí sub-skóre 0–100 pro každou kategorii + vážený průměr (celkové score).
// Váhy zvýrazňují, co je Fakanovo USP: a11y/EAA + cookie-free.
//
// Kategorie `visual` (Fáze A) sbírá deterministické vizuální findings
// (multi-viewport overflow, iOS focus zoom, touch targety, dark mode).
// Kategorie `content` (Fáze B) bude AI hodnocení obsahu a estetiky.

const WEIGHTS = {
  perf:    18,
  a11y:    18,
  visual:  14,
  content: 14,
  cookie:  10,
  seo:     10,
  sec:     11,
  cms:      5,
};  // sum = 100

const SEVERITY_PENALTY = {
  critical: 30,
  high:     15,
  medium:    7,
  low:       3,
  info:      0,
};

export function score(findings, ctx) {
  const sub = {
    perf: 100, a11y: 100, visual: 100, content: 100,
    cookie: 100, seo: 100, sec: 100, cms: 100,
  };

  for (const f of findings) {
    if (sub[f.category] === undefined) continue;
    const penalty = (SEVERITY_PENALTY[f.severity] ?? 0) * (f.weight || 1);
    sub[f.category] -= penalty;
  }
  for (const k of Object.keys(sub)) sub[k] = Math.max(0, Math.min(100, Math.round(sub[k])));

  // Vážený průměr
  let total = 0, wSum = 0;
  for (const [k, w] of Object.entries(WEIGHTS)) {
    if (sub[k] === undefined) continue;
    total += sub[k] * w;
    wSum  += w;
  }
  total = Math.round(total / wSum);

  return {
    total,
    perf:    sub.perf,
    a11y:    sub.a11y,
    visual:  sub.visual,
    content: sub.content,
    seo:     sub.seo,
    cookie:  sub.cookie,
    sec:     sub.sec,
    cms:     sub.cms,
    label:   scoreLabel(total),
  };
}

export function scoreLabel(score) {
  if (score >= 90) return 'Lepší než 95 % toho, co vidíme. Klobouk dolů.';
  if (score >= 70) return 'Slušný. Tři opravy by zvedly skóre o 15 bodů.';
  if (score >= 50) return 'Funguje. Ale na mobilu vás to stojí návštěvníky.';
  if (score >= 30) return 'Návštěvníkovi to vadí, jen vám to ještě neřekl.';
  return 'Tady už ani Google nehledá cestu zpět.';
}
