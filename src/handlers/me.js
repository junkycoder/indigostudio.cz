// src/handlers/me.js
//
// GET /api/me
// Vrací aktuální device + (volitelně) account + list journeys.
//
// Anonymní device vidí jen journeys, které sám vytvořil (j.device_id).
// Ověřený account vidí všechny journeys přes všechny své devices
// (j.account_id) — sjednoceno při verify magic linkem.
//
// Frontend si na základě response vykreslí profil button (avatar + dropdown).

import { getOrCreateDevice } from '../lib/identity.js';

export async function handleMe(request, env, ctx) {
  if (request.method !== 'GET') {
    return Response.json({ ok: false, error: 'Method not allowed' }, { status: 405 });
  }

  const { device, account, setCookieHeader } = await getOrCreateDevice(env, request);

  let journeysRows;
  if (account) {
    journeysRows = await env.DB.prepare(
      `SELECT j.id, j.status, j.total_amount_cents, j.currency,
              j.created_at, j.updated_at, j.lead_id,
              l.domain AS lead_domain, l.email AS lead_email
       FROM journeys j
       LEFT JOIN leads l ON l.id = j.lead_id
       WHERE j.account_id = ?
       ORDER BY j.updated_at DESC LIMIT 100`
    ).bind(account.id).all();
  } else {
    journeysRows = await env.DB.prepare(
      `SELECT j.id, j.status, j.total_amount_cents, j.currency,
              j.created_at, j.updated_at, j.lead_id,
              l.domain AS lead_domain, l.email AS lead_email
       FROM journeys j
       LEFT JOIN leads l ON l.id = j.lead_id
       WHERE j.device_id = ? AND j.account_id IS NULL
       ORDER BY j.updated_at DESC LIMIT 100`
    ).bind(device.id).all();
  }

  const journeys = journeysRows.results || [];
  const journeyIds = journeys.map(j => j.id);

  // Nested items pro každou journey jedním dotazem.
  const itemsByJourney = {};
  if (journeyIds.length > 0) {
    const placeholders = journeyIds.map(() => '?').join(',');
    const items = await env.DB.prepare(
      `SELECT id, journey_id, kind, ref_id, status, price_cents, position
       FROM journey_items
       WHERE journey_id IN (${placeholders})
       ORDER BY journey_id, position`
    ).bind(...journeyIds).all();
    for (const it of (items.results || [])) {
      (itemsByJourney[it.journey_id] ||= []).push({
        id: it.id,
        kind: it.kind,
        refId: it.ref_id,
        status: it.status,
        priceCents: it.price_cents,
        position: it.position,
      });
    }
  }

  const journeysOut = journeys.map(j => ({
    id: j.id,
    status: j.status,
    totalAmountCents: j.total_amount_cents,
    currency: j.currency,
    leadDomain: j.lead_domain,
    leadEmail: j.lead_email,
    createdAt: j.created_at,
    updatedAt: j.updated_at,
    items: itemsByJourney[j.id] || [],
  }));

  const body = JSON.stringify({
    ok: true,
    device: {
      id: device.id,
      createdAt: device.createdAt,
    },
    account: account ? {
      id: account.id,
      email: account.email,
      emailVerifiedAt: account.emailVerifiedAt,
    } : null,
    journeys: journeysOut,
  });

  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'private, no-store',
  });
  if (setCookieHeader) headers.set('Set-Cookie', setCookieHeader);
  return new Response(body, { status: 200, headers });
}
