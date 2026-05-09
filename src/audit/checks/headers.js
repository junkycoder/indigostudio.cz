// src/audit/checks/headers.js
export async function checkHeaders(url) {
  let resp;
  try {
    resp = await fetch(url, { method: 'HEAD', redirect: 'follow', cf: { cacheTtl: 0 } });
  } catch { return { https: false, hsts: false, csp: false }; }

  const h = resp.headers;
  return {
    https:   url.startsWith('https://'),
    hsts:   !!h.get('strict-transport-security'),
    csp:    !!h.get('content-security-policy'),
    xfo:    !!h.get('x-frame-options') || /frame-ancestors/i.test(h.get('content-security-policy') || ''),
    server: h.get('server') || null,
  };
}
