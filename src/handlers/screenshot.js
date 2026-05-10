// src/handlers/screenshot.js
//
// GET /api/screenshot/{auditId}            — original mobil 390×844 (zpětná kompat)
// GET /api/screenshot/{auditId}/{kind}     — varianta z visual checks
//
// kind ∈ { mobile-portrait | mobile-landscape | desktop | mobile-dark }
//
// PROMPT past: alternativa k veřejnému R2 bucketu. R2 zůstává private,
// Worker přečte objekt a vrátí ho s ETag, aby browser uměl 304 Not Modified.

const ALLOWED_KINDS = new Set([
  'mobile-portrait',
  'mobile-landscape',
  'desktop',
  'mobile-dark',
]);

export async function handleScreenshot(request, env) {
  const parts = new URL(request.url).pathname.split('/').filter(Boolean);
  // Očekáváme ['api', 'screenshot', '{auditId}'] nebo ['api', 'screenshot', '{auditId}', '{kind}']
  const auditId = parts[2];
  const kind = parts[3] || null;

  if (!auditId || !/^[a-f0-9-]{36}$/i.test(auditId)) {
    return new Response('Bad audit id', { status: 400 });
  }
  if (kind !== null && !ALLOWED_KINDS.has(kind)) {
    return new Response('Bad kind', { status: 400 });
  }

  const key = kind
    ? `audits/${auditId}/shot-${kind}.jpg`
    : `audits/${auditId}/screenshot.jpg`;

  // Conditional GET — pokud klient pošle If-None-Match shodný s R2 etag, vrátit 304.
  const ifNoneMatch = request.headers.get('If-None-Match');
  const obj = await env.REPORTS.get(key, ifNoneMatch ? { onlyIf: { etagDoesNotMatch: ifNoneMatch } } : undefined);

  if (obj === null) {
    if (ifNoneMatch) return new Response(null, { status: 304, headers: { ETag: ifNoneMatch } });
    return new Response('Not found', { status: 404 });
  }

  return new Response(obj.body, {
    headers: {
      'content-type':  obj.httpMetadata?.contentType || 'image/jpeg',
      'etag':          obj.httpEtag,
      'cache-control': 'public, max-age=86400, immutable',
    },
  });
}
