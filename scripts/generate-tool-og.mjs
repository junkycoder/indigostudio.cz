// Přegeneruje obrázky pro sdílení po změně názvů nebo popisů nástrojů.
// Vyžaduje systémový rsvg-convert; není součástí nasazení Workeru.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { TOOLS, TOOL_CATALOG } from "../src/tools-data.js";

const destination = new URL("../public/tools/og/", import.meta.url).pathname;
mkdirSync(destination, { recursive: true });

const palettes = [
  ["#1d2938", "#e9b0a2"], ["#171f31", "#f0a868"], ["#253d68", "#c1cdfb"],
  ["#183d32", "#bde3cd"], ["#492d41", "#f4c6d9"], ["#3e362d", "#efd5a7"],
  ["#183c45", "#b9e0e1"], ["#343150", "#d4cbf3"],
];
const names = new Map(TOOLS.map(([slug, title, description]) => [slug, { title, description }]));
names.set("nastroje", { title: "Online nástroje", description: "Praktické nástroje Indigo Studio na jednom místě." });
names.set("ceska-republika", { title: "Česká republika", description: "Úřady, pojišťovny, doprava i zábava na jednom místě." });
const entries = [["nastroje", "Přehled nástrojů", ["#1b2435", "#a8b8f1"]]];
TOOL_CATALOG.forEach(([group, slugs], index) => slugs.forEach(slug => entries.push([slug, group, palettes[index]])));

const xml = text => String(text).replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]);
function wrap(text, limit) {
  const lines = [""];
  for (const word of text.split(" ")) {
    const last = lines.length - 1;
    if (lines[last] && `${lines[last]} ${word}`.length > limit) lines.push(word);
    else lines[last] += `${lines[last] ? " " : ""}${word}`;
  }
  return lines;
}

for (const [slug, group, [background, accent]] of entries) {
  const { title, description } = names.get(slug);
  const heading = wrap(title, title.length > 25 ? 19 : 22);
  const headlineSize = heading.some(line => line.length > 21) ? 68 : 79;
  const headline = heading.map((line, index) => `<tspan x="82" y="${284 + index * 86}">${xml(line)}</tspan>`).join("");
  const summary = wrap(description, 48).slice(0, 2).map((line, index) => `<tspan x="86" y="${460 + index * 42}">${xml(line)}</tspan>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
    <rect width="1200" height="630" fill="${background}"/>
    <rect x="0" y="0" width="16" height="630" fill="${accent}"/>
    <circle cx="1062" cy="128" r="184" fill="none" stroke="${accent}" stroke-opacity=".17" stroke-width="2"/>
    <circle cx="1062" cy="128" r="122" fill="none" stroke="${accent}" stroke-opacity=".28" stroke-width="2"/>
    <path d="M892 242h194M986 48v194" stroke="${accent}" stroke-opacity=".32" stroke-width="2"/>
    <rect x="82" y="67" width="28" height="28" rx="6" transform="rotate(-12 96 81)" fill="${accent}"/>
    <text x="130" y="89" fill="#f7f7f6" font-family="Arial,sans-serif" font-size="26" font-weight="700">Indigo<tspan font-weight="400">Studio</tspan></text>
    <text x="82" y="169" fill="${accent}" font-family="Arial,sans-serif" font-size="23" font-weight="700" letter-spacing="1.3">${xml(group.toLocaleUpperCase("cs-CZ"))}</text>
    <text fill="#fffdf8" font-family="Georgia,serif" font-size="${headlineSize}" font-weight="700">${headline}</text>
    <text fill="#d7dce3" font-family="Arial,sans-serif" font-size="31">${summary}</text>
    <path d="M82 550h1036" stroke="#ffffff" stroke-opacity=".24"/>
    <text x="82" y="594" fill="${accent}" font-family="Arial,sans-serif" font-size="23">${xml(slug)}.indigostudio.cz</text>
    <text x="1118" y="594" text-anchor="end" fill="#ffffff" fill-opacity=".63" font-family="Arial,sans-serif" font-size="22">Online zdarma</text>
  </svg>`;
  const output = join(destination, `${slug}.png`);
  const result = spawnSync("rsvg-convert", ["--output", output], { input: svg, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`${slug}: ${result.stderr || result.error}`);
}
console.log(`Vygenerováno ${entries.length} obrázků OG.`);
