// src/suggestion/render.js
//
// Pipeline pro AI návrh: vstup je `{ orderId }` z queue.
//   1) Načti order + suggestion + lead (idempotentně)
//   2) Posuň status orders='processing'
//   3) Vyrob baseline screenshot — z auditu nebo screenshotem teď
//   4) Volej Claude Sonnet 4.5 Vision (baseline + uploady + brief)
//   5) Sanitizuj HTML output (HTMLRewriter)
//   6) Vyrendruj HTML přes Browser Rendering, ulož preview PNG do R2
//   7) Ulož HTML do R2
//   8) Update suggestions (klíče, tokeny) + orders='done'
//   9) Pošli mail přes Resend
//
// Idempotence: pokud orders.status už je 'processing'/'done', skip.
// Při chybě: orders.status='failed', error_message, mail klientovi že vrátíme peníze
// (refund flow řeší Fakan ručně přes Stripe Dashboard).

import puppeteer from '@cloudflare/puppeteer';
import { callVision, bufferToBase64 } from '../lib/claude-vision.js';
import { sanitizeHtml } from '../lib/html-sanitize.js';
import { sendTransactional } from '../email/send.js';
import { tplSuggestionDone } from '../email/templates.js';

const SYSTEM_PROMPT = `Jsi expert na webdesign a moderní HTML/CSS. Klient pošle screenshot své stránky, stručný brief co chce změnit, a případně inspirace (logo, fotky, screenshoty referenčních webů).

Tvůj úkol: vrať JEDEN samostatný HTML soubor (s inline CSS v <style>) představující upravenou verzi té stránky podle briefu. Ne celý web, jen tu jednu stránku, kterou jsi viděl na screenshotu.

Pravidla:
- Pouze HTML + inline CSS. Žádný JavaScript. Žádné externí <script>, žádné <link rel="stylesheet"> na CDN, žádné Google Fonts (použij system font stack).
- Drž obsah konzistentní: text na stránce zůstává, jen design / strukturu měníš podle briefu. Nepřekládej do jiného jazyka, neměň název firmy ani konkrétní fakta.
- Žádné placeholder texty ("Lorem ipsum"). Použij reálný český obsah ze screenshotu.
- Web musí fungovat na mobilu (mobile-first responzive, viewport meta).
- Žádné tracking pixely, analytics, externí <iframe>.

Output: čistý HTML soubor začínající <!doctype html> a končící </html>. Žádné markdown ohrady (\`\`\`html), žádný komentář před ani za.`;

const MAX_IMAGES = 4;          // 1 baseline + 3 uploads
const PER_IMAGE_BYTES = 4 * 1024 * 1024;

export async function processSuggestionRender({ orderId }, env, ctx) {
  const t0 = Date.now();

  // 1) Načti order + suggestion
  const row = await env.DB.prepare(
    `SELECT o.id, o.status, o.email, o.lead_id, o.amount_cents, o.currency,
            s.url, s.brief, s.audit_id, s.files_json,
            l.unsub_token, l.domain
       FROM orders o
       JOIN suggestions s ON s.order_id = o.id
       LEFT JOIN leads l ON l.id = o.lead_id
      WHERE o.id = ? AND o.kind = 'suggestion' LIMIT 1`
  ).bind(orderId).first();

  if (!row) {
    console.warn(`suggestion-render: order ${orderId} neexistuje`);
    return; // ack — order neexistuje, retry by nepomohl
  }
  if (row.status === 'done')       return; // už hotovo
  if (row.status === 'processing') return; // jiná instance to dělá (queue retry)
  if (row.status !== 'paid') {
    console.warn(`suggestion-render: order ${orderId} status=${row.status}, čekáme paid`);
    throw new Error(`order ${orderId} není paid (${row.status})`);
  }

  const now = () => Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `UPDATE orders SET status='processing', updated_at=? WHERE id=?`
  ).bind(now(), orderId).run();

  let browser;
  try {
    // 2) Baseline screenshot
    const baseline = await loadOrCaptureBaseline(env, row);
    if (!baseline) throw new Error('Nepodařilo se vyrobit baseline screenshot');

    // 3) Uploady — jen image typy
    const uploads = await loadImageUploads(env, row.files_json);

    // 4) Claude Vision
    const images = [baseline, ...uploads].slice(0, MAX_IMAGES);
    const briefText = composeBrief(row);

    const vision = await callVision(env, {
      systemPrompt: SYSTEM_PROMPT,
      briefText,
      images,
    });

    // 5) Sanitize
    const cleanedHtml = await sanitizeHtml(vision.text);
    if (cleanedHtml.length < 200) {
      throw new Error('Claude vrátil podezřele krátký HTML output');
    }

    // 6) Render preview
    browser = await puppeteer.launch(env.MYBROWSER);
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.setContent(cleanedHtml, { waitUntil: 'networkidle0', timeout: 15000 });
    const previewBuf = await page.screenshot({ fullPage: true, type: 'png' });

    // 7) Ulož HTML + preview do R2
    const htmlKey = `suggestions/${orderId}/output.html`;
    const previewKey = `suggestions/${orderId}/preview.png`;

    await env.REPORTS.put(htmlKey, cleanedHtml, {
      httpMetadata: { contentType: 'text/html; charset=utf-8' },
      customMetadata: { orderId },
    });
    await env.REPORTS.put(previewKey, previewBuf, {
      httpMetadata: { contentType: 'image/png' },
      customMetadata: { orderId },
    });

    // 8) Update DB
    const ts = now();
    await env.DB.batch([
      env.DB.prepare(
        `UPDATE suggestions
            SET html_output_key = ?, preview_image_key = ?,
                claude_request_id = ?, claude_input_tokens = ?, claude_output_tokens = ?
          WHERE order_id = ?`
      ).bind(
        htmlKey, previewKey,
        vision.requestId || null,
        vision.usage?.input_tokens || null,
        vision.usage?.output_tokens || null,
        orderId,
      ),
      env.DB.prepare(
        `UPDATE orders SET status='done', completed_at=?, updated_at=? WHERE id=?`
      ).bind(ts, ts, orderId),
    ]);

    // 9) Mail — best-effort, fail by neměl rollbacknout render
    const host = env.PUBLIC_HOST || 'fakan.cz';
    const previewPublicUrl = `https://${host}/api/suggestion/${orderId}/preview`;
    const outputPublicUrl  = `https://${host}/api/suggestion/${orderId}/output`;
    const tpl = tplSuggestionDone(env, {
      domain: row.domain || row.url,
      orderId,
      previewUrl: previewPublicUrl,
      outputUrl:  outputPublicUrl,
    });

    const sent = await sendTransactional(env, {
      to: row.email,
      subject: tpl.subject,
      html: tpl.html,
      text: tpl.text,
      listUnsubUrl: row.unsub_token ? `https://${host}/odhlasit/${row.unsub_token}` : null,
    });
    if (!sent.ok) console.warn(`suggestion-render mail send fail order=${orderId}: ${sent.error}`);

    console.log(`suggestion ${orderId} done in ${Date.now() - t0}ms`);

  } catch (err) {
    const msg = String(err.message || err).slice(0, 500);
    console.error(`suggestion-render fail order=${orderId}: ${msg}`);
    await env.DB.prepare(
      `UPDATE orders SET status='failed', error_message=?, updated_at=? WHERE id=?`
    ).bind(msg, now(), orderId).run();
    throw err; // queue retry — po max_retries skončí v DLQ a Fakan ručně
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

// ---- helpers --------------------------------------------------------------

async function loadOrCaptureBaseline(env, row) {
  // Z auditu — screenshot je v `audits/{auditId}/screenshot.jpg`
  if (row.audit_id) {
    const obj = await env.REPORTS.get(`audits/${row.audit_id}/screenshot.jpg`);
    if (obj) {
      const buf = await obj.arrayBuffer();
      return { mimeType: 'image/jpeg', base64: bufferToBase64(buf) };
    }
  }

  // Fallback: udělej screenshot teď
  let browser;
  try {
    browser = await puppeteer.launch(env.MYBROWSER);
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true });
    await page.setUserAgent('FakanAuditor/1.0 (+https://fakan.cz)');
    await page.goto(row.url, { waitUntil: 'networkidle2', timeout: 25000 });
    const buf = await page.screenshot({ type: 'jpeg', quality: 75 });
    return { mimeType: 'image/jpeg', base64: bufferToBase64(buf.buffer || buf) };
  } catch (err) {
    console.warn(`baseline capture fail: ${err.message}`);
    return null;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
}

async function loadImageUploads(env, filesJson) {
  if (!filesJson) return [];
  let files;
  try { files = JSON.parse(filesJson); }
  catch { return []; }
  if (!Array.isArray(files)) return [];

  const out = [];
  for (const f of files) {
    if (out.length >= MAX_IMAGES - 1) break;       // max 3 uploads vedle baseline
    if (!f.mime?.startsWith('image/')) continue;   // PDF/DOCX/TXT — Claude Vision je nezpracuje
    if (f.bytes > PER_IMAGE_BYTES) continue;        // přeskoč obří soubor
    const obj = await env.REPORTS.get(f.r2_key);
    if (!obj) continue;
    const buf = await obj.arrayBuffer();
    out.push({ mimeType: f.mime, base64: bufferToBase64(buf) });
  }
  return out;
}

function composeBrief(row) {
  return `Kontextová informace k zadání:

Adresa stránky: ${row.url}
Brief od klienta:
${row.brief}

První obrázek je aktuální screenshot mobilní verze té stránky. Případné další obrázky jsou inspirace nebo podklady, které klient přiložil.

Vrať mi jeden HTML soubor podle pravidel v system promptu.`;
}
