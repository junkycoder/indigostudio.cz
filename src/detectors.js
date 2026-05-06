// Detekční pravidla pro stack / trackery / cookie banery / chat widgety.
// Pravidla se aplikují na: <meta generator>, src/href atributy, inline JS, text uvnitř <script>.
// Cíl: rychlá heuristika, ne stoprocentní detekce. Když pattern matchuje, přidáme značku.

export const STACK_PATTERNS = [
  // CMS / hosted website builders
  {
    id: 'wordpress',
    name: 'WordPress',
    note: 'Klasický CMS. Často s plugin balastem, fragile.',
    patterns: [/wp-content\//i, /wp-includes\//i, /content="WordPress/i],
  },
  {
    id: 'shopify',
    name: 'Shopify',
    note: 'Hosted e-shop platforma.',
    patterns: [/cdn\.shopify\.com/i, /Shopify\.theme/i, /__st\s*=\s*\{/i],
  },
  {
    id: 'webnode',
    name: 'Webnode',
    note: 'Hosted page builder. Závislost na vendoru, lock-in.',
    patterns: [/webnode\.(?:com|cz)/i, /content="Webnode/i],
  },
  {
    id: 'wix',
    name: 'Wix',
    note: 'Hosted page builder. Pomalý, lock-in.',
    patterns: [/static\.wixstatic\.com/i, /content="Wix\.com/i, /_wixCIDX/],
  },
  {
    id: 'squarespace',
    name: 'Squarespace',
    note: 'Hosted page builder.',
    patterns: [/static1\.squarespace\.com/i, /squarespace-cdn\.com/i],
  },
  {
    id: 'webflow',
    name: 'Webflow',
    note: 'Hosted page builder.',
    patterns: [/assets\.website-files\.com/i, /content="Webflow/i, /data-wf-page/i],
  },
  {
    id: 'ghost',
    name: 'Ghost',
    note: 'Self-hosted publishing platforma.',
    patterns: [/content="Ghost\s/i, /ghost-blog/i],
  },
  {
    id: 'drupal',
    name: 'Drupal',
    note: 'CMS, vyšší údržba.',
    patterns: [/content="Drupal\s/i, /sites\/default\/files\//i],
  },
  {
    id: 'joomla',
    name: 'Joomla',
    note: 'Starší CMS.',
    patterns: [/content="Joomla/i, /\/components\/com_/i],
  },
  {
    id: 'typo3',
    name: 'TYPO3',
    note: 'Enterprise CMS.',
    patterns: [/content="TYPO3/i, /typo3conf\//i],
  },
  // SPA frameworky
  {
    id: 'next',
    name: 'Next.js',
    note: 'React SPA / SSR. Často overkill pro statický web.',
    patterns: [/__NEXT_DATA__/i, /\/_next\/static\//i],
  },
  {
    id: 'nuxt',
    name: 'Nuxt',
    note: 'Vue SSR.',
    patterns: [/__NUXT__/i, /\/_nuxt\//i],
  },
  {
    id: 'gatsby',
    name: 'Gatsby',
    note: 'React static site generator.',
    patterns: [/___gatsby/i, /\/page-data\/.*\.json/i],
  },
  {
    id: 'astro',
    name: 'Astro',
    note: 'Moderní static site generator.',
    patterns: [/astro-island/i, /data-astro-/i, /content="Astro/i],
  },
  {
    id: 'sveltekit',
    name: 'SvelteKit',
    note: 'Svelte SSR / static.',
    patterns: [/__sveltekit_/i, /\/_app\/immutable\//i],
  },
  {
    id: 'react',
    name: 'React',
    note: 'JS framework. Bez SSR znamená delší TTFV.',
    patterns: [/react(?:-dom)?(?:\.production)?\.min\.js/i, /\bdata-reactroot\b/i, /\bdata-reactid\b/i],
  },
  {
    id: 'vue',
    name: 'Vue.js',
    note: 'JS framework.',
    patterns: [/vue(?:\.runtime)?(?:\.global)?(?:\.prod)?\.min\.js/i, /\bdata-v-app\b/i],
  },
  {
    id: 'angular',
    name: 'Angular',
    note: 'JS framework, často těžký.',
    patterns: [/\bng-version=/i, /\bng-cli\b/i],
  },
  {
    id: 'jquery',
    name: 'jQuery',
    note: 'Legacy. V 2026 už zbytečné.',
    patterns: [/\/jquery(?:[-.]?\d|\.min)?\.js/i],
  },
  {
    id: 'bootstrap',
    name: 'Bootstrap',
    note: 'Velký CSS framework.',
    patterns: [/\/bootstrap(?:[-.]?\d|\.min)?\.css/i, /\/bootstrap(?:\.min)?\.js/i],
  },
  // SSG bez tracker baggage
  {
    id: 'hugo',
    name: 'Hugo',
    note: 'Statický generator, lehký.',
    patterns: [/content="Hugo\s/i],
  },
  {
    id: 'jekyll',
    name: 'Jekyll',
    note: 'Statický generator.',
    patterns: [/content="Jekyll/i],
  },
  {
    id: 'eleventy',
    name: 'Eleventy',
    note: 'Statický generator.',
    patterns: [/content="Eleventy/i],
  },
];

export const TRACKER_PATTERNS = [
  // Google
  {
    id: 'ga4',
    name: 'Google Analytics 4',
    severity: 'high',
    note: 'Vyžaduje cookie souhlas v EU.',
    patterns: [/gtag\/js\?id=G-[A-Z0-9]+/i, /googletagmanager\.com\/gtag/i],
  },
  {
    id: 'ua',
    name: 'Google Analytics (Universal)',
    severity: 'high',
    note: 'Deprecated od července 2023, ale stále se objevuje.',
    patterns: [/google-analytics\.com\/analytics\.js/i, /ga\(\s*['"]create['"]/i, /UA-\d{4,}-\d+/],
  },
  {
    id: 'gtm',
    name: 'Google Tag Manager',
    severity: 'high',
    note: 'Container pro další trackery.',
    patterns: [/googletagmanager\.com\/gtm\.js/i, /GTM-[A-Z0-9]+/],
  },
  {
    id: 'gads',
    name: 'Google Ads / DoubleClick',
    severity: 'high',
    note: 'Reklamní tracking.',
    patterns: [/googleadservices\.com/i, /doubleclick\.net/i, /AW-\d{4,}/],
  },
  // Meta
  {
    id: 'fbpixel',
    name: 'Meta Pixel (Facebook)',
    severity: 'high',
    note: 'Reklamní tracking. Vyžaduje souhlas.',
    patterns: [/connect\.facebook\.net\/[^"']*\/fbevents\.js/i, /\bfbq\(\s*['"]init['"]/i, /facebook\.com\/tr\?/i],
  },
  // CZ-specific
  {
    id: 'sklik',
    name: 'Sklik (Seznam Ads)',
    severity: 'high',
    note: 'Český reklamní tracker.',
    patterns: [/c\.imedia\.cz\/js\/retargeting\.js/i, /seznam\.cz\/rc\.cgi/i],
  },
  {
    id: 'smartsupp',
    name: 'Smartsupp',
    severity: 'medium',
    note: 'Chat + tracking.',
    patterns: [/smartsuppchat\.com/i, /smartsupp\.com/i],
  },
  // Globální
  {
    id: 'hotjar',
    name: 'Hotjar',
    severity: 'high',
    note: 'Session recording. Heavy.',
    patterns: [/static\.hotjar\.com/i, /\bhj\(\s*['"]identify/i],
  },
  {
    id: 'hubspot',
    name: 'HubSpot',
    severity: 'high',
    note: 'Marketing tracking + chat.',
    patterns: [/js\.hs-scripts\.com/i, /js\.hsforms\.net/i, /js\.hubspot\.com/i],
  },
  {
    id: 'linkedin',
    name: 'LinkedIn Insight',
    severity: 'medium',
    note: 'B2B tracking.',
    patterns: [/snap\.licdn\.com\/li\.lms-analytics/i, /_linkedin_partner_id/i],
  },
  {
    id: 'twitter',
    name: 'X / Twitter Pixel',
    severity: 'medium',
    note: 'Reklamní tracking.',
    patterns: [/static\.ads-twitter\.com\/uwt\.js/i, /\btwq\(/i],
  },
  {
    id: 'pinterest',
    name: 'Pinterest Tag',
    severity: 'medium',
    patterns: [/s\.pinimg\.com\/ct\/core\.js/i, /\bpintrk\(/i],
  },
  {
    id: 'tiktok',
    name: 'TikTok Pixel',
    severity: 'medium',
    note: 'Reklamní tracking.',
    patterns: [/analytics\.tiktok\.com\/i18n\/pixel/i, /\bttq\.(?:track|page)/i],
  },
  {
    id: 'matomo',
    name: 'Matomo (self-hosted analytics)',
    severity: 'low',
    note: 'Často nastavené cookieless. Lepší než GA, ale stále tracker.',
    patterns: [/matomo\.js/i, /piwik\.js/i, /_paq\.push/i],
  },
  {
    id: 'plausible',
    name: 'Plausible',
    severity: 'low',
    note: 'Cookieless analytics. Bez problémů.',
    patterns: [/plausible\.io\/js\//i],
  },
  {
    id: 'cfwa',
    name: 'Cloudflare Web Analytics',
    severity: 'low',
    note: 'Cookieless. OK.',
    patterns: [/static\.cloudflareinsights\.com\/beacon/i],
  },
  {
    id: 'fathom',
    name: 'Fathom Analytics',
    severity: 'low',
    note: 'Cookieless. OK.',
    patterns: [/cdn\.usefathom\.com/i],
  },
];

export const COOKIE_BANNER_PATTERNS = [
  { id: 'cookiebot', name: 'Cookiebot', patterns: [/cookiebot\.com\//i, /CybotCookiebotDialog/i] },
  { id: 'onetrust', name: 'OneTrust', patterns: [/cookielaw\.org/i, /onetrust\.com/i] },
  { id: 'usercentrics', name: 'Usercentrics', patterns: [/usercentrics\.com/i, /\busercentrics\b/i] },
  { id: 'iubenda', name: 'Iubenda', patterns: [/iubenda\.com/i] },
  { id: 'cookieyes', name: 'CookieYes', patterns: [/cookieyes\.com/i] },
  { id: 'klaro', name: 'Klaro', patterns: [/kiprotect\.com\/klaro/i, /\bklaro-/i] },
  { id: 'cookiehub', name: 'CookieHub', patterns: [/cookiehub\.net/i] },
  { id: 'cookie-script', name: 'Cookie-Script', patterns: [/cookie-script\.com/i] },
  { id: 'cookieconsent', name: 'CookieConsent (osano)', patterns: [/cookieconsent\.osano\.com/i, /cookieconsent\.min\.js/i] },
  { id: 'orestbida', name: 'Cookieconsent (orestbida)', patterns: [/cookieconsent\.umd\.js/i, /vanilla-cookieconsent/i] },
];

// Aplikuje set patternů na text (HTML body, hlavičky, atd.) a vrátí seznam shod.
export function detectFromText(patternSet, text) {
  const hits = [];
  for (const item of patternSet) {
    if (item.patterns.some((re) => re.test(text))) {
      hits.push({
        id: item.id,
        name: item.name,
        severity: item.severity || null,
        note: item.note || null,
      });
    }
  }
  return hits;
}

// Bezpečnostní hlavičky, které kontrolujeme.
// Každá má `weight` v skóre (max součet = 100) a `note` pro UI.
export const SECURITY_HEADERS = [
  {
    id: 'hsts',
    header: 'strict-transport-security',
    name: 'HSTS',
    weight: 22,
    note: 'Vynutí HTTPS i pro budoucí návštěvy.',
  },
  {
    id: 'csp',
    header: 'content-security-policy',
    name: 'Content-Security-Policy',
    weight: 22,
    note: 'Zakáže injekci cizího skriptu.',
  },
  {
    id: 'xfo',
    header: 'x-frame-options',
    name: 'X-Frame-Options',
    weight: 14,
    note: 'Zabraňuje vložení do iframe (clickjacking).',
  },
  {
    id: 'xcto',
    header: 'x-content-type-options',
    name: 'X-Content-Type-Options',
    weight: 14,
    note: 'Brání MIME sniffing útokům.',
    expectedValue: 'nosniff',
  },
  {
    id: 'refpol',
    header: 'referrer-policy',
    name: 'Referrer-Policy',
    weight: 14,
    note: 'Kontroluje, kam se posílá referer.',
  },
  {
    id: 'permpol',
    header: 'permissions-policy',
    name: 'Permissions-Policy',
    weight: 14,
    note: 'Vypíná zbytečné browser API (kamera, geolokace…).',
  },
];
