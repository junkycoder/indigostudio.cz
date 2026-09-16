/* Pozadí: živé malůvky naší práce (návrh, kód, UML, workflow, e-maily…)
   Sdílené pro všechny stránky — stačí <script src="/doodles.js" defer></script>.
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
    animation-delay: var(--o, 0s);
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
  /* chat a hovor jsou vzácné „perličky": menší a nejvýš jednou na stránce */
  .d-chat { --w: 0.46; } .d-call { --w: 0.34; }

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
  @media print { .doodles { display: none !important; } }
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

`;

  var style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  var host = document.createElement("div");
  host.className = "doodles";
  host.setAttribute("aria-hidden", "true");
  document.body.insertBefore(host, document.body.firstChild);

  var tpl = document.createElement("template");
  tpl.innerHTML = SVGS;
  var all = tpl.content.querySelectorAll(".doodle");
  var byName = {}, rare = [];
  // perličky (chat, hovor) se neopakují ve vzoru — každá max. jednou na stránce
  Array.prototype.forEach.call(all, function (el) {
    var name = el.getAttribute("class").match(/d-\w+$/)[0];
    byName[name] = el;
    if (/d-(chat|call)/.test(name)) rare.push(el);
  });
  // pořadí vzoru; e-mail a kód jsou dvakrát (častější). Duplikáty mají odstup 4 a 6,
  // takže při indexu (c*3 + r*5) % 10 nikdy nesousedí stejné motivy.
  var PATTERN = ["d-mock", "d-mail", "d-code", "d-uml", "d-flow", "d-mail", "d-phone", "d-kanban", "d-code", "d-git"];
  var set = PATTERN.map(function (n) { return byName[n]; });
  // kde perličky leží: nejbližší buňka ke kotvě (podíl šířky/výšky viewportu)
  var RARE_AT = { "d-call": [0.85, 0.2], "d-chat": [0.3, 0.8] };
  var key = "";

  function build() {
    var w = window.innerWidth, h = window.innerHeight;
    var cell = w < 560 ? 190 : 290, rowH = Math.round(cell * 0.72);
    var cols = Math.ceil(w / cell) + 1, rows = Math.ceil(h / rowH) + 1;
    if (key === cols + "x" + rows + "@" + cell) return;
    key = cols + "x" + rows + "@" + cell;
    host.style.setProperty("--cell", cell + "px");
    host.textContent = "";
    var cells = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        cells.push({ r: r, c: c, x: (c + (r % 2 ? 0.5 : 0)) * cell, y: (r + 0.35) * rowH });
      }
    }
    // perličky dostanou buňku nejblíž své kotvě (jen celé viditelné buňky)
    var taken = {};
    rare.forEach(function (el) {
      var name = el.getAttribute("class").match(/d-\w+$/)[0], at = RARE_AT[name], best = -1, bestD = Infinity;
      cells.forEach(function (p, i) {
        if (taken[i] || p.x < cell / 2 || p.x > w - cell / 2 || p.y < rowH / 2 || p.y > h - rowH / 2) return;
        var d = Math.pow(p.x - at[0] * w, 2) + Math.pow(p.y - at[1] * h, 2);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best >= 0) taken[best] = el;
    });
    cells.forEach(function (p, i) {
      // sousedé (vodorovně i svisle) mají vždy jiný motiv
      var svg = (taken[i] || set[(p.c * 3 + p.r * 5) % set.length]).cloneNode(true);
      svg.style.left = p.x + "px";
      svg.style.top = p.y + "px";
      svg.style.rotate = (((p.c * 7 + p.r * 11) % 9) - 4) + "deg";
      // posun startu po diagonále → kreslení běží ve vlnách
      svg.style.setProperty("--o", -(((p.c + p.r) * 1.4) % 18).toFixed(1) + "s");
      host.appendChild(svg);
    });
  }
  build();
  var t;
  window.addEventListener("resize", function () { clearTimeout(t); t = setTimeout(build, 150); });
})();
