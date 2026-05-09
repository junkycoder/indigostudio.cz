// src/audit/checks/seo.js
export async function checkSeo(page) {
  return await page.evaluate(() => {
    const get = (sel, attr = 'content') =>
      document.querySelector(sel)?.getAttribute(attr) || null;
    return {
      title:           document.title || null,
      metaDescription: get('meta[name="description"]'),
      ogTitle:         get('meta[property="og:title"]'),
      ogImage:         get('meta[property="og:image"]'),
      canonical:       get('link[rel="canonical"]', 'href'),
      lang:            document.documentElement.lang || null,
      h1Count:         document.querySelectorAll('h1').length,
      imgWithoutAlt:   [...document.querySelectorAll('img')].filter(i => !i.alt).length,
    };
  });
}
