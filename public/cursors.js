/* Kurzory nad kartami — klasická šipka / ruka s malým kulatým odznakem podle typu karty.
   Nad pozadím a mimo karty zůstává systémový kurzor.
   Sdílené pro všechny stránky — <script src="/cursors.js"></script> v <head> hned za doodles.js.
   Čisté CSS: SVG kurzory v data URI, karta nastaví proměnné --cur (běžný) a --cur-hi
   (nad odkazem/tlačítkem = ruka). Jen pro myš (hover + fine pointer);
   na dotykových zařízeních a bez JS zůstávají systémové kurzory. */
(function () {
  // fill = tělo kurzoru, line = obrys (kontrast vůči pozadí), badge = odznak, glyph = značka v odznaku
  var COLORS = {
    dark:  { fill: "#ffffff", line: "#0d0e13", badge: "#6366f1", glyph: "#ffffff" },
    light: { fill: "#14151b", line: "#ffffff", badge: "#4f46e5", glyph: "#ffffff" },
  };

  // tvary v boxu 32×32
  var ARROW = "M4 2.5V22.5L8.6 18.2 11.7 25.3 15 23.9 11.9 16.9H18.4Z";
  var HAND = "M9 3c1.4 0 2.5 1.1 2.5 2.5V13c1.6-.8 3.3 0 3.6 1.4 1.5-.6 3.2.2 3.5 1.7 1.6-.3 3 .9 3 2.4V22c0 4.4-3.1 8-7.5 8h-2.3c-2.2 0-4.1-1-5.3-2.8l-3.6-5.4c-.8-1.2-.5-2.7.6-3.4 1.1-.7 2.5-.4 3.2.7l.8 1.1V5.5C6.5 4.1 7.6 3 9 3Z";
  var KNUCKLES = "M15.1 14.6v3.4M18.6 16.3v2.6";
  var IBEAM = "M12.5 6.5c1.6 0 2.8.4 3.5 1.3.7-.9 1.9-1.3 3.5-1.3M12.5 25.5c1.6 0 2.8-.4 3.5-1.3.7.9 1.9 1.3 3.5 1.3M16 7.8v16.4";

  // značky do odznaku, mřížka 24×24 (jako běžné ikony); třetí prvek = vyplnit
  var GLYPHS = {
    search: [["circle", 'cx="10.5" cy="10.5" r="6.5"'], ["path", 'd="m20 20-4.6-4.6"']],
    send:   [["path", 'd="M21 3 10.5 13.5"'], ["path", 'd="M21 3 14.5 21l-4-7.5L3 9.5Z"']],
    user:   [["circle", 'cx="12" cy="8" r="4"'], ["path", 'd="M4.5 21a7.5 7.5 0 0 1 15 0"']],
    phone:  [["rect", 'x="6.5" y="2.5" width="11" height="19" rx="2.5"'], ["path", 'd="M11 18h2"']],
    chart:  [["path", 'd="M5 20v-6M12 20V5M19 20v-10"']],
    star:   [["path", 'd="M12 2.5 15 8.6l6.6.9-4.8 4.7 1.2 6.6-6-3.2-6 3.2 1.2-6.6-4.8-4.7L9 8.6Z"', 1]],
    code:   [["path", 'd="m8 7-5 5 5 5M16 7l5 5-5 5"']],
  };

  // odznak vpravo dole: kruh s obrysem a značkou zmenšenou z 24 na ~8,6 px
  var BX = 24.3, BR = 6.8, GS = 0.36;
  function badge(name, pal) {
    var off = (BX - 12 * GS).toFixed(2);
    var shapes = GLYPHS[name].map(function (g) {
      return "<" + g[0] + " " + g[1] + (g[2] ? ' fill="' + pal.glyph + '"' : "") + "/>";
    }).join("");
    return '<circle cx="' + BX + '" cy="' + BX + '" r="' + BR + '" fill="' + pal.badge + '" stroke="' + pal.line + '" stroke-width="1.5"/>' +
      '<g transform="translate(' + off + " " + off + ") scale(" + GS + ')" fill="none" stroke="' + pal.glyph + '" stroke-width="' + (1.25 / GS).toFixed(2) + '">' + shapes + "</g>";
  }

  // obrys = stejný tvar tažený silnější čarou pod výplní (vyčnívá ven o 1,5 px)
  function pointer(kind, pal) {
    if (kind === "arrow") {
      return '<path d="' + ARROW + '" fill="' + pal.line + '" stroke="' + pal.line + '" stroke-width="3"/>' +
        '<path d="' + ARROW + '" fill="' + pal.fill + '"/>';
    }
    return '<g transform="translate(0.5 0.5) scale(0.82)">' +
      '<path d="' + HAND + '" fill="' + pal.line + '" stroke="' + pal.line + '" stroke-width="3.6"/>' +
      '<path d="' + HAND + '" fill="' + pal.fill + '"/>' +
      '<path d="' + KNUCKLES + '" fill="none" stroke="' + pal.line + '" stroke-width="1.4"/></g>';
  }

  function cur(body, x, y, fallback) {
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" stroke-linecap="round" stroke-linejoin="round">' + body + "</svg>";
    return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") ' + x + " " + y + ", " + fallback;
  }

  // karta → značka v odznaku
  var CARDS = [
    [".cap-block", "search"],
    ['[aria-labelledby="poptavka"], .offer, .closing', "send"],
    [".card", "user"],
    ['.item[data-kind="app"]', "phone"],
    ['.item[data-kind="case"]', "chart"],
    ['.item[data-kind="reference"]', "star"],
    ['.item[data-kind="sample"]', "code"],
  ];
  var IN_CARD = ":is(" + CARDS.map(function (c) { return c[0]; }).join(", ") + ") ";
  var INTERACTIVE = 'a[href], button, summary, label, select, [role="button"], .tip, abbr[title], input:is([type="checkbox"], [type="radio"], [type="submit"], [type="button"], [type="reset"])';
  var TEXT = 'input:not([type="checkbox"], [type="radio"], [type="submit"], [type="button"], [type="reset"]), textarea, [contenteditable]';

  function rules(pal) {
    var ibeam = '<path d="' + IBEAM + '" fill="none" stroke="' + pal.line + '" stroke-width="3.6"/>' +
      '<path d="' + IBEAM + '" fill="none" stroke="' + pal.fill + '" stroke-width="1.4"/>';
    return CARDS.map(function (c) {
      var normal = cur(pointer("arrow", pal) + badge(c[1], pal), 4, 3, "auto");
      var hi = cur(pointer("hand", pal) + badge(c[1], pal), 8, 3, "pointer");
      return c[0] + " { --cur: " + normal + "; --cur-hi: " + hi + "; cursor: var(--cur); }";
    }).join("\n") + "\n" +
      IN_CARD + ":is(" + TEXT + ") { cursor: " + cur(ibeam, 16, 16, "text") + " !important; }";
  }

  var css = "@media (hover: hover) and (pointer: fine) {\n" +
    rules(COLORS.dark) + "\n" +
    "@media (prefers-color-scheme: light) {\n" + rules(COLORS.light) + "\n}\n" +
    IN_CARD + ":is(" + INTERACTIVE + ") { cursor: var(--cur-hi) !important; }\n" +
    IN_CARD + ":disabled { cursor: var(--cur) !important; }\n" +
    "}\n";

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
})();
