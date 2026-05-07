// Free analýza — synchronní vlna.
// Cíl: TTFV ≤ 5 s. Streamuje výsledky přes SSE jakmile přijdou.
//
// Tok:
//  1. Validace URL.
//  2. fetch(target) s timeoutem.
//  3. Po response headers → emit status, headers, cookies (parallelizable).
//  4. Streamuj body do HTMLRewriter → emit meta, og, stack, trackers, banners.
//  5. emit done (nebo error kdykoli).

import {
  STACK_PATTERNS,
  TRACKER_PATTERNS,
  COOKIE_BANNER_PATTERNS,
  SECURITY_HEADERS,
  detectFromText,
} from './detectors.js';

const FETCH_TIMEOUT_MS = 8000;
const MAX_BODY_BYTES = 2_000_000; // 2 MB strop, ať nestáhneme něco šíleného
const USER_AGENT = 'Mozilla/5.0 (compatible; FakanAnalyzer/0.1; +https://fakan.cz/o-analyze)';

// Validace + normalizace URL. Vrací URL objekt nebo vyhodí Error.
export function normalizeUrl(input) {
  if (!input || typeof input !== 'string') {
    throw new Error('Chybí URL.');
  }
  let raw = input.trim();
  if (raw.length === 0) throw new Error('Chybí URL.');
  if (raw.length > 2048) throw new Error('URL je moc dlouhá.');

  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;

  let u;
  try {
    u = new URL(raw);
  } catch {
    throw new Error('Tohle není platná URL.');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new Error('Funguje jen http nebo https.');
  }
  if (!u.hostname || !u.hostname.includes('.')) {
    throw new Error('Hostname vypadá divně.');
  }
  // Žádný localhost / private IP — zabraňuje SSRF.
  if (isPrivateHost(u.hostname)) {
    throw new Error('Privátní adresy a localhost neanalyzujeme.');
  }
  return u;
}

function isPrivateHost(host) {
  const h = host.toLowerCase();
  if (h === 'localhost' || h.endsWith('.localhost') || h === '0.0.0.0') return true;
  // IPv4
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 0) return true;
  }
  // IPv6 lokální
  if (h.startsWith('[::1]') || h === '::1' || h.startsWith('[fc') || h.startsWith('[fd')) return true;
  return false;
}

// SSE writer pomocná struktura.
function makeSse() {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();
  let closed = false;

  async function send(event, data) {
    if (closed) return;
    const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    try {
      await writer.write(encoder.encode(payload));
    } catch {
      closed = true;
    }
  }

  async function close() {
    if (closed) return;
    closed = true;
    try {
      await writer.close();
    } catch {
      /* ignored */
    }
  }

  return { readable, send, close };
}

// Hlavní vstup do Worker handleru.
export function handleAnalyze(request) {
  const url = new URL(request.url);
  const target = url.searchParams.get('url');

  let parsed;
  try {
    parsed = normalizeUrl(target);
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }

  const sse = makeSse();
  const startedAt = Date.now();
  // Worker poznáme podle hostname příchozího requestu — abychom poznali self-fetch.
  const workerHost = url.hostname;

  // Spustíme analýzu, ale neblokujeme response. Tahle catch je poslední
  // záchrana — jakákoli neošetřená výjimka uvnitř runAnalysis musí pořád
  // vyprodukovat smysluplnou zprávu pro UI a něco do logu.
  runAnalysis(parsed, sse, startedAt, workerHost).catch(async (err) => {
    console.error('[analyze] unhandled', err);
    try {
      await sse.send('error', {
        message: `Analýza spadla na něčem, co jsme neošetřili (${describeError(err)}). Napiš nám, opravíme to.`,
        kind: err?.name || 'UnhandledError',
      });
    } catch { /* writer mohl být zavřený */ }
    await sse.close();
  });

  return new Response(sse.readable, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
      connection: 'keep-alive',
    },
  });
}

// Lidsky popíše error tak, aby byl k něčemu i bez `.message`.
function describeError(err) {
  if (err == null) return 'bez detailu';
  if (typeof err === 'string') return err.slice(0, 200);
  const name = err.name || err.constructor?.name || 'Error';
  const msg = typeof err.message === 'string' ? err.message.trim() : '';
  if (msg) return `${name}: ${truncate(msg, 200)}`;
  if (typeof err.code === 'string') return `${name}: ${err.code}`;
  return name;
}

function truncate(s, n) {
  if (typeof s !== 'string') return s;
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

async function runAnalysis(target, sse, startedAt, workerHost) {
  await sse.send('hello', {
    target: target.toString(),
    host: target.hostname,
    startedAt,
  });
  await sse.send('stage', { id: 'fetching', label: 'Stahuju tvůj web…' });

  // Self-fetch: Worker by stáhl sám sebe → na CF to často skončí
  // subrequest loopem nebo prázdnou odpovědí. Radši to řekneme rovnou.
  if (workerHost && hostsMatch(workerHost, target.hostname)) {
    await sse.send('error', {
      message: 'Tohle je náš vlastní web — Cloudflare Worker neumí čistě analyzovat sám sebe. Vyzkoušej to na jiné URL.',
      kind: 'SelfFetchRefused',
    });
    await sse.close();
    return;
  }

  let response;
  let networkError = null;
  const fetchStart = Date.now();
  try {
    response = await fetch(target.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        'user-agent': USER_AGENT,
        accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5',
        'accept-language': 'cs,en;q=0.7',
      },
    });
  } catch (err) {
    networkError = err;
  }
  const fetchMs = Date.now() - fetchStart;

  if (networkError) {
    await sse.send('error', {
      message: explainNetworkError(networkError, target),
      kind: networkError?.name || 'NetworkError',
    });
    await sse.close();
    return;
  }

  // Status & redirect.
  const finalUrl = response.url || target.toString();
  const wasRedirected = finalUrl !== target.toString();
  let isHttps = target.protocol === 'https:';
  try {
    isHttps = new URL(finalUrl).protocol === 'https:';
  } catch {
    /* ponecháme isHttps ze vstupní URL */
  }

  await sse.send('status', {
    status: response.status,
    statusText: response.statusText,
    finalUrl,
    redirected: wasRedirected,
    isHttps,
    fetchMs,
  });

  // Hlavičky — bezpečnostní + cookies + content-type + server.
  const headerInfo = analyzeHeaders(response.headers);
  await sse.send('headers', headerInfo);

  await sse.send('cookies', extractCookies(response.headers));

  // Když to není HTML, body neparsujeme.
  const ct = (response.headers.get('content-type') || '').toLowerCase();
  const isHtml = ct.includes('text/html') || ct.includes('application/xhtml') || ct === '';
  if (!isHtml) {
    await sse.send('body', { skipped: true, reason: `Content-Type: ${ct || 'neznámý'} — neparsujeme.` });
    await sse.send('done', { ok: true, totalMs: Date.now() - startedAt });
    await sse.close();
    return;
  }

  await sse.send('stage', { id: 'parsing', label: 'Koukám, co Google a sociální sítě uvidí…' });

  let body;
  try {
    body = await readLimited(response.body, MAX_BODY_BYTES);
  } catch (err) {
    await sse.send('error', { message: `Body nešlo přečíst: ${err.message}.`, kind: 'BodyError' });
    await sse.close();
    return;
  }

  const text = decode(body);
  const sizeBytes = body.byteLength;
  await sse.send('body', { sizeBytes, decoded: true });

  // Od tohohle bodu už máme HTML v paměti — chyby v parserech řešíme
  // izolovaně, ať jeden rozbitý regex nezabije celou analýzu.
  const meta = safeRun('parseMeta', () => parseMeta(text), emptyMeta());
  await sse.send('meta', meta);

  const stack = safeRun('stack', () => detectFromText(STACK_PATTERNS, text), []);
  const trackers = safeRun('trackers', () => detectFromText(TRACKER_PATTERNS, text), []);
  const banners = safeRun('banners', () => detectFromText(COOKIE_BANNER_PATTERNS, text), []);

  // Server hint do stack listu (často jen z hlavičky).
  if (headerInfo.serverHint) {
    stack.unshift({
      id: 'server-' + headerInfo.serverHint.toLowerCase().replace(/[^a-z0-9]+/g, ''),
      name: headerInfo.serverHint,
      severity: null,
      note: 'Detekováno z `Server` hlavičky.',
    });
  }

  await sse.send('stack', stack);
  await sse.send('trackers', trackers);
  await sse.send('banners', banners);

  // Score — ne klasický grade, jen indikátor.
  await sse.send('score', buildScore({ headerInfo, trackers, banners, meta, isHttps, status: response.status }));

  await sse.send('done', { ok: true, totalMs: Date.now() - startedAt });
  await sse.close();
}

// Network error → lidsky čitelná zpráva. Cloudflare fetch občas hází
// TypeError s chybovým řetězcem typu "Too many redirects.<chain>", který
// klientovi je k ničemu — proto si chyby cílíme na konkrétní jména.
function explainNetworkError(err, target) {
  const name = err?.name || '';
  const msgRaw = typeof err?.message === 'string' ? err.message : '';
  const msg = msgRaw.split(/[.\n]/)[0].trim(); // jen první věta, zbytek je často redirect chain

  if (name === 'TimeoutError' || name === 'AbortError') {
    return `Web neodpovídá do ${FETCH_TIMEOUT_MS / 1000} s. Možná je dole, nebo tě blokuje firewall.`;
  }
  if (/too many redirects/i.test(msgRaw)) {
    return 'Web se zacyklil v přesměrováních. Zkontroluj redirect pravidla.';
  }
  if (/certificate|ssl|tls/i.test(msgRaw)) {
    return `HTTPS certifikát ${target.hostname} se nepodařilo ověřit. ${msg || 'TLS handshake selhal'}.`;
  }
  if (/dns|getaddrinfo|enotfound/i.test(msgRaw)) {
    return `${target.hostname} nemá DNS záznam. Překlep, nebo doména neexistuje?`;
  }
  if (/refused|econnrefused/i.test(msgRaw)) {
    return `${target.hostname} odmítl spojení. Server běží?`;
  }
  if (/reset|econnreset/i.test(msgRaw)) {
    return `${target.hostname} resetoval spojení. Síťová klika?`;
  }
  if (msg) return `Nepodařilo se stáhnout web: ${truncate(msg, 160)}.`;
  if (name) return `Nepodařilo se stáhnout web (${name}).`;
  return 'Nepodařilo se stáhnout web. Detaily nejsou.';
}

// Hostname comparison s ignorováním www. a velkých písmen.
function hostsMatch(a, b) {
  if (!a || !b) return false;
  const norm = (h) => h.toLowerCase().replace(/^www\./, '');
  return norm(a) === norm(b);
}

// Spustí parser/detektor a při chybě vrátí fallback místo aby spadl celý stream.
function safeRun(label, fn, fallback) {
  try {
    return fn();
  } catch (err) {
    console.error(`[analyze] ${label} threw`, err);
    return fallback;
  }
}

function emptyMeta() {
  return {
    lang: null, title: null, titleLength: 0, description: null, descriptionLength: 0,
    viewport: null, robots: null, generator: null, themeColor: null, canonical: null, favicon: null,
    og: { title: null, description: null, image: null, type: null, siteName: null, url: null, locale: null },
    twitter: { card: null, title: null, image: null },
    jsonLdCount: 0, h1Count: 0,
  };
}

// Čte stream s tvrdým limitem v bajtech (zabrání DoS).
async function readLimited(stream, maxBytes) {
  if (!stream) return new Uint8Array(0);
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (total + value.byteLength > maxBytes) {
      const remaining = maxBytes - total;
      if (remaining > 0) chunks.push(value.subarray(0, remaining));
      total = maxBytes;
      try {
        await reader.cancel('size limit reached');
      } catch {
        /* ignored */
      }
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

// Decode bytes → string. Hledáme charset v meta nebo response headers, jinak utf-8.
function decode(bytes) {
  // Rychlá heuristika: peek prvních 1024 bajtů pro <meta charset>.
  let charset = 'utf-8';
  const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, Math.min(2048, bytes.byteLength)));
  const m = head.match(/<meta[^>]+charset\s*=\s*["']?([a-z0-9_-]+)/i);
  if (m) charset = m[1].toLowerCase();
  try {
    return new TextDecoder(charset, { fatal: false }).decode(bytes);
  } catch {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
}

function analyzeHeaders(headers) {
  const findings = [];
  let totalWeight = 0;
  let presentWeight = 0;
  for (const def of SECURITY_HEADERS) {
    const value = headers.get(def.header);
    let present = !!value;
    if (present && def.expectedValue && !value.toLowerCase().includes(def.expectedValue)) {
      present = false; // např. nosniff musí být v hodnotě
    }
    totalWeight += def.weight;
    if (present) presentWeight += def.weight;
    findings.push({
      id: def.id,
      name: def.name,
      header: def.header,
      present,
      value: value || null,
      note: def.note,
      weight: def.weight,
    });
  }
  return {
    securityScore: Math.round((presentWeight / totalWeight) * 100),
    headers: findings,
    server: headers.get('server') || null,
    poweredBy: headers.get('x-powered-by') || null,
    contentType: headers.get('content-type') || null,
    contentLength: headers.get('content-length') || null,
    serverHint: pickServerHint(headers),
  };
}

function pickServerHint(headers) {
  const server = (headers.get('server') || '').toLowerCase();
  const powered = (headers.get('x-powered-by') || '').toLowerCase();
  const combined = server + ' ' + powered;
  if (combined.includes('cloudflare')) return 'Cloudflare';
  if (combined.includes('netlify')) return 'Netlify';
  if (combined.includes('vercel')) return 'Vercel';
  if (combined.includes('nginx')) return 'nginx';
  if (combined.includes('apache')) return 'Apache';
  if (combined.includes('caddy')) return 'Caddy';
  if (combined.includes('iis')) return 'Microsoft IIS';
  if (combined.includes('php')) return 'PHP backend';
  return null;
}

function extractCookies(headers) {
  // Cloudflare Workers Headers podporuje getSetCookie() (Web standard).
  let raw = [];
  if (typeof headers.getSetCookie === 'function') {
    raw = headers.getSetCookie();
  } else {
    const single = headers.get('set-cookie');
    if (single) raw = [single];
  }
  const list = raw.map((line) => parseCookie(line));
  const trackingLike = list.filter((c) => looksLikeTracker(c.name));
  return {
    count: list.length,
    cookies: list,
    trackingLikeCount: trackingLike.length,
  };
}

function parseCookie(line) {
  const parts = line.split(';').map((s) => s.trim());
  const [nameValue, ...attrs] = parts;
  const eq = nameValue.indexOf('=');
  const name = eq >= 0 ? nameValue.slice(0, eq) : nameValue;
  const meta = { secure: false, httpOnly: false, sameSite: null, maxAge: null, expires: null, domain: null };
  for (const a of attrs) {
    const lower = a.toLowerCase();
    if (lower === 'secure') meta.secure = true;
    else if (lower === 'httponly') meta.httpOnly = true;
    else if (lower.startsWith('samesite=')) meta.sameSite = a.slice(9);
    else if (lower.startsWith('max-age=')) meta.maxAge = parseInt(a.slice(8), 10);
    else if (lower.startsWith('expires=')) meta.expires = a.slice(8);
    else if (lower.startsWith('domain=')) meta.domain = a.slice(7);
  }
  return { name, ...meta };
}

function looksLikeTracker(name) {
  const n = name.toLowerCase();
  return (
    n.startsWith('_ga') || n.startsWith('_gid') || n.startsWith('_gat') ||
    n.startsWith('_fbp') || n.startsWith('_fbc') ||
    n.startsWith('_hj') || n.startsWith('hubspotutk') ||
    n.startsWith('_pin_') || n.startsWith('_uet') ||
    n === 'fr' || n === 'tr' ||
    n.startsWith('sklik')
  );
}

// Velmi opatrný HTML meta parser. Workers HTMLRewriter by byl elegantnější,
// ale potřebujeme i kontext pro <script>/<noscript> bloky (kvůli detekci trackerů
// uvnitř inline JS). Body máme stejně v paměti, regex stačí.
export function parseMeta(html) {
  const lang = matchAttr(html, /<html[^>]*\blang\s*=\s*["']?([^"'\s>]+)/i);
  const title = stripTags(matchOne(html, /<title[^>]*>([\s\S]*?)<\/title>/i)) || null;
  const description = matchAttr(html, /<meta[^>]+name\s*=\s*["']?description["']?[^>]*content\s*=\s*["']([^"']*)["']/i);
  const viewport = matchAttr(html, /<meta[^>]+name\s*=\s*["']?viewport["']?[^>]*content\s*=\s*["']([^"']*)["']/i);
  const robots = matchAttr(html, /<meta[^>]+name\s*=\s*["']?robots["']?[^>]*content\s*=\s*["']([^"']*)["']/i);
  const generator = matchAttr(html, /<meta[^>]+name\s*=\s*["']?generator["']?[^>]*content\s*=\s*["']([^"']*)["']/i);
  const themeColor = matchAttr(html, /<meta[^>]+name\s*=\s*["']?theme-color["']?[^>]*content\s*=\s*["']([^"']*)["']/i);
  const canonical = matchAttr(html, /<link[^>]+rel\s*=\s*["']?canonical["']?[^>]*href\s*=\s*["']([^"']*)["']/i);
  const favicon = matchAttr(html, /<link[^>]+rel\s*=\s*["'][^"']*icon[^"']*["'][^>]*href\s*=\s*["']([^"']*)["']/i);

  // Open Graph
  const og = {
    title: matchAttr(html, /<meta[^>]+property\s*=\s*["']?og:title["']?[^>]*content\s*=\s*["']([^"']*)["']/i),
    description: matchAttr(html, /<meta[^>]+property\s*=\s*["']?og:description["']?[^>]*content\s*=\s*["']([^"']*)["']/i),
    image: matchAttr(html, /<meta[^>]+property\s*=\s*["']?og:image["']?[^>]*content\s*=\s*["']([^"']*)["']/i),
    type: matchAttr(html, /<meta[^>]+property\s*=\s*["']?og:type["']?[^>]*content\s*=\s*["']([^"']*)["']/i),
    siteName: matchAttr(html, /<meta[^>]+property\s*=\s*["']?og:site_name["']?[^>]*content\s*=\s*["']([^"']*)["']/i),
    url: matchAttr(html, /<meta[^>]+property\s*=\s*["']?og:url["']?[^>]*content\s*=\s*["']([^"']*)["']/i),
    locale: matchAttr(html, /<meta[^>]+property\s*=\s*["']?og:locale["']?[^>]*content\s*=\s*["']([^"']*)["']/i),
  };
  const twitter = {
    card: matchAttr(html, /<meta[^>]+name\s*=\s*["']?twitter:card["']?[^>]*content\s*=\s*["']([^"']*)["']/i),
    title: matchAttr(html, /<meta[^>]+name\s*=\s*["']?twitter:title["']?[^>]*content\s*=\s*["']([^"']*)["']/i),
    image: matchAttr(html, /<meta[^>]+name\s*=\s*["']?twitter:image["']?[^>]*content\s*=\s*["']([^"']*)["']/i),
  };

  // JSON-LD count (jen počet, parsing v async vlně)
  const jsonLdMatches = html.match(/<script[^>]+type\s*=\s*["']?application\/ld\+json["']?/gi);

  // h1 počet
  const h1Matches = html.match(/<h1\b[^>]*>/gi);

  return {
    lang,
    title,
    titleLength: title ? title.length : 0,
    description,
    descriptionLength: description ? description.length : 0,
    viewport,
    robots,
    generator,
    themeColor,
    canonical,
    favicon,
    og,
    twitter,
    jsonLdCount: jsonLdMatches ? jsonLdMatches.length : 0,
    h1Count: h1Matches ? h1Matches.length : 0,
  };
}

function matchOne(text, re) {
  const m = text.match(re);
  return m ? m[1] : null;
}
function matchAttr(text, re) {
  const v = matchOne(text, re);
  return v ? decodeEntities(v.trim()) : null;
}
function stripTags(s) {
  return s ? s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim() : s;
}
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

// Souhrnné skóre + verdikty pro UI. Hodnoty 0-100 + jednoslovní popis.
export function buildScore({ headerInfo, trackers, banners, meta, isHttps, status }) {
  const verdicts = [];

  if (status >= 200 && status < 300) {
    verdicts.push({ kind: 'ok', text: `Web odpovídá HTTP ${status}.` });
  } else {
    verdicts.push({ kind: 'warn', text: `Web vrátil HTTP ${status}. Něco není v pořádku.` });
  }

  if (!isHttps) {
    verdicts.push({ kind: 'crit', text: 'Není na HTTPS. Nezabezpečené.' });
  }

  const trackingHeavy = trackers.filter((t) => t.severity === 'high');
  if (trackingHeavy.length === 0) {
    verdicts.push({ kind: 'ok', text: 'Žádné agresivní trackery.' });
  } else {
    verdicts.push({
      kind: 'warn',
      text: `Najdeno ${trackingHeavy.length} ${trackingHeavy.length === 1 ? 'tracker' : trackingHeavy.length < 5 ? 'trackery' : 'trackerů'} vyžadujících souhlas.`,
    });
  }

  if (banners.length > 0) {
    verdicts.push({
      kind: 'warn',
      text: `Cookie banner: ${banners.map((b) => b.name).join(', ')}. U nás by nebyl potřeba.`,
    });
  }

  if (!meta.description) {
    verdicts.push({ kind: 'warn', text: 'Chybí meta description. Google si tě vymyslí sám.' });
  } else if (meta.descriptionLength < 60 || meta.descriptionLength > 200) {
    verdicts.push({ kind: 'info', text: `Meta description má ${meta.descriptionLength} znaků (ideál 80–160).` });
  }

  if (!meta.title) {
    verdicts.push({ kind: 'crit', text: 'Stránka nemá <title>.' });
  } else if (meta.titleLength > 65) {
    verdicts.push({ kind: 'info', text: `<title> má ${meta.titleLength} znaků, Google ho ořízne.` });
  }

  if (!meta.og.image) {
    verdicts.push({ kind: 'info', text: 'Chybí og:image. Sdílení na sítích vypadá smutně.' });
  }

  if (!meta.viewport) {
    verdicts.push({ kind: 'crit', text: 'Chybí viewport meta. Mobil neuvidí, co má.' });
  }

  if (meta.h1Count === 0) {
    verdicts.push({ kind: 'warn', text: 'Žádný <h1>. Pro SEO i přístupnost špatně.' });
  } else if (meta.h1Count > 1) {
    verdicts.push({ kind: 'info', text: `${meta.h1Count}× <h1>. Lepší jen jeden.` });
  }

  return {
    securityScore: headerInfo.securityScore,
    trackerCount: trackers.length,
    trackerHighCount: trackingHeavy.length,
    bannerCount: banners.length,
    verdicts,
  };
}
