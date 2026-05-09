// src/audit/processor.js
// Hlavní auditní pipeline. Vstup: { auditId, leadId, url, domain, email, reportToken }

import puppeteer            from '@cloudflare/puppeteer';
import { runAxe }           from './checks/axe.js';
import { detectCookies }    from './checks/cookies.js';
import { checkHeaders }     from './checks/headers.js';
import { detectCms }        from './checks/cms.js';
import { checkSeo }         from './checks/seo.js';
import { score }            from './scoring.js';
import { scheduleEmail }    from '../email/dispatcher.js';

export async function processAuditJob(job, env, ctx) {
  const { auditId, leadId, url, domain, email, reportToken } = job;
  const t0 = Date.now();

  await env.DB.prepare(
    `UPDATE audits SET status='running', started_at=? WHERE id=?`
  ).bind(Math.floor(Date.now()/1000), auditId).run();

  const findings = [];
  let perfData = {}, cookieData = {}, headerData = {}, cmsData = {}, seoData = {};
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

    // mobilní screenshot
    const shot = await page.screenshot({ type: 'jpeg', quality: 70 });
    await env.REPORTS.put(`audits/${auditId}/screenshot.jpg`, shot, {
      httpMetadata: { contentType: 'image/jpeg' },
    });

    headerData = await checkHeaders(url);

    findings.push(...buildFindings({ perfData, cookieData, headerData, cmsData, seoData }));

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
    JSON.stringify({ perfData, cookieData, headerData, cmsData, seoData, scores }),
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

  // cache (7 dní per doména)
  await env.AUDIT_CACHE.put(
    `audit:${domain}`, JSON.stringify({ auditId, ts: now }),
    { expirationTtl: 7 * 86400 },
  );

  // mail #1 — okamžitě
  await scheduleEmail(env, {
    leadId, auditId, template: 'audit_done',
    sendInSeconds: 0,
  });

  // strategist ihned (běží jako další queue zpráva)
  await env.AUDIT_QUEUE.send({ kind: 'strategist', auditId, leadId, email });

  console.log(`audit ${auditId} done in ${Date.now()-t0}ms score=${scores.total}`);
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

  // SEO
  if (!seoData.title) f.push({ category:'seo', severity:'high', title:'Chybí <title>', weight:3 });
  if (!seoData.metaDescription) f.push({ category:'seo', severity:'medium',
    title:'Chybí meta description',
    fix_hint:'Krátký popis (do 160 znaků). Google si jinak vymyslí.', weight:2 });
  if (!seoData.ogTitle) f.push({ category:'seo', severity:'low',
    title:'Chybí Open Graph tagy',
    fix_hint:'Bez OG tagů má sdílení na Facebooku/LinkedInu generický náhled.', weight:1 });

  // CMS
  if (cmsData.cms === 'wordpress' && cmsData.outdated)
    f.push({ category:'cms', severity:'high', title:'Zastaralý WordPress',
      detail:`Detekovaná verze ${cmsData.version || 'starší než aktuální'}.`,
      fix_hint:'Bezpečnostní díra. Buď update, nebo přesun na statický web.', weight:3 });

  return f;
}
