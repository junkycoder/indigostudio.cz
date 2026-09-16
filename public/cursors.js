/* Kurzory ve stylu malůvek — jen nad kartami, každý typ karty má svůj motiv.
   Nad pozadím a mimo karty zůstává systémový kurzor.
   Sdílené pro všechny stránky — <script src="/cursors.js"></script> v <head> hned za doodles.js.
   Čisté CSS: SVG kurzory v data URI, karta nastaví proměnné --cur (běžný) a --cur-hi
   (nad odkazem/tlačítkem = ruka + odznak karty). Jen pro myš (hover + fine pointer);
   na dotykových zařízeních a bez JS zůstávají systémové kurzory. */
(function () {
  var COLORS = {
    dark:  { halo: "#0d0e13", 1: "#818cf8", 2: "#f472b6", 3: "#2dd4bf", 4: "#fbbf24", 5: "#4ade80" },
    light: { halo: "#ffffff", 1: "#6366f1", 2: "#db2777", 3: "#0d9488", 4: "#d97706", 5: "#16a34a" },
  };

  // tvary v boxu 32×32: [prvek, atributy, barva (1–5), vyplnit pozadím?]
  var P = function (d, c, f) { return ["path", 'd="' + d + '"', c, f]; };
  var ICONS = {
    arrow: [P("M5 3 5.5 25 11 19.5 15 28 18.5 26.5 14.5 18 22 17.5Z", 1, 1)],
    hand: [
      P("M9 3c1.4 0 2.5 1.1 2.5 2.5V13c1.6-.8 3.3 0 3.6 1.4 1.5-.6 3.2.2 3.5 1.7 1.6-.3 3 .9 3 2.4V22c0 4.4-3.1 8-7.5 8h-2.3c-2.2 0-4.1-1-5.3-2.8l-3.6-5.4c-.8-1.2-.5-2.7.6-3.4 1.1-.7 2.5-.4 3.2.7l.8 1.1V5.5C6.5 4.1 7.6 3 9 3Z", 1, 1),
      P("M15.1 14.4v4M18.6 16.1v3", 1),
    ],
    ibeam: [P("M11 5c2.5 0 5 1 5 3.5v15c0 2.5 2.5 3.5 5 3.5M21 5c-2.5 0-5 1-5 3.5M11 27c2.5 0 5-1 5-3.5M13 16h6", 1)],
    magnifier: [
      ["circle", 'cx="12" cy="12" r="8.5"', 3],
      P("M18.5 18.5 28 28", 4),
      P("M8 10.5a4.5 4.5 0 0 1 3-3", 2),
    ],
    plane: [
      P("M3 3 29 13.5 17.5 16.5 13.5 29Z", 2, 1),
      P("M3 3 17.5 16.5", 2),
      P("M21 24.5c2.5 2 5 3 8 3", 1),
    ],
    // odznaky (kreslí se zmenšené vpravo dole vedle šipky / ruky)
    envelope: [["rect", 'x="3" y="7" width="26" height="19" rx="3"', 2, 1], P("M4 9l12 9 12-9", 2)],
    phone: [["rect", 'x="9" y="2" width="14" height="28" rx="3"', 3, 1], P("M13.5 6h5M14.5 25.5h3", 3)],
    chart: [P("M4 4v24h24", 4), P("M10 22v-5M16 22v-9M22 22v-6", 1), P("M9 11l6-5 5 3 7-5", 2)],
    star: [P("M16 3 19.2 11.5 28.4 12 21.2 17.7 23.6 26.5 16 21.5 8.4 26.5 10.8 17.7 3.6 12 12.8 11.5Z", 4, 1)],
    code: [P("M10 8 3 16l7 8M22 8l7 8-7 8", 3), P("M19 5 13 27", 2)],
  };

  // vykreslí vrstvy [ikona, posun x, posun y, měřítko]; tah má ve výsledku vždy 2 px, lem 5 px
  function svg(layers, pal) {
    var halo = "", body = "";
    layers.forEach(function (l) {
      var g = '<g transform="translate(' + l[1] + " " + l[2] + ") scale(" + l[3] + ')" ';
      var shapes = ICONS[l[0]];
      halo += g + 'stroke="' + pal.halo + '" stroke-width="' + (5 / l[3]).toFixed(2) + '">' +
        shapes.map(function (s) { return "<" + s[0] + " " + s[1] + ' fill="' + (s[3] ? pal.halo : "none") + '"/>'; }).join("") + "</g>";
      body += g + 'stroke-width="' + (2 / l[3]).toFixed(2) + '">' +
        shapes.map(function (s) { return "<" + s[0] + " " + s[1] + ' stroke="' + pal[s[2]] + '" fill="none"/>'; }).join("") + "</g>";
    });
    return '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" stroke-linecap="round" stroke-linejoin="round">' + halo + body + "</svg>";
  }

  function cur(layers, x, y, fallback, pal) {
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg(layers, pal)) + '") ' + x + " " + y + ", " + fallback;
  }

  // šipka / ruka zmenšená na 0,8 a odznak karty vpravo dole
  function withBadge(base, badge) {
    return [[base, 0, 0, 0.8], [badge, 17, 17, 0.45]];
  }

  // karta → plný kurzor s hotspotem (nebo null = šipka s odznakem), odznak
  var CARDS = [
    [".cap-block", ["magnifier", 12, 12], "magnifier"],
    ['[aria-labelledby="poptavka"], .closing', ["plane", 3, 3], "plane"],
    [".card", null, "envelope"],
    ['.item[data-kind="app"]', null, "phone"],
    ['.item[data-kind="case"]', null, "chart"],
    ['.item[data-kind="reference"]', null, "star"],
    ['.item[data-kind="sample"]', null, "code"],
  ];
  var IN_CARD = ":is(" + CARDS.map(function (c) { return c[0]; }).join(", ") + ") ";
  var INTERACTIVE = 'a[href], button, summary, label, select, [role="button"], .tip, abbr[title], input:is([type="checkbox"], [type="radio"], [type="submit"], [type="button"], [type="reset"])';
  var TEXT = 'input:not([type="checkbox"], [type="radio"], [type="submit"], [type="button"], [type="reset"]), textarea, [contenteditable]';

  // prvky s animovanou rukou místo kurzoru
  var HAND = '.site-header .nav-link, [aria-labelledby="poptavka"] .cta';
  var HAND_CSS = `
  .cursor-hand {
    --hc: ${COLORS.dark[1]}; --hr: ${COLORS.dark[4]}; --hh: ${COLORS.dark.halo};
    position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none;
    opacity: 0; transition: opacity 0.12s;
  }
  @media (prefers-color-scheme: light) {
    .cursor-hand { --hc: ${COLORS.light[1]}; --hr: ${COLORS.light[4]}; --hh: ${COLORS.light.halo}; }
  }
  .cursor-hand.is-on { opacity: 1; }
  .cursor-hand svg { display: block; overflow: visible; }
  .cursor-hand .ch-halo { stroke: var(--hh); stroke-width: 4; fill: var(--hh); }
  .cursor-hand .ch-line { stroke: var(--hc); stroke-width: 1.8; }
  .cursor-hand .ch-ring { stroke: var(--hr); stroke-width: 1.6; opacity: 0; transform-box: fill-box; transform-origin: center; }
  .cursor-hand .ch-hand { transform-origin: 9px 3px; }
  /* ruka jemně pulzuje a prstem ťukne; od špičky se rozběhne kroužek */
  .cursor-hand.is-on .ch-hand { animation: ch-tap 1.6s ease-in-out infinite; }
  .cursor-hand.is-on .ch-ring { animation: ch-ring 1.6s ease-out infinite; }
  .cursor-hand.is-down .ch-hand { animation: none; transform: translateY(1.5px) scale(0.92); }
  @keyframes ch-tap {
    0%, 100% { transform: scale(1); }
    35% { transform: scale(1.08); }
    55% { transform: translateY(1.5px) scale(0.94); }
    70% { transform: scale(1); }
  }
  @keyframes ch-ring {
    0%, 52% { opacity: 0; transform: scale(0.3); }
    58% { opacity: 1; transform: scale(0.5); }
    100% { opacity: 0; transform: scale(1.6); }
  }
  @media (prefers-reduced-motion: reduce) {
    .cursor-hand.is-on .ch-hand, .cursor-hand.is-on .ch-ring { animation: none; }
  }
  `;

  function rules(pal) {
    return CARDS.map(function (c) {
      var full = c[1];
      var normal = full ? cur([[full[0], 0, 0, 1]], full[1], full[2], "auto", pal)
        : cur(withBadge("arrow", c[2]), 4, 2, "auto", pal);
      var hi = cur(withBadge("hand", c[2]), 7, 2, "pointer", pal);
      return c[0] + " { --cur: " + normal + "; --cur-hi: " + hi + "; cursor: var(--cur); }";
    }).join("\n") + "\n" +
      IN_CARD + ":is(" + TEXT + ") { cursor: " + cur([["ibeam", 0, 0, 1]], 16, 16, "text", pal) + " !important; }";
  }

  var css = "@media (hover: hover) and (pointer: fine) {\n" +
    rules(COLORS.dark) + "\n" +
    "@media (prefers-color-scheme: light) {\n" + rules(COLORS.light) + "\n}\n" +
    IN_CARD + ":is(" + INTERACTIVE + "):not(" + HAND + ") { cursor: var(--cur-hi) !important; }\n" +
    IN_CARD + ":disabled { cursor: var(--cur) !important; }\n" +
    ":is(" + HAND + ") { cursor: none !important; }\n" +
    "}\n" + HAND_CSS;

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // Tlačítko v hlavičce a v poptávce: animovaná ruka, která pulzuje a ťuká prstem.
  // Animovaný kurzor CSS neumí → systémový se skryje a ruka je prvek, který jede za myší.
  if (!window.matchMedia || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  var hand = document.createElement("div");
  hand.className = "cursor-hand";
  hand.setAttribute("aria-hidden", "true");
  var d = ICONS.hand.map(function (s) { return s[1]; });
  hand.innerHTML = '<svg viewBox="-4 -4 36 36" width="40" height="40" stroke-linecap="round" stroke-linejoin="round" fill="none">' +
    '<circle class="ch-ring" cx="9" cy="3" r="4.5"/>' +
    '<g class="ch-hand"><path class="ch-halo" ' + d[0] + '/><path class="ch-halo" ' + d[1] + '/>' +
    '<path class="ch-line" ' + d[0] + '/><path class="ch-line" ' + d[1] + '/></g></svg>';

  var x = 0, y = 0, on = false, queued = false;
  function place() {
    queued = false;
    // hotspot = špička prstu (9, 3) ve viewBoxu posunutém o 4, měřítko 40/36
    hand.style.transform = "translate(" + (x - 14.4) + "px, " + (y - 7.8) + "px)";
    hand.classList.toggle("is-on", on);
  }
  function update() { if (!queued) { queued = true; requestAnimationFrame(place); } }
  window.addEventListener("pointermove", function (e) {
    if (e.pointerType !== "mouse") return;
    x = e.clientX; y = e.clientY;
    on = !!(e.target.closest && e.target.closest(HAND));
    update();
  }, { passive: true });
  document.addEventListener("pointerdown", function () { hand.classList.add("is-down"); });
  document.addEventListener("pointerup", function () { hand.classList.remove("is-down"); });
  document.documentElement.addEventListener("mouseleave", function () { on = false; update(); });
  window.addEventListener("scroll", function () { if (on) { on = false; update(); } }, { passive: true });
  document.addEventListener("DOMContentLoaded", function () { document.body.appendChild(hand); });
})();
