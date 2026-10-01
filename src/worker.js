// Indigo Studio — jeden Worker servuje statickou vizitku indigostudio.cz
// a obsluhuje poptávkový formulář (POST /api/poptavka → e-mail přes Email Routing).

import { EmailMessage } from "cloudflare:email";
import { handleStatusboard } from "./statusboard.js";
import { handleOdber } from "./odber.js";
import toolsPage from "./tools.page.html";
import { TOOL_BY_HOST, TOOL_CATALOG, TOOLS } from "./tools-data.js";
import czechRepublicPage from "./ceska-republika.page.html";
import { DIRECTORY, DIRECTORY_COUNT } from "./ceska-republika-data.js";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
};

// Náhledy lze vložit výhradně do přehledu nástrojů Indigo Studio.
const EMBED_HEADERS = { ...SECURITY_HEADERS, "Content-Security-Policy": "frame-ancestors https://nastroje.indigostudio.cz" };
delete EMBED_HEADERS["X-Frame-Options"];
EMBED_HEADERS["X-Robots-Tag"] = "noindex, follow";

// odesílatel — adresa v naší doméně, ověřená v Resendu (DKIM)
const MAIL_FROM = "poptavka@indigostudio.cz";
// příjemce poptávek přes Resend — reálná schránka v Zoho
const MAIL_TO = "info@indigostudio.cz";
// fallback příjemce pro Cloudflare send_email — musí být ověřená destinace v Email Routingu
const MAIL_TO_FALLBACK = "hromada.dan@gmail.com";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Veřejný rozcestník českých online služeb žije na vlastní subdoméně.
    if (url.hostname === "ceska-republika.indigostudio.cz") {
      if (url.pathname === "/" || url.pathname === "/index.html") {
        const html = czechRepublicPage
          .replace("__EMBED_CLASS__", url.searchParams.get("embed") === "1" ? "embed" : "")
          .replace("__COUNT__", String(DIRECTORY_COUNT))
          .replace("__CATEGORY_COUNT__", String(DIRECTORY.length))
          .replace("__NAV__", renderDirectoryNavigation())
          .replace("__STRUCTURED_DATA__", directoryStructuredData())
          .replace("__SECTIONS__", renderDirectorySections());
        return new Response(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            ...(url.searchParams.get("embed") === "1" ? EMBED_HEADERS : SECURITY_HEADERS),
          },
        });
      }
      if (url.pathname === "/robots.txt") {
        return siteRobots(url.hostname);
      }
      if (url.pathname === "/sitemap.xml") {
        return siteSitemap(url.hostname);
      }
      if (!["/ceska-republika/style.css", "/ceska-republika/app.js", "/favicon.svg", "/apple-touch-icon.png"].includes(url.pathname) && !url.pathname.startsWith("/tools/fonts/")) {
        return new Response("Stránka nenalezena.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
      const res = await env.ASSETS.fetch(request);
      const headers = new Headers(res.headers);
      for (const [key, value] of Object.entries(SECURITY_HEADERS)) headers.set(key, value);
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    }

    // Každý veřejný nástroj má vlastní subdoménu, stránku a metadata.
    const tool = TOOL_BY_HOST.get(url.hostname);
    if (tool) {
      if (url.pathname === "/" || url.pathname === "/index.html") {
        const description = tool.slug === "nastroje" ? `${TOOLS.length} online nástrojů a služeb Indigo Studio s interaktivními náhledy.` : tool.description;
        const html = toolsPage
          .replaceAll("__TITLE__", escapeHtml(tool.title))
          .replaceAll("__DESCRIPTION__", escapeHtml(description))
          .replace("__EMBED_CLASS__", url.searchParams.get("embed") === "1" ? "embed" : "")
          .replace("__CATALOG__", tool.slug === "nastroje" ? renderToolCatalog() : "")
          .replace("__CATALOG_NAV__", tool.slug === "nastroje" ? renderToolNav() : "")
          .replaceAll("__OG_IMAGE__", `https://indigostudio.cz/tools/og/${tool.slug}.png`)
          .replaceAll("__OG_ALT__", escapeHtml(`${tool.title} — online nástroj Indigo Studio`))
          .replace("__STRUCTURED_DATA__", structuredData(tool, description))
          .replaceAll("__SLUG__", tool.slug);
        return new Response(html, {
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "public, max-age=300",
            ...(url.searchParams.get("embed") === "1" ? EMBED_HEADERS : SECURITY_HEADERS),
          },
        });
      }
      if (tool.slug === "prevody-men" && url.pathname === "/api/kurzy") {
        return getExchangeRates();
      }
      if (url.pathname === "/robots.txt") {
        return siteRobots(url.hostname);
      }
      if (url.pathname === "/sitemap.xml") {
        return siteSitemap(url.hostname);
      }
      if (!["/tools/app.js", "/tools/style.css", "/tools/qr.js", "/tools/exif.js", "/tools/js-yaml.js", "/favicon.svg", "/apple-touch-icon.png"].includes(url.pathname) && !url.pathname.startsWith("/tools/fonts/")) {
        return new Response("Stránka nenalezena.", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
      }
      const res = await env.ASSETS.fetch(request);
      const headers = new Headers(res.headers);
      for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    }

    // Statusboard mBlue žije na vlastní subdoméně a je celý za přihlášením.
    // Na apexu ho schválně nespouštíme — jedna adresa, jedno místo.
    if (url.hostname === "mblue.indigostudio.cz") {
      if (url.pathname === "/" || url.pathname === "") {
        return Response.redirect(new URL("/statusboard", url.origin), 302);
      }
      return handleStatusboard(request, env, url);
    }

    // Web Editor se odstěhoval na vlastní doménu. Stará adresa jen přesměruje
    // se zachovanou cestou — starší buildy appky a opsané odkazy na ni vedou
    // dál a nový web si staré cesty (/soukromi, /stahnout/…) přeloží sám.
    if (url.hostname === "weed.indigostudio.cz") {
      return Response.redirect(`https://webeditor.click${url.pathname}${url.search}`, 301);
    }

    // odběr novinek o školeních (double opt-in, D1 + Resend)
    if (url.pathname === "/api/odber" || url.pathname.startsWith("/api/odber/")) {
      return handleOdber(request, env, url);
    }

    if (url.pathname === "/api/poptavka") {
      if (request.method !== "POST") return json({ error: "Method Not Allowed" }, 405);
      return handlePoptavka(request, env);
    }

    // /rampa byla nahrazena článkem /cookies — starý odkaz (i z rozeslaného mailu)
    // trvale přesměruj na aktuální obsah.
    if (url.pathname === "/rampa" || url.pathname === "/rampa/" || url.pathname === "/rampa.html") {
      return Response.redirect(new URL("/cookies", url.origin), 301);
    }

    // Klientský PoC má vlastní stránku; HTML asset se servíruje interně jako TXT,
    // aby ho automatická kanonizace Cloudflare neposílala zpět do smyčky.
    if (url.pathname === "/lada-poc") {
      return Response.redirect(new URL("/lada-poc/", url.origin), 307);
    }

    let assetRequest = request;
    const isLadaPoc = url.pathname === "/lada-poc/";
    if (isLadaPoc) {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = "/lada-poc/page.txt";
      assetRequest = new Request(assetUrl, request);
    }

    // statika + bezpečnostní hlavičky
    const res = await env.ASSETS.fetch(assetRequest);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
    if (isLadaPoc) headers.set("Content-Type", "text/html; charset=utf-8");
    return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
  },
};

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function siteRobots(hostname) {
  return new Response(`User-agent: *\nAllow: /\n\nSitemap: https://${hostname}/sitemap.xml\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS },
  });
}

function siteSitemap(hostname) {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://${hostname}/</loc></url></urlset>`, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=86400", ...SECURITY_HEADERS },
  });
}

const CATALOG_NAMES = new Map([...TOOLS.map(([slug, title]) => [slug, title]), ["ceska-republika", "Česká republika"]]);

function renderToolCatalog() {
  return TOOL_CATALOG.map(([group, slugs]) => `<section class="catalog-section"><h2>${escapeHtml(group)}</h2><div class="catalog-grid">${slugs.map(slug => {
    const title = CATALOG_NAMES.get(slug);
    const url = `https://${slug}.indigostudio.cz/`;
    return `<article class="catalog-card" id="${slug}"><div class="catalog-card-head"><h3>${escapeHtml(title)}</h3><a href="${url}" aria-label="Otevřít ${escapeHtml(title)} samostatně">Otevřít <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 15 15 5M8 5h7v7"/></svg></a></div><iframe src="${url}?embed=1" title="${escapeHtml(title)} — živý náhled" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="clipboard-write; bluetooth; autoplay" sandbox="allow-scripts allow-same-origin allow-forms allow-downloads"></iframe></article>`;
  }).join("")}</div></section>`).join("");
}

// Svislá lišta pro rychlý přesun mezi kartami; skupiny odděluje mezera.
function renderToolNav() {
  return `<nav class="rail" aria-label="Rychlá navigace mezi nástroji"><ol>${TOOL_CATALOG.map(([group, slugs]) => `<li><ol aria-label="${escapeHtml(group)}">${slugs.map(slug => `<li><a href="#${slug}"><span>${escapeHtml(CATALOG_NAMES.get(slug))}</span></a></li>`).join("")}</ol></li>`).join("")}</ol></nav>`;
}

function structuredData(tool, description) {
  const url = `https://${tool.slug}.indigostudio.cz/`;
  const publisher = { "@type": "Organization", name: "Indigo Studio", url: "https://indigostudio.cz/" };
  const data = tool.slug === "nastroje" ? {
    "@context": "https://schema.org", "@type": "CollectionPage", name: tool.title, description, url,
    inLanguage: "cs-CZ", publisher,
    mainEntity: { "@type": "ItemList", itemListElement: TOOL_CATALOG.flatMap(([, slugs]) => slugs).map((slug, index) => ({
      "@type": "ListItem", position: index + 1, name: slug === "ceska-republika" ? "Česká republika" : TOOLS.find(item => item[0] === slug)?.[1], url: `https://${slug}.indigostudio.cz/`,
    })) },
  } : {
    "@context": "https://schema.org", "@type": "WebApplication", name: tool.title, description, url,
    inLanguage: "cs-CZ", browserRequirements: "Moderní webový prohlížeč", applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web", isAccessibleForFree: true, offers: { "@type": "Offer", price: "0", priceCurrency: "CZK" }, publisher,
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function directoryStructuredData() {
  const data = {
    "@context": "https://schema.org", "@type": "CollectionPage", name: "Česká republika — rozcestník online služeb",
    description: "Odkazy na české úřady, zdravotní a komerční pojišťovny, dopravu, operátory a streamovací služby.",
    url: "https://ceska-republika.indigostudio.cz/", inLanguage: "cs-CZ",
    publisher: { "@type": "Organization", name: "Indigo Studio", url: "https://indigostudio.cz/" },
    mainEntity: { "@type": "ItemList", itemListElement: DIRECTORY.flatMap(section => section.items).map(([name, url], index) => ({
      "@type": "ListItem", position: index + 1, name, url,
    })) },
  };
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function renderDirectoryNavigation() {
  return `<ul>${DIRECTORY.map(section => `<li data-nav-id="${escapeHtml(section.id)}"><a href="#${escapeHtml(section.id)}">${escapeHtml(section.title)}</a></li>`).join("")}</ul>`;
}

function renderDirectorySections() {
  const arrow = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19 19 5M8 5h11v11"/></svg>';
  return DIRECTORY.map(section => {
    const items = section.items.map(([name, href, description]) => {
      const domain = new URL(href).hostname.replace(/^www\./, "");
      return `<a class="service" href="${escapeHtml(href)}"><span><strong>${escapeHtml(name)}</strong><em>${escapeHtml(description)}</em><small>${escapeHtml(domain)}</small></span>${arrow}</a>`;
    }).join("");
    return `<section class="directory-section" id="${escapeHtml(section.id)}" aria-labelledby="${escapeHtml(section.id)}-title"><div class="section-head"><div><h2 id="${escapeHtml(section.id)}-title">${escapeHtml(section.title)}</h2><p>${escapeHtml(section.intro)}</p></div><small>${section.items.length} odkazů</small></div><div class="service-list">${items}</div></section>`;
  }).join("");
}

// ECB vydává referenční kurzy v pracovní dny. Krátká cache šetří požadavky.
async function getExchangeRates() {
  try {
    const response = await fetch("https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml");
    if (!response.ok) throw new Error("ECB nedostupná");
    const xml = await response.text();
    const date = xml.match(/time=['"]([^'"]+)['"]/i)?.[1];
    const rates = { EUR: 1 };
    for (const match of xml.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([0-9.]+)['"]/g)) {
      rates[match[1]] = Number(match[2]);
    }
    if (!date || !rates.CZK || !rates.USD) throw new Error("Neplatná data ECB");
    return new Response(JSON.stringify({ date, rates }), {
      headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=3600", ...SECURITY_HEADERS },
    });
  } catch (error) {
    console.error("ECB rates:", error?.message || error);
    return json({ error: "Kurzy se nyní nepodařilo načíst." }, 503);
  }
}

async function handlePoptavka(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Neplatný požadavek." }, 400);
  }

  // honeypot — bot vyplní skryté pole; tváříme se, že je odesláno
  if (body && typeof body.company === "string" && body.company.trim() !== "") {
    return json({ ok: true });
  }

  const name = String(body?.name ?? "").trim().slice(0, 100);
  const email = String(body?.email ?? "").trim().replace(/[\r\n]/g, "").slice(0, 200);
  const message = String(body?.message ?? "").trim().slice(0, 5000);

  if (!name || !email || !message) return json({ error: "Vyplňte prosím jméno, e-mail i zprávu." }, 400);
  if (!EMAIL_RE.test(email)) return json({ error: "Zadejte prosím platný e-mail." }, 400);

  const ip = request.headers.get("CF-Connecting-IP") || "neznámá";

  try {
    // primární cesta: Resend HTTP API (nezávislé na MX → funguje i když poštu drží Zoho)
    if (env.RESEND_API_KEY) {
      await sendViaResend(env.RESEND_API_KEY, { name, email, message, ip });
    } else {
      // fallback: Cloudflare send_email binding na ověřenou destinaci v Email Routingu
      const raw = buildEmail({ name, email, message, ip, to: MAIL_TO_FALLBACK });
      await env.SEB.send(new EmailMessage(MAIL_FROM, MAIL_TO_FALLBACK, raw));
    }
  } catch (err) {
    console.log("poptavka send error:", err && err.message);
    return json({ error: "Odeslání se nezdařilo. Napište prosím na info@indigostudio.cz." }, 502);
  }

  return json({ ok: true });
}

// --- odeslání přes Resend (https://resend.com) ---
async function sendViaResend(apiKey, { name, email, message, ip }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `Indigo Studio <${MAIL_FROM}>`,
      to: [MAIL_TO],
      reply_to: `${name.replace(/[\r\n]/g, "")} <${email}>`,
      subject: buildSubject(name),
      text: buildText({ name, email, message, ip }),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${detail.slice(0, 300)}`);
  }
}

// --- text zprávy (sdílí Resend i CF fallback) ---
function buildSubject(name) {
  return `Poptávka z webu — ${name}`;
}

function buildText({ name, email, message, ip }) {
  return (
    `Nová poptávka z indigostudio.cz\n\n` +
    `Jméno:  ${name}\n` +
    `E-mail: ${email}\n\n` +
    `Zpráva:\n${message}\n\n` +
    `—\nOdesláno z webového formuláře, IP: ${ip}\n`
  );
}

// --- sestavení RFC822 zprávy pro CF send_email (UTF-8 bezpečně přes base64) ---
function buildEmail({ name, email, message, ip, to }) {
  const subject = buildSubject(name);
  const text = buildText({ name, email, message, ip });

  const headers = [
    `From: Indigo Studio <${MAIL_FROM}>`,
    `To: ${to}`,
    `Reply-To: ${name.replace(/[\r\n]/g, "")} <${email}>`,
    `Subject: =?UTF-8?B?${b64Utf8(subject)}?=`,
    `Message-ID: <${crypto.randomUUID()}@indigostudio.cz>`,
    `Date: ${new Date().toUTCString()}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    `Content-Transfer-Encoding: base64`,
  ];

  return headers.join("\r\n") + "\r\n\r\n" + wrap76(b64Utf8(text)) + "\r\n";
}

function b64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function wrap76(s) {
  return s.replace(/.{1,76}/g, "$&\r\n").replace(/\r\n$/, "");
}
