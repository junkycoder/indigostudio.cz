// src/lib/subreg.js
//
// Subreg.cz SOAP klient. Žádné npm SDK — držíme se Web Platform.
// Endpoint: https://soap.subreg.cz/cmd.php
// Doc:      https://subreg.cz/manual/api/
//
// Subreg vrací XML; parsujeme ho regexem pro pole, která potřebujeme
// (žádný DOMParser ve Workers). Robustní pro běžné odpovědi, ale když
// Subreg něco strukturálně změní, je třeba parser opravit.
//
// Auth flow:
//   1) Login(login, password) → ssid (24h validní)
//   2) Cache ssid v KV pod klíčem 'subreg:ssid' s TTL 23h
//   3) Každý další call posílá ssid v parametrech

const ENDPOINT = 'https://soap.subreg.cz/cmd.php';
const SSID_TTL = 23 * 3600;
const SSID_KV_KEY = 'subreg:ssid';

// ---- nízká úroveň: SOAP envelope -----------------------------------------

function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Subreg SOAP envelope — všechny parametry jsou jednoduché stringy nebo
// vnořené struktury. Pro náš case (Check_Domain, Make_Order register)
// stačí flat key→value.
function buildEnvelope(method, params) {
  const paramsXml = Object.entries(params)
    .map(([k, v]) => `<${k}>${escapeXml(v)}</${k}>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                   xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                   xmlns:ns1="http://subreg.cz/types">
  <SOAP-ENV:Body>
    <ns1:${method}>${paramsXml}</ns1:${method}>
  </SOAP-ENV:Body>
</SOAP-ENV:Envelope>`;
}

async function rawCall(method, params) {
  const r = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': method,
    },
    body: buildEnvelope(method, params),
  });
  const text = await r.text();
  if (!r.ok) {
    const err = new Error(`Subreg ${method} HTTP ${r.status}`);
    err.status = r.status;
    err.body = text.slice(0, 500);
    throw err;
  }
  // Detekce SOAP faultu (server odpoví 200 ale s <Fault>)
  const fault = extractTag(text, 'faultstring') || extractTag(text, 'errormsg');
  if (fault) {
    const err = new Error(`Subreg ${method}: ${fault}`);
    err.fault = fault;
    err.body = text;
    throw err;
  }
  return text;
}

// Vytáhne string mezi <tag>...</tag> (case-insensitive). Vrátí null pokud nenašel.
function extractTag(xml, tag) {
  const re = new RegExp(`<(?:[^>]*:)?${tag}[^>]*>([\\s\\S]*?)</(?:[^>]*:)?${tag}>`, 'i');
  const m = re.exec(xml);
  return m ? m[1].trim() : null;
}

// Vytáhne všechny stringy mezi opakovanými tagy (např. všechny <ns> v <ns_records>).
function extractAllTags(xml, tag) {
  const re = new RegExp(`<(?:[^>]*:)?${tag}[^>]*>([\\s\\S]*?)</(?:[^>]*:)?${tag}>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1].trim());
  return out;
}

// ---- session: SSID s KV cachem -------------------------------------------

async function getSsid(env) {
  const cached = await env.AUDIT_CACHE.get(SSID_KV_KEY);
  if (cached) return cached;
  if (!env.SUBREG_LOGIN || !env.SUBREG_PASSWORD) {
    throw new Error('SUBREG_LOGIN / SUBREG_PASSWORD nejsou nastavené');
  }
  const xml = await rawCall('Login', {
    login: env.SUBREG_LOGIN,
    password: env.SUBREG_PASSWORD,
  });
  const ssid = extractTag(xml, 'ssid');
  if (!ssid) throw new Error('Subreg Login: ssid nevrácen');
  await env.AUDIT_CACHE.put(SSID_KV_KEY, ssid, { expirationTtl: SSID_TTL });
  return ssid;
}

// Zruší cached ssid (po 401-like chybě) a zkusí znovu — automatický recovery.
async function callWithSsid(env, method, params, _retry = false) {
  const ssid = await getSsid(env);
  try {
    return await rawCall(method, { ssid, ...params });
  } catch (err) {
    if (!_retry && /ssid|expired|not.*logged/i.test(String(err.fault || err.message))) {
      await env.AUDIT_CACHE.delete(SSID_KV_KEY);
      return callWithSsid(env, method, params, true);
    }
    throw err;
  }
}

// ---- veřejné API ---------------------------------------------------------

// Vrátí { available: bool, status: 'free' | 'registered' | 'banned' | 'unknown',
// price?: number, currency?: 'CZK', period?: 1 }
export async function checkDomain(env, fqdn) {
  const xml = await callWithSsid(env, 'Check_Domain', { domain: fqdn });
  const status = (extractTag(xml, 'status') || '').toLowerCase();
  const priceStr = extractTag(xml, 'price') || extractTag(xml, 'amount');
  const price = priceStr ? Number(priceStr) : undefined;
  const currency = extractTag(xml, 'currency') || 'CZK';
  return {
    available: status === 'free' || status === 'available',
    status: status || 'unknown',
    price,
    currency,
    period: 1,
  };
}

// Pricelist endpoint — vrací aktuální ceny per TLD. Cacheujeme v KV 6h.
export async function pricelist(env) {
  const cacheKey = 'subreg:pricelist';
  const cached = await env.AUDIT_CACHE.get(cacheKey, { type: 'json' });
  if (cached) return cached;

  const xml = await callWithSsid(env, 'Pricelist', {});
  const items = [];
  const reItem = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m;
  while ((m = reItem.exec(xml)) !== null) {
    const block = m[1];
    items.push({
      tld:      extractTag(block, 'tld'),
      register: Number(extractTag(block, 'register_price') || extractTag(block, 'price') || 0),
      transfer: Number(extractTag(block, 'transfer_price') || 0),
      renew:    Number(extractTag(block, 'renew_price') || 0),
      currency: extractTag(block, 'currency') || 'CZK',
    });
  }
  await env.AUDIT_CACHE.put(cacheKey, JSON.stringify(items), { expirationTtl: 6 * 3600 });
  return items;
}

// Vytvoří objednávku na registraci nebo převod. Subreg `Make_Order` přijme
// strukturu `order` s `type` ('Create_Domain' | 'Transfer_Domain') a kontakty.
// Vrátí { orderId, status }.
export async function makeOrder(env, { fqdn, opKind, contact, period = 1, authInfo, ns = [] }) {
  const orderType = opKind === 'transfer' ? 'Transfer_Domain' : 'Create_Domain';
  const params = {
    order: serializeOrder({
      type: orderType,
      domain: fqdn,
      period,
      contacts: contact,
      authInfo,
      ns,
    }),
  };
  const xml = await callWithSsid(env, 'Make_Order', params);
  return {
    orderId: extractTag(xml, 'orderid') || extractTag(xml, 'order_id'),
    status:  extractTag(xml, 'status'),
    raw:     xml,
  };
}

// Subreg očekává XML strukturu uvnitř `<order>`. Build inline (jednoduché flat-ish).
function serializeOrder({ type, domain, period, contacts, authInfo, ns }) {
  let xml = `<type>${escapeXml(type)}</type>`;
  xml += `<params>`;
  xml += `<domain>${escapeXml(domain)}</domain>`;
  xml += `<period>${period}</period>`;
  if (authInfo) xml += `<authid>${escapeXml(authInfo)}</authid>`;
  // Kontakt: registrant + admin + tech (pro CZ.NIC a EURid stačí registrant).
  // Subreg umí symbolic IDs (předem vytvořené kontakty) nebo inline.
  // Tady inline.
  if (contacts) {
    xml += `<registrant>${serializeContact(contacts)}</registrant>`;
  }
  if (ns && ns.length) {
    xml += `<ns>` + ns.map((h) => `<host>${escapeXml(h)}</host>`).join('') + `</ns>`;
  }
  xml += `</params>`;
  return xml;
}

function serializeContact(c) {
  const fields = ['name', 'org', 'street', 'city', 'pc', 'cc', 'phone', 'fax', 'email', 'regid', 'taxid'];
  return fields
    .filter((f) => c[f] !== undefined && c[f] !== null && c[f] !== '')
    .map((f) => `<${f}>${escapeXml(c[f])}</${f}>`)
    .join('');
}

// Detail existující domény (po registraci / pro polling stavu transferu).
export async function domainInfo(env, fqdn) {
  const xml = await callWithSsid(env, 'Domain_Info', { domain: fqdn });
  const status = extractTag(xml, 'status');
  const expires = extractTag(xml, 'expire') || extractTag(xml, 'expires_at');
  const ns = extractAllTags(xml, 'host');
  return {
    status,
    expiresAt: expires ? Math.floor(new Date(expires).getTime() / 1000) : null,
    ns,
  };
}

// Stav konkrétní objednávky v Subregu (pro transfer polling).
export async function orderInfo(env, orderId) {
  const xml = await callWithSsid(env, 'Get_Order', { orderid: orderId });
  return {
    status: extractTag(xml, 'status'),
    error:  extractTag(xml, 'errormsg'),
    raw:    xml,
  };
}
