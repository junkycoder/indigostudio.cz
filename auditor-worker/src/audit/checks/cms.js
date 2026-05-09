// src/audit/checks/cms.js
// Lehká fingerprint detekce. Pro plnou knihovnu: webappanalyzer / wappalyzer.

const FINGERPRINTS = [
  { cms: 'wordpress', re: [/\/wp-content\//i, /\/wp-includes\//i, /name="generator"\s+content="WordPress\s+([\d.]+)/i] },
  { cms: 'shoptet',   re: [/shoptet\.cdn\./i, /shoptet\.cz/i] },
  { cms: 'wix',       re: [/static\.wixstatic\.com/i, /name="generator"\s+content="Wix/i] },
  { cms: 'webnode',   re: [/webnode\.cz/i, /webnode\.com/i] },
  { cms: 'squarespace', re: [/static1\.squarespace\.com/i] },
  { cms: 'webflow',   re: [/webflow\.com\/.*\.js/i, /data-wf-page/i] },
  { cms: 'next.js',   re: [/_next\/static\//i] },
  { cms: 'astro',     re: [/astro-island/i] },
];

export async function detectCms(page, response) {
  const html = await page.content();
  for (const fp of FINGERPRINTS) {
    for (const re of fp.re) {
      const m = html.match(re);
      if (m) {
        const version = m[1] || null;
        return {
          cms: fp.cms,
          version,
          outdated: fp.cms === 'wordpress' && version && parseFloat(version) < 6.5,
        };
      }
    }
  }
  const generator = await page.$eval('meta[name="generator"]', el => el.content).catch(() => null);
  return { cms: generator || 'unknown', version: null, outdated: false };
}
