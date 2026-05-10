// src/audit/checks/discovery.js
//
// Fetch robots.txt + sitemap.xml — paralelně, mimo browser. Levné HTTP GETy.
// Nepokouší se sitemap parsovat plně, jen spočítat <loc> a validovat top-level
// XML strukturu.
//
// Vrací: { robots: {…}, sitemap: {…}, findings: [...] }

const FETCH_TIMEOUT_MS = 6000;
const SITEMAP_MAX_BYTES = 256 * 1024;   // ořežeme ~256 KB stačí pro počet
const URL_COUNT_HARD_CAP = 5000;

export async function checkDiscovery(siteUrl) {
  const origin = new URL(siteUrl).origin;

  const [robots, sitemap] = await Promise.all([
    fetchRobots(`${origin}/robots.txt`),
    fetchSitemap(`${origin}/sitemap.xml`),
  ]);

  // Pokud robots.txt deklaruje sitemap na jiné URL a /sitemap.xml chybí,
  // dofetchujeme tu, na kterou ukazuje robots.
  if (!sitemap.exists && robots.sitemapUrls.length > 0) {
    const robotsSitemap = await fetchSitemap(robots.sitemapUrls[0]);
    if (robotsSitemap.exists) {
      Object.assign(sitemap, robotsSitemap, { discoveredVia: 'robots.txt' });
    }
  }

  return {
    robots,
    sitemap,
    findings: buildDiscoveryFindings(robots, sitemap),
  };
}

async function fetchRobots(url) {
  const res = await safeFetch(url);
  if (!res || res.status >= 400) {
    return { exists: false, status: res?.status || 0, disallowAll: false, sitemapUrls: [] };
  }
  const text = (await res.text()).slice(0, 64 * 1024);

  // Globální Disallow: / pro * = totální zákaz indexace.
  // Hledáme pouze blok pro User-agent: *.
  const disallowAll = parseDisallowAll(text);

  // Sitemap: deklarace.
  const sitemapUrls = [];
  for (const line of text.split(/\r?\n/)) {
    const m = /^\s*sitemap\s*:\s*(\S+)/i.exec(line);
    if (m) sitemapUrls.push(m[1]);
    if (sitemapUrls.length >= 5) break;
  }

  return {
    exists: true,
    status: res.status,
    disallowAll,
    sitemapUrls,
    sizeBytes: text.length,
  };
}

function parseDisallowAll(text) {
  // Velmi jednoduchý parser — najdeme blok "User-agent: *" a v něm "Disallow: /".
  const lines = text.split(/\r?\n/).map((l) => l.split('#')[0].trim()).filter(Boolean);
  let inStarBlock = false;
  for (const line of lines) {
    const ua = /^user-agent\s*:\s*(.+)$/i.exec(line);
    if (ua) {
      inStarBlock = ua[1].trim() === '*';
      continue;
    }
    if (!inStarBlock) continue;
    const dis = /^disallow\s*:\s*(.*)$/i.exec(line);
    if (dis && dis[1].trim() === '/') return true;
  }
  return false;
}

async function fetchSitemap(url) {
  const res = await safeFetch(url);
  if (!res || res.status >= 400) {
    return { exists: false, status: res?.status || 0, urlCount: 0, kind: null, url };
  }
  // Cap velikost — některé velké e-shopy mají sitemap 10 MB.
  const reader = res.body?.getReader();
  if (!reader) {
    return { exists: false, status: res.status, urlCount: 0, kind: null, url };
  }
  let received = 0;
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.length;
    chunks.push(value);
    if (received >= SITEMAP_MAX_BYTES) {
      try { await reader.cancel(); } catch {}
      break;
    }
  }
  const buf = new Uint8Array(received);
  let offset = 0;
  for (const c of chunks) { buf.set(c, offset); offset += c.length; }
  const text = new TextDecoder('utf-8').decode(buf);

  // Index sitemap (sitemapindex) vs. urlset.
  const isIndex = /<sitemapindex[\s>]/i.test(text);
  const kind = isIndex ? 'index' : 'urlset';

  // Spočítat <loc> tagy. U sitemapindex je to počet child sitemap, u urlset
  // počet URL. Cap pro paranoiu (ddos / nelegitimní web).
  let urlCount = 0;
  const re = /<loc>/gi;
  while (re.exec(text) && urlCount < URL_COUNT_HARD_CAP) urlCount++;

  return {
    exists: true,
    status: res.status,
    kind,
    urlCount,
    truncated: received >= SITEMAP_MAX_BYTES,
    url,
  };
}

async function safeFetch(url) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      method: 'GET',
      headers: { 'user-agent': 'FakanAuditor/1.0 (+https://fakan.cz)' },
      redirect: 'follow',
      signal: ac.signal,
      cf: { cacheTtl: 0 },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function buildDiscoveryFindings(robots, sitemap) {
  const f = [];

  if (!robots.exists) {
    f.push({
      category: 'seo', severity: 'low',
      title: 'Web nemá soubor robots.txt',
      detail: 'Robots.txt řekne vyhledávačům, kam smějí, a kde najdou mapu webu (sitemap).',
      fix_hint: 'Vytvořit /robots.txt s minimálně dvěma řádky: User-agent: * a Sitemap: https://…/sitemap.xml',
      weight: 1,
    });
  } else if (robots.disallowAll) {
    f.push({
      category: 'seo', severity: 'critical',
      title: 'Robots.txt zakazuje celý web vyhledávačům',
      detail: 'V /robots.txt je "User-agent: * — Disallow: /". Google ani Seznam web nezaindexují.',
      fix_hint: 'Pokud to není testovací prostředí, řádek "Disallow: /" odstranit nebo nahradit konkrétními cestami.',
      weight: 5,
    });
  }

  if (!sitemap.exists) {
    f.push({
      category: 'seo', severity: 'low',
      title: 'Web nemá sitemap.xml',
      detail: 'Mapa webu pomáhá Googlu rychleji najít všechny stránky, hlavně u nových webů a u stránek bez interních odkazů.',
      fix_hint: 'Vygenerovat /sitemap.xml a odkázat na něj z robots.txt řádkem Sitemap: …',
      weight: 1,
    });
  } else if (sitemap.urlCount === 0) {
    f.push({
      category: 'seo', severity: 'medium',
      title: 'Sitemap.xml je prázdná',
      detail: 'Soubor existuje, ale neobsahuje žádné URL. Pro Google je k ničemu.',
      fix_hint: 'Sitemap musí obsahovat alespoň URL hlavních stránek. Většina CMS to umí vygenerovat sama.',
      weight: 2,
    });
  }

  return f;
}
