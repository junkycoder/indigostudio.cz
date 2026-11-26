/* Vánoční výzdoba celého webu (sezónní, jen dekorace)
   Připojit za doodles.js: <script src="/vanoce.js" defer></script>
   Motivy v /vanoce/ jsou dodané hotové (webp s průhledností) — neupravovat, jen umisťovat.
   Po skončení sezóny (END) skript nic nevloží — stačí ho pak odpojit ze stránek.
   Stránka s vlastní výzdobou (prvek .xmas, např. /tynecko) se přeskočí. */
(function () {
  // poslední den výzdoby je 6. 1. (Tři králové), od 7. 1. 2027 nic
  var END = new Date(2027, 0, 7);
  if (new Date() >= END) return;

  // větev v pravém horním rohu; na telefonu místo ní jen baňka zavěšená pod lištou
  // (<picture> → prohlížeč stáhne jen jeden z obou souborů)
  var PHONE = "(max-width: 560px)";
  var HTML =
    '<picture class="xmas-deco" aria-hidden="true">' +
      '<source media="' + PHONE + '" srcset="/vanoce/banka.webp" width="1254" height="1254">' +
      '<img src="/vanoce/vetev-roh-ozdoba.webp" alt="" width="1448" height="1086" decoding="async" fetchpriority="low">' +
    "</picture>";

  var CSS = `
  /* ---- Vánoční výzdoba (vanoce.js) ----
     V pravém horním rohu stránky hned pod lištou (top nastavuje skript podle výšky lišty),
     pod obsahem (z-index -1 = nad malůvkami, pod kartami a textem), bez myši a bez čteček. */
  .xmas-deco { position: absolute; z-index: -1; top: 0; right: 0; pointer-events: none; user-select: none; }
  .xmas-deco img { display: block; width: min(30vw, 380px); height: auto; opacity: 0; transition: opacity 0.8s ease; }
  .xmas-deco.is-loaded img { opacity: 1; }
  @media ${PHONE} {
    /* baňka visí za poutko z dolní hrany lišty */
    .xmas-deco { margin-top: -14px; right: 14px; }
    .xmas-deco img { width: 64px; }
  }
  @media (prefers-reduced-motion: reduce) { .xmas-deco img { transition: none; } }
  @media print { .xmas-deco { display: none; } }
  `;

  function mount() {
    if (document.querySelector(".xmas")) return;

    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);
    document.body.insertAdjacentHTML("beforeend", HTML);

    var deco = document.body.lastElementChild;
    var img = deco.querySelector("img");
    var show = function () { deco.classList.add("is-loaded"); };
    if (img.complete && img.naturalWidth) show();
    else img.addEventListener("load", show);

    // kotva = dolní hrana lišty (na telefonu má lišta dva řádky); stránka bez lišty → úplně nahoře
    var header = document.querySelector(".site-header");
    if (!header) return;
    var place = function () {
      deco.style.top = header.getBoundingClientRect().bottom + window.scrollY + "px";
    };
    place();
    if (window.ResizeObserver) new ResizeObserver(place).observe(header);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount);
  else mount();
})();
