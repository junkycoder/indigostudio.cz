// Indigo Studio — jeden Worker servuje statickou vizitku indigostudio.cz
// a obsluhuje poptávkový formulář (POST /api/poptavka → e-mail přes Email Routing).

import { EmailMessage } from "cloudflare:email";
import { handleStatusboard } from "./statusboard.js";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
};

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

    // Statusboard mBlue žije na vlastní subdoméně a je celý za přihlášením.
    // Na apexu ho schválně nespouštíme — jedna adresa, jedno místo.
    if (url.hostname === "mblue.indigostudio.cz") {
      if (url.pathname === "/" || url.pathname === "") {
        return Response.redirect(new URL("/statusboard", url.origin), 302);
      }
      return handleStatusboard(request, env, url);
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
