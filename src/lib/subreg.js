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

// Subreg SOAP envelope. Subreg očekává parametry zabalené v `<data>` wrapperu
// (PHP SoapClient to dělá automaticky přes pojmenovaný argument $data).
// Bez něj parser vidí prázdné login/password a vrací "Incorrect username
// or password" — past při ručně psaném XML.
function buildEnvelope(method, params) {
  const paramsXml = Object.entries(params)
    .map(([k, v]) => `<${k}>${escapeXml(v)}</${k}>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"
                   xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                   xmlns:xsd="http://www.w3.org/2001/XMLSchema"
                   xmlns:ns1="http://subreg.cz/soap">
  <SOAP-ENV:Body>
    <ns1:${method}>
      <data>${paramsXml}</data>
    </ns1:${method}>
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
  // SOAP fault (server side error v transportu) — výjimka, žádná Map struktura.
  const soapFault = /<(?:[^>]*:)?faultstring[^>]*>([\s\S]*?)<\/(?:[^>]*:)?faultstring>/i.exec(text);
  if (soapFault) {
    const err = new Error(`Subreg ${method}: SOAP fault — ${soapFault[1].trim()}`);
    err.fault = soapFault[1].trim();
    err.body = text.slice(0, 500);
    throw err;
  }
  // Application-level error v Subreg Map odpovědi
  assertOk(text, method);
  return text;
}

// Subreg vrací XML-RPC Map struktury:
//   <item><key xsi:type="xsd:string">ssid</key><value xsi:type="xsd:string">XYZ</value></item>
// Top-level pattern je vždy { status: 'ok'|'error', data: {...payload} }, kde
// `data` může obsahovat vnořené Mapy nebo Array.
//
// Pro náš case stačí flat lookup — regex najde první výskyt key=X kdekoli
// v dokumentu, což pro typed Subreg responses (ssid, status, price, expire …)
// funguje, protože jsou jednou v root.

function getMapValue(xml, key) {
  const re = new RegExp(
    `<item>\\s*<key[^>]*>\\s*${key}\\s*<\\/key>\\s*<value[^>]*>([\\s\\S]*?)<\\/value>\\s*<\\/item>`,
    'i',
  );
  const m = re.exec(xml);
  return m ? m[1].trim() : null;
}

// Najde všechny `<value xsi:type="xsd:string">X</value>` uvnitř bloku
// (např. seznam nameserverů jako Array of strings v `<value xsi:type="ns2:Array">…</value>`).
function getStringArrayValues(xml) {
  const re = /<value[^>]*type="xsd:string"[^>]*>([\s\S]*?)<\/value>/gi;
  const out = [];
  let m;
  while ((m = re.exec(xml)) !== null) out.push(m[1].trim());
  return out;
}

// Vytáhne hodnotu mapy s daným key (klíč může být kdekoli — ne nutně root level).
// Když value je nested Map nebo Array, vrátí raw inner XML pro další parsování.
function getRawMapValue(xml, key) {
  return getMapValue(xml, key);
}

// Validace top-level statusu Subreg odpovědi. Throws při error / missing status.
function assertOk(xml, methodName) {
  const status = getMapValue(xml, 'status');
  if (!status) {
    const e = new Error(`Subreg ${methodName}: nečitelná odpověď (chybí status)`);
    e.body = xml.slice(0, 300);
    throw e;
  }
  if (status.toLowerCase() === 'error') {
    const errMsg  = getMapValue(xml, 'errormsg')  || getMapValue(xml, 'message')   || 'unknown';
    const errCode = getMapValue(xml, 'errorcode') || getMapValue(xml, 'code')      || '';
    const e = new Error(`Subreg ${methodName}: ${errMsg}${errCode ? ` (${errCode})` : ''}`);
    e.fault = errMsg;
    e.code  = errCode;
    throw e;
  }
}

// ---- session: SSID s KV cachem -------------------------------------------

async function getSsid(env) {
  const cached = await env.AUDIT_CACHE.get(SSID_KV_KEY);
  if (cached) return cached;
  if (!env.SUBREG_LOGIN || !env.SUBREG_PASSWORD) {
    throw new Error('SUBREG_LOGIN / SUBREG_PASSWORD nejsou nastavené');
  }
  // Subreg `password` = "API heslo" nastavené v Subreg → Settings → API access
  // (jiné než webové heslo). API klíč (SUBREG_API_KEY, pokud je nastaven)
  // Subreg pro Login nepoužívá — je relikt z dřívějších REST experimentů.
  const xml = await rawCall('Login', {
    login: env.SUBREG_LOGIN,
    password: env.SUBREG_PASSWORD,
  });
  const ssid = getMapValue(xml, 'ssid');
  if (!ssid) throw new Error('Subreg Login: ssid nevrácen v Map struktuře');
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

// Vrátí { available: bool, status: 'free' | 'taken' | 'banned' | 'unknown',
// price?: number, currency?: 'CZK', period?: 1 }
//
// Subreg Check_Domain Map klíč pro dostupnost je `avail` (NE `available`),
// hodnota xsd:int 1 nebo 0. Cena `price` je nested Map { amount, currency,
// premium }, kterou pro MVP nepotřebujeme — klientský ceník je hardcoded.
export async function checkDomain(env, fqdn) {
  const xml = await callWithSsid(env, 'Check_Domain', { domain: fqdn });
  const availRaw = getMapValue(xml, 'avail');
  const available = availRaw === '1' || availRaw === 'true';
  const status = available
    ? 'free'
    : (availRaw === '0' || availRaw === 'false' ? 'taken' : 'unknown');
  return { available, status, period: 1 };
}

// Pricelist endpoint — vrací aktuální ceny per TLD. Cacheujeme v KV 6h.
export async function pricelist(env) {
  const cacheKey = 'subreg:pricelist';
  const cached = await env.AUDIT_CACHE.get(cacheKey, { type: 'json' });
  if (cached) return cached;

  const xml = await callWithSsid(env, 'Pricelist', {});
  // Pricelist vrací Array of Map. Pro náš MVP nepotřebujeme — klientský ceník
  // je hardcoded v handlers/. Jen surový dump pro budoucí použití.
  await env.AUDIT_CACHE.put(cacheKey, xml.slice(0, 50000), { expirationTtl: 6 * 3600 });
  return [];
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
    orderId: getMapValue(xml, 'orderid') || getMapValue(xml, 'order_id'),
    status:  getMapValue(xml, 'status'),
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
// Subreg vrací data { name, expire, autorenew, status, hosts: [...] }
export async function domainInfo(env, fqdn) {
  const xml = await callWithSsid(env, 'Domain_Info', { domain: fqdn });
  const status = getMapValue(xml, 'status') || getMapValue(xml, 'state');
  const expires = getMapValue(xml, 'expire') || getMapValue(xml, 'expires_at');
  // Hosts jsou v Array of strings — najdeme pod klíčem 'hosts' nebo 'ns'
  const hostsBlock = getMapValue(xml, 'hosts') || getMapValue(xml, 'ns') || '';
  const ns = hostsBlock ? getStringArrayValues(hostsBlock) : [];
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
    status: getMapValue(xml, 'status'),
    error:  getMapValue(xml, 'errormsg'),
    raw:    xml,
  };
}
