// src/handlers/report.js
// GET /audit/{token}  — veřejná stránka s výsledky auditu (HTML)
// GET /audit/{token}/data  — JSON pro frontend

export async function handleReport(request, env) {
  const url     = new URL(request.url);
  const parts   = url.pathname.split('/').filter(Boolean);
  const token   = parts[1];
  const isJson  = parts[2] === 'data';
  if (!token) return new Response('Bad token', { status: 400 });

  const audit = await env.DB.prepare(
    `SELECT a.*, l.email FROM audits a JOIN leads l ON l.id = a.lead_id
     WHERE a.report_token = ? LIMIT 1`
  ).bind(token).first();
  if (!audit) return new Response('Not found', { status: 404 });

  const findings = await env.DB.prepare(
    `SELECT category, severity, title, detail, fix_hint FROM findings
     WHERE audit_id = ? ORDER BY
       CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2
                     WHEN 'medium' THEN 3 WHEN 'low' THEN 4 ELSE 5 END`
  ).bind(audit.id).all();

  const strategist = await env.DB.prepare(
    `SELECT * FROM strategist_outputs WHERE audit_id = ?`
  ).bind(audit.id).first();

  const payload = {
    audit, findings: findings.results,
    strategist: strategist ? hydrateStrategist(strategist) : null,
  };

  if (isJson) {
    return Response.json(payload, {
      headers: { 'cache-control': 'private, max-age=60' },
    });
  }

  // HTML shell — frontend si data dotáhne sám fetchem na /data
  return new Response(renderShell(token, audit.domain), {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

function hydrateStrategist(s) {
  return {
    headline: s.headline,
    risks:    s.risks,
    fix:      safeParse(s.variant_fix),
    redesign: safeParse(s.variant_redesign),
    new:      safeParse(s.variant_new),
  };
}
const safeParse = (s) => { try { return JSON.parse(s || 'null'); } catch { return null; } };

function renderShell(token, domain) {
  // Redirektovat na statickou stránku (uloženou v Pages) která fetchuje data
  // Pro MVP serveruj minimální shell + <script> — frontend separate file.
  return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<title>Audit ${escapeHtml(domain)} — fakan.cz</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<link rel="stylesheet" href="https://fakan.cz/assets/audit.css">
</head>
<body>
<div id="audit-root" data-token="${token}"></div>
<script type="module" src="https://fakan.cz/assets/audit.js"></script>
</body>
</html>`;
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, c => (
  { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
));
