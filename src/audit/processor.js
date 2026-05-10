// src/audit/processor.js
// Hlavní auditní pipeline. Vstup: { auditId, leadId, url, domain, email, reportToken }

import puppeteer            from '@cloudflare/puppeteer';
import { runAxe }           from './checks/axe.js';
import { detectCookies }    from './checks/cookies.js';
import { checkHeaders }     from './checks/headers.js';
import { detectCms }        from './checks/cms.js';
import { checkSeo, buildSeoLengthFindings } from './checks/seo.js';
import { checkDiscovery }   from './checks/discovery.js';
import { runVisualChecks }  from './checks/visual.js';
import { runAiReview }      from './checks/ai-review.js';
import { score }            from './scoring.js';

export async function processAuditJob(job, env, ctx) {
  const { auditId, leadId, url, domain, email, reportToken } = job;
  const t0 = Date.now();

  await env.DB.prepare(
    `UPDATE audits SET status='running', started_at=? WHERE id=?`
  ).bind(Math.floor(Date.now()/1000), auditId).run();

  const findings = [];
  let perfData = {}, cookieData = {}, headerData = {}, cmsData = {}, seoData = {};
  let discoveryData = { robots: { exists: false }, sitemap: { exists: false } };
  let visualData = { screenshots: {}, metrics: {} };
  let aiData = { findings: [], scores: {}, summary: null };
  let browser, errMsg = null;

  try {
    browser = await puppeteer.launch(env.MYBROWSER);
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.setUserAgent('FakanAuditor/1.0 (+https://fakan.cz)');

    const cookieLog = [];
    page.on('response', (resp) => {
      const sc = resp.headers()['set-cookie'];
      if (sc) cookieLog.push({ url: resp.url(), header: sc });
    });

    const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 25000 });

    perfData = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] || {};
      const fcp = performance.getEntriesByType('paint')
        .find(p => p.name === 'first-contentful-paint')?.startTime || 0;
      const weight = performance.getEntriesByType('resource')
        .reduce((a, r) => a + (r.transferSize || 0), 0);
      return {
        ttfb: Math.round(nav.responseStart || 0),
        fcp:  Math.round(fcp),
        domLoad: Math.round(nav.domContentLoadedEventEnd || 0),
        load: Math.round(nav.loadEventEnd || 0),
        weight,
      };
    });

    cookieData  = await detectCookies(page, cookieLog);
    seoData     = await checkSeo(page);
    cmsData     = await detectCms(page, response);

    const axe = await runAxe(page);
    findings.push(...axe.findings);

    // Mobilní screenshot pro zpětnou kompatibilitu s /api/screenshot/{auditId}.
    // Visual checky pak doplní mobile-portrait + landscape + desktop + dark
    // pod samostatné R2 keys (shot-*.jpg).
    const shot = await page.screenshot({ type: 'jpeg', quality: 70 });
    await env.REPORTS.put(`audits/${auditId}/screenshot.jpg`, shot, {
      httpMetadata: { contentType: 'image/jpeg' },
    });

    // Vizuální checky napříč viewporty + dark mode + UX detaily na mobilu.
    // Pouští se nad stejnou Page instancí (přepínání viewportu bez reloadu).
    // Findings + screenshot R2 keys jdou do souhrnu, screenshoty do R2.
    try {
      visualData = await runVisualChecks(page, env, auditId);
      findings.push(...visualData.findings);
    } catch (vErr) {
      // Visual checky jsou doplněk — selhání nesmí shodit celý audit.
      console.warn(`audit ${auditId}: visual checks failed: ${vErr.message}`);
      visualData = { screenshots: {}, metrics: { error: vErr.message?.slice(0, 200) } };
    }

    // AI hodnocení vizuálu a obsahu (Claude Sonnet 4.5 Vision).
    // Synchronně před score, abychom měli content_score v mailu #1.
    // Selhání nesmí shodit audit — fallback je prázdné AI findings.
    try {
      const lead = await env.DB.prepare(
        `SELECT segment FROM leads WHERE id = ? LIMIT 1`,
      ).bind(leadId).first();

      aiData = await runAiReview(page, visualData.screenshots, env, {
        domain,
        url,
        cms: cmsData?.cms,
        segment: lead?.segment || 'unknown',
        techScores: { perf: perfData.fcp, a11y: null },  // skutečné scores ještě nepočítané
      });
      findings.push(...(aiData.findings || []));
    } catch (aiErr) {
      console.warn(`audit ${auditId}: ai review failed: ${aiErr.message}`);
      aiData = { findings: [], scores: {}, summary: null, error: aiErr.message?.slice(0, 200) };
    }

    // Headers + discovery (robots.txt + sitemap.xml) — oboje mimo browser,
    // pustit paralelně.
    [headerData, discoveryData] = await Promise.all([
      checkHeaders(url),
      checkDiscovery(url),
    ]);

    findings.push(...buildFindings({ perfData, cookieData, headerData, cmsData, seoData }));
    findings.push(...buildSeoLengthFindings(seoData));
    findings.push(...(discoveryData.findings || []));

  } catch (err) {
    errMsg = err.message?.slice(0, 500) || 'Unknown error';
    findings.push({
      category: 'error', severity: 'critical',
      title: 'Audit nedoběhl', detail: errMsg, weight: 0,
    });
  } finally {
    if (browser) await browser.close().catch(() => {});
  }

  const scores = score(findings, { perfData, cookieData, cmsData });

  // persist
  // Pozn.: visual_score zatím žije jen v json_summary.scores — nový sloupec
  // bychom museli přidat ALTER migrací, což rozbije idempotentní schema.sql.
  // Po stabilizaci (~50 reálných auditů) přesunout do samostatného sloupce.
  const now = Math.floor(Date.now()/1000);
  await env.DB.prepare(`
    UPDATE audits SET
      status = ?, score = ?, perf_score = ?, a11y_score = ?, seo_score = ?,
      cookie_score = ?, sec_score = ?, cms = ?, error = ?,
      json_summary = ?, finished_at = ?
    WHERE id = ?
  `).bind(
    errMsg ? 'failed' : 'done',
    scores.total, scores.perf, scores.a11y, scores.seo,
    scores.cookie, scores.sec,
    cmsData?.cms || null, errMsg,
    JSON.stringify({
      perfData, cookieData, headerData, cmsData, seoData,
      discovery:   discoveryData,
      visualMetrics: visualData.metrics,
      screenshots: visualData.screenshots,
      aiReview: {
        summary:        aiData.summary || null,
        visual_ai:      aiData.scores?.visual_ai ?? null,
        content_ai:     aiData.scores?.content   ?? null,
        scores_detail:  aiData.scores?.detail    || {},
        usage:          aiData.usage             || null,
        error:          aiData.error             || null,
      },
      scores,
    }),
    now, auditId,
  ).run();

  // findings
  if (findings.length) {
    const stmts = findings.map(f =>
      env.DB.prepare(
        `INSERT INTO findings (id, audit_id, category, severity, title, detail, fix_hint, weight)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        crypto.randomUUID(), auditId,
        f.category, f.severity, f.title,
        f.detail || '', f.fix_hint || '', f.weight ?? 1,
      )
    );
    await env.DB.batch(stmts);
  }

  // mail #1 — posunout placeholder z audit.js (Fáze 1) na "teď".
  // Idempotentní: pokud z nějakého důvodu placeholder neexistuje (re-run, ruční zásah),
  // INSERT-neme nový. Žádný duplikát ale necheme.
  const updated = await env.DB.prepare(
    `UPDATE email_events SET send_at = ?
     WHERE audit_id = ? AND template = 'audit_done' AND status = 'queued'`
  ).bind(now, auditId).run();
  if ((updated.meta?.changes || 0) === 0) {
    await env.DB.prepare(
      `INSERT INTO email_events (id, lead_id, audit_id, template, status, send_at)
       VALUES (?, ?, ?, 'audit_done', 'queued', ?)`
    ).bind(crypto.randomUUID(), leadId, auditId, now).run();
  }

  // Cache + Strategist pouštíme jen při úspěšném auditu.
  // - Failed audit cachovat = vrátit starý failed report po opravě domény (špatně).
  // - Failed audit do Strategistu = LLM bude halucinovat bez findings (špatně).
  if (!errMsg) {
    await env.AUDIT_CACHE.put(
      `audit:${domain}`, JSON.stringify({ auditId, ts: now }),
      { expirationTtl: 7 * 86400 },
    );
    await env.AUDIT_QUEUE.send({ kind: 'strategist', auditId, leadId, email });
  }

  console.log(`audit ${auditId} ${errMsg ? 'FAILED' : 'done'} in ${Date.now()-t0}ms score=${scores.total}`);
}

// --- buildFindings: data → findings ---

function buildFindings({ perfData, cookieData, headerData, cmsData, seoData }) {
  const f = [];

  // PERFORMANCE
  if (perfData.fcp > 2500)
    f.push({ category:'perf', severity:'high', title:'Stránka naskakuje pomalu',
      detail:`První obsah se objeví za ${(perfData.fcp/1000).toFixed(1)} s.`,
      fix_hint:'Optimalizovat obrázky, odstranit nepotřebný JS, zapnout Brotli.', weight:3 });
  if (perfData.weight > 2_000_000)
    f.push({ category:'perf', severity:'medium', title:'Stránka je těžká',
      detail:`Celková velikost ${(perfData.weight/1024/1024).toFixed(1)} MB.`,
      fix_hint:'Konvertovat obrázky na WebP/AVIF, lazy-loading.', weight:2 });

  // COOKIES
  if (cookieData.cookieBannerDetected)
    f.push({ category:'cookie', severity:'high', title:'Cookie okénko otravuje návštěvníka',
      detail:'Před obsahem se zobrazuje souhlas s cookies.',
      fix_hint:'Cookie-free architektura: bez GA, bez 3rd-party trackerů.', weight:3 });
  if (cookieData.thirdPartyTrackers?.length)
    f.push({ category:'cookie', severity:'medium', title:`${cookieData.thirdPartyTrackers.length} třetích trackerů`,
      detail:cookieData.thirdPartyTrackers.join(', '),
      fix_hint:'Cloudflare Web Analytics místo GA, žádný Facebook Pixel.', weight:2 });

  // HEADERS / SECURITY
  if (!headerData.hsts) f.push({ category:'sec', severity:'medium', title:'Chybí HSTS',
    detail:'Strict-Transport-Security header není nastavený.',
    fix_hint:'Cloudflare → SSL/TLS → HSTS, max-age 1 rok.', weight:1 });
  if (!headerData.csp) f.push({ category:'sec', severity:'low', title:'Chybí CSP',
    fix_hint:'Content-Security-Policy aspoň v report-only režimu.', weight:1 });
  if (!headerData.https) f.push({ category:'sec', severity:'critical', title:'Web nejede na HTTPS',
    fix_hint:'Cloudflare zdarma, do hodiny máš zelený zámek.', weight:5 });

  // SEO — chybějící title / description je vážné. Délky a OG tagy řeší
  // buildSeoLengthFindings() (volá se z processoru zvlášť).
  if (!seoData.title) f.push({ category:'seo', severity:'high', title:'Chybí titulek stránky', weight:3 });
  if (!seoData.metaDescription) f.push({ category:'seo', severity:'medium',
    title:'Chybí popis stránky',
    fix_hint:'Krátký popis (do 160 znaků). Google si jinak vymyslí, co o stránce napíše.', weight:2 });

  // CMS
  if (cmsData.cms === 'wordpress' && cmsData.outdated)
    f.push({ category:'cms', severity:'high', title:'Zastaralý WordPress',
      detail:`Detekovaná verze ${cmsData.version || 'starší než aktuální'}.`,
      fix_hint:'Bezpečnostní díra. Buď update, nebo přesun na statický web.', weight:3 });

  return f;
}
