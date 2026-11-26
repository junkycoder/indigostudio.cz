// Animované logo: srdce s korunou tepe (dvojitý úder „tu-dum") a každý úder pošle ven barevnou vlnu
// ve tvaru srdce. Zdrojem pravdy je tenhle skript — SVG a náhled vedle něj jsou jeho výstup.
// Spuštění: node marketing/logo-animace/build.mjs
// Logo (od Veroniky) se čte přímo z public/logo*.svg, takže po změně loga stačí skript spustit znovu.
// Animace je čisté CSS uvnitř SVG: funguje v <img>, <picture> i otevřené samostatně; s „omezit pohyb"
// (prefers-reduced-motion) se ukáže statické logo.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const out = (path) => fileURLToPath(new URL(path, import.meta.url));
const publicFile = (path) => fileURLToPath(new URL(`../../public/${path}`, import.meta.url));

// Rytmus: délka jednoho tepu v sekundách (~43 tepů za minutu, klidně, ne nervózně)
const BEAT = 1.4;

// Barvy značky (README „Logo a barvy") a barvy vln pro světlé a tmavé pozadí
const THEMES = {
  light: {
    mark: "#2A018A",
    text: "#0C0D16",
    glow: "#B899FF",
    waves: {
      lubA: ["#2A018A", "#7B2FF7", "#FF4FB8"], // indigo → fialová → růžová
      lubB: ["#3D5BFF", "#9B5CFF", "#FF7AC8"], // modrá → fialová → růžová
      dubA: ["#8A5CFF", "#FF7AC8"],
      dubB: ["#3D5BFF", "#B899FF"],
    },
  },
  dark: {
    mark: "#B899FF",
    text: "#F4F2FA",
    glow: "#B899FF",
    waves: {
      lubA: ["#B899FF", "#9B6BFF", "#FF7AC8"],
      lubB: ["#6F9BFF", "#B899FF", "#FF8FD2"],
      dubA: ["#C3A6FF", "#FF8FD2"],
      dubB: ["#6F9BFF", "#D9C8FF"],
    },
  },
};

// Cesty z SVG souboru: [{ fill, d }]
function loadPaths(file) {
  const svg = readFileSync(publicFile(file), "utf8");
  const viewBox = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
  const paths = [...svg.matchAll(/<path fill="([^"]+)"(?: transform="([^"]+)")? d="([^"]+)"/g)].map((m) => ({
    fill: m[1],
    transform: m[2],
    d: m[3],
  }));
  return { viewBox, paths };
}

// Rozloží cestu na podcesty z kubických segmentů [p0, p1, p2, p3] v absolutních souřadnicích.
// Logo používá jen M, c, z (případně C); cokoli jiného je chyba, ať si toho všimneme.
function parsePath(d) {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)/g);
  const subpaths = [];
  let i = 0;
  let cmd = null;
  let pos = [0, 0];
  let start = [0, 0];
  let segs = null;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) {
      cmd = tokens[i++];
      if (cmd === "z" || cmd === "Z") {
        pos = start;
        continue;
      }
    }
    if (cmd === "M") {
      pos = start = [num(), num()];
      segs = [];
      subpaths.push(segs);
      cmd = null;
    } else if (cmd === "c" || cmd === "C") {
      const n = [num(), num(), num(), num(), num(), num()];
      const o = cmd === "c" ? pos : [0, 0];
      const seg = [pos, [o[0] + n[0], o[1] + n[1]], [o[0] + n[2], o[1] + n[3]], [o[0] + n[4], o[1] + n[5]]];
      segs.push(seg);
      pos = seg[3];
    } else {
      throw new Error(`Nepodporovaný příkaz cesty: ${cmd}`);
    }
  }
  return subpaths;
}

const bezier = ([a, b, c, e], t) => {
  const m = 1 - t;
  return [0, 1].map((k) => m * m * m * a[k] + 3 * m * m * t * b[k] + 3 * m * t * t * c[k] + t * t * t * e[k]);
};
const samples = (segs, steps = 6) => segs.flatMap((s) => Array.from({ length: steps }, (_, k) => bezier(s, k / steps)));
const fmt = (p) => `${+p[0].toFixed(1)} ${+p[1].toFixed(1)}`;

function bbox(points) {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) };
}

// Úroveň (y v souřadnicích loga), kde nohy koruny dosedají na laloky srdce
const LOBE_TOP = 356;

// Obrys samotného srdce (bez koruny) pro vlny: vnější obrys od levého laloku přes špičku k pravému
// převezmeme přesně, horní část mezi laloky (pod korunou) doplníme dvěma oblouky přes zářez.
function heartOutline(markD) {
  const [outer, inner] = parsePath(markD);
  const n = outer.length;
  const at = (k) => outer[((k % n) + n) % n];
  let bottom = 0;
  outer.forEach((s, k) => {
    if (s[3][1] > outer[bottom][3][1]) bottom = k;
  });
  let first = bottom;
  let last = bottom;
  while (at(first - 1)[0][1] > LOBE_TOP) first--;
  while (at(last + 1)[3][1] > LOBE_TOP) last++;
  const run = Array.from({ length: last - first + 1 }, (_, k) => at(first + k));
  const left = run[0][0];
  const right = run[run.length - 1][3];

  // Zářez srdce: nejnižší bod vnitřního obrysu uprostřed mezi laloky
  const cx = (left[0] + right[0]) / 2;
  const notchY = Math.max(
    ...samples(inner)
      .filter((p) => Math.abs(p[0] - cx) < 30 && p[1] < left[1] + 160)
      .map((p) => p[1]),
  );
  const notch = [cx, notchY];
  const dxR = right[0] - cx;
  const dxL = cx - left[0];
  const toNotch = `C${fmt([right[0] - 0.45 * dxR, right[1]])} ${fmt([cx + 0.25 * dxR, notchY - 0.62 * (notchY - right[1])])} ${fmt(notch)}`;
  const toLeft = `C${fmt([cx - 0.25 * dxL, notchY - 0.62 * (notchY - left[1])])} ${fmt([left[0] + 0.45 * dxL, left[1]])} ${fmt(left)}`;
  const d = `M${fmt(left)}${run.map((s) => `C${fmt(s[1])} ${fmt(s[2])} ${fmt(s[3])}`).join("")}${toNotch}${toLeft}Z`;
  // Silueta celé značky (vnější obrys koruny a srdce): vlny pod ní schováme, takže se vynoří zpod srdce
  // a nekreslí se dovnitř koruny
  const silhouette = `M${fmt(outer[0][0])}${outer.map((s) => `C${fmt(s[1])} ${fmt(s[2])} ${fmt(s[3])}`).join("")}Z`;
  return { d, silhouette, box: bbox(samples(run)) };
}

// Gradient pro jednu vlnu; liché vlny mají barvy zrcadlově, ať se střídají strany
const gradient = (id, colors, flip) =>
  `<linearGradient id="${id}" x1="${flip ? 1 : 0}" y1="0" x2="${flip ? 0 : 1}" y2="1">${colors
    .map((c, k) => `<stop offset="${+(k / (colors.length - 1)).toFixed(2)}" stop-color="${c}"/>`)
    .join("")}</linearGradient>`;

const s = (x) => `${+x.toFixed(3)}s`;

// Velikost vln: do kolika se roztáhnou (násobek srdce) a tloušťka tahu (násobek výchozí);
// v malém logu v liště jsou kratší a silnější, aby byly vidět
const WAVES_LARGE = { lub: 1.75, dub: 1.5, stroke: 1 };
const WAVES_SMALL = { lub: 1.6, dub: 1.35, stroke: 2.5 };

// markTransform: umístění značky v plátně (podlouhlé logo má značku zmenšenou maticí);
// fade: pás {x1, y1, x2, y2} v souřadnicích značky, za kterým vlny mizí, aby nešly přes text
function animatedSvg({ viewBox, label, markD, markTransform, staticPaths, heart, theme, fade, size = WAVES_LARGE }) {
  const t = THEMES[theme];
  // Úder „tu" ve 6 % tepu, „dum" ve 20 %; vlna vyrazí ve vrcholu úderu a žije dva tepy,
  // proto jsou od každé vlny dvě kopie posunuté o jeden tep (a každá má jinou barvu).
  const lub = 0.06 * BEAT;
  const dub = 0.2 * BEAT;
  const waves = [
    ["lub", "lubA", lub],
    ["lub", "lubB", lub - BEAT],
    ["dub", "dubA", dub],
    ["dub", "dubB", dub - BEAT],
  ];
  const w = (x) => +(x * size.stroke).toFixed(1);
  // Transformace se vztahují ke středu srdce (ne ke středu značky s korunou)
  const markBox = bbox(samples(parsePath(markD).flat()));
  const heartCy = (heart.box.y0 + heart.box.y1) / 2;
  const beatOriginY = ((heartCy - markBox.y0) / (markBox.y1 - markBox.y0)) * 100;

  const css = `
.beat{transform-box:fill-box;transform-origin:50% ${beatOriginY.toFixed(1)}%;animation:beat ${s(BEAT)} infinite}
.glow{opacity:0;animation:glow ${s(BEAT)} infinite}
.wave{fill:none;stroke-linejoin:round;opacity:0;transform-box:fill-box;transform-origin:50% 50%;animation:lub ${s(2 * BEAT)} cubic-bezier(.22,.61,.36,1) infinite}
.wave.dub{animation-name:dub}
${waves.map(([, id, delay]) => `.${id}{animation-delay:${s(delay)}}`).join("\n")}
@keyframes beat{0%{transform:scale(1)}6%{transform:scale(1.07)}13%{transform:scale(.99)}20%{transform:scale(1.045)}32%,100%{transform:scale(1)}}
@keyframes glow{0%{opacity:0}6%{opacity:.55}13%{opacity:.2}20%{opacity:.4}45%,100%{opacity:0}}
@keyframes lub{0%{transform:scale(1);opacity:0;stroke-width:${w(18)}}3%{opacity:1}100%{transform:scale(${size.lub});opacity:0;stroke-width:${w(4)}}}
@keyframes dub{0%{transform:scale(1);opacity:0;stroke-width:${w(12)}}3%{opacity:.75}100%{transform:scale(${size.dub});opacity:0;stroke-width:${w(3)}}}
@media (prefers-reduced-motion:reduce){.beat,.glow,.wave{animation:none}.glow,.wave{display:none}}`.trim();

  // Maska vln (v souřadnicích značky): pod siluetou značky nejsou vidět, takže se vynoří zpod srdce;
  // u loga s nápisem navíc za pásem `fade` mizí
  const fadeGradient = fade
    ? `<linearGradient id="is-fade" gradientUnits="userSpaceOnUse" x1="${fade.x1}" y1="${fade.y1}" x2="${fade.x2}" y2="${fade.y2}"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient>`
    : "";
  const area = `x="-5000" y="-5000" width="10000" height="10000"`;
  const mask =
    `<mask id="is-mask" maskUnits="userSpaceOnUse" ${area}>` +
    `<rect ${area} fill="${fade ? "url(#is-fade)" : "#fff"}"/>` +
    `<path fill="#000" d="${heart.silhouette}"/></mask>`;
  const place = markTransform ? ` transform="${markTransform}"` : "";

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox.join(" ")}" role="img" aria-label="${label}">
<style>
${css}
</style>
<defs>
${Object.entries(t.waves)
  .map(([id, colors], k) => gradient(`is-${id}`, colors, k % 2 === 1))
  .join("\n")}
<radialGradient id="is-glow" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="${t.glow}"/><stop offset="1" stop-color="${t.glow}" stop-opacity="0"/></radialGradient>
${fadeGradient}
${mask}
<path id="is-heart" d="${heart.d}"/>
</defs>
<g${place}><g mask="url(#is-mask)">
${waves.map(([kind, id]) => `<use href="#is-heart" class="wave ${kind} ${id}" stroke="url(#is-${id})"/>`).join("\n")}
</g></g>
${staticPaths.map((p) => `<path fill="${p.fill}"${p.transform ? ` transform="${p.transform}"` : ""} d="${p.d}"/>`).join("\n")}
<g${place}><g class="beat">
<use href="#is-heart" class="glow" fill="url(#is-glow)"/>
<path fill="${t.mark}" d="${markD}"/>
</g></g>
</svg>
`;
}

// Převod mezi souřadnicemi značky a plátna pro matici „matrix(a 0 0 d e f)" (jen zmenšení a posun)
function matrixOf(transform) {
  const [a, , , d, e, f] = transform.match(/matrix\(([^)]+)\)/)[1].trim().split(/[\s,]+/).map(Number);
  return { toMark: ([x, y]) => [(x - e) / a, (y - f) / d], toCanvas: ([x, y]) => [a * x + e, d * y + f] };
}

// --- Vstupy z public/ ---

const mark = loadPaths("logo-mark.svg");
const markD = mark.paths[0].d;
const heart = heartOutline(markD);

// Celé logo: indigová cesta = značka + „Studio", tmavá = „Indigo" + slogan
const logo = loadPaths("logo.svg");
const indigo = logo.paths.find((p) => p.fill === THEMES.light.mark);
const text = logo.paths.find((p) => p.fill === THEMES.light.text);
if (!indigo.d.startsWith(markD)) throw new Error("public/logo.svg už nezačíná značkou z logo-mark.svg");
const studioD = indigo.d.slice(markD.length);
const textTop = bbox(samples(parsePath(studioD + text.d).flat())).y0;

// Plátno pro samotné srdce: místo kolem, aby se vlny stihly rozplynout
const pad = 0.8 * (heart.box.x1 - heart.box.x0);
const hcx = (heart.box.x0 + heart.box.x1) / 2;
const markViewBox = [hcx - pad, 130, 2 * pad, 880].map((v) => +v.toFixed(1));

// Podlouhlé logo do lišty webu: značka je zmenšená maticí, nápis vpravo. Plátno je oproti
// public/logo-horizontal.svg (0 0 1376 300) rozšířené vlevo, nahoru a dolů, aby se vlny a tep
// nesekly o okraj; web to vyrovná zápornými okraji (viz .brand img ve stránkách).
const HORIZONTAL_PAD = { left: 90, top: 30, bottom: 75 };
const horizontal = loadPaths("logo-horizontal.svg");
const hzMark = horizontal.paths.find((p) => p.transform);
if (hzMark?.d !== markD) throw new Error("public/logo-horizontal.svg už neobsahuje značku z logo-mark.svg");
const hzText = horizontal.paths.find((p) => p.fill === THEMES.light.text);
const hzStudio = horizontal.paths.find((p) => p.fill === THEMES.light.mark && !p.transform);
const hzMatrix = matrixOf(hzMark.transform);
// Nápis je ve skupině posunuté o translate(…)
const hzTextGroup = readFileSync(publicFile("logo-horizontal.svg"), "utf8").match(/<g transform="(translate\(([-\d.]+)[\s,]+([-\d.]+)\))">/);
if (!hzTextGroup) throw new Error("public/logo-horizontal.svg: nečekaná struktura nápisu");
const hzTextLeft = bbox(samples(parsePath(hzText.d).flat())).x0 + Number(hzTextGroup[2]);
const [, , hw, hh] = horizontal.viewBox;
const hzViewBox = [-HORIZONTAL_PAD.left, -HORIZONTAL_PAD.top, hw + HORIZONTAL_PAD.left, hh + HORIZONTAL_PAD.top + HORIZONTAL_PAD.bottom];
const hzFade = {
  x1: +hzMatrix.toMark([hzTextLeft - 60, 0])[0].toFixed(1),
  y1: 0,
  x2: +hzMatrix.toMark([hzTextLeft, 0])[0].toFixed(1),
  y2: 0,
};

for (const theme of ["light", "dark"]) {
  const suffix = theme === "dark" ? "-dark" : "";
  const t = THEMES[theme];
  writeFileSync(
    out(`srdce-animovane${suffix}.svg`),
    animatedSvg({ viewBox: markViewBox, label: "Indigo Studio", markD, staticPaths: [], heart, theme }),
  );
  const vertical = animatedSvg({
    viewBox: logo.viewBox,
    label: "Indigo Studio — Tvoříme srdcem.",
    markD,
    staticPaths: [
      { fill: t.mark, d: studioD },
      { fill: t.text, d: text.d },
    ],
    heart,
    theme,
    fade: { x1: 0, y1: Math.round(textTop - 80), x2: 0, y2: Math.round(textTop - 10) },
  });
  writeFileSync(out(`logo-animovane${suffix}.svg`), vertical);
  // Web: velké logo v patičce, podlouhlé v liště
  writeFileSync(publicFile(`logo-animated${suffix}.svg`), vertical);
  writeFileSync(
    publicFile(`logo-horizontal-animated${suffix}.svg`),
    animatedSvg({
      viewBox: hzViewBox,
      label: "Indigo Studio",
      markD,
      markTransform: hzMark.transform,
      staticPaths: [
        { fill: t.text, d: hzText.d, transform: hzTextGroup[1] },
        { fill: t.mark, d: hzStudio.d, transform: hzTextGroup[1] },
      ],
      heart,
      theme,
      fade: hzFade,
      size: WAVES_SMALL,
    }),
  );
}

console.log(
  "Hotovo: srdce-animovane(-dark).svg, logo-animovane(-dark).svg,",
  "public/logo-animated(-dark).svg, public/logo-horizontal-animated(-dark).svg",
);
