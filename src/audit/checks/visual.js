// src/audit/checks/visual.js
//
// Vizuální checky napříč viewporty + dark mode + mobilní UX detaily.
// Volá se z processor.js po prvním goto, sdílí jednu Page instance — žádné
// reloady, jen přepínání viewportu / media features. Layouty řízené čistě
// CSS @media reagují okamžitě, JS-driven layouty zachytíme dispatchem
// `resize` eventu.
//
// Vrací: { findings, screenshots: { kind: r2_key }, metrics }
//
// Screenshoty:
//   audits/{auditId}/shot-mobile-portrait.jpg   — primární mobil 390×844
//   audits/{auditId}/shot-mobile-landscape.jpg  — mobil otočený 844×390
//   audits/{auditId}/shot-desktop.jpg           — desktop 1440×900
//   audits/{auditId}/shot-mobile-dark.jpg       — mobil + prefers-color-scheme:dark
//
// Pozor: processor.js navíc ukládá audits/{auditId}/screenshot.jpg pro
// zpětnou kompatibilitu s /api/screenshot/{auditId} endpointem (starý SPA).

const VIEWPORTS = {
  mobilePortrait:  { width: 390,  height: 844, isMobile: true,  hasTouch: true  },
  mobileLandscape: { width: 844,  height: 390, isMobile: true,  hasTouch: true  },
  desktop:         { width: 1440, height: 900, isMobile: false, hasTouch: false },
};

const SCREENSHOT_OPTS = { type: 'jpeg', quality: 70, fullPage: false };

// Některé weby mají decimální layout / scrollbar. +8 px tolerance.
const OVERFLOW_TOLERANCE_PX = 8;

// iOS Safari spustí zoom-on-focus, když má input/textarea/select font-size < 16 px.
const IOS_MIN_INPUT_FONT_PX = 16;

// WCAG 2.5.5 / Apple HIG: minimální tap target 44×44.
// 1–2 malé prvky bývá norma (sociální ikonky v patičce). Od 3 výš je to vzor.
const TAP_TARGET_MIN_PX = 44;
const TAP_TARGET_THRESHOLD = 3;

// Repaint po změně viewportu / media. CSS @media reaguje okamžitě, ale
// JS layouty potřebují resize event + krátký frame.
const REPAINT_WAIT_MS = 350;
const REPAINT_WAIT_DARK_MS = 700;  // dark mode často animuje tranzici

export async function runVisualChecks(page, env, auditId) {
  const findings = [];
  const screenshots = {};

  // --- 1. Mobile portrait — UX metriky + screenshot ---
  // Page už má 390×844 (nastavil processor), pojistně setneme znovu.
  await page.setViewport(VIEWPORTS.mobilePortrait);
  await waitForRepaint(page);

  const mobile = await measureMobileMetrics(page);

  if (mobile.overflowPx > OVERFLOW_TOLERANCE_PX) {
    findings.push({
      category: 'visual', severity: 'high',
      title: 'Web na mobilu posunutý do strany',
      detail: `Stránka je o ${mobile.overflowPx} px širší než displej. Návštěvník musí scrollovat doprava.`,
      fix_hint: 'Najít prvky s pevnou šířkou v px, dlouhá slova bez zalamování a obrázky bez max-width:100 %.',
      weight: 2,
    });
  }
  if (mobile.smallInputs > 0) {
    findings.push({
      category: 'visual', severity: 'medium',
      title: 'Formulář na iPhonu zoomne, jakmile do něj klepnete',
      detail: `${mobile.smallInputs} ${pluralCs(mobile.smallInputs, 'políčko', 'políčka', 'políček')} má písmo menší než ${IOS_MIN_INPUT_FONT_PX} px.`,
      fix_hint: 'Stačí v CSS: input, textarea, select { font-size: 16px }. Telefon si pak dá pokoj a nezoomuje.',
      weight: 1,
    });
  }
  if (mobile.smallTapTargets >= TAP_TARGET_THRESHOLD) {
    findings.push({
      category: 'visual', severity: 'medium',
      title: 'Tlačítka jsou na mobilu těžko trefitelná',
      detail: `${mobile.smallTapTargets} prvků k poklepání má rozměr menší než ${TAP_TARGET_MIN_PX}×${TAP_TARGET_MIN_PX} px.`,
      fix_hint: 'Apple a WCAG doporučují minimum 44×44 px. Hlavně menu, sociální ikonky a křížek pro zavření.',
      weight: 1,
    });
  }

  screenshots.mobilePortrait = await captureAndStore(page, env, auditId, 'mobile-portrait');

  // --- 2. Mobile landscape — overflow + screenshot ---
  await page.setViewport(VIEWPORTS.mobileLandscape);
  await waitForRepaint(page);
  const landscape = await measureOverflow(page);
  if (landscape.overflowPx > OVERFLOW_TOLERANCE_PX) {
    findings.push({
      category: 'visual', severity: 'medium',
      title: 'Na šířku se mobilní rozložení rozpadá',
      detail: `Když mobil otočíte na šířku (844×390), stránka přetéká o ${landscape.overflowPx} px.`,
      fix_hint: 'Otestovat web v 844×390. Často je problém ve fixní šířce headeru nebo container divu.',
      weight: 1,
    });
  }
  screenshots.mobileLandscape = await captureAndStore(page, env, auditId, 'mobile-landscape');

  // --- 3. Desktop — screenshot pro AI vrstvu ---
  await page.setViewport(VIEWPORTS.desktop);
  await waitForRepaint(page);
  screenshots.desktop = await captureAndStore(page, env, auditId, 'desktop');

  // --- 4. Dark mode — emulace + screenshot + heuristika ---
  await page.setViewport(VIEWPORTS.mobilePortrait);
  await waitForRepaint(page);

  let darkSupported = null;  // null = nezjištěno, true/false = výsledek
  try {
    await setColorScheme(page, 'dark');
    await waitForRepaint(page, REPAINT_WAIT_DARK_MS);

    const dark = await detectDarkMode(page);
    darkSupported = dark.supported;
    screenshots.mobileDark = await captureAndStore(page, env, auditId, 'mobile-dark');

    if (dark.supported === false) {
      findings.push({
        category: 'visual', severity: 'low',
        title: 'Web nemá vlastní tmavý režim',
        detail: 'Když má návštěvník na telefonu zapnutý tmavý režim, web zůstane světlý. iOS si ho pak invertuje sám a výsledek bývá nečitelný.',
        fix_hint: 'Stačí @media (prefers-color-scheme: dark) s tmavou variantou pozadí a textu.',
        weight: 1,
      });
    }
  } catch (err) {
    console.warn(`visual: dark mode detection failed for ${auditId}: ${err.message}`);
  } finally {
    // Reset zpět na light, ať další checky (cookies, headers) nedostanou
    // zkreslený stav.
    await setColorScheme(page, 'light').catch(() => {});
    await page.setViewport(VIEWPORTS.mobilePortrait).catch(() => {});
  }

  return {
    findings,
    screenshots,
    metrics: {
      mobile,
      landscape,
      darkSupported,
    },
  };
}

// --- Helpery ---

async function waitForRepaint(page, ms = REPAINT_WAIT_MS) {
  await page.evaluate(() => window.dispatchEvent(new Event('resize'))).catch(() => {});
  await new Promise((r) => setTimeout(r, ms));
}

async function captureAndStore(page, env, auditId, kind) {
  const buf = await page.screenshot(SCREENSHOT_OPTS);
  const key = `audits/${auditId}/shot-${kind}.jpg`;
  await env.REPORTS.put(key, buf, { httpMetadata: { contentType: 'image/jpeg' } });
  return key;
}

async function measureMobileMetrics(page) {
  return await page.evaluate(({ minInputFont, minTapTarget }) => {
    const overflowPx = Math.max(
      0,
      Math.round(document.documentElement.scrollWidth - window.innerWidth),
    );

    let smallInputs = 0;
    const inputSel = 'input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]):not([type="reset"]), textarea, select';
    for (const el of document.querySelectorAll(inputSel)) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize);
      if (fs && fs < minInputFont) smallInputs++;
    }

    let smallTapTargets = 0;
    const tapSel = 'a[href], button, input[type="button"], input[type="submit"], [role="button"]';
    for (const el of document.querySelectorAll(tapSel)) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      if (rect.width < minTapTarget || rect.height < minTapTarget) smallTapTargets++;
    }

    return { overflowPx, smallInputs, smallTapTargets };
  }, { minInputFont: IOS_MIN_INPUT_FONT_PX, minTapTarget: TAP_TARGET_MIN_PX });
}

async function measureOverflow(page) {
  return await page.evaluate(() => ({
    overflowPx: Math.max(
      0,
      Math.round(document.documentElement.scrollWidth - window.innerWidth),
    ),
  }));
}

// Puppeteer @cloudflare nemá vždy `emulateMediaFeatures`, fallback přes CDP.
async function setColorScheme(page, value) {
  if (typeof page.emulateMediaFeatures === 'function') {
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value }]);
    return;
  }
  const session = await page.target?.().createCDPSession?.();
  if (session) {
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-color-scheme', value }],
    });
  }
}

// Heuristika: po emulaci dark mode zkontrolujeme luminanci body pozadí.
// Light bg = web nemá vlastní dark variantu (bude se invertovat na iOS).
async function detectDarkMode(page) {
  const data = await page.evaluate(() => {
    const cs = getComputedStyle(document.body);
    return { bg: cs.backgroundColor, fg: cs.color };
  });
  const bgL = parseRgbLuminance(data.bg);
  if (bgL === null) return { supported: null, ...data };
  return { supported: bgL <= 0.5, bgLuminance: bgL, ...data };
}

function parseRgbLuminance(rgb) {
  const m = /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/.exec(rgb || '');
  if (!m) return null;
  const r = parseInt(m[1], 10), g = parseInt(m[2], 10), b = parseInt(m[3], 10);
  const f = (c) => { c = c / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function pluralCs(n, one, few, many) {
  if (n === 1) return one;
  if (n >= 2 && n <= 4) return few;
  return many;
}
