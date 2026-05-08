# Design doc — landing-v2

**Autor:** senior-architect
**Status:** draft → review (Gate 2)
**Datum:** 2026-05-08
**Vstupy:** [`brief.md`](brief.md), [`decisions.md`](decisions.md), [`risk-check.md`](risk-check.md), [`forecast.md`](forecast.md)

---

## 1. Architektonický přehled

### 1.1 Co stavíme

Lead capture vrstvu nad existující free-analýzou + redesign copy. Žádné AI volání v runtime, jen deterministická data plus odeslaný mail.

### 1.2 Tok end-to-end

```
                    ┌──────────────────────────┐
                    │  fakan.cz/index.html     │ ← copy refresh, vykání, 40+
                    │  formulář:               │   formulář: URL + email + souhlas
                    │   url + email + consent  │   submit → /vysledek?url=…&em=…&c=1
                    └─────────────┬────────────┘
                                  │ GET /vysledek?url=…&em=…&c=1&v=v1
                                  ▼
                    ┌──────────────────────────┐
                    │  fakan.cz/vysledek.html  │
                    │  + vysledek.js (SSE)     │
                    └─────────────┬────────────┘
                                  │ GET /api/analyze?url=…&em=…&c=1&v=v1&s=landing-hero
                                  ▼
                    ┌──────────────────────────┐
                    │  Worker /api/analyze     │
                    │  (existující SSE engine) │
                    └─────────────┬────────────┘
                                  │ po `done` SSE eventu (server-side):
                                  │  ctx.waitUntil(captureLead({url, email, consent, ip, source}))
                                  ▼
                    ┌──────────────────────────┐
                    │  captureLead()           │
                    │  1. validate consent     │
                    │  2. strip URL            │
                    │  3. hash IP              │
                    │  4. gen unsubscribe_token│
                    │  5. INSERT INTO leads    │
                    │     (idempotent UPSERT)  │
                    │  6. enqueue mail         │
                    └─────────────┬────────────┘
                                  │
                                  ▼
                    ┌──────────────────────────┐         ┌──────────────────────┐
                    │  send_email binding      │────────▶│  Cloudflare Email    │
                    │  lead-followup.{html,txt}│         │  Workers (outbound)  │
                    └──────────────────────────┘         └──────────┬───────────┘
                                                                    │ SMTP
                                                                    ▼
                                                          ┌──────────────────┐
                                                          │  uživatelův mail │
                                                          └────────┬─────────┘
                                                                   │ klik na opt-out
                                                                   ▼
                    ┌──────────────────────────┐
                    │  GET /odhlasit?t=<token> │ ← Worker render HTML
                    │  UPDATE leads            │   + status='opted_out'
                    │     SET opted_out_at=…   │   + odeslán optout-confirmation mail
                    └──────────────────────────┘
```

### 1.3 Co je nové

| Komponenta | Soubor / lokace | Stav |
|---|---|---|
| D1 binding `DB` | `wrangler.toml` | nový |
| D1 migrace `leads` | `migrations/0001_leads.sql` | nový |
| Email Workers binding `EMAIL` | `wrangler.toml` | nový |
| Helper `lib/lead.js` (insert, idempotence) | `src/lib/lead.js` | nový |
| Helper `lib/url-strip.js` (sanitizace URL) | `src/lib/url-strip.js` | nový |
| Helper `lib/hash.js` (IP hash + token gen) | `src/lib/hash.js` | nový |
| Mail šablony (4× HTML + 4× plain) | `src/email/templates/*.js` | nový |
| Mail sender (`sendMail()` wrapper) | `src/lib/mail.js` | nový |
| Endpoint `GET /odhlasit` | `src/optout.js` (handler v `worker.js`) | nový |
| Stránka `/zasady-ochrany-osobnich-udaju.html` | `fakan.cz/zasady-ochrany-osobnich-udaju.html` | nový |
| Stránka `/odhlasit-hotovo.html` (statický fallback) | `fakan.cz/odhlasit-hotovo.html` | nový |
| Verzovaný text souhlasu | `legal/consent-versions/v1-2026-05-08.md` | nový |
| KV namespace `RATELIMIT` (anti-abuse) | `wrangler.toml` | nový |

### 1.4 Co se modifikuje

| Komponenta | Co se mění |
|---|---|
| `fakan.cz/index.html` | redesign 40+ (větší font, vyšší tlačítka, klidnější animace), formulář o `email` + `consent` + odkaz na PP, copy refresh marketerem |
| `fakan.cz/vysledek.html` | copy refresh (vykání), CTA banner, konzistence s 40+ tokeny |
| `fakan.cz/vysledek.js` | forwarduje `email`, `consent`, `version`, `source` jako query params do `/api/analyze` |
| `fakan.cz/prehled.html` | jen copy refresh, žádná funkční změna |
| `src/worker.js` | nový handler `/api/lead` *(viz pozn. níže — lead capture vede přes piggyback v `/api/analyze`, samostatný `/api/lead` zůstává jako fallback pro klienty bez SSE)*; nový handler `/odhlasit` |
| `src/analyze.js` | po `done` SSE eventu volá `ctx.waitUntil(captureLead(env, {…}))` |

> **Rozhodnutí — `/api/analyze` piggyback vs. samostatný `/api/lead`:**
> Lead capture jede přes **piggyback** uvnitř `/api/analyze`. Důvod: 1) jen jedna síťová akce z UI = méně failure módů, 2) lead se uloží i v případě, že frontendové JS by se rozbilo po doběhnutí SSE, 3) tým má pak možnost analytickou logiku použít jako server-side trigger bez nutnosti druhého fetche, 4) idempotence se řeší DB unique indexem, takže duplicitní spuštění (refresh, retry SSE) nepřidá další lead.
> Samostatný `POST /api/lead` přesto zavedeme pro budoucí kontaktní formulář a jako fallback pro neJS klienty. Pro v2 ho junior implementuje, ale není to primární cesta.

### 1.5 Co zůstává

- `src/detectors.js` — beze změny.
- SSE engine v `analyze.js` — beze změny, jen přidaný hook po `done`.
- Smart Placement, custom domain v `wrangler.toml` — zachováno.
- `run_worker_first = ["/api/*"]` — zachováno, **přidáme** `/odhlasit` do tohoto patternu nebo do druhé položky (viz sekce 3.3).

---

## 2. Data model — D1 schema

### 2.1 Tabulka `leads`

```sql
-- migrations/0001_leads.sql
-- Lead capture pro free analýzu. Vznik: 2026-05-08.
-- Per legal-advisor: souhlas musí být evidovaný (consent_at, _version, _ip_hash),
-- IP nikdy v plain podobě, URL stripnutá od senzitivních query parametrů.

CREATE TABLE leads (
  id                    TEXT PRIMARY KEY,            -- UUIDv4 (crypto.randomUUID())
  created_at            TEXT NOT NULL,               -- ISO 8601 UTC, např. '2026-05-08T14:30:00.000Z'
  url                   TEXT NOT NULL,               -- stripnutá URL (origin + path), bez utm_*, fbclid, gclid, token, session, auth, email, key, secret, code, password
  email                 TEXT NOT NULL,               -- validovaný formát (RFC 5322 subset)
  consent_at            TEXT NOT NULL,               -- ISO 8601 UTC
  consent_text_version  TEXT NOT NULL,               -- např. 'v1-2026-05-08'
  consent_ip_hash       TEXT NOT NULL,               -- sha256(ip + CONSENT_SALT), hex
  consent_ua_hash       TEXT,                        -- volitelně, sha256(ua + CONSENT_SALT)
  source                TEXT NOT NULL,               -- 'landing-hero' | 'landing-cta' | 'vysledek-form' | 'manual'
  status                TEXT NOT NULL DEFAULT 'new', -- 'new' | 'mailed' | 'bounced' | 'opted_out' | 'converted'
  unsubscribe_token     TEXT NOT NULL UNIQUE,        -- 32 bajtů random hex (64 znaků)
  mail_sent_at          TEXT,                        -- ISO 8601 UTC, NULL dokud neodejde
  mail_attempts         INTEGER NOT NULL DEFAULT 0,  -- 0..2 (orig + 1 retry)
  mail_last_error       TEXT,                        -- poslední error message při send fail (truncate 500)
  opted_out_at          TEXT,                        -- ISO 8601 UTC, NULL dokud neodhlášen
  last_contact_at       TEXT NOT NULL,               -- pro retenci (24 měs od posledního kontaktu)
  notes                 TEXT                         -- volitelné, ruční poznámky
);

-- Idempotence: stejný email × stejná URL × stejný den = jeden lead.
-- Date(created_at) bere první 10 znaků ISO timestampu = 'YYYY-MM-DD'.
CREATE UNIQUE INDEX leads_idem
  ON leads (email, url, substr(created_at, 1, 10));

-- Lookup pro opt-out (UNIQUE už je nahoře, tohle je redundance pro čitelnost).
-- SQLite vytvoří implicit index z UNIQUE constraintu, není potřeba ručně.

-- Lookup pro retro/admin queries.
CREATE INDEX leads_status_created  ON leads (status, created_at);
CREATE INDEX leads_last_contact    ON leads (last_contact_at);
```

### 2.2 Konvence

- **`id`** = `crypto.randomUUID()` (Workers runtime to umí). PK i pro budoucí cross-table reference.
- **`unsubscribe_token`** = 32 bajtů náhodných z `crypto.getRandomValues()`, hex-encoded → 64 znaků. **Nesmí** být odvozeno od emailu/ID. Per risk-check § 5.3.
- **`consent_ip_hash`** = `SHA-256(ip + env.CONSENT_SALT)`, hex. `CONSENT_SALT` je secret v `wrangler.toml` `[vars]` (pro produkční tajemství přes `wrangler secret put`, ne plain).
- **`consent_text_version`** = string odkazující na soubor v `legal/consent-versions/`. Změna textu = nová verze, stará verze v repu zůstává.
- **`status`**: `new` (insert) → `mailed` (po úspěšném `send_email`) → případně `bounced` (po retry fail) nebo `opted_out` (po klik) nebo `converted` (manuálně, když uzavřeme zakázku).
- **`last_contact_at`**: při insertu = `created_at`. Při každém manuálním follow-up update. Retence cron 24 měsíců po `last_contact_at`.

### 2.3 Idempotence — proč unique index, ne UPSERT

Kdyby uživatel z jakéhokoliv důvodu spustil analýzu dvakrát (refresh, druhý browser tab), nechceme dva leady. Unique index na `(email, url, day(created_at))` to deterministicky zařízne. V kódu:

```js
// pseudokód
try {
  await env.DB.prepare('INSERT INTO leads (...) VALUES (...)').bind(...).run();
} catch (err) {
  if (err.message?.includes('UNIQUE constraint failed')) {
    // duplicita ten samý den — tichý no-op, lead už máme
    return { duplicate: true };
  }
  throw err;
}
```

Per-day granularita znamená: jiný den = nový lead (přijatelné, marketingově to dává smysl, znovu projevený zájem).

### 2.4 KV — anti-abuse rate limit

```
namespace: RATELIMIT
key:       'lead:ip:' + sha256(ip + CONSENT_SALT)   ← reuse stejného hashe jako v leads
value:     <count>                                   ← integer jako string
ttl:       3600 (1 hodina)
```

Limity:
- **Lead capture:** max **5 leadů/h/IP**. Free analýza už má 3/24h/IP — lead capture je pod-akce, ale nezneužitelné stačí 5/h aby běžný uživatel nikdy nenarazil.
- **Opt-out:** žádný rate limit (token je dostatečně dlouhý, brute force nehrozí, a zablokování opt-outu by bylo legal problém — lidé musí umět odhlásit i z mobilní sítě s dynamickou IP).

### 2.5 Co NEukládáme

- Plnou IP — jen hash.
- Plný User-Agent — jen volitelný hash (a ten v MVP **vynechej**, doplníme až bude důvod).
- Cloudflare `cf-ipcountry`, `cf-ray`, `cf-connecting-ip` — neulkladáme.
- Referer hlavičku — neukládáme.
- Cookies — žádné neexistují a nikdy nebudou existovat.

---

## 3. Worker endpointy — nové a změněné

### 3.1 `GET /api/analyze` — modifikovaný

**Vstup (rozšířeno):**

```
GET /api/analyze?url=<URL>&em=<email>&c=1&v=<consent_version>&s=<source>
```

| Parametr | Typ | Povinný | Význam |
|---|---|---|---|
| `url` | string | ano | URL k analýze, normalizováno přes `normalizeUrl()` |
| `em` | string | ne (ale pokud je `c=1`, ano) | email pro lead capture |
| `c` | string | ne | `'1'` = consent given. Pokud chybí nebo není `'1'`, lead se neuloží |
| `v` | string | ne (ale pokud je `c=1`, ano) | verze textu souhlasu, např. `'v1-2026-05-08'` |
| `s` | string | ne | source identifier, default `'unknown'` |

**Výstup:** beze změny — pořád SSE stream se stávajícími eventy.

**Změna chování:** po `done` eventu (nebo po `error`, ale jen tehdy, kdy se podařilo HTML stáhnout — viz pozn.) Worker spustí:

```js
ctx.waitUntil(captureLead(env, {
  url: parsed.toString(),
  email: params.em,
  consent: params.c === '1',
  consentVersion: params.v,
  source: params.s || 'unknown',
  ip: request.headers.get('cf-connecting-ip') || '',
  userAgent: request.headers.get('user-agent') || '',
  analysisResultSummary: { /* score, top 3 verdicts */ }, // pro mail šablonu
}));
```

`waitUntil` zajistí, že Worker neukončí běh dřív než insert + mail. Per Cloudflare docs `waitUntil` má 30 s strop, což je víc než dost.

> **Pozn. k chybové variantě:** lead se uloží **i tehdy**, když analýza spadne na network error (uživatel projevil zájem, jeho web prostě nejel). Mail v tom případě posíláme s textem „nepodařilo se nám stáhnout tvůj web (timeout / DNS / TLS), ale díky za zájem, ozveme se osobně". Tohle je marketing-friendly, ne tech-failure-as-no-lead.

### 3.2 `POST /api/lead` — nový (fallback)

Pro budoucnost (kontaktní formulář bez analýzy) a jako noJS fallback.

```
POST /api/lead
Content-Type: application/json

{
  "url": "https://example.cz",
  "email": "klient@example.cz",
  "consent": true,
  "consentVersion": "v1-2026-05-08",
  "source": "kontakt-formular"
}
```

**Validace:**
- `consent === true` (server-side enforce per risk-check § 2.1).
- `email` matchuje RFC 5322 subset regex (jednoduchý, ne přehnaně).
- `url` projde `normalizeUrl()` + `stripUrl()` (viz § 4.2).
- `consentVersion` v allowlistu známých verzí (zatím `['v1-2026-05-08']`).

**Odpověď:**
- `204 No Content` — lead přijat (idempotentně, i pokud byl duplicitní).
- `400 Bad Request` — validace failed, JSON `{error: 'human message'}`.
- `429 Too Many Requests` — rate limit překročen.

**Hlavičky:** žádné cookies, žádný `Set-Cookie`. CORS jen z `fakan.cz`.

### 3.3 `GET /odhlasit?t=<token>` — nový

Worker handler **musí** běžet jako Worker (ne static asset), protože dělá DB update. Routing: přidat `/odhlasit*` do `run_worker_first` v `wrangler.toml`:

```toml
[assets]
directory = "fakan.cz"
run_worker_first = ["/api/*", "/odhlasit*"]
```

**Tok:**

1. Validace `t` (64 hex znaků).
2. Lookup `SELECT id, email, status FROM leads WHERE unsubscribe_token = ?`.
3. **Pokud nenalezen** → vrátit 200 (NE 404) se stejnou stránkou „odhlášeno" + `noindex`. Per risk-check: nesmíme útočníkovi prozradit, že token neexistuje.
4. **Pokud nalezen a `status != 'opted_out'`**:
   - `UPDATE leads SET status = 'opted_out', opted_out_at = ?, last_contact_at = ? WHERE id = ?`.
   - `ctx.waitUntil(sendMail(env, 'optout-confirmation', { email, ... }))` — potvrzovací mail (per scope rozhodnutí Gate 1).
5. Render HTML stránku „Hotovo, odhlášeno" inline z Workeru.

**Proč Worker render, ne statická HTML stránka:** chceme jednu URL `/odhlasit?t=…`, ne dvě (`/odhlasit?t=…` + redirect na `/odhlasit-hotovo.html`). Worker render je jednodušší a šetří jeden navigační kruh.

Nicméně **`fakan.cz/odhlasit-hotovo.html`** zakládáme jako fallback pro případ, že by někdo přistál na URL bez tokenu (nebo z webu) — render obecné stránky „chcete-li se odhlásit, použijte odkaz v mailu".

### 3.4 Cron Trigger — retence (Fáze 2 backlog, ne MVP)

Per risk-check § 2.3 retence 24 měsíců. Naplánujeme do `wrangler.toml`:

```toml
[triggers]
crons = ["0 3 1 * *"]  # 1. v měsíci, 03:00 UTC
```

Handler v `worker.js`:

```js
async scheduled(event, env, ctx) {
  // DELETE FROM leads WHERE last_contact_at < datetime('now', '-24 months') AND status != 'converted'
  // + 3-letá retence pro opted_out
}
```

**Pozn.:** První retro-pass přijde nejdřív v 2028-05. Implementaci klidně odložit do následující iterace (`landing-v3` nebo dedicated `data-retention` task), v MVP to ne­blokuje.

---

## 4. Email Workers — outbound architektura

### 4.1 Binding

```toml
# wrangler.toml
[[send_email]]
name = "EMAIL"
# allowed_destination_addresses ponecháno bez restrikce — posíláme komukoliv, kdo nám zadá email
# (zákaznickým doménám, žádný interní whitelist)
```

> **Researcher: ověřit aktuální syntaxi `[[send_email]]` v wrangleru.** V některých verzích to bylo `[email]`, v jiných `[[send_email]]`. Verze, která je v repu: `compatibility_date = "2025-05-01"`.

### 4.2 DNS setup pro `fakan.cz`

Domain `fakan.cz` musí být verified v Cloudflare Email Routing dashboardu. Předpoklady:

- **MX záznam** směrem na Cloudflare: `route1.mx.cloudflare.net`, `route2.mx.cloudflare.net`, `route3.mx.cloudflare.net` — pro inbound (jsem@fakan.cz). Už by mělo být, ale **researcher ověří**.
- **SPF**: `v=spf1 include:_spf.mx.cloudflare.net ~all` (nebo `-all`, pokud není fallback provider).
- **DKIM**: Cloudflare automaticky generuje při Email Routing setupu, klíč se zveřejní jako `cf2024-1._domainkey` TXT.
- **DMARC**: `v=DMARC1; p=quarantine; rua=mailto:dmarc@fakan.cz; aspf=s; adkim=s` — start na `quarantine`, po týdnu monitoring na `reject`. Ne `p=none` — to je signál pro spammery.

### 4.3 Adresa odesílatele

**`nabidky@fakan.cz`** pro lead followup, opt-out potvrzení, soft DOI.
**`prihlaseni@fakan.cz`** pro magic-link auth maily (až dorazí auth flow).

Důvod oddělení: deliverability (transactional vs. marketing kanál) a budoucí možnost odlišného opt-out pro marketingové vs. login maily (login mail nemůžete vypnout, je to nedělitelně spjato se službou).

`Reply-To: jsem@fakan.cz` ve všech mailech (Fakan osobně).

### 4.4 Mail render — kde a jak

**Server-side ve Workeru.** Šablony jsou JS moduly exportující funkce:

```js
// src/email/templates/lead-followup.js
export function leadFollowup({ targetUrl, summary, unsubscribeUrl, leadId }) {
  return {
    subject: `Analýza ${new URL(targetUrl).hostname} — našli jsme tři věci`,
    html: `<!doctype html>...`,    // viz § 5
    text: `Dobrý den,\n\nudělali jsme analýzu vašeho webu...`,  // ručně psaný plain-text twin
  };
}
```

**Plain-text twin = ručně psaný, ne strip z HTML.** Důvody:
- 40+ cílovka má vyšší podíl klientů, kde HTML nezobrazuje (Outlook 2007 ve firmě, mail klient v telefonu s vypnutým HTML pro datový limit, screen readery).
- Automatický strip dělá fakt ošklivé výstupy (linky bez kontextu, tabulky rozbité).
- Plain-text se píše jednou, žije týdny → 5 minut práce ušetří ošklivý first-impression.

### 4.5 Send + retry policy

```js
// src/lib/mail.js — pseudokód
async function sendMail(env, template, data) {
  const msg = createMimeMessage();  // viz https://developers.cloudflare.com/email-routing/email-workers/send-email/
  msg.setSender({ name: 'Daniel Hromada — fakan.cz', addr: 'nabidky@fakan.cz' });
  msg.setRecipient(data.email);
  msg.setSubject(template.subject);
  msg.setHeader('Reply-To', 'jsem@fakan.cz');
  msg.setHeader('List-Unsubscribe', `<${data.unsubscribeUrl}>, <mailto:nabidky@fakan.cz?subject=unsubscribe>`);
  msg.setHeader('List-Unsubscribe-Post', 'List-Unsubscribe=One-Click');
  msg.addMessage({ contentType: 'text/plain', data: template.text });
  msg.addMessage({ contentType: 'text/html',  data: template.html });

  try {
    await env.EMAIL.send(new EmailMessage(msg.getSender().addr, data.email, msg.asRaw()));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err.message || err).slice(0, 500) };
  }
}
```

**Retry:**
- 1× retry s exponenciálním backoffem (1 s) **uvnitř téže `waitUntil`** session.
- Pokud i druhý fail → `UPDATE leads SET status = 'bounced', mail_attempts = 2, mail_last_error = ?`.
- Žádný cron-based retry. Když Email Workers chcípne, raději eskalujeme ručně z DB.

> **Researcher: dokumentace `mimetext` package.** V CF příkladech se používá `mimetext` z npm — to znamená dependency. **Senior-architect veto bez zdůvodnění.** Můžeme použít vlastní mini-MIME builder (50 řádků) — alternativně lib pro raw MIME. **Doporučení:** vlastní `src/lib/mime.js`, jednoduchý multipart builder. CLAUDE.md sekce 2 zakazuje npm závislosti bez schválení.

### 4.6 Soft DOI mail — kdy a jak

**Doporučení:** soft DOI mail **není samostatný mail**. Místo toho je **úvodní odstavec** přímo v `lead-followup` mailu (per risk-check § 4.3). Vzor:

> *Tento email vám posíláme proto, že jste si na fakan.cz vyžádal/a analýzu webu [URL] a souhlasil/a se zasláním výsledků. Pokud to nejste vy, klikněte sem [opt-out link] a smažeme váš email z databáze.*

Důvody nedělat samostatný DOI mail:
- Dva maily v 5 minutách = vypadá to jako spam, deliverability hit.
- Klasický double opt-in (potvrzovací klik před prvním obsahovým mailem) má drop-off ~30 %, ztratíme leady.
- Soft DOI v prvním obsahovém mailu splňuje compliance i UX.

**Ale:** Gate 1 explicitně zařadil „soft DOI mail" jako samostatný typ. Reinterpretuju to jako **šablonu na sklad** pro případ, kdy bude legal/marketing chtít plný DOI flow. Šablona se připraví, ale **MVP ji nepoužívá**. Pokud chce orchestrátor jiný výklad, eskaluju.

---

## 5. Mail šablony — návrh struktury

Pro každou šablonu: input proměnné, subject, kontent strategy. Plný copy doplní marketer ve Fázi 4.

### 5.1 `lead-followup`

| Aspekt | Hodnota |
|---|---|
| Soubor | `src/email/templates/lead-followup.js` |
| Subject | `Analýza {hostname} — co jsme našli` (česky, žádné emoji, max 50 znaků) |
| From | `Daniel Hromada — fakan.cz <nabidky@fakan.cz>` |
| Reply-To | `jsem@fakan.cz` |
| Vstupní data | `{ targetUrl, hostname, summary: { topVerdicts: [{kind, text}], score, securityScore, trackerCount }, unsubscribeUrl, leadId, sentAt }` |
| Sekce HTML | 1) Soft DOI úvod, 2) „Co jsme našli" — top 3 verdiktů z analýzy, 3) Co můžeme udělat — 2 odstavce (audit / hosting), 4) CTA „Domluvte si bezplatný 15min hovor" → `mailto:` (žádný kalendář v MVP), 5) Patička |
| Patička (povinná) | Daniel Hromada (Fakan) · IČO [doplní owner] · [adresa firmy] · jsem@fakan.cz · +420 604 690 539 · [Odhlásit] |
| Stylování | Inline CSS, max 600px wide, žádné webfonty (system stack), žádné `<img>` z externích zdrojů kromě budoucího logo z `r2.fakan.cz/logo.png` *(out of scope MVP, prozatím text-only logo)* |
| Plain text twin | Ano, ručně psaný |

### 5.2 `magic-link-auth` (na sklad, draft v0)

| Aspekt | Hodnota |
|---|---|
| Soubor | `src/email/templates/magic-link-auth.js` |
| Subject | `Přihlašovací odkaz pro fakan.cz` |
| From | `fakan.cz <prihlaseni@fakan.cz>` |
| Reply-To | `jsem@fakan.cz` |
| Vstupní data | `{ magicLinkUrl, expiresInMinutes: 15, ip, userAgent }` |
| Sekce | 1) „Klikněte pro přihlášení" CTA, 2) „Odkaz platí 15 minut", 3) „Pokud to nejste vy, ignorujte tento email" + IP a UA pro paranoidní uživatele, 4) Patička |
| Patička | Pouze identifikace odesílatele + adresa, **žádný opt-out** (login mail = transakční, nepodléhá opt-outu) |
| Plain text | Ano |

> Šablona se zařídí v iteraci, ale **endpoint pro magic link auth ještě neexistuje** → mail se v MVP nikdy nezavolá. Junior **smí psát unit test** pro render funkci, ale v `worker.js` nepřipojí žádný handler.

### 5.3 `optout-confirmation`

| Aspekt | Hodnota |
|---|---|
| Soubor | `src/email/templates/optout-confirmation.js` |
| Subject | `Odhlášeno z fakan.cz` |
| From | `nabidky@fakan.cz` |
| Vstupní data | `{ email, optedOutAt }` |
| Sekce | 1) „Hotovo, odhlásili jsme vás", 2) „Pokud to byla chyba, napište nám na jsem@fakan.cz", 3) Patička |
| **Žádné CTA ani marketing copy.** | |
| Patička | Pouze identifikace odesílatele |
| Plain text | Ano |

### 5.4 `soft-doi` (na sklad, MVP nepoužívá)

Per § 4.6, šablona připravená na případ plného DOI flow. Junior implementuje render funkci, ale handler v `worker.js` ji nezavolá. Pokud bude legal po launch chtít přepnout, je to flag ve Workeru.

| Aspekt | Hodnota |
|---|---|
| Soubor | `src/email/templates/soft-doi.js` |
| Subject | `Potvrďte zájem o analýzu {hostname}` |
| Vstupní data | `{ targetUrl, hostname, confirmUrl, expiresInHours: 24 }` |
| Plain text | Ano |

### 5.5 Společný layout

Helper `src/email/templates/_layout.js` exportuje `wrap(body, footer)`. Patička je v jednom místě, změna IČO nebo adresy = jeden edit. **Šablonový engine NE** — vanilla template literály stačí.

---

## 6. Frontend — co se mění

### 6.1 `index.html`

**Strukturální změny:**

- Hero formulář rozšířit o `<input type="email" name="email">` a `<input type="checkbox" name="consent">` s odkazem na PP.
- CTA banner formulář totožný (DRY: extrahovat do JS funkce, ne kopírovat HTML).
- Skip link, header, footer beze změny struktury.
- Nový odkaz v patičce: `Zásady ochrany osobních údajů`.

**Designové změny pro 40+ (rozhoduje marketer + tester verifikuje):**

| Token | Před | Po |
|---|---|---|
| Body font-size | 17 px | **18 px desktop / 17 px mobile** (mobile zůstává 17 kvůli šířce 375 px) |
| `--muted` light | `#6B7280` (kontrast 4.6:1 na ivory) | **`#52606F`** (kontrast 6.0:1) — pro AAA u patičky a popisků |
| Tlačítka `.btn-cta` | `min-height: 52px` | **`min-height: 56px`** + `padding: 16px 24px` |
| Form inputy | `min-height: 52px` | **`min-height: 56px`**, `font-size: 18px` |
| Animace `pulse` | 1.2s infinite | **respektovat `prefers-reduced-motion`** je už v `vysledek.html` — replikovat sem |
| `.eyebrow` | 12 px | **13 px**, letter-spacing trochu méně agresivní (0.10em → 0.08em) |
| Hero H1 | clamp(34px, 5.5vw, 56px) | beze změny (už OK pro 40+) |
| Tlačítka focus | `:focus-visible` outline 2px | **3px outline + 2px offset** (viditelnější) |

**Form HTML návrh:**

```html
<form class="url-form" id="analyzeForm" novalidate>
  <div class="form-row">
    <label for="urlInput">Adresa vašeho webu</label>
    <input
      class="url-input"
      id="urlInput"
      name="url"
      type="text"
      placeholder="vasedomena.cz"
      autocomplete="url"
      autocapitalize="none"
      autocorrect="off"
      spellcheck="false"
      inputmode="url"
      required>
  </div>
  <div class="form-row">
    <label for="emailInput">Váš email</label>
    <input
      class="email-input"
      id="emailInput"
      name="email"
      type="email"
      placeholder="vy@vasedomena.cz"
      autocomplete="email"
      autocapitalize="none"
      autocorrect="off"
      spellcheck="false"
      inputmode="email"
      required>
  </div>
  <div class="form-consent">
    <input type="checkbox" id="consentChk" name="consent" required>
    <label for="consentChk">
      Souhlasím se zasláním výsledků analýzy a nezávazného návrhu řešení.
      Více v <a href="/zasady-ochrany-osobnich-udaju">zásadách ochrany osobních údajů</a>.
      Souhlas mohu kdykoliv odvolat.
    </label>
  </div>
  <!-- honeypot — viz § 7.2 -->
  <input type="text" name="company" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">
  <button class="btn-cta" type="submit">Analyzovat zdarma →</button>
</form>
```

> **Marketer:** finální texty labelů, placeholderů a CTA (vykání, 40+ tón) doplníš ve Fázi 4. Architecturálně mi sedí výše uvedené, ale není to brand-final.

### 6.2 `vysledek.js` — forwarding

```js
// po načtení params:
const params = new URLSearchParams(location.search);
const target = params.get('url') || '';
const email  = params.get('em')  || '';
const consent = params.get('c')  === '1';
const version = params.get('v')  || '';
const source = params.get('s')   || 'unknown';

// při sestavení SSE URL:
const apiQs = new URLSearchParams({ url: target });
if (email && consent && version) {
  apiQs.set('em', email);
  apiQs.set('c', '1');
  apiQs.set('v', version);
  apiQs.set('s', source);
}
const es = new EventSource('/api/analyze?' + apiQs.toString());
```

**Žádný extra fetch po `done`** — lead capture jede server-side v Workeru. UI jen pokračuje stávajícím flow + případně malý toast „Výsledky vám pošleme i na email" po `done`.

### 6.3 `vysledek.html` — minimální změny

- Copy refresh (vykání) — marketer.
- Pokud uživatel přišel **bez** emailu (přímý link, sdílení), zobrazit fallback formulář pod CTA banner: „Chcete dostat tento výsledek emailem?" → submit na `/api/lead`. **MVP optional**, junior to udělá pokud zbude čas.
- Nový info banner po `done`: „Výsledky vám pošleme i na {email} během 5 minut." — jen pokud byl email zadán.

### 6.4 `prehled.html`

Pouze copy refresh, **žádná funkční změna**, žádná lead capture. Out of scope pro tuhle iteraci.

### 6.5 `zasady-ochrany-osobnich-udaju.html` — nová

Statická HTML stránka. Per risk-check § 2.4 musí pokrývat: kdo zpracovává, co sbíráme, právní titul, jak dlouho, komu předáváme, vaše práva, kontakt, datum účinnosti.

**Šablona designu:** stejné CSS tokeny jako `index.html`, jen `<main>` s prose stylem (max-width 70ch). Žádné SVG, žádný JS.

Obsah dodá **legal-advisor + marketer** ve Fázi 4. Architectonicky je to čistě statika z `fakan.cz/`.

### 6.6 `odhlasit-hotovo.html` — nová (fallback)

Statická HTML pro případ, že někdo přistál bez tokenu. Worker ji nepoužívá (vlastní render), ale existuje pro lidi, co se sem prokliknou jiným způsobem.

### 6.7 Brand tokens — refactor odložit

PRD má backlog úkol „Brand tokens jako CSS variables". V této iteraci se barvy/spacing **nepřejmenovávají**. Pokud copy refresh narazí na hardcoded barvy v hex, junior je nahradí stávajícími CSS variables (`var(--orange)` apod.), ale nezakládá novou tokenovou vrstvu.

---

## 7. Anti-abuse + spam protection

### 7.1 Rate limit `/api/lead` a `/api/analyze` lead-capture větve

KV-based, viz § 2.4. Implementace:

```js
async function checkRateLimit(env, ipHash, key, max, windowSec) {
  const k = `${key}:${ipHash}`;
  const current = parseInt(await env.RATELIMIT.get(k) || '0', 10);
  if (current >= max) return false;
  await env.RATELIMIT.put(k, String(current + 1), { expirationTtl: windowSec });
  return true;
}
```

**Limity:**
- `lead`: 5/h/IP.
- `analyze`: 3/24h/IP — zachovat stávající (pokud existuje, pokud ne zavést teď).
- `optout`: bez limitu.

**KV consistency model:** eventual. Race condition mezi dvěma simultánními requesty může pustit 6. lead místo 5. Pro anti-abuse to je akceptovatelné, není to bezpečnostní hranice.

### 7.2 Honeypot

V form HTML přidat skryté pole `<input name="company">`. Pokud server-side dorazí neprázdná hodnota, request je bot, **silently drop** (vrátit 204 jako úspěch, ale nic neuložit). Boti se naučí rychleji, když dostanou error.

### 7.3 Turnstile

Brief o tom mlčí, ale Cloudflare Turnstile je v README jako samostatný úkol „Turnstile + rate limit". **Doporučení:** v MVP v2 **NE**, jen honeypot + KV rate limit. Důvody:

- 40+ cílovka může mít s Turnstile potíž (zvlášť accessibility u screen-readeru).
- Honeypot + rate limit + soft DOI mail úvodní odstavec pokrývá 95 % spam scenarios.
- Zařadit Turnstile v `landing-v3` pokud z retro vyleze, že honeypot nestačí.

### 7.4 Soft DOI jako další vrstva

Per § 4.6 — úvodní odstavec lead-followup mailu funguje jako záchranná brzda pro chybně zadané emaily. Příjemce, který nezadal email, klikne opt-out, lead se zruší.

---

## 8. Error handling

| Co selže | Co se stane | Co vidí uživatel |
|---|---|---|
| D1 insert: UNIQUE constraint failed | tichý no-op, lead už máme z předchozího pokusu téhož dne | analýza pokračuje, mail dorazí 1× (ten z prvního pokusu) |
| D1 insert: jiná chyba (síťová, DB nedostupná) | `console.error('[lead] insert failed', err)` + `ctx.waitUntil` ukončí, lead ztracen | analýza UI funguje normálně, mail nedojde — degraded gracefully |
| Email Workers send: 4xx (validation) | retry 1×, pak `status='bounced'`, error logged | analýza UI funguje, mail nedojde |
| Email Workers send: 5xx (server) | retry 1×, pak `status='bounced'`, eskalace přes log | dtto |
| `/odhlasit` token nenalezen | render stránky „odhlášeno" jako by nalezen byl | uživatel myslí že to vyšlo, neukázat útočníkovi že token neexistuje |
| `/odhlasit` token validní formát ale 0 řádků updated | dtto | dtto |
| `/odhlasit` DB error | render stránky „dočasná chyba, zkuste znovu za pár minut" + 503 | jasná hláška |
| `normalizeUrl()` failed | 400 JSON `{error: 'Tohle není platná URL.'}` | analýza neproběhne, UI zobrazí error |
| Email validation failed (nevalidní formát) | 400 `{error: 'Email nevypadá jako email.'}` | UI zvýrazní pole |
| Honeypot triggered | 204 No Content (silent success), nic neukládat | bot myslí že vyhrál |
| Rate limit překročen | 429 `{error: 'Moc rychle. Zkuste za pár minut.'}` | UI zobrazí toast |
| Worker CPU limit (50ms na free, 30s paid) | analýza spadne, lead se neuloží | UI ukáže timeout |
| Subrequest limit (50/1000) | nehrozí (1× fetch + 1× DB + 1× mail = 3 subrequesty) | n/a |

### 8.1 Logging

Console.log/error v Workeru končí v `wrangler tail` a v Cloudflare Logs Engine. **Bez** Sentry / external aggregator (out of scope, žádná npm závislost). Pro MVP stačí.

### 8.2 Alerting (out of scope)

Když mailing chcípne na 50 % requestů, chceme to vědět. Cloudflare nemá out-of-the-box alert na log level. Backlog úkol: scheduled task, který každou hodinu spočítá `SELECT count(*) FROM leads WHERE status='bounced' AND created_at > datetime('now', '-1 hour')` a pošle mail Fakanovi pokud > 5. **Ne v MVP**, ale flag.

---

## 9. Otevřené otázky pro researchera

Researcher dostane tyto úkoly před / současně s rozpadem PM:

### 9.1 Cloudflare Email Workers `send_email` binding

- **Aktuální syntaxe `wrangler.toml`** pro `[[send_email]]` k `compatibility_date = "2025-05-01"`. Doložit z oficiální docs URL.
- **Quota / rate limit** outbound mailů — kolik mailů/den/účet, kolik mailů/sek? Cloudflare to historicky uvádělo jako „abuse-prevention threshold" bez čísla.
- **Cena** pro Workers Free vs. Workers Paid plán (2026 sazby).
- **Jak vypadá `EmailMessage` API** v 2026 — používá se ještě `mimetext` lib, nebo je už built-in?
- **Limit velikosti zprávy** (MB).
- **Bounce handling** — vrací `env.EMAIL.send()` reálně exception při hard bounce, nebo to projde a bounce přijde async přes inbound mail?

### 9.2 DNS records pro `fakan.cz`

- **Existující stav** — co je v Cloudflare DNS dashboardu pro `fakan.cz`. Pokud researcher má přístup, vypsat MX, SPF, DKIM, DMARC.
- **Pokud chybí**, přesné hodnoty pro Email Workers outbound (SPF include, DKIM selector).

### 9.3 Patička mailu — CZ regulace

- **§ 7 zákona č. 480/2004 Sb.** vyžaduje identifikaci odesílatele. Co konkrétně musí být uvedeno? Je adresa firmy povinná, nebo stačí IČO + jméno?
- **GDPR čl. 13** vs. mailová patička — musí být odkaz na PP přímo v mailu, nebo stačí na webu odkazovaném z mailu?
- **Best practice** pro „informace o správci údajů" v mailové patičce.

### 9.4 List-Unsubscribe-Post (RFC 8058)

- Gmail / Yahoo od 2024 vyžadují one-click unsubscribe pro odesílatele s vyšším objemem. Je to relevantní pro 5–20 mailů/den, nebo až od jiného volume? Implementaci `List-Unsubscribe-Post: List-Unsubscribe=One-Click` máme v § 4.5, **researcher potvrdí, že hlavička je validní a Gmail ji uznává**.

### 9.5 Cloudflare D1 — dnešní limits

- **Free tier limity** k 2026-05 (writes/day, reads/day, storage). Forecast má 100k writes/den, 5M reads/den, 5 GB.
- **`crypto.randomUUID()` a `crypto.getRandomValues()`** dostupné v Workers runtime — potvrdit (mělo by být, jen pojistka).
- **D1 prepared statements** — potvrdit syntaxi pro `bind()` v `compatibility_date = "2025-05-01"`.

---

## 10. ADR — klíčová rozhodnutí

V této iteraci stojí za samostatný ADR jedno rozhodnutí, ostatní jsou dostatečně zachycená v decisions.md a tomto designu:

### 10.1 ADR-001: Cloudflare Email Workers vs. MailChannels

> **Soubor:** `docs/adr/ADR-001-email-outbound-cloudflare-vs-mailchannels.md`
> **Stav:** accepted (per Gate 1)

Stručný obsah:
- **Kontext:** potřebujeme outbound mail z Workeru pro lead followup, opt-out, magic-link auth.
- **Možnosti:** (1) MailChannels — historicky free pro CF Workers, (2) Cloudflare Email Workers `send_email` binding, (3) Resend / Postmark / Mailgun — placené API.
- **Rozhodnutí:** Email Workers binding.
- **Důvody:**
  - Compliance: 1 procesor (Cloudflare) místo 2 (Cloudflare + MailChannels) — menší DPA povrch, jednodušší Privacy Policy (per legal-advisor risk-check § 2.5).
  - Cost: free pro běžný objem (5–20 mailů/den), žádný tier upgrade.
  - Stack alignment: Cloudflare end-to-end (CLAUDE.md sekce 2).
  - MailChannels v 2024 změnil politiku (placený plán pro non-CF zákazníky), riziko že se to změní znovu.
- **Trade-offy:**
  - Email Workers má méně dokumentace a menší knowhow než MailChannels.
  - Pokud Cloudflare výpadek, fallback nemáme. (Akceptováno pro MVP, fallback řešíme až v prod escalation playbooku.)
- **Důsledky pro implementaci:** binding `EMAIL` v `wrangler.toml`, vlastní `mime` builder, DNS verifikace, žádná npm dependency.

> **Junior implementuje ADR jako samostatný commit `docs(adr): ADR-001 Email Workers volba`**, ne v rámci hlavního design commitu.

Další (ne-ADR) rozhodnutí, kterých se design dotýká:
- Lead capture piggyback v `/api/analyze` (vs. samostatný endpoint) — zachycené v § 1.4.
- URL stripping deny-list (vs. allowlist origin+path) — § 4.2 / risk-check § 1.3.
- Soft DOI integrovaný do prvního mailu (vs. samostatný DOI mail) — § 4.6.
- Single opt-in s evidencí (vs. plný DOI) — § 4.6 + risk-check § 4.3.
- Plain-text twin ručně psaný (vs. strip z HTML) — § 4.4.

Tyto stačí dokumentovat v tomto design.md a v decisions.md, ADR by byl overkill.

---

## 11. Konzistence s tie-breaker pravidly (CLAUDE.md sekce 7.6)

**Provedl jsem cross-check svého návrhu proti všem doménovým autoritám:**

| Doména | Autorita | Můj návrh | Konflikt? |
|---|---|---|---|
| Tech & architektura | senior-architect (já) | viz tento dokument | n/a |
| Scope & rozsah | brief.md | redesign + lead capture + maily; PP a optout-confirmation jsem **zařadil**, protože legal je vyžaduje (vyšší autorita) | bez konfliktu |
| Compliance & legal | risk-check.md | strip URL, hash IP, evidence souhlasu, žádný tracking pixel, opt-out flow, PP před prvním leadem, retence cron | bez konfliktu |
| Cost & budget | forecast.md | runtime ≈ 0 USD (Email Workers + D1 + KV ve free tieru), AI volání = 0 | bez konfliktu |
| Tón & copy | marketer (Fáze 4) | strukturu šablon mám, finální copy nechávám marketerovi | bez konfliktu |
| Workflow | project-manager | rozpad očekávám od PM, design je atomický pro junior tasks | bez konfliktu |
| Standardy | product-manager | žádný framework, žádné cookies, vanilla JS, fonty self-host | bez konfliktu |
| Fakta & rešerše | researcher | otevřené otázky § 9 | čeká na researchera |

**Bez konfliktů, dokumenty konzistentní.**

Jediný bod, který vyžaduje pozornost: **„soft DOI jako samostatný mail vs. integrovaný do lead-followup"** — Gate 1 řekl „ano" na všechny tři typy. Můj návrh (§ 4.6) to interpretuje jako „šablona připravena, MVP nepoužívá, plný DOI flow je optional přepínač pro budoucí iteraci". Pokud orchestrátor / owner trvá na samostatném DOI mailu už v MVP, **eskaluju zpět** — udělá z toho 2× mail bez compliance přínosu navíc, jen drop-off konverze. Ale rozhodnutí je na ownerovi/legal.

---

## 12. Implementační poznámky pro juniora

PM rozpadne na atomické tasky. Tady jen technický pořadník (sériový, kde závislost vynucuje):

1. **`wrangler.toml`** — přidat `[[d1_databases]]` `DB`, `[[kv_namespaces]]` `RATELIMIT`, `[[send_email]]` `EMAIL`, případně cron triggers.
2. **`migrations/0001_leads.sql`** — schema z § 2.1, aplikovat přes `wrangler d1 execute`.
3. **`src/lib/url-strip.js`** — strip funkce s deny-list per risk-check § 1.3.
4. **`src/lib/hash.js`** — `sha256Hex(input, salt)`, `randomTokenHex(bytes)`.
5. **`src/lib/lead.js`** — `captureLead(env, data)` — validate, strip, hash, insert (idempotent), trigger mail.
6. **`src/lib/mime.js`** — minimální multipart MIME builder.
7. **`src/lib/mail.js`** — `sendMail(env, template, data)` s retry.
8. **`src/email/templates/_layout.js`** + 4 šablony (`lead-followup`, `magic-link-auth`, `optout-confirmation`, `soft-doi`). Plný copy doplní marketer.
9. **`src/optout.js`** — handler GET `/odhlasit?t=…`.
10. **`src/worker.js`** — routing pro `/api/lead` POST, `/odhlasit` GET, `scheduled` handler (zatím no-op).
11. **`src/analyze.js`** — `ctx.waitUntil(captureLead(...))` po `done` (a po `error` při HTML stažené).
12. **`fakan.cz/index.html`** — formulář, 40+ design tokeny, copy stub (marketer dodá final).
13. **`fakan.cz/vysledek.html` + `vysledek.js`** — forwarding email/consent, copy refresh.
14. **`fakan.cz/prehled.html`** — copy refresh.
15. **`fakan.cz/zasady-ochrany-osobnich-udaju.html`** — statická stránka, obsah od legal+marketer.
16. **`fakan.cz/odhlasit-hotovo.html`** — fallback statická.
17. **`legal/consent-versions/v1-2026-05-08.md`** — verzovaný text souhlasu (od legal+marketer).
18. **Smoke test** — celý flow od `index.html` až po dorazení mailu z `jsem@fakan.cz` testovací schránky.

PM si to rozpadne dle své vlastní cadence (3 paralelní pruhy: backend / frontend / copy+legal).

---

## 13. Verdikt

**Design hotov, předávám PM zakázky na rozpad.**

Otázky pro researchera (§ 9) běží paralelně, neblokují PM rozpad — jejich výstupy se promítnou do tasků v Fázi 3. Pokud researcher najde, že `[[send_email]]` syntaxe je jiná nebo Email Workers má hard quota, vrátíme se sem a doupravíme § 4.

Po Gate 2 se design považuje za baseline pro junior implementaci.
