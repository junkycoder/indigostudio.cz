// src/worker.js
import { handleAudit }       from './handlers/audit.js';
import { handleReport }      from './handlers/report.js';
import { handleUnsubscribe } from './handlers/unsubscribe.js';
import { processAuditJob }   from './audit/processor.js';
import { runStrategist }     from './audit/strategist.js';
import { dispatchPendingMail } from './email/dispatcher.js';

export default {
  async fetch(request, env, ctx) {
    const url   = new URL(request.url);
    const route = `${request.method} ${url.pathname}`;

    try {
      if (route === 'POST /api/audit')              return handleAudit(request, env, ctx);
      if (url.pathname.startsWith('/audit/'))       return handleReport(request, env);
      if (url.pathname === '/unsubscribe')          return handleUnsubscribe(request, env);
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
