// Vánoční share preview (OG 1200×630) — sezónní, do 6. 1. 2027
//   og-vanoce(-en|-vi).png  = celý web: běžný OG obrázek + větev s baňkou
//   og-tynecko(-en|-vi).png = /tynecko: nabídka „dárek k Vánocům" + větev, visačka, linka se srdcem
// Motivy z public/vanoce/ se jen umisťují (dodané, neupravovat). Logo = cesty ze scripts/og*.svg.
// sharp (librsvg) obrázky webp ve SVG nevykreslí, proto se renderuje headless Chromem.
// Spuštění: node scripts/og-vanoce.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const FONT = "Helvetica, Arial, sans-serif";
const INDIGO = "#2A018A", INK = "#0C0D16", MUTED = "#524F63";

// rozměry dodaných motivů (px)
const BRANCH = { href: "../public/vanoce/vetev-roh-ozdoba.webp", w: 1448, h: 1086 };
const HEART_LINE = { href: "../public/vanoce/linka-srdce.webp", w: 2000, h: 667 };

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const image = (m, x, y, w) =>
  `<image href="${m.href}" x="${x}" y="${y}" width="${w}" height="${(w * m.h / m.w).toFixed(1)}"/>`;
// větev vždy v pravém horním rohu
const branch = (w) => image(BRANCH, 1200 - w, 0, w);

// z původního OG zdroje: skupina s názvem (bez sloganu) a cesta značky (srdce s korunou)
function brandParts(lang) {
  const src = readFileSync(join(ROOT, "scripts", lang === "cs" ? "og.svg" : `og-${lang}.svg`), "utf8");
  const paths = [...src.matchAll(/<path fill="(#[0-9A-Fa-f]{6})" d="([^"]+)"\/>/g)];
  const mark = src.match(/<path fill="#2A018A" transform="[^"]+" d="([^"]+)"\/>/);
  if (paths.length < 2 || !mark) throw new Error(`logo v og ${lang} nenalezeno`);
  // první dvě cesty = „Indigo" a „Studio" (třetí v češtině je slogan)
  const name = paths.slice(0, 2).map((p) => `<path fill="${p[1]}" d="${p[2]}"/>`).join("");
  const lines = [...src.matchAll(/<text [^>]*>([^<]+)<\/text>/g)].map((t) => t[1]);
  return { name, mark: mark[1], lines, slogan: lang === "cs" ? `<path fill="${paths[2][1]}" d="${paths[2][2]}"/>` : "" };
}

const svg = (body, comment) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">\n` +
  `  <!-- ${comment} Generuje scripts/og-vanoce.mjs, ručně neupravovat. -->\n${body}\n</svg>\n`;

// ---- celý web: běžný OG + větev; značka se posune pod větev, aby ji baňka nezakryla ----
function webSvg(lang) {
  const b = brandParts(lang);
  const [h, l1, l2, url] = b.lines;
  return svg(`  <rect width="1200" height="630" fill="#ffffff"/>
  <rect y="618" width="1200" height="12" fill="${INDIGO}"/>
  <g transform="translate(44.60 -300.65) scale(0.5)">${b.name}${b.slogan}</g>
  <path fill="${INDIGO}" transform="matrix(0.44 0 0 0.44 620 170)" d="${b.mark}"/>
  ${branch(440)}
  <text x="96" y="360" font-family="${FONT}" font-size="46" font-weight="700" letter-spacing="-1" fill="${INK}">${h}</text>
  <text x="96" y="414" font-family="${FONT}" font-size="36" font-weight="400" fill="${MUTED}">${l1}</text>
  <text x="96" y="460" font-family="${FONT}" font-size="36" font-weight="400" fill="${MUTED}">${l2}</text>
  <text x="96" y="550" font-family="${FONT}" font-size="28" font-weight="600" fill="${INDIGO}">${url}</text>`,
    `Vánoční share preview celého webu (${lang}).`);
}

// ---- /tynecko: texty odpovídají stránce a plakátu ----
const TYNECKO = {
  cs: {
    place: "Týnec nad Sázavou a okolí",
    title: [["Nové webové stránky"], ["pro Vás jako ", "dárek"], ["", "k Vánocům*"]],
    tag: ["Vánoční", "nabídka"],
    note: ["* Od nového roku platíte provoz, péči a podporu", "5 082 Kč ročně včetně DPH."],
  },
  en: {
    place: "Around Týnec nad Sázavou",
    title: [["A new website"], ["for you as a"], ["", "Christmas gift*"]],
    tag: ["Christmas", "offer"],
    note: ["* Starting in the new year, you pay for hosting, maintenance", "and support, CZK 5,082 per year incl. VAT."],
  },
  vi: {
    place: "Vùng Týnec nad Sázavou",
    title: [["Website mới cho"], ["Quý khách làm"], ["", "quà Giáng sinh*"]],
    tag: ["Ưu đãi", "Giáng sinh"],
    note: ["* Từ năm mới, Quý khách trả phí vận hành, bảo trì và hỗ trợ", "5.082 Kč mỗi năm, đã gồm VAT."],
  },
};

function tyneckoSvg(lang) {
  const t = TYNECKO[lang];
  const b = brandParts(lang);
  const BW = 500; // šířka větve
  // visačka visí pod větví vlevo od baňky (stejně jako na stránce: 0.56 × šířka větve od pravého okraje)
  const tagCx = 1200 - BW * 0.56, tagTop = BW * 0.36;
  const title = t.title.map(([plain, accent = ""], i) =>
    `<text x="72" y="${248 + i * 70}" font-family="${FONT}" font-size="62" font-weight="700" letter-spacing="-1.6" fill="${INK}">` +
    `${esc(plain)}${accent ? `<tspan fill="${INDIGO}">${esc(accent)}</tspan>` : ""}</text>`).join("\n  ");
  const flake = "M0 -10V10M-8.7 -5L8.7 5M-8.7 5L8.7 -5M-2.5 -7.5L0 -5L2.5 -7.5M-2.5 7.5L0 5L2.5 7.5";
  return svg(`  <rect width="1200" height="630" fill="#fbf7f0"/>
  <rect y="618" width="1200" height="12" fill="${INDIGO}"/>
  ${branch(BW)}
  <!-- visačka „Vánoční nabídka" (jako na stránce) -->
  <g transform="rotate(5 ${tagCx} ${tagTop})">
    <path d="M${tagCx} ${tagTop - 70}V${tagTop + 16}" stroke="#b8893a" stroke-width="2"/>
    <rect x="${tagCx - 75}" y="${tagTop}" width="150" height="158" rx="16" fill="#fffdf6" stroke="#d9b46a" stroke-width="3"/>
    <circle cx="${tagCx}" cy="${tagTop + 17}" r="6" fill="#fbf7f0" stroke="#d9b46a" stroke-width="2"/>
    <text x="${tagCx}" y="${tagTop + 72}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-weight="700" font-size="27" fill="${INDIGO}">${esc(t.tag[0])}</text>
    <text x="${tagCx}" y="${tagTop + 102}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-weight="700" font-size="27" fill="${INDIGO}">${esc(t.tag[1])}</text>
    <path d="${flake}" transform="translate(${tagCx} ${tagTop + 130}) scale(1.1)" fill="none" stroke="#d4a446" stroke-width="1.8" stroke-linecap="round"/>
  </g>
  <g transform="translate(39.10 -209.10) scale(0.32)">${b.name}</g>
  <text x="72" y="166" font-family="${FONT}" font-size="24" font-weight="600" fill="${MUTED}">${esc(t.place)}</text>
  ${image(HEART_LINE, 52, 356, 400)}
  ${title}
  <text x="72" y="508" font-family="${FONT}" font-size="20" font-weight="400" fill="${MUTED}">${esc(t.note[0])}</text>
  <text x="72" y="535" font-family="${FONT}" font-size="20" font-weight="400" fill="${MUTED}">${esc(t.note[1])}</text>
  <text x="72" y="584" font-family="${FONT}" font-size="26" font-weight="600" fill="${INDIGO}">indigostudio.cz/tynecko</text>`,
    `Share preview /tynecko (${lang}).`);
}

function render(name, content) {
  const src = join(ROOT, "scripts", `${name}.svg`);
  writeFileSync(src, content);
  const out = join(ROOT, "public", `${name}.png`);
  execFileSync(CHROME, [
    "--headless", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--allow-file-access-from-files", "--window-size=1200,630", "--virtual-time-budget=3000",
    `--screenshot=${out}`, pathToFileURL(src).href,
  ], { stdio: "ignore" });
  console.log("public/" + name + ".png");
}

for (const lang of ["cs", "en", "vi"]) {
  const sfx = lang === "cs" ? "" : `-${lang}`;
  render(`og-vanoce${sfx}`, webSvg(lang));
  render(`og-tynecko${sfx}`, tyneckoSvg(lang));
}
