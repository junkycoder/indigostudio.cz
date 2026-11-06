// Rozbalovací nabídky v horní liště (služby, jazyk): <details> se zavře kliknutím mimo nebo Escapem.
// Bez skriptu funguje dál, jen se zavírá druhým kliknutím na tlačítko.
(function () {
  "use strict";

  // Přepínač jazyka: volbu si zapamatujeme v cookie lang, podle ní Worker při příští
  // návštěvě české adresy přesměruje (nebo nechá češtinu). Technicky nezbytná cookie
  // = uživatelem zvolené nastavení, souhlas nepotřebuje. Bez JS přepínač funguje
  // dál, jen si volbu nepamatuje.
  document.addEventListener("click", function (e) {
    var link = e.target instanceof Element ? e.target.closest(".nav-lang a[hreflang]") : null;
    if (!link) return;
    document.cookie = "lang=" + link.getAttribute("hreflang") + "; Path=/; Max-Age=31536000; SameSite=Lax" +
      (location.protocol === "https:" ? "; Secure" : "");
  });

  var groups = Array.prototype.slice.call(document.querySelectorAll(".nav-group"));
  if (!groups.length) return;

  function closeAll(except) {
    groups.forEach(function (group) {
      if (group !== except) group.open = false;
    });
  }

  document.addEventListener("click", function (e) {
    var target = e.target instanceof Element ? e.target : null;
    closeAll(target && target.closest(".nav-group"));
  });

  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var open = groups.filter(function (group) { return group.open; });
    if (!open.length) return;
    var summary = open[0].querySelector("summary");
    closeAll(null);
    if (summary) summary.focus();
  });
})();
