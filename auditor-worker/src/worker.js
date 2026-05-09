// src/worker.js
// Jeden Worker servuje celý fakan.cz: landing + audit-page + API + opt-out.
// Statiku obsluhuje binding ASSETS (auditor-worker/public/), dynamiku Worker.

import { handleAudit }         from './handlers/audit.js';
import { handleReport }        from './handlers/report.js';
import { handleScreenshot }    from './handlers/screenshot.js';
import { handleOptout }        from './legacy/optout.js';
import { processAuditJob }     from './audit/processor.js';
import { runStrategist }       from './audit/strategist.js';
import { dispatchPendingMail } from './email/dispatcher.js';
import { corsHeaders, withCors } from './lib/cors.js';

export default {
  async fetch(request, env, ctx) {
    // CORS preflight — same-origin už po sjednocení, ale ponecháno defenzivně
    // (kdyby někdo posílal z localhost / dev origin).
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // ----- API (vše pod /api/) -----
      if (request.method === 'POST' && path === '/api/audit') {
        return withCors(await handleAudit(request, env, ctx), request);
      }
      if (path.startsWith('/api/audit/') && path.endsWith('/data')) {
        return withCors(await handleReport(request, env), request);
      }
      if (path.startsWith('/api/screenshot/')) {
        return withCors(await handleScreenshot(request, env), request);
      }

      // ----- Opt-out (sjednocený handler) -----
      // Cesty: /odhlasit/{token}, /odhlasit?t=, /odhlasit?token=, /unsubscribe?token=
      // Sloučeno kvůli legacy mailům z analyze flow + List-Unsubscribe header z auditoru.
      if (
        path === '/odhlasit' ||
        path.startsWith('/odhlasit/') ||
        path === '/unsubscribe'
      ) {
        return handleOptout(request, env, ctx);
      }

      // ----- Audit report SPA -----
      // /audit/{token} → audit-page index.html (frontend si token přečte z URL).
      // Asset cestu /audit/index.html nechce přepsat (ať lze otevřít přímo).
      if (path.startsWith('/audit/') && path !== '/audit/index.html') {
        const indexUrl = new URL('/audit/index.html', request.url);
        return env.ASSETS.fetch(new Request(indexUrl, request));
      }

      // ----- Backwards-compat redirecty -----
      // Stará URL z mailů a předchozí frontend verze. Po pár měsících odstavit.
      if (path.startsWith('/audit/') && path.endsWith('/data')) {
        // /audit/{token}/data → /api/audit/{token}/data
        const newUrl = new URL('/api' + path, request.url);
        return Response.redirect(newUrl.toString(), 301);
      }
      if (path.startsWith('/screenshot/')) {
        const newUrl = new URL('/api' + path, request.url);
        return Response.redirect(newUrl.toString(), 301);
      }

      // ----- Statika (landing, ochrana-udaju, …) -----
      return env.ASSETS.fetch(request);
    } catch (err) {
      console.error('fetch error', err);
      return new Response('Internal error', { status: 500 });
    }
  },

  async queue(batch, env, ctx) {
    for (const msg of batch.messages) {
      try {
        if (msg.body.kind === 'strategist') {
          await runStrategist(msg.body, env);
        } else {
          await processAuditJob(msg.body, env, ctx);
        }
        msg.ack();
      } catch (err) {
        console.error('queue error', err, msg.body);
        msg.retry({ delaySeconds: 60 });
      }
    }
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(dispatchPendingMail(env));
  },
};
