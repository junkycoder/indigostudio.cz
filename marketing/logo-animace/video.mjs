// Videa animovaného loga pro sociální sítě: z SVG vedle (výstup build.mjs) udělá MP4 a GIF.
// Snímky kreslí skutečný prohlížeč (headless Chrome přes DevTools Protocol), takže video vypadá
// přesně jako SVG na webu. Snímkuje se deterministicky: animace se pozastaví a pro každý snímek
// se nastaví čas, takže smyčka navazuje bez skoku.
// Spuštění: node marketing/logo-animace/video.mjs (nejdřív build.mjs, pokud se měnilo logo);
// jen vybrané varianty: node marketing/logo-animace/video.mjs logo-vodorovne-animovane
// Výstup jde sem (české názvy) a zároveň do public/podklady/ (anglické názvy, ke stažení na /media).
// Potřebuje Google Chrome (jinde než v /Applications nastavit cestu v proměnné CHROME) a ffmpeg
// s libx264 (na macOS brew install ffmpeg). Žádné npm závislosti: WebSocket je v Node 22 vestavěný.

import { spawn, execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const out = (path) => fileURLToPath(new URL(path, import.meta.url));
const podklady = (path) => fileURLToPath(new URL(`../../public/podklady/${path}`, import.meta.url));

const CHROME = process.env.CHROME || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

// Perioda celé animace: tep 1,4 s, vlna žije dva tepy a barvy vln se střídají po tepu → 2,8 s
const PERIOD_MS = 2800;
// Začátek snímání v ustáleném stavu (všechny vlny už běží), v milisekundách
const START_MS = 5600;
// Logo zabírá 80 % plátna, okraj 10 % z každé strany
const LOGO_SHARE = 0.8;

// name = SVG vedle a název výstupu tady, web = název v public/podklady/,
// aspect = výška plátna vůči šířce (vodorovné logo na podlouhlém plátně, ostatní na čtverci)
const VARIANTS = [
  { name: "logo-animovane", web: "indigo-studio-logo-animated", background: "#FFFFFF" },
  { name: "logo-animovane-dark", web: "indigo-studio-logo-animated-dark", background: "#0C0D16" },
  { name: "logo-vodorovne-animovane", web: "indigo-studio-logo-horizontal-animated", background: "#FFFFFF", aspect: 1 / 3 },
  { name: "logo-vodorovne-animovane-dark", web: "indigo-studio-logo-horizontal-animated-dark", background: "#0C0D16", aspect: 1 / 3 },
  { name: "srdce-animovane", web: "indigo-studio-mark-animated", background: "#FFFFFF" },
  { name: "srdce-animovane-dark", web: "indigo-studio-mark-animated-dark", background: "#0C0D16" },
];

// MP4: čtverec pro feed, 30 fps (84 snímků na periodu), perioda 4× za sebou ≈ 11 s.
// GIF: menší, 25 fps (70 snímků, zpoždění přesně 4 setiny), jedna perioda a nekonečná smyčka.
// size je šířka plátna; výška = šířka × aspect (zaokrouhleno na sudé číslo kvůli H.264).
const FORMATS = [
  { ext: "mp4", size: 1080, fps: 30, repeat: 4 },
  { ext: "gif", size: 600, fps: 25 },
];

// --- Minimální klient DevTools Protocolu ---

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.lastId = 0;
    this.pending = new Map();
    this.listeners = new Set();
    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject, method } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${method}: ${msg.error.message}`));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const listener of this.listeners) listener(msg);
      }
    });
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", () => reject(new Error(`Nepodařilo se připojit k ${url}`)), { once: true });
    });
    return new Cdp(ws);
  }

  send(method, params = {}, sessionId) {
    const id = ++this.lastId;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject, method }));
  }

  // Počká na první událost daného jména v dané relaci
  once(method, sessionId) {
    return new Promise((resolve) => {
      const listener = (msg) => {
        if (msg.method !== method || msg.sessionId !== sessionId) return;
        this.listeners.delete(listener);
        resolve(msg.params);
      };
      this.listeners.add(listener);
    });
  }

  close() {
    this.ws.close();
  }
}

// Spustí headless Chrome s dočasným profilem; port DevTools si zvolí sám a zapíše ho do profilu
async function launchChrome(profileDir) {
  if (!existsSync(CHROME)) throw new Error(`Chrome nenalezen: ${CHROME} (nastavte proměnnou CHROME)`);
  const chrome = spawn(
    CHROME,
    [
      "--headless=new",
      "--remote-debugging-port=0",
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--hide-scrollbars",
      "--mute-audio",
      "--force-color-profile=srgb",
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  const portFile = join(profileDir, "DevToolsActivePort");
  for (let waited = 0; !existsSync(portFile) || !readFileSync(portFile, "utf8").includes("\n"); waited += 100) {
    if (waited > 20000) throw new Error("Chrome nenastartoval do 20 s");
    if (chrome.exitCode != null) throw new Error(`Chrome skončil s kódem ${chrome.exitCode}`);
    await new Promise((r) => setTimeout(r, 100));
  }
  const [port, path] = readFileSync(portFile, "utf8").trim().split("\n");
  return { chrome, wsUrl: `ws://127.0.0.1:${port}${path}` };
}

// HTML obal: inline SVG vycentrované na plném pozadí, aby šlo ovládat jeho animace z dokumentu
function wrapperHtml(svg, background) {
  const share = `${LOGO_SHARE * 100}%`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:100%;height:100%;overflow:hidden;background:${background}}
body{display:grid;place-items:center}
body>svg{width:${share};height:${share}}
</style></head><body>${svg}</body></html>`;
}

async function main() {
  const work = mkdtempSync(join(tmpdir(), "logo-video-"));
  const profileDir = join(work, "chrome");
  mkdirSync(profileDir);
  let chrome;
  let cdp;
  try {
    const launched = await launchChrome(profileDir);
    chrome = launched.chrome;
    cdp = await Cdp.connect(launched.wsUrl);
    const { targetId } = await cdp.send("Target.createTarget", { url: "about:blank" });
    const { sessionId } = await cdp.send("Target.attachToTarget", { targetId, flatten: true });
    const page = (method, params) => cdp.send(method, params, sessionId);
    const evaluate = async (expression) => {
      const res = await page("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
      if (res.exceptionDetails) throw new Error(`Chyba ve stránce: ${res.exceptionDetails.text}`);
      return res.result.value;
    };
    await page("Page.enable");
    // Pohyb vždy zapnutý (s „omezit pohyb" by SVG ukázalo statické logo)
    await page("Emulation.setEmulatedMedia", {
      features: [{ name: "prefers-reduced-motion", value: "no-preference" }],
    });

    const only = process.argv.slice(2);
    const variants = only.length ? VARIANTS.filter((v) => only.includes(v.name)) : VARIANTS;
    if (!variants.length) throw new Error(`Neznámá varianta: ${only.join(", ")}`);

    for (const variant of variants) {
      const svg = readFileSync(out(`${variant.name}.svg`), "utf8");
      const htmlFile = join(work, `${variant.name}.html`);
      writeFileSync(htmlFile, wrapperHtml(svg, variant.background));
      const loaded = cdp.once("Page.loadEventFired", sessionId);
      await page("Page.navigate", { url: pathToFileURL(htmlFile).href });
      await loaded;
      const count = await evaluate("document.getAnimations().forEach((a) => a.pause()); document.getAnimations().length");
      if (!count) throw new Error(`${variant.name}.svg nemá žádné animace`);

      for (const format of FORMATS) {
        await page("Emulation.setDeviceMetricsOverride", {
          width: format.size,
          height: Math.round((format.size * (variant.aspect ?? 1)) / 2) * 2,
          deviceScaleFactor: 1,
          mobile: false,
        });
        const framesDir = join(work, `${variant.name}-${format.ext}`);
        mkdirSync(framesDir);
        const frames = Math.round((PERIOD_MS / 1000) * format.fps);
        for (let i = 0; i < frames; i++) {
          const time = START_MS + (i * PERIOD_MS) / frames;
          // Nastavit čas všem animacím a počkat, až se změna opravdu vykreslí
          await evaluate(`(async () => {
            for (const a of document.getAnimations()) a.currentTime = ${time};
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
          })()`);
          const { data } = await page("Page.captureScreenshot", { format: "png" });
          writeFileSync(join(framesDir, `${String(i).padStart(4, "0")}.png`), Buffer.from(data, "base64"));
        }
        encode(format, frames, join(framesDir, "%04d.png"), out(`${variant.name}.${format.ext}`));
        copyFileSync(out(`${variant.name}.${format.ext}`), podklady(`${variant.web}.${format.ext}`));
        console.log(`${variant.name}.${format.ext} → public/podklady/${variant.web}.${format.ext}`);
      }
    }
  } finally {
    cdp?.close();
    if (chrome && chrome.exitCode == null) {
      const exited = new Promise((r) => chrome.once("exit", r));
      chrome.kill();
      await exited;
    }
    rmSync(work, { recursive: true, force: true });
  }
}

function encode(format, frames, input, output) {
  const base = ["-y", "-loglevel", "error", "-framerate", String(format.fps), "-i", input];
  if (format.ext === "mp4") {
    execFileSync(
      "ffmpeg",
      [
        ...base,
        "-vf",
        `loop=loop=${format.repeat - 1}:size=${frames}:start=0,format=yuv420p`,
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-crf",
        "18",
        "-movflags",
        "+faststart",
        output,
      ],
      { stdio: "inherit" },
    );
  } else {
    // Paleta z celé animace, uspořádaný rozptyl (stabilní mezi snímky → menší soubor),
    // do GIFu se ukládá jen měnící se obdélník
    execFileSync(
      "ffmpeg",
      [
        ...base,
        "-vf",
        "split[a][b];[a]palettegen=max_colors=256[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle",
        "-loop",
        "0",
        output,
      ],
      { stdio: "inherit" },
    );
  }
}

await main();
