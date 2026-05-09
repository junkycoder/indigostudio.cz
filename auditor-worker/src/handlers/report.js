// src/handlers/report.js
// GET /audit/{token}        → 302 na audit.fakan.cz Pages frontend
// GET /audit/{token}/data   → JSON payload pro Pages frontend

const REPORT_HOST = 'https://audit.fakan.cz';

export async function handleReport(request, env) {
  const url    = new URL(request.url);
  const parts  = url.pathname.split('/').filter(Boolean);
  const token  = parts[1];
  const isJson = parts[2] === 'data';
  if (!token) return new Response('Bad token', { status: 400 });

  // /audit/{token} (bez /data) — pošlat klienta na Pages frontend, který si data dotáhne sám.
  // Mail templates linkují rovnou na audit.fakan.cz, tahle větev je jen pojistka pro
  // případ, že někdo otevře Worker URL ručně.
  if (!isJson) {
    return Response.redirect(`${REPORT_HOST}/audit/${encodeURIComponent(token)}`, 302);
  }

  const audit = await env.DB.prepare(
    `SELECT * FROM audits WHERE report_token = ? LIMIT 1`
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

  // Whitelist polí — NEVRACET lead email, lead_id, error, json_summary, ip, …
  // Frontend si zná token z URL, víc nepotřebuje.
  const payload = {
    audit: {
      id:            audit.id,
      domain:        audit.domain,
      url:           audit.url,
      status:        audit.status,
      score:         audit.score,
      perf_score:    audit.perf_score,
      a11y_score:    audit.a11y_score,
      seo_score:     audit.seo_score,
      cookie_score:  audit.cookie_score,
      sec_score:     audit.sec_score,
      cms:           audit.cms,
      finished_at:   audit.finished_at,
    },
    findings:   findings.results,
    strategist: strategist ? hydrateStrategist(strategist) : null,
  };

  return Response.json(payload, {
    headers: { 'cache-control': 'private, max-age=60' },
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
