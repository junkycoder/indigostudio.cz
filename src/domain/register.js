// src/domain/register.js
//
// Queue handler pro 'domain-register' i 'domain-transfer' (jeden flow,
// rozliší se přes domain_orders.op_kind).
//
// Pipeline:
//   1) Načti order + domain_orders + lead (idempotentně)
//   2) Posuň status='processing'
//   3) Zavolej Subreg Make_Order
//   4) Subreg vrátí orderId + status. Pro register obvykle 'completed' nebo
//      'in_progress'. Pro transfer 'in_progress' (CZ.NIC vyžaduje 5 dní pro převod).
//   5) Pro 'completed': dotáhni Domain_Info (NS, expires) a status='done', email klientovi
//   6) Pro 'in_progress': status zůstává 'processing', polling cron checkuje stav
//      (a Queue retry s delaySeconds — ale max_retries=3 je málo, takže přes
//      `domain_status_poll` event_type ručně). Tady jednoduše: vrátíme bez
//      throw, ack zprávu, spoléháme na Subreg notifikační mail.
//
// Při kritické chybě Make_Order: status='failed', mail klientovi že vrátíme peníze.

import { makeOrder, domainInfo } from '../lib/subreg.js';
import { sendTransactional } from '../email/send.js';
import { tplDomainOperationDone, tplDomainOperationFailed } from '../email/templates.js';

export async function processDomainOperation({ orderId }, env, ctx) {
  const t0 = Date.now();

  const row = await env.DB.prepare(
    `SELECT o.id, o.kind, o.status, o.email, o.lead_id, o.amount_cents,
            d.fqdn, d.tld, d.op_kind, d.auth_info, d.period_years,
            d.registrant_name, d.registrant_email, d.registrant_phone,
            d.registrant_street, d.registrant_city, d.registrant_zip,
            d.registrant_country, d.registrant_ico, d.registrant_dic,
            l.unsub_token
       FROM orders o
       JOIN domain_orders d ON d.order_id = o.id
       LEFT JOIN leads l ON l.id = o.lead_id
      WHERE o.id = ? AND o.kind IN ('domain_register', 'domain_transfer') LIMIT 1`
  ).bind(orderId).first();

  if (!row) {
    console.warn(`domain-op: order ${orderId} neexistuje`);
    return;
  }
  if (row.status === 'done')       return;
  if (row.status === 'processing') return;
  if (row.status !== 'paid') {
    throw new Error(`order ${orderId} není paid (${row.status})`);
  }

  const now = () => Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `UPDATE orders SET status='processing', updated_at=? WHERE id=?`
  ).bind(now(), orderId).run();

  try {
    // Subreg expects flat contact map. Ale my máme registrant_* sloupce.
    const contact = {
      name:   row.registrant_name,
      email:  row.registrant_email,
      phone:  row.registrant_phone,
      street: row.registrant_street,
      city:   row.registrant_city,
      pc:     row.registrant_zip,
      cc:     row.registrant_country,
      regid:  row.registrant_ico,
      taxid:  row.registrant_dic,
    };

    const subregResult = await makeOrder(env, {
      fqdn: row.fqdn,
      opKind: row.op_kind,
      contact,
      period: row.period_years,
      authInfo: row.auth_info || undefined,
      // NS necháme default Subreg — klient si je může změnit po registraci.
      // Pokud bude potřeba, doplníme vlastní `ns: ['ns1.<host>', 'ns2.<host>']`.
      ns: [],
    });

    // Update orders.registrar_order_id + status v domain_orders
    await env.DB.prepare(
      `UPDATE domain_orders
          SET registrar_order_id = ?, registrar_status = ?
        WHERE order_id = ?`
    ).bind(subregResult.orderId || null, subregResult.status || null, orderId).run();

    // Pokud completed, dotáhni Domain_Info pro NS + expires
    const subregStatus = String(subregResult.status || '').toLowerCase();
    if (/completed|ok|success|done|finished/.test(subregStatus)) {
      let info = null;
      try { info = await domainInfo(env, row.fqdn); }
      catch (err) { console.warn(`domain_info ${row.fqdn} fail: ${err.message}`); }

      await env.DB.batch([
        env.DB.prepare(
          `UPDATE domain_orders
              SET expires_at = ?, ns_records_json = ?
            WHERE order_id = ?`
        ).bind(info?.expiresAt || null, info?.ns ? JSON.stringify(info.ns) : null, orderId),
        env.DB.prepare(
          `UPDATE orders SET status='done', completed_at=?, updated_at=? WHERE id=?`
        ).bind(now(), now(), orderId),
      ]);

      await sendDoneMail(env, row, info);
      console.log(`domain-${row.op_kind} ${row.fqdn} done in ${Date.now() - t0}ms`);
      return;
    }

    // Subreg vrátil in_progress — typicky transfer (5 dní lhůta) nebo
    // pomalá registrace (autorita zatím neodpověděla). Order zůstává
    // 'processing' v naší DB, polling řeší cron job (mimo MVP scope —
    // Subreg pošle notifikaci a dispatchujeme ručně).
    console.log(`domain-${row.op_kind} ${row.fqdn} subreg status=${subregStatus}, čekáme na callback`);

  } catch (err) {
    const msg = String(err.message || err).slice(0, 500);
    console.error(`domain-op fail order=${orderId} (${row.fqdn}): ${msg}`);
    await env.DB.prepare(
      `UPDATE orders SET status='failed', error_message=?, updated_at=? WHERE id=?`
    ).bind(msg, now(), orderId).run();

    await sendFailMail(env, row, msg).catch((e) => console.warn('fail-mail', e));
    throw err; // Queue retry
  }
}

// ---- mails ----------------------------------------------------------------

async function sendDoneMail(env, row, info) {
  const host = env.PUBLIC_HOST || 'indigostudio.cz';
  const tpl = tplDomainOperationDone(env, {
    fqdn: row.fqdn,
    opKind: row.op_kind,
    periodYears: row.period_years,
    ns: info?.ns || [],
    expiresAt: info?.expiresAt || null,
    orderId: row.id,
  });
  await sendTransactional(env, {
    to: row.email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    listUnsubUrl: row.unsub_token ? `https://${host}/odhlasit/${row.unsub_token}` : null,
  });
}

async function sendFailMail(env, row, errorMessage) {
  const host = env.PUBLIC_HOST || 'indigostudio.cz';
  const tpl = tplDomainOperationFailed(env, {
    fqdn: row.fqdn,
    opKind: row.op_kind,
    errorMessage,
    orderId: row.id,
  });
  await sendTransactional(env, {
    to: row.email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    listUnsubUrl: row.unsub_token ? `https://${host}/odhlasit/${row.unsub_token}` : null,
  });
}
