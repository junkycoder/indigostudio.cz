// Černobílá značka: srdce s korunou zachycené v půlce tepu, kolem něj tři vlny v odstínech šedi.
// Stejná kompozice jako tónovaná ikona iOS aplikace (~/indigostudio-ios, scripts/make-icon.py).
// Spuštění: node marketing/logo-animace/mono.mjs
// Tvary čte z public/logo-mark-animated.svg (výstup build.mjs), takže po změně loga stačí pustit
// nejdřív build.mjs a pak tenhle skript. Výstup: public/logo-mark-mono(-dark).svg a PNG do
// public/podklady/ (přes rsvg-convert, brew install librsvg).

import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const publicFile = (path) => fileURLToPath(new URL(`../../public/${path}`, import.meta.url));

const source = readFileSync(publicFile("logo-mark-animated.svg"), "utf8");
const pick = (re) => source.match(re)[1];
const heart = pick(/<path id="is-heart" d="([^"]+)"/); // srdce bez koruny, tvar vln
const mark = pick(/<path fill="#2A018A" d="([^"]+)"/); // celá značka
const mask = pick(/<mask[^>]*>[\s\S]*?<path fill="#000" d="([^"]+)"/); // pod značkou se vlny nekreslí

// Střed srdce bez koruny = střed vln i tepu (transform-origin v animaci)
const CX = 625.85;
const CY = 589.0;
// Obsah: vršek koruny (y 170) až spodní špička vnější vlny, do šířky vnější vlna; okraj 12
const VIEWBOX = "188.2 158.1 875.3 791.9";

const ring = (id, scale, width, opacity) =>
  `<use href="#h" transform="translate(${CX} ${CY}) scale(${scale}) translate(${-CX} ${-CY})" fill="none" stroke="url(#${id})" stroke-width="${width}" stroke-linejoin="round" opacity="${opacity}"/>`;

// Zamrzlý okamžik animace: tři vlny v různé fázi, nejvzdálenější nejslabší
const RINGS = [ring("lubB", 1.5, 7, 0.3), ring("lubA", 1.3, 10, 0.7), ring("dubA", 1.13, 9, 0.85)];

const VARIANTS = {
  // pro světlé pozadí: černá
  "": { mark: "#000000", glow: ["#000000", 0.12], waves: { lubA: ["#000000", "#424242"], lubB: ["#1F1F1F", "#616161"], dubA: ["#000000", "#303030"] } },
  // pro tmavé pozadí: bílá (jako tónovaná ikona aplikace)
  "-dark": { mark: "#FFFFFF", glow: ["#FFFFFF", 0.55], waves: { lubA: ["#FFFFFF", "#BDBDBD"], lubB: ["#E0E0E0", "#9E9E9E"], dubA: ["#FFFFFF", "#CFCFCF"] } },
};

for (const [suffix, v] of Object.entries(VARIANTS)) {
  const gradient = (id, [from, to], flip) =>
    `<linearGradient id="${id}" x1="${flip ? 1 : 0}" y1="0" x2="${flip ? 0 : 1}" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}" role="img" aria-label="Indigo Studio">
<defs>
${gradient("lubA", v.waves.lubA)}
${gradient("lubB", v.waves.lubB, true)}
${gradient("dubA", v.waves.dubA)}
<radialGradient id="glow" cx=".5" cy=".45" r=".6"><stop offset="0" stop-color="${v.glow[0]}"/><stop offset="1" stop-color="${v.glow[0]}" stop-opacity="0"/></radialGradient>
<mask id="m" maskUnits="userSpaceOnUse" x="-5000" y="-5000" width="10000" height="10000"><rect x="-5000" y="-5000" width="10000" height="10000" fill="#fff"/><path fill="#000" d="${mask}"/></mask>
<path id="h" d="${heart}"/>
</defs>
<g mask="url(#m)">${RINGS.join("")}</g>
<use href="#h" transform="translate(${CX} ${CY}) scale(1.06) translate(${-CX} ${-CY})" fill="url(#glow)" opacity="${v.glow[1]}"/>
<path fill="${v.mark}" d="${mark}"/>
</svg>
`;
  const svgPath = publicFile(`logo-mark-mono${suffix}.svg`);
  writeFileSync(svgPath, svg);
  const png = publicFile(`podklady/indigo-studio-mark-mono${suffix}.png`);
  execFileSync("rsvg-convert", ["-h", "1200", svgPath, "-o", png]);
  console.log(`public/logo-mark-mono${suffix}.svg, public/podklady/indigo-studio-mark-mono${suffix}.png`);
}
