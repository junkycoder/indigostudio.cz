// Worker entry — routuje API a /odhlasit, statiku servíruje Cloudflare assets přímo.
// Per wrangler.toml `run_worker_first = ["/api/*", "/odhlasit*"]` se sem dostanou
// jen tyhle dvě skupiny requestů. Cokoliv jiného je teoreticky nedosažitelné,
// ale defenzivně vracíme 404.
//
// Reference:
//   * projects/landing-v2/design.md § 3 (endpointy)
//   * projects/landing-v2/tasks.md TASK-10 (toto)

import { handleAnalyze } from './analyze.js';
import { handleOptout } from './optout.js';
import { checkRateLimit } from './lib/ratelimit.js';

// Rate limit pro free analýzu — 3 requesty / IP / 24 h.
// Per design § 7.1 + tasks TASK-11. Honest abuse (uživatel klikne 4×) propustíme
// degradací (KV chyba), ale boti se zaseknou.
const ANALYZE_RATE = { scope: 'analyze', limit: 3, windowSeconds: 86400 };

const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8' };

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // GET /odhlasit* — opt-out endpoint (Worker render, ne static).
    if (path === '/odhlasit' || path.startsWith('/odhlasit/')) {
      return handleOptout(request, env, ctx);
    }

    // GET /api/analyze — free analýza + lead piggyback.
    if (path === '/api/analyze') {
      if (request.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
          status: 405,
          headers: { ...JSON_HEADERS, allow: 'GET' },
        });
      }

      // Rate limit gate — před voláním handleru, aby honest blocked requests
      // neutrácely Worker CPU. Honeypot řeší analyze.js interně, neduplikujeme.
      const rl = await checkRateLimit({
        env,
        request,
        scope: ANALYZE_RATE.scope,
        limit: ANALYZE_RATE.limit,
        windowSeconds: ANALYZE_RATE.windowSeconds,
      });

      if (!rl.ok) {
        const retryAfterSec = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
        return new Response(
          JSON.stringify({ error: 'rate_limit', resetAt: rl.resetAt }),
          {
            status: 429,
            headers: {
              ...JSON_HEADERS,
              'retry-after': String(retryAfterSec),
            },
          }
        );
      }

      return handleAnalyze(request, env, ctx);
    }

    // POST /api/lead — fallback endpoint pro budoucí kontaktní formulář.
    // Pro landing-v2 stačí piggyback v /api/analyze, takže jen 501 stub.
    // TODO: implementovat až bude potřeba samostatný kontaktní formulář (post-landing-v2).
    if (path === '/api/lead') {
      return new Response(JSON.stringify({ error: 'not_implemented' }), {
        status: 501,
        headers: JSON_HEADERS,
      });
    }

    // Ostatní /api/* — 501.
    if (path.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'not_implemented' }), {
        status: 501,
        headers: JSON_HEADERS,
      });
    }

    // Sem by se kvůli `run_worker_first` patternům neměl dostat žádný request.
    return new Response('Not found', { status: 404 });
  },
};
