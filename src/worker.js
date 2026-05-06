// Worker entry — routuje API requesty, statiku servíruje Cloudflare automaticky.
import { handleAnalyze } from './analyze.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/analyze') {
      if (request.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
          status: 405,
          headers: { 'content-type': 'application/json; charset=utf-8', allow: 'GET' },
        });
      }
      return handleAnalyze(request);
    }

    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'not_implemented' }), {
        status: 501,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }

    // Statika je servována Cloudflare assets, sem se requesty nedostanou.
    return new Response('Not found', { status: 404 });
  },
};
