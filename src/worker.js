// Indigo Studio — jeden Worker servuje statickou vizitku indigostudio.cz
// a obsluhuje poptávkový formulář (POST /api/poptavka → e-mail přes Email Routing).

import { EmailMessage } from "cloudflare:email";

const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
};

// odesílatel (adresa v naší zóně) a příjemce (ověřená destinace v Email Routingu)
const MAIL_FROM = "poptavka@indigostudio.cz";
const MAIL_TO = "hromada.dan@gmail.com";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/poptavka") {
      if (request.method !== "POST") return json({ error: "Method Not Allowed" }, 405);
      return handlePoptavka(request, env);
    }

    // statika + bezpečnostní hlavičky
    const res = await env.ASSETS.fetch(request);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(SECURITY_HEADERS)) headers.set(k, v);
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
  const raw = buildEmail({ name, email, message, ip });

  try {
    await env.SEB.send(new EmailMessage(MAIL_FROM, MAIL_TO, raw));
  } catch (err) {
    console.log("send_email error:", err && err.message);
    return json({ error: "Odeslání se nezdařilo. Napište prosím na info@indigostudio.cz." }, 502);
  }

  return json({ ok: true });
}

// --- sestavení RFC822 zprávy (UTF-8 bezpečně přes base64) ---
function buildEmail({ name, email, message, ip }) {
  const subject = `Poptávka z webu — ${name}`;
  const text =
    `Nová poptávka z indigostudio.cz\n\n` +
    `Jméno:  ${name}\n` +
    `E-mail: ${email}\n\n` +
    `Zpráva:\n${message}\n\n` +
    `—\nOdesláno z webového formuláře, IP: ${ip}\n`;

  const headers = [
    `From: Indigo Studio <${MAIL_FROM}>`,
    `To: ${MAIL_TO}`,
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
