export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // API routes — zatim stub
    if (url.pathname.startsWith('/api/')) {
      return new Response(JSON.stringify({ error: 'not_implemented' }), {
        status: 501,
        headers: { 'content-type': 'application/json' },
      });
    }

    // Staticke soubory servuje Cloudflare automaticky
    return new Response('Not found', { status: 404 });
  },
};
