// src/lib/cors.js
// CORS — POST formulář jde z fakan.cz, frontend reportu z audit.fakan.cz.

const ALLOWED_ORIGINS = new Set([
  'https://fakan.cz',
  'https://www.fakan.cz',
  'https://audit.fakan.cz',
]);

export function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allow  = ALLOWED_ORIGINS.has(origin) ? origin : 'https://fakan.cz';
  return {
    'Access-Control-Allow-Origin':  allow,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age':       '86400',
    'Vary':                         'Origin',
  };
}

export function withCors(response, request) {
  const headers = new Headers(response.headers);
  for (const [k, v] of Object.entries(corsHeaders(request))) headers.set(k, v);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
