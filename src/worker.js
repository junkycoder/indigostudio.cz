// Indigo Studio — jeden Worker servuje statickou vizitku indigostudio.cz.
// Statiku drží asset binding (public/), Worker jen doplní bezpečnostní hlavičky.

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
};

export default {
  async fetch(request, env) {
    const res = await env.ASSETS.fetch(request);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
    return new Response(res.body, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  },
};
