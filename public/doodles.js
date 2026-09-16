/* Pozadí: živé malůvky naší práce (návrh, kód, UML, workflow, e-maily…)
   Sdílené pro všechny stránky — <script src="/doodles.js"></script> v <head>, BEZ defer:
   malůvky tak existují už při prvním vykreslení a při přechodu mezi stránkami neproblikne pozadí.
   Vloží vlastní styly, host .doodles a poskládá vzor přes celý viewport. */
(function () {
  var CSS = `
  /* ---- Pozadí: živé malůvky naší práce (návrh, kód, UML, workflow, e-maily…) ----
     Čisté SVG + CSS. Každý tah se nakreslí (pathLength=1 → dashoffset 1→0),
     chvíli drží, pak se „smaže" a cyklus jede znovu. Pořadí tahů řídí --i.
     Vzor (cihlová mřížka přes celý viewport) skládá JS níže. */
  .doodles {
    --c1: #818cf8; --c2: #f472b6; --c3: #2dd4bf; --c4: #fbbf24; --c5: #4ade80;
    --cell: 290px;
    position: fixed; inset: 0; z-index: -1;
    pointer-events: none; overflow: hidden;
    opacity: 0.11;
  }
  @media (prefers-color-scheme: light) {
    .doodles { --c1: #6366f1; --c2: #db2777; --c3: #0d9488; --c4: #d97706; --c5: #16a34a; opacity: 0.1; }
  }
  @media (max-width: 560px) { .doodles { opacity: 0.08; } }
  .doodle {
    position: absolute; height: auto;
    width: calc(var(--cell) * var(--w, 0.75));
    translate: -50% -50%;
    fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
    animation: doodle-float 16s ease-in-out infinite alternate;
    /* --tf/--td = fáze podle hodin → animace na nové stránce plynule navazuje na předchozí */
    animation-delay: calc(var(--tf, 0ms) + var(--o, 0s));
  }
  .doodle .s {
    stroke-dasharray: 1; stroke-dashoffset: 1;
    animation: doodle-draw 18s var(--ease, cubic-bezier(0.22, 1, 0.36, 1)) infinite;
    animation-delay: calc(var(--o, 0s) + var(--i, 0) * 0.22s);
  }
  .doodle .tok { stroke-width: 5; }
  .doodle .caret { stroke-width: 2.5; animation: doodle-blink 1.1s steps(1) infinite; }
  .k1 { stroke: var(--c1); } .k2 { stroke: var(--c2); } .k3 { stroke: var(--c3); }
  .k4 { stroke: var(--c4); } .k5 { stroke: var(--c5); }

  /* relativní velikost motivu vůči buňce vzoru */
  .d-mock { --w: 0.78; } .d-code { --w: 0.74; } .d-uml { --w: 0.68; } .d-flow { --w: 0.84; }
  .d-mail { --w: 0.45; } .d-phone { --w: 0.36; } .d-kanban { --w: 0.72; } .d-git { --w: 0.66; }
  /* chat, hovor a hodinky jsou vzácné „perličky": menší a nejvýš jednou na stránce */
  .d-chat { --w: 0.46; } .d-call { --w: 0.34; }
  .d-meet { --w: 0.4; } .d-desktop { --w: 0.55; } .d-watch { --w: 0.24; }

  @keyframes doodle-draw {
    0%        { stroke-dashoffset: 1; }
    18%, 72%  { stroke-dashoffset: 0; }
    90%, 100% { stroke-dashoffset: -1; }
  }
  @keyframes doodle-float {
    from { transform: translate(0, 0) rotate(-1.5deg); }
    to   { transform: translate(6px, -14px) rotate(1.5deg); }
  }
  @keyframes doodle-blink { 50% { opacity: 0; } }

  @media (prefers-reduced-motion: reduce) {
    .doodle, .doodle .s, .doodle .caret { animation: none; stroke-dashoffset: 0; }
  }
  /* světlo pod kurzorem: jemná indigová záře, tlumená stejně jako malůvky */
  .doodles-glow {
    position: fixed; inset: 0; z-index: -1; pointer-events: none;
    background: radial-gradient(420px circle at var(--mx, 50%) var(--my, 30%), rgba(99, 102, 241, 0.07), transparent 70%);
  }
  @media (prefers-color-scheme: light) {
    .doodles-glow { background: radial-gradient(420px circle at var(--mx, 50%) var(--my, 30%), rgba(99, 102, 241, 0.045), transparent 70%); }
  }
  @media (hover: none), (prefers-reduced-motion: reduce) { .doodles-glow { display: none; } }
  @media print { .doodles, .doodles-glow { display: none !important; } }
  /* popis pro čtečky: vizuálně skrytý, na konci stránky, přečte se jen při průchodu obsahem */
  .doodles-desc {
    position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0;
    overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0;
  }
`;

  var SVGS = `
<!-- návrh: wireframe webu -->
<svg class="doodle d-mock" viewBox="0 0 220 160">
  <rect class="s k1" style="--i:0" pathLength="1" x="10" y="10" width="200" height="140" rx="8"/>
  <path class="s k1" style="--i:1" pathLength="1" d="M10 32h200"/>
  <circle class="s k2" style="--i:2" pathLength="1" cx="23" cy="21" r="3"/>
  <circle class="s k4" style="--i:2" pathLength="1" cx="33" cy="21" r="3"/>
  <circle class="s k5" style="--i:2" pathLength="1" cx="43" cy="21" r="3"/>
  <path class="s k1" style="--i:3" pathLength="1" d="M24 48h84M24 62h58"/>
  <rect class="s k2" style="--i:4" pathLength="1" x="24" y="76" width="44" height="14" rx="7"/>
  <rect class="s k3" style="--i:5" pathLength="1" x="128" y="44" width="68" height="50" rx="4"/>
  <path class="s k3" style="--i:6" pathLength="1" d="M128 94l24-22 14 12 12-8 18 18"/>
  <circle class="s k4" style="--i:6" pathLength="1" cx="180" cy="58" r="5"/>
  <rect class="s k1" style="--i:7" pathLength="1" x="24" y="106" width="52" height="32" rx="4"/>
  <rect class="s k3" style="--i:8" pathLength="1" x="84" y="106" width="52" height="32" rx="4"/>
  <rect class="s k4" style="--i:9" pathLength="1" x="144" y="106" width="52" height="32" rx="4"/>
  <path class="s k2" style="--i:10" pathLength="1" d="M60 84l14 30 4-12 12-4z"/>
</svg>

<!-- kód: editor s tokeny -->
<svg class="doodle d-code" viewBox="0 0 220 150">
  <rect class="s k3" style="--i:0" pathLength="1" x="10" y="10" width="200" height="130" rx="8"/>
  <path class="s k2 tok" style="--i:1" pathLength="1" d="M30 34h26"/>
  <path class="s k1 tok" style="--i:2" pathLength="1" d="M64 34h46"/>
  <path class="s k4 tok" style="--i:3" pathLength="1" d="M44 50h24"/>
  <path class="s k3 tok" style="--i:4" pathLength="1" d="M76 50h58"/>
  <path class="s k1 tok" style="--i:5" pathLength="1" d="M58 66h48"/>
  <path class="s k2 tok" style="--i:6" pathLength="1" d="M114 66h16"/>
  <path class="s k5 tok" style="--i:7" pathLength="1" d="M58 82h70"/>
  <path class="s k4 tok" style="--i:8" pathLength="1" d="M44 98h20"/>
  <path class="s k1 tok" style="--i:9" pathLength="1" d="M72 98h64"/>
  <path class="s k2 tok" style="--i:10" pathLength="1" d="M30 114h14"/>
  <path class="caret k1" d="M144 106v16"/>
</svg>

<!-- UML: třídy a dědičnost -->
<svg class="doodle d-uml" viewBox="0 0 220 170">
  <rect class="s k1" style="--i:0" pathLength="1" x="14" y="14" width="84" height="64" rx="3"/>
  <path class="s k1" style="--i:1" pathLength="1" d="M14 32h84M14 56h84"/>
  <path class="s k1" style="--i:2" pathLength="1" d="M22 23h40M22 42h52M22 49h36M22 66h46"/>
  <rect class="s k3" style="--i:3" pathLength="1" x="140" y="18" width="66" height="44" rx="3"/>
  <path class="s k3" style="--i:4" pathLength="1" d="M140 34h66M148 26h32M148 46h44"/>
  <path class="s k4" style="--i:5" pathLength="1" d="M98 40h42"/>
  <path class="s k4" style="--i:6" pathLength="1" d="M132 35l8 5-8 5"/>
  <rect class="s k2" style="--i:7" pathLength="1" x="112" y="100" width="94" height="56" rx="3"/>
  <path class="s k2" style="--i:8" pathLength="1" d="M112 118h94M120 109h44M120 130h60M120 140h40"/>
  <path class="s k4" style="--i:9" pathLength="1" d="M56 88v40h56"/>
  <path class="s k4" style="--i:10" pathLength="1" d="M48 90l8-12 8 12z"/>
</svg>

<!-- workflow: start → krok → rozhodnutí → větve -->
<svg class="doodle d-flow" viewBox="0 0 240 140">
  <circle class="s k5" style="--i:0" pathLength="1" cx="20" cy="70" r="10"/>
  <path class="s k1" style="--i:1" pathLength="1" d="M30 70h28M52 65l6 5-6 5"/>
  <rect class="s k1" style="--i:2" pathLength="1" x="58" y="52" width="52" height="36" rx="6"/>
  <path class="s k1" style="--i:3" pathLength="1" d="M68 66h32M68 75h22"/>
  <path class="s k1" style="--i:4" pathLength="1" d="M110 70h14"/>
  <path class="s k4" style="--i:5" pathLength="1" d="M148 46l24 24-24 24-24-24z"/>
  <path class="s k3" style="--i:6" pathLength="1" d="M148 46V22h32M174 17l6 5-6 5"/>
  <path class="s k2" style="--i:6" pathLength="1" d="M148 94v24h32M174 113l6 5-6 5"/>
  <rect class="s k3" style="--i:7" pathLength="1" x="180" y="8" width="50" height="28" rx="6"/>
  <rect class="s k2" style="--i:8" pathLength="1" x="180" y="104" width="50" height="28" rx="6"/>
  <path class="s k3" style="--i:9" pathLength="1" d="M194 22l6 6 14-12"/>
  <path class="s k2" style="--i:9" pathLength="1" d="M198 112l14 12M212 112l-14 12"/>
</svg>

<!-- e-mail: obálka, notifikace, odeslání -->
<svg class="doodle d-mail" viewBox="0 0 200 150">
  <rect class="s k2" style="--i:0" pathLength="1" x="20" y="44" width="130" height="88" rx="6"/>
  <path class="s k2" style="--i:1" pathLength="1" d="M22 50l63 46 63-46"/>
  <path class="s k2" style="--i:2" pathLength="1" d="M24 128l44-38M146 128l-44-38"/>
  <circle class="s k4" style="--i:3" pathLength="1" cx="148" cy="46" r="11"/>
  <path class="s k4" style="--i:4" pathLength="1" d="M146 42l3-2v12"/>
  <path class="s k1" style="--i:5" pathLength="1" d="M20 30c30-26 70-26 104-10"/>
  <path class="s k1" style="--i:6" pathLength="1" d="M136 22l54-14-20 44-10-16z"/>
  <path class="s k1" style="--i:7" pathLength="1" d="M160 36l30-28"/>
</svg>

<!-- mobilní aplikace -->
<svg class="doodle d-phone" viewBox="0 0 120 200">
  <rect class="s k3" style="--i:0" pathLength="1" x="14" y="10" width="92" height="180" rx="14"/>
  <path class="s k3" style="--i:1" pathLength="1" d="M48 22h24"/>
  <rect class="s k1" style="--i:2" pathLength="1" x="26" y="36" width="68" height="42" rx="5"/>
  <path class="s k1" style="--i:3" pathLength="1" d="M26 92h68M26 104h46"/>
  <circle class="s k4" style="--i:4" pathLength="1" cx="32" cy="124" r="5"/>
  <path class="s k4" style="--i:5" pathLength="1" d="M44 124h48"/>
  <circle class="s k2" style="--i:6" pathLength="1" cx="32" cy="144" r="5"/>
  <path class="s k2" style="--i:7" pathLength="1" d="M44 144h40"/>
  <rect class="s k5" style="--i:8" pathLength="1" x="26" y="162" width="68" height="16" rx="8"/>
</svg>
<!-- kanban: úkoly ve sloupcích -->
<svg class="doodle d-kanban" viewBox="0 0 220 150">
  <rect class="s k1" style="--i:0" pathLength="1" x="10" y="10" width="62" height="130" rx="6"/>
  <rect class="s k4" style="--i:1" pathLength="1" x="79" y="10" width="62" height="130" rx="6"/>
  <rect class="s k5" style="--i:2" pathLength="1" x="148" y="10" width="62" height="130" rx="6"/>
  <path class="s k1" style="--i:3" pathLength="1" d="M20 24h30M89 24h36M158 24h26"/>
  <rect class="s k2" style="--i:4" pathLength="1" x="18" y="36" width="46" height="22" rx="3"/>
  <rect class="s k3" style="--i:5" pathLength="1" x="18" y="64" width="46" height="22" rx="3"/>
  <rect class="s k1" style="--i:6" pathLength="1" x="87" y="36" width="46" height="22" rx="3"/>
  <rect class="s k2" style="--i:7" pathLength="1" x="156" y="36" width="46" height="22" rx="3"/>
  <rect class="s k4" style="--i:8" pathLength="1" x="156" y="64" width="46" height="22" rx="3"/>
  <rect class="s k3" style="--i:9" pathLength="1" x="156" y="92" width="46" height="22" rx="3"/>
  <path class="s k2" style="--i:10" pathLength="1" d="M40 96c10 30 70 34 88-4M121 90l7 2 1 8"/>
</svg>

<!-- git: větev a merge -->
<svg class="doodle d-git" viewBox="0 0 200 140">
  <circle class="s k1" style="--i:0" pathLength="1" cx="24" cy="110" r="6"/>
  <path class="s k1" style="--i:1" pathLength="1" d="M30 110h44"/>
  <circle class="s k1" style="--i:2" pathLength="1" cx="80" cy="110" r="6"/>
  <path class="s k3" style="--i:3" pathLength="1" d="M84 105c12-22 16-55 34-55"/>
  <circle class="s k3" style="--i:4" pathLength="1" cx="124" cy="50" r="6"/>
  <path class="s k1" style="--i:4" pathLength="1" d="M86 110h82"/>
  <path class="s k3" style="--i:5" pathLength="1" d="M130 50h18"/>
  <circle class="s k3" style="--i:6" pathLength="1" cx="154" cy="50" r="6"/>
  <path class="s k3" style="--i:7" pathLength="1" d="M159 54c10 20 15 40 15 50"/>
  <circle class="s k5" style="--i:8" pathLength="1" cx="174" cy="110" r="6"/>
  <path class="s k4" style="--i:9" pathLength="1" d="M160 88h24l8 8-8 8h-24z"/>
  <path class="s k2" style="--i:10" pathLength="1" d="M40 30h40M40 42h26"/>
</svg>
<!-- chat: konverzace v aplikaci -->
<svg class="doodle d-chat" viewBox="0 0 200 150">
  <rect class="s k1" style="--i:0" pathLength="1" x="10" y="10" width="180" height="130" rx="10"/>
  <path class="s k1" style="--i:1" pathLength="1" d="M10 34h180"/>
  <circle class="s k5" style="--i:2" pathLength="1" cx="26" cy="22" r="6"/>
  <path class="s k1" style="--i:2" pathLength="1" d="M40 22h44"/>
  <path class="s k3" style="--i:3" pathLength="1" d="M30 46h70a8 8 0 0 1 8 8v8a8 8 0 0 1-8 8H38l-10 8v-8a8 8 0 0 1-6-8v-8a8 8 0 0 1 8-8z"/>
  <path class="s k3" style="--i:4" pathLength="1" d="M34 58h52"/>
  <path class="s k2" style="--i:5" pathLength="1" d="M170 82H100a8 8 0 0 0-8 8v8a8 8 0 0 0 8 8h62l10 8v-8a8 8 0 0 0 6-8v-8a8 8 0 0 0-8-8z"/>
  <path class="s k2" style="--i:6" pathLength="1" d="M104 94h54"/>
  <rect class="s k4" style="--i:7" pathLength="1" x="22" y="110" width="44" height="20" rx="10"/>
  <circle class="s k4" style="--i:8" pathLength="1" cx="34" cy="120" r="2"/>
  <circle class="s k4" style="--i:9" pathLength="1" cx="44" cy="120" r="2"/>
  <circle class="s k4" style="--i:10" pathLength="1" cx="54" cy="120" r="2"/>
</svg>

<!-- telefon: příchozí hovor -->
<svg class="doodle d-call" viewBox="0 0 180 150">
  <path class="s k5" style="--i:0" pathLength="1" d="M30 36c6-8 16-8 22-1l12 15c5 6 4 14-2 19l-7 6c7 15 18 26 33 33l6-7c5-6 13-7 19-2l15 12c7 6 7 16-1 22l-8 7c-9 8-22 9-33 3-28-14-50-36-64-64-6-11-5-24 3-33z"/>
  <path class="s k4" style="--i:4" pathLength="1" d="M104 44a28 28 0 0 1 28 28"/>
  <path class="s k4" style="--i:6" pathLength="1" d="M106 22a50 50 0 0 1 48 48"/>
</svg>

<!-- schůzka: malý okruh u stolu (2–5 lidí, počet se losuje) -->
<svg class="doodle d-meet" viewBox="0 0 200 170">
  <ellipse class="s k1" style="--i:0" pathLength="1" cx="100" cy="92" rx="44" ry="28"/>
  <path class="s k4" style="--i:1" pathLength="1" d="M84 88h32M90 98h20"/>
  <g data-p="1"><circle class="s k2" style="--i:2" pathLength="1" cx="34" cy="70" r="9"/><path class="s k2" style="--i:3" pathLength="1" d="M19 104a15 14 0 0 1 30 0"/></g>
  <g data-p="2"><circle class="s k3" style="--i:3" pathLength="1" cx="166" cy="70" r="9"/><path class="s k3" style="--i:4" pathLength="1" d="M151 104a15 14 0 0 1 30 0"/></g>
  <g data-p="3"><circle class="s k5" style="--i:4" pathLength="1" cx="100" cy="22" r="9"/><path class="s k5" style="--i:5" pathLength="1" d="M85 56a15 14 0 0 1 30 0"/></g>
  <g data-p="4"><circle class="s k4" style="--i:5" pathLength="1" cx="62" cy="128" r="9"/><path class="s k4" style="--i:6" pathLength="1" d="M47 162a15 14 0 0 1 30 0"/></g>
  <g data-p="5"><circle class="s k2" style="--i:6" pathLength="1" cx="138" cy="128" r="9"/><path class="s k2" style="--i:7" pathLength="1" d="M123 162a15 14 0 0 1 30 0"/></g>
</svg>

<!-- počítač: monitor na stojanu -->
<svg class="doodle d-desktop" viewBox="0 0 200 160">
  <rect class="s k1" style="--i:0" pathLength="1" x="20" y="10" width="160" height="104" rx="8"/>
  <path class="s k1" style="--i:1" pathLength="1" d="M20 96h160"/>
  <path class="s k1" style="--i:2" pathLength="1" d="M88 114l-6 24h36l-6-24M66 142h68"/>
  <rect class="s k3" style="--i:3" pathLength="1" x="34" y="24" width="30" height="60" rx="3"/>
  <path class="s k4 tok" style="--i:4" pathLength="1" d="M78 32h74"/>
  <path class="s k2 tok" style="--i:5" pathLength="1" d="M78 48h54"/>
  <path class="s k5 tok" style="--i:6" pathLength="1" d="M78 64h64"/>
  <circle class="s k4" style="--i:7" pathLength="1" cx="100" cy="105" r="2"/>
</svg>

<!-- chytré hodinky (perlička) -->
<svg class="doodle d-watch" viewBox="0 0 120 170">
  <path class="s k1" style="--i:0" pathLength="1" d="M44 10h32l4 30H40zM40 130h40l-4 30H44z"/>
  <rect class="s k1" style="--i:1" pathLength="1" x="30" y="40" width="60" height="90" rx="16"/>
  <path class="s k4" style="--i:2" pathLength="1" d="M90 70h6v16h-6"/>
  <circle class="s k5" style="--i:3" pathLength="1" cx="60" cy="76" r="16"/>
  <circle class="s k2" style="--i:4" pathLength="1" cx="60" cy="76" r="8"/>
  <path class="s k3 tok" style="--i:5" pathLength="1" d="M48 110h24"/>
</svg>

`;

  var style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  var host = document.createElement("div");
  host.className = "doodles";
  host.setAttribute("aria-hidden", "true");
  // skript běží v <head> → <body> ještě neexistuje; host visí přímo pod <html> (fixed, z-index -1)
  if (document.body) document.body.insertBefore(host, document.body.firstChild);
  else document.documentElement.appendChild(host);

  // světlo pod kurzorem — před malůvkami, ať je záře pod nimi
  var glow = document.createElement("div");
  glow.className = "doodles-glow";
  glow.setAttribute("aria-hidden", "true");
  host.parentNode.insertBefore(glow, host);
  var mx = 0, my = 0, pending = false;
  window.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse") return;
    mx = e.clientX; my = e.clientY;
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      glow.style.setProperty("--mx", mx + "px");
      glow.style.setProperty("--my", my + "px");
    });
  }, { passive: true });

  var tpl = document.createElement("template");
  tpl.innerHTML = SVGS;
  var byName = {};
  Array.prototype.forEach.call(tpl.content.querySelectorAll(".doodle"), function (el) {
    byName[el.getAttribute("class").match(/d-\w+$/)[0]] = el;
  });
  // losovací osudí: e-mail a kód jsou častější; perličky (RARE) se losují zvlášť níže
  var PATTERN = ["d-mock", "d-mail", "d-code", "d-uml", "d-flow", "d-mail", "d-phone", "d-kanban", "d-code", "d-git", "d-meet", "d-desktop"];
  var RARE = ["d-chat", "d-call", "d-watch"];
  var CYCLE = 18000; // délka doodle-draw
  // názvy motivů pro popis pozadí ve čtečce
  var NAMES = {
    "d-mock": "návrh webové stránky", "d-code": "editor s\u00a0kódem", "d-uml": "UML diagram tříd",
    "d-flow": "diagram workflow", "d-mail": "odesílaný e-mail", "d-phone": "mobilní aplikace",
    "d-kanban": "kanban s\u00a0úkoly", "d-git": "větvení v\u00a0gitu", "d-meet": "schůzka u\u00a0stolu",
    "d-desktop": "počítač", "d-chat": "chat", "d-call": "příchozí hovor", "d-watch": "chytré hodinky"
  };

  // semínko na dobu návštěvy: při přechodu mezi stránkami zůstane rozvrh i fáze stejná,
  // nová návštěva = nové rozložení
  var seed = 0;
  try { seed = +sessionStorage.getItem("doodleSeed") || 0; } catch (e) {}
  if (!seed) {
    seed = 1 + Math.floor(Math.random() * 4294967294);
    try { sessionStorage.setItem("doodleSeed", seed); } catch (e) {}
  }
  // deterministický generátor (mulberry32) z (semínko, a, b, c)
  function rng(a, b, c) {
    var t = (seed ^ Math.imul(a + 1, 0x9e3779b1) ^ Math.imul(b + 1, 0x85ebca77) ^ Math.imul(c + 1, 0xc2b2ae3d)) >>> 0;
    return function () {
      t = (t + 0x6d2b79f5) >>> 0;
      var x = Math.imul(t ^ (t >>> 15), 1 | t);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  var grid = null;

  // motiv buňky i v cyklu k — čistá funkce, takže vyjde stejně na každé stránce
  function pick(i, k) {
    // perlička n má svoje místo a ukáže se jen v cyklech, kdy k % počet === n
    for (var n = 0; n < RARE.length; n++) {
      if (i === grid.rare[n] && k % RARE.length === n) return RARE[n];
    }
    return PATTERN[Math.floor(rng(i, k, 1)() * PATTERN.length)];
  }

  function makeDoodle(i, now) {
    var p = grid.cells[i], o = grid.offs[i];
    var k = Math.floor((now + o) / CYCLE);
    var name = pick(i, k);
    // ne stejný motiv jako sousedé ani jako předchozí malůvka na tomhle místě
    if (RARE.indexOf(name) < 0) {
      var avoid = {};
      [i].concat(grid.nb[i]).forEach(function (j) {
        if (grid.els[j]) avoid[grid.els[j].getAttribute("data-name")] = 1;
      });
      var start = PATTERN.indexOf(name), n = 0;
      while (n < PATTERN.length && avoid[PATTERN[(start + n) % PATTERN.length]]) n++;
      if (n < PATTERN.length) name = PATTERN[(start + n) % PATTERN.length];
    }
    var r = rng(i, k, 2);
    var svg = byName[name].cloneNode(true);
    if (name === "d-meet") {
      var people = 2 + Math.floor(r() * 4); // 2–5 lidí
      Array.prototype.forEach.call(svg.querySelectorAll("[data-p]"), function (g) {
        if (+g.getAttribute("data-p") > people) g.parentNode.removeChild(g);
      });
    }
    svg.querySelector(".s").setAttribute("data-first", "");
    svg.setAttribute("data-cell", i);
    svg.setAttribute("data-name", name);
    svg.style.width = "calc(var(--cell) * var(--w) * " + (0.75 + r() * 0.5).toFixed(2) + ")";
    svg.style.left = (p.x + (r() - 0.5) * grid.cell * 0.4).toFixed(0) + "px";
    svg.style.top = (p.y + (r() - 0.5) * grid.rowH * 0.35).toFixed(0) + "px";
    svg.style.rotate = ((r() - 0.5) * 16).toFixed(1) + "deg";
    // fáze kreslení podle hodin → na další stránce animace navazuje
    svg.style.setProperty("--o", -((now + o) % CYCLE) + "ms");
    return svg;
  }

  function build() {
    var w = window.innerWidth, h = window.innerHeight;
    var cell = w < 560 ? 190 : 290, rowH = Math.round(cell * 0.72);
    var cols = Math.ceil(w / cell) + 1, rows = Math.ceil(h / rowH) + 1;
    var key = cols + "x" + rows + "@" + cell;
    if (grid && grid.key === key) return;
    grid = { key: key, cell: cell, rowH: rowH, cells: [], offs: [], rare: [], nb: [], els: [] };
    var visible = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var p = { x: (c + (r % 2 ? 0.5 : 0)) * cell, y: (r + 0.35) * rowH };
        var i = grid.cells.push(p) - 1;
        grid.offs.push(Math.floor(rng(i, 0, 0)() * CYCLE)); // každá buňka má svůj rytmus
        if (p.x >= cell / 2 && p.x <= w - cell / 2 && p.y >= rowH / 2 && p.y <= h - rowH / 2) visible.push(i);
      }
    }
    // sousedé = buňky do vzdálenosti ~1,2 buňky (vedle i šikmo v sousední řadě)
    grid.cells.forEach(function (p, i) {
      grid.nb[i] = [];
      grid.cells.forEach(function (q, j) {
        if (i !== j && Math.pow(p.x - q.x, 2) + Math.pow(p.y - q.y, 2) <= Math.pow(cell * 1.2, 2)) grid.nb[i].push(j);
      });
    });
    // perličky: každá má jedno vlastní viditelné místo → nejvýš jednou na stránce
    var rr = rng(7, 7, 7);
    RARE.forEach(function () {
      grid.rare.push(visible.length ? visible.splice(Math.floor(rr() * visible.length), 1)[0] : -1);
    });
    host.style.setProperty("--cell", cell + "px");
    host.style.setProperty("--tf", -(Date.now() % 32000) + "ms");
    host.textContent = "";
    var now = Date.now();
    grid.cells.forEach(function (p, i) { host.appendChild(grid.els[i] = makeDoodle(i, now)); });
    describe();
  }

  // Popis pro čtečky: malůvky samy jsou aria-hidden (mění se každých pár sekund), místo nich
  // je na konci <body> jeden statický obrázek s výčtem motivů. Bez aria-live → nepřečte se
  // znovu při každé proměně, jen když na něj uživatel při čtení stránky narazí.
  var desc = null;
  function describe() {
    if (!document.body) return;
    if (!desc) {
      desc = document.createElement("div");
      desc.className = "doodles-desc";
      desc.setAttribute("role", "img");
      document.body.appendChild(desc);
    }
    var seen = {}, list = [];
    grid.els.forEach(function (el, i) {
      var p = grid.cells[i], name = el.getAttribute("data-name");
      if (p.x < window.innerWidth + grid.cell / 2 && p.y < window.innerHeight + grid.rowH / 2 && !seen[name]) {
        seen[name] = 1;
        list.push(NAMES[name]);
      }
    });
    desc.setAttribute("aria-label", "Pozadí stránky: ručně kreslené malůvky naší práce, které se pomalu kreslí, mizí a\u00a0střídají. Právě je tu " + list.join(", ") + ".");
  }

  // po každém cyklu (nakreslit → smazat) se na místě objeví jiná malůvka
  host.addEventListener("animationiteration", function (e) {
    if (e.animationName !== "doodle-draw" || !e.target.hasAttribute || !e.target.hasAttribute("data-first")) return;
    var old = e.target.closest(".doodle");
    if (!old || old.parentNode !== host) return;
    var i = +old.getAttribute("data-cell");
    host.replaceChild(grid.els[i] = makeDoodle(i, Date.now() + 50), old);
  });

  build();
  if (!document.body) document.addEventListener("DOMContentLoaded", describe);
  var t;
  window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(build, 150); });
})();
