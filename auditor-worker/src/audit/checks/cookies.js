// src/audit/checks/cookies.js
// Detekuje cookie banner + třetí-stranové trackery na základě DOMu a network logu.

const TRACKER_HOSTS = [
  'google-analytics.com', 'googletagmanager.com', 'facebook.net', 'connect.facebook.net',
  'doubleclick.net', 'hotjar.com', 'clarity.ms', 'sklik.cz', 'seznam.cz/d',
];

const BANNER_KEYWORDS = [
  'souhlas', 'cookie', 'gdpr', 'akceptov', 'přijmout všechny',
  'rozumím', 'consent',
];

export async function detectCookies(page, cookieLog) {
  const trackers = new Set();
  for (const c of cookieLog) {
    try {
      const host = new URL(c.url).hostname;
      for (const t of TRACKER_HOSTS) if (host.includes(t)) trackers.add(t);
    } catch {}
  }

  const banner = await page.evaluate((kw) => {
    const text = document.body?.innerText?.toLowerCase().slice(0, 5000) || '';
    return kw.some(k => text.includes(k));
  }, BANNER_KEYWORDS);

  return {
    cookieBannerDetected: !!banner,
    thirdPartyTrackers: [...trackers],
    cookiesSetBeforeConsent: cookieLog.length,
  };
}
