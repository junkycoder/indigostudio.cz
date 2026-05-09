// src/worker.js
import { handleAudit }         from './handlers/audit.js';
import { handleReport }        from './handlers/report.js';
import { handleUnsubscribe }   from './handlers/unsubscribe.js';
import { handleScreenshot }    from './handlers/screenshot.js';
import { processAuditJob }     from './audit/processor.js';
import { runStrategist }       from './audit/strategist.js';
import { dispatchPendingMail } from './email/dispatcher.js';
import { corsHeaders, withCors } from './lib/cors.js';

export default {
  async fetch(request, env, ctx) {
    // CORS preflight — POST z fakan.cz formuláře, GET data z audit.fakan.cz frontendu.
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      if (request.method === 'POST' && path === '/api/audit') {
        return withCors(await handleAudit(request, env, ctx), request);
      }
      if (path.startsWith('/audit/')) {
        return withCors(await handleReport(request, env), request);
      }
      if (path.startsWith('/screenshot/')) {
        return withCors(await handleScreenshot(request, env), request);
      }
      if (path === '/unsubscribe') {
        return handleUnsubscribe(request, env);
      }
      return new Response('Not found', { status: 404 });
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
    // každých 15 min: vyzvedni naplánované maily kterým nadešel čas
    ctx.waitUntil(dispatchPendingMail(env));
  },
};
