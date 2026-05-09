// Worker entry pro fakan-cz landing.
// Per `[assets]` v wrangler.toml + `run_worker_first = ["/odhlasit*"]`
// se sem dostane pouze opt-out request. Ostatní statiku (index.html, …)
// servíruje Cloudflare assets binding přímo.
//
// Form pro audit posílá z prohlížeče POST přímo na https://api.fakan.cz/api/audit
// (auditor-worker), tady ho neřešíme — žádný /api/* endpoint.

import { handleOptout } from './optout.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/odhlasit' || path.startsWith('/odhlasit/')) {
      return handleOptout(request, env, ctx);
    }

    return new Response('Not found', { status: 404 });
  },
};
