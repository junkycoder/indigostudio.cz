// src/worker.js
// Jeden Worker servuje celý fakan.cz: landing + audit-page + API + opt-out.
// Statiku obsluhuje binding ASSETS (auditor-worker/public/), dynamiku Worker.

import { handleAudit }         from './handlers/audit.js';
import { handleReport }        from './handlers/report.js';
import { handleScreenshot }    from './handlers/screenshot.js';
import { handleSuggestion }    from './handlers/suggestion.js';
import { handleSuggestionStatus, handleSuggestionAsset } from './handlers/suggestion-status.js';
import { handleDomainCheck }   from './handlers/domain-check.js';
import { handleDomainOrder, handleDomainStatus } from './handlers/domain-order.js';
import { handleStripeWebhook } from './handlers/stripe-webhook.js';
import { handleOptout }        from './handlers/optout.js';
import { handleMe }            from './handlers/me.js';
import { handleAccountStart, handleAccountVerify, handleAccountLogout } from './handlers/account.js';
import { processAuditJob }     from './audit/processor.js';
import { runStrategist }       from './audit/strategist.js';
import { processSuggestionRender } from './suggestion/render.js';
import { processDomainOperation }  from './domain/register.js';
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
      if (request.method === 'POST' && path === '/api/suggestion') {
        return withCors(await handleSuggestion(request, env, ctx), request);
      }
      if (path.startsWith('/api/suggestion/') && path.endsWith('/status')) {
        return withCors(await handleSuggestionStatus(request, env), request);
      }
      if (path.startsWith('/api/suggestion/') && (path.endsWith('/preview') || path.endsWith('/output'))) {
        return withCors(await handleSuggestionAsset(request, env), request);
      }
      if (request.method === 'GET' && path === '/api/domain/check') {
        return withCors(await handleDomainCheck(request, env), request);
      }
      if (request.method === 'POST' && path === '/api/domain/order') {
        return withCors(await handleDomainOrder(request, env, ctx), request);
      }
      if (path.startsWith('/api/domain/') && path.endsWith('/status')) {
        return withCors(await handleDomainStatus(request, env), request);
      }
      if (path.startsWith('/api/audit/') && path.endsWith('/data')) {
        return withCors(await handleReport(request, env), request);
      }
      if (path.startsWith('/api/screenshot/')) {
        return withCors(await handleScreenshot(request, env), request);
      }

      // ----- Identita: profil + magic link -----
      // /api/me čte device cookie a vrací aktuální journeys. Bezpečné volat
      // anonymně — middleware vyrobí device_token, pokud chybí.
      // /api/account/start posílá magic link. /verify je redirect z mailu,
      // ne JSON endpoint (bez CORS, vrací 302).
      if (request.method === 'GET'  && path === '/api/me') {
        return withCors(await handleMe(request, env, ctx), request);
      }
      if (request.method === 'POST' && path === '/api/account/start') {
        return withCors(await handleAccountStart(request, env, ctx), request);
      }
      if (request.method === 'GET'  && path === '/api/account/verify') {
        return handleAccountVerify(request, env, ctx);
      }
      if (request.method === 'POST' && path === '/api/account/logout') {
        return withCors(await handleAccountLogout(request, env, ctx), request);
      }

      // Stripe webhook — bez CORS (volá ho Stripe server, ne browser)
      // a handler si raw body čte sám (nesmí být zkonzumované middleware).
      if (request.method === 'POST' && path === '/api/stripe/webhook') {
        return handleStripeWebhook(request, env, ctx);
      }

      // ----- Opt-out -----
      // Cesty: /odhlasit/{token}, /odhlasit?t=, /odhlasit?token=, /unsubscribe?token=
      // List-Unsubscribe header z drip mailů + ruční klik z patičky.
      if (
        path === '/odhlasit' ||
        path.startsWith('/odhlasit/') ||
        path === '/unsubscribe'
      ) {
        return handleOptout(request, env, ctx);
      }

      // ----- Audit report SPA -----
      // /audit/{token} → audit-page index.html (frontend si token přečte z URL).
      // Asset bindingu posíláme `/audit/` (trailing slash), ten ho vyřeší jako
      // adresář s default index.html. Pokud bychom poslali `/audit/index.html`,
      // auto-trailing-slash by udělal 307 redirect na `/audit/` a vznikne loop.
      if (path.startsWith('/audit/') && !path.endsWith('/data')) {
        const assetUrl = new URL('/audit/', request.url);
        return env.ASSETS.fetch(new Request(assetUrl, request));
      }

      // ----- Suggestion status SPA -----
      // /navrh/{orderId} → public/navrh/index.html. Stejný trik s trailing slashem
      // jako u /audit/, jinak asset binding udělá redirect smyčku.
      if (path.startsWith('/navrh/')) {
        const assetUrl = new URL('/navrh/', request.url);
        return env.ASSETS.fetch(new Request(assetUrl, request));
      }

      // ----- Doménové stránky -----
      // /domena/objednat?fqdn=… → public/domena/objednat/index.html (registrant form + Stripe)
      // /domena/stav/{orderId}  → public/domena/stav/index.html (polling status)
      if (path === '/domena/objednat' || path.startsWith('/domena/objednat/')) {
        const assetUrl = new URL('/domena/objednat/', request.url);
        return env.ASSETS.fetch(new Request(assetUrl, request));
      }
      if (path.startsWith('/domena/stav/')) {
        const assetUrl = new URL('/domena/stav/', request.url);
        return env.ASSETS.fetch(new Request(assetUrl, request));
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
      const kind = msg.body?.kind;
      try {
        switch (kind) {
          case 'audit':
          case undefined:
            // Audit job — kind chybí u nejstarších zpráv (backwards-compat).
            await processAuditJob(msg.body, env, ctx);
            break;
          case 'strategist':
            await runStrategist(msg.body, env);
            break;
          case 'suggestion-render':
            await processSuggestionRender(msg.body, env, ctx);
            break;
          case 'domain-register':
          case 'domain-transfer':
            await processDomainOperation(msg.body, env, ctx);
            break;
          default:
            // Neznámý kind = permanent chyba, retry by se nezlepšil.
            console.error(`queue: neznámý kind '${kind}'`, msg.body);
            msg.ack();
            continue;
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
