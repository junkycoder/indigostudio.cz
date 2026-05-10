// src/lib/html-sanitize.js
//
// Sanitizace HTML/CSS výstupu z Claude Vision přes Cloudflare HTMLRewriter.
// Cíl: žádný JS run, žádné externí načítání kromě HTTPS images, žádné iframy.
//
// Klient si HTML stáhne a může ho nasadit. Pokud Claude vyplivl něco zlého
// (instrukce v briefu navedly model k inline JS), tahle vrstva to sundá.

const DROP_TAGS = ['script', 'iframe', 'object', 'embed', 'meta'];
const URL_ATTRS = ['href', 'src', 'action', 'formaction', 'srcset', 'xlink:href'];

// Vrátí Promise<string> s vyčištěným HTML.
export async function sanitizeHtml(rawHtml) {
  if (!rawHtml || typeof rawHtml !== 'string') return '';

  // Odstranit Claude wrappery typu ```html ... ```
  const stripped = stripCodeFences(rawHtml.trim());

  // HTMLRewriter chce Response. Zabalíme string a streamovaně transformujeme.
  let rewriter = new HTMLRewriter();

  for (const tag of DROP_TAGS) {
    rewriter = rewriter.on(tag, { element(el) { el.remove(); } });
  }

  rewriter = rewriter
    .on('a, link, area, base, form, button, img, source, video, audio, track', {
      element(el) {
        for (const name of URL_ATTRS) {
          const v = el.getAttribute(name);
          if (v && /^\s*javascript:/i.test(v)) el.removeAttribute(name);
          if (v && /^\s*data:text\/html/i.test(v)) el.removeAttribute(name);
        }
      },
    })
    .on('link', {
      element(el) {
        // Externí stylesheet jen z HTTPS (preferujeme inline <style>)
        const rel = (el.getAttribute('rel') || '').toLowerCase();
        if (rel.includes('stylesheet')) {
          const href = el.getAttribute('href') || '';
          if (!/^https:\/\//.test(href)) el.remove();
        }
      },
    })
    .on('*', {
      element(el) {
        // Odstranit on*= handlery (onclick, onload, …) — case-insensitive.
        for (const [name] of el.attributes) {
          if (/^on/i.test(name)) el.removeAttribute(name);
          // Odstranit style="…javascript:…"
          if (name.toLowerCase() === 'style') {
            const v = el.getAttribute('style') || '';
            if (/javascript:|expression\(/i.test(v)) el.removeAttribute('style');
          }
        }
      },
    });

  const cleaned = await rewriter.transform(
    new Response(stripped, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
  ).text();

  return cleaned;
}

function stripCodeFences(s) {
  // Odstraní ```html nebo ``` v prvním řádku a ``` v posledním (Claude občas přidá).
  return s
    .replace(/^```(?:html|HTML)?\s*\n/, '')
    .replace(/\n```\s*$/, '');
}
