// Rozbalovací nabídka v horní liště: <details> se zavře kliknutím mimo nebo Escapem.
// Bez skriptu funguje dál, jen se zavírá druhým kliknutím na tlačítko.
(function () {
  "use strict";

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
