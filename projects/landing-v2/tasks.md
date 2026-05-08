# Tasks — landing-v2

**Autor:** project-manager
**Status:** rozpad → čeká Gate 2
**Datum:** 2026-05-08

**Vstupy:** [`brief.md`](brief.md) · [`decisions.md`](decisions.md) · [`risk-check.md`](risk-check.md) · [`forecast.md`](forecast.md) · [`fit-check.md`](fit-check.md) · [`design.md`](design.md) · [`docs/adr/ADR-001-email-outbound-cloudflare-vs-mailchannels.md`](../../docs/adr/ADR-001-email-outbound-cloudflare-vs-mailchannels.md)

---

## A. Tasks

Pruhy: **B** = backend, **F** = frontend, **C** = copy, **L** = legal, **T** = tooling/ops.
Junior-velikost = 1–4 h. Code review na všech junior-developer taskech dělá `senior-architect` paralelně, samostatně se neobjevuje jako task.

---

### TASK-01: `wrangler.toml` — bindings (D1, KV, Email Workers, secret salt)
**Role:** junior-developer
**Pruh:** B
**Odhad:** 1 h
**Závislosti:** —
**Vstupy:** `design.md` § 1.3 + § 4.1 + § 4.2, `wrangler.toml` (existující), researcher výstup pro syntaxi `[[send_email]]` (čeká, ale junior začne s předpokládanou syntaxí, doplní po researcheru)
**Co se má udělat:** Přidat do `wrangler.toml` čtyři nová bindings: `[[d1_databases]]` jako `DB`, `[[kv_namespaces]]` jako `RATELIMIT`, `[[send_email]]` jako `EMAIL`, `[vars]` placeholder `CONSENT_SALT` (komentář „secret put přes wrangler secret put"). Compatibility date `2025-05-01` ponechat. `[assets].run_worker_first` rozšířit o `/odhlasit*`. Žádný cron trigger zatím (retence je backlog per design § 3.4).
**Acceptance criteria:**
- [ ] `wrangler.toml` obsahuje binding `DB` (D1, database_name `fakan_leads` nebo `fakan-leads` per CF konvence), id `TBD` placeholder s komentářem „nahradit po `wrangler d1 create`"
- [ ] Binding `RATELIMIT` (KV), id placeholder
- [ ] Binding `EMAIL` (Email Workers, `[[send_email]]` syntaxe), bez `allowed_destination_addresses` restrikce
- [ ] `run_worker_first = ["/api/*", "/odhlasit*"]`
- [ ] `wrangler.toml` projde `wrangler types` / `wrangler deploy --dry-run` bez chyby
- [ ] Komentáře česky, krátké, vysvětlují proč each binding (kdyby šel někdo cizí číst za 6 měsíců)
- [ ] Žádné secrety v plain (jen poznámka „CONSENT_SALT řešit přes `wrangler secret put`")
**Smoke test:** `wrangler deploy --dry-run` projde lokálně.
**Pro testera:** ověřit, že `wrangler.toml` parser nehlásí varování. Zkontrolovat, že žádný binding nebyl smazán.

---

### TASK-02: D1 migrace `0001_leads.sql`
**Role:** junior-developer
**Pruh:** B
**Odhad:** 1 h
**Závislosti:** TASK-01
**Vstupy:** `design.md` § 2.1 (přesné schema), `risk-check.md` § 2.2
**Co se má udělat:** Vytvořit `migrations/0001_leads.sql` přesně podle design § 2.1. Tabulka `leads` se sloupci v pořadí podle designu, unique index `leads_idem` na `(email, url, substr(created_at, 1, 10))`, indexy `leads_status_created` a `leads_last_contact`. Header komentář s důvodem (lead capture, autor, datum) a odkazem na risk-check.
**Acceptance criteria:**
- [ ] Soubor `migrations/0001_leads.sql` existuje
- [ ] `CREATE TABLE leads` má všechny sloupce z `design.md` § 2.1 včetně typů a NOT NULL constraintů
- [ ] Pole `consent_at`, `consent_text_version`, `consent_ip_hash`, `unsubscribe_token` jsou přítomna a NOT NULL (kromě `consent_ua_hash`)
- [ ] `unsubscribe_token` má `UNIQUE` constraint
- [ ] Unique index `leads_idem` na `(email, url, substr(created_at, 1, 10))`
- [ ] Indexy `leads_status_created` a `leads_last_contact`
- [ ] Soubor projde `wrangler d1 execute fakan_leads --local --file=./migrations/0001_leads.sql` bez syntax error
- [ ] Komentář vysvětlující idempotence strategii (per-day granularita)
**Smoke test:** `wrangler d1 execute --local` aplikuje schema; `SELECT name FROM sqlite_master WHERE type='table'` vrátí `leads`.
**Pro testera:** vyzkoušet INSERT dvou stejných řádků s `(email, url, day)` — druhý musí selhat na UNIQUE.

---

### TASK-03: Helper `src/lib/url-strip.js`
**Role:** junior-developer
**Pruh:** B
**Odhad:** 1 h
**Závislosti:** —
**Vstupy:** `design.md` § 2.1 řádek `url`, `risk-check.md` § 1.3
**Co se má udělat:** Funkce `stripUrl(input: string): string` — vstup URL, výstup origin + pathname (žádný query string a hash). Před stripem odstranit známé senzitivní query parametry, kdyby se rozhodlo časem path zachovat. Pro MVP postačí: parse URL přes `new URL()`, vrátit `${origin}${pathname}` bez `search` a `hash`. Při invalid URL vyhodit chybu, kterou volající chytne.
**Acceptance criteria:**
- [ ] Export `stripUrl(input)` v `src/lib/url-strip.js`
- [ ] `stripUrl('https://example.cz/page?utm_source=x&token=abc')` = `'https://example.cz/page'`
- [ ] `stripUrl('https://example.cz')` = `'https://example.cz/'` (URL API přidá trailing slash, OK)
- [ ] `stripUrl('https://example.cz/?')` = `'https://example.cz/'`
- [ ] `stripUrl('not a url')` vyhodí TypeError
- [ ] Bez npm závislostí
- [ ] JSDoc komentář s 1-line popisem + odkaz na `risk-check.md` § 1.3
**Smoke test:** Lokálně v node REPL nebo jednoduchý `node -e "import('./src/lib/url-strip.js').then(m => console.log(m.stripUrl('https://example.cz/page?utm=x')))"`.
**Pro testera:** edge cases — URL s portem, IPv6, IDN doména (`https://háčky.cz`), URL s userinfo (`https://user:pass@example.cz` — Worker by tohle neměl dostat, ale otestuj že to nespadne).

---

### TASK-04: Helper `src/lib/hash.js` — hash + token gen
**Role:** junior-developer
**Pruh:** B
**Odhad:** 1 h
**Závislosti:** —
**Vstupy:** `design.md` § 2.2 a § 2.4
**Co se má udělat:** Dvě funkce: `sha256Hex(input: string, salt: string): Promise<string>` (sha256 přes Web Crypto, hex výstup) a `randomTokenHex(bytes: number): string` (`crypto.getRandomValues()` na Uint8Array, hex). Bez npm dependencies, používá se Web Crypto API dostupné v Workers runtime.
**Acceptance criteria:**
- [ ] Export `sha256Hex(input, salt)` — vrací 64znakový hex string
- [ ] Export `randomTokenHex(bytes)` — vrací string délky `bytes * 2` (hex)
- [ ] `sha256Hex('1.2.3.4', 'salt1') === sha256Hex('1.2.3.4', 'salt1')` (deterministic)
- [ ] `sha256Hex('1.2.3.4', 'salt1') !== sha256Hex('1.2.3.4', 'salt2')` (salt mění výstup)
- [ ] `randomTokenHex(32)` vrací 64znakový string, dva po sobě volání dají různé výsledky
- [ ] Bez npm závislostí, používá se `globalThis.crypto`
- [ ] JSDoc komentář
**Smoke test:** Lokálně v node `--experimental-vm-modules` nebo přes `wrangler dev` test endpoint.
**Pro testera:** ověřit, že `crypto.getRandomValues()` v Workers runtime opravdu funguje (ne jen Node polyfill). Tester to zkusí přes `wrangler dev` s testovací routou.

---

### TASK-05: Mini-MIME builder `src/lib/mime.js`
**Role:** junior-developer
**Pruh:** B
**Odhad:** 2 h
**Závislosti:** —
**Vstupy:** `design.md` § 4.4 a § 4.5 (architect výslovně zakázal npm `mimetext`)
**Co se má udělat:** Vlastní minimální `multipart/alternative` MIME builder. API:
```js
buildMime({
  from: { name, addr },
  to: addr,
  subject,
  replyTo,
  headers: { 'List-Unsubscribe': '...', 'List-Unsubscribe-Post': '...' },
  text,    // plain text body
  html,    // HTML body
}): string  // raw RFC 5322 message
```
Multipart boundary náhodný (přes `randomTokenHex(16)`). Headers UTF-8 přes `=?UTF-8?B?...?=` encoding pro non-ASCII (subject s diakritikou). Bez npm dependencies.
**Acceptance criteria:**
- [ ] Export `buildMime(opts)` v `src/lib/mime.js`
- [ ] Output validní RFC 5322 / 5322bis multipart/alternative zpráva
- [ ] Subject s diakritikou (`Analýza fakan.cz — našli jsme tři věci`) projde MIME encoding
- [ ] Plain a HTML část oba uvedené (`Content-Type: text/plain; charset=UTF-8` resp. `text/html; charset=UTF-8`)
- [ ] Custom headers (`Reply-To`, `List-Unsubscribe`, `List-Unsubscribe-Post`) v output přítomné
- [ ] Žádná npm závislost (`package.json` se nemění)
- [ ] CRLF (`\r\n`) line endings, ne LF
- [ ] Test: výstup zparsovaný přes `node-mailparser` (jen pro test, ne v runtime) odpovídá vstupu
**Smoke test:** Test soubor `tests/mime.test.js` (nebo ad-hoc node script) zparsuje výstup a ověří strukturu.
**Pro testera:** zkusit emoji v subject (`✨` — i když brand zakazuje, raději otestovat že to nespadne), dlouhý subject (>78 znaků — folding), diakritika v `from.name`.

---

### TASK-06: Lead capture core `src/lib/lead.js`
**Role:** junior-developer
**Pruh:** B
**Odhad:** 3 h
**Závislosti:** TASK-02, TASK-03, TASK-04
**Vstupy:** `design.md` § 2.3 + § 3.1 + § 4.5, `risk-check.md` § 2.1
**Co se má udělat:** Funkce `captureLead(env, data)`:
1. Validace: `consent === true` (jinak return `{skipped: 'no-consent'}`), `email` matchuje regex, `consentVersion` v allowlistu (zatím `['v1-2026-05-08']`).
2. Sanitizace: `stripUrl(data.url)`, `sha256Hex(data.ip, env.CONSENT_SALT)`.
3. Generování: `crypto.randomUUID()` pro `id`, `randomTokenHex(32)` pro `unsubscribe_token`, ISO timestamp pro `created_at`/`consent_at`/`last_contact_at`.
4. INSERT prepared statement do `env.DB`, chytnout UNIQUE constraint failed jako duplicate (return `{duplicate: true, leadId: undefined}`).
5. Po úspěšném INSERTu vrátit `{ok: true, leadId, unsubscribeToken}`.

Volání `sendMail()` **NENÍ v této funkci** — to dělá volající (`analyze.js` přes `ctx.waitUntil`). `captureLead` je čistě DB layer + validation.
**Acceptance criteria:**
- [ ] Export `captureLead(env, data)` async funkce
- [ ] Bez `consent === true` se neprovede žádný DB write a vrátí se `{skipped: 'no-consent'}`
- [ ] Email validace přes regex (RFC 5322 jednoduchý subset, např. `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`); fail → `{skipped: 'bad-email'}`
- [ ] `consentVersion` mimo allowlist → `{skipped: 'unknown-consent-version'}`
- [ ] Úspěch → INSERT s 13 NOT NULL sloupci + 4 nullable; vrací `{ok: true, leadId, unsubscribeToken}`
- [ ] UNIQUE constraint failed → `{duplicate: true}` (žádný throw)
- [ ] Jiná DB chyba → throw (volající chytne)
- [ ] `consent_ip_hash` se ukládá jako sha256, ne plain IP
- [ ] `url` se ukládá stripnutá (bez query stringu)
- [ ] `last_contact_at = created_at` při insertu
- [ ] JSDoc s odkazy na risk-check § 2.1
**Smoke test:** Lokální `wrangler dev` test endpoint, který zavolá `captureLead` se sample daty, ověří `SELECT * FROM leads`.
**Pro testera:** edge cases — email s `+` aliasem (`jan+spam@fakan.cz`), URL s českými znaky (`https://háčky.cz`), invalid `consent` typy (`'true'` string, `1` číslo, `'on'`), prázdné `ip` (lokální dev), duplicitní insert (musí vrátit `{duplicate: true}`).

---

### TASK-07: Mail sender `src/lib/mail.js` (Email Workers wrapper + retry)
**Role:** junior-developer
**Pruh:** B
**Odhad:** 2 h
**Závislosti:** TASK-01, TASK-05; **researcher** (TASK-21) ideálně doběhl
**Vstupy:** `design.md` § 4.5
**Co se má udělat:** Funkce `sendMail(env, recipient, builtTemplate)`:
1. Sestavit MIME přes `buildMime()` (TASK-05).
2. Volat `env.EMAIL.send(new EmailMessage(from, recipient, raw))`.
3. Retry 1× s 1s delay při výjimce.
4. Vrací `{ok: true}` / `{ok: false, error: string}`. **NIKDY** netrhne, volající nemá padnout kvůli mailu.
5. Druhá funkce `markLeadMailed(env, leadId, result)` updatuje `leads.status` na `'mailed'`/`'bounced'`, `mail_sent_at`, `mail_attempts`, `mail_last_error`. Tahle se volá zvlášť po `sendMail`.

`from` je `{ name: 'Daniel Hromada — fakan.cz', addr: 'nabidky@fakan.cz' }` (per design § 4.3) pro lead-followup a optout-confirmation. Pro magic-link `prihlaseni@fakan.cz`. `Reply-To: jsem@fakan.cz`.
**Acceptance criteria:**
- [ ] Export `sendMail(env, recipient, builtTemplate)` async
- [ ] Export `markLeadMailed(env, leadId, result)` async
- [ ] Při úspěchu (`env.EMAIL.send` resolve) → `{ok: true}`
- [ ] Při výjimce → 1× retry po 1s, pak `{ok: false, error: ...}` (truncate 500 znaků)
- [ ] `markLeadMailed` updatuje `status = 'mailed'` při ok=true, `'bounced'` při ok=false; vždy zvyšuje `mail_attempts`
- [ ] Žádný throw z `sendMail` (volající `ctx.waitUntil` se nesmí zhroutit)
- [ ] `Reply-To: jsem@fakan.cz` v mailu
- [ ] JSDoc
**Smoke test:** Lokálně přes `wrangler dev` (Email Workers binding nemusí poslat, ale `send()` musí být zavoláno bez throw). Plný end-to-end test až po DNS setupu (zodpovědnost ownera + researcher TASK-21).
**Pro testera:** mock `env.EMAIL.send()` který vyhodí výjimku — ověřit retry chování. Reálný test až po DNS verifikaci.

---

### TASK-08: Mail šablony — `_layout.js` + 4 šablony (skeleton + struktura)
**Role:** junior-developer
**Pruh:** B
**Odhad:** 2 h
**Závislosti:** —
**Vstupy:** `design.md` § 5 (struktura, vstupy, subject, sekce); copy dodá marketer (TASK-13–15)
**Co se má udělat:** Vytvořit:
- `src/email/templates/_layout.js` — export `wrap(bodyHtml, footerHtml)` který obalí HTML do `<!doctype html><html lang="cs"><head><meta charset="utf-8">...` s inline CSS (max 600 px wide, system font stack, Fakan Orange CTA, žádné webfonty), a vrátí kompletní HTML. Druhá funkce `wrapText(bodyText, footerText)` pro plain. Patička přijímá parametry `{ico, address, email, phone, optoutUrl}` (může být `null` pro magic-link, kde optoutUrl chybí).
- `src/email/templates/lead-followup.js` — export `leadFollowup({targetUrl, hostname, summary, unsubscribeUrl, leadId, sentAt})` vrací `{subject, html, text}`. Sekce 1–5 per design § 5.1. **Subject hardcoded** (`Analýza ${hostname} — co jsme našli`), tělo s placeholdery `{{COPY:...}}` které marketer nahradí v TASK-13.
- `src/email/templates/magic-link-auth.js` — vstupy `{magicLinkUrl, expiresInMinutes, ip, userAgent}`, struktura per § 5.2. Komentář `<!-- DRAFT v0 — endpoint pro magic link auth ještě neimplementován -->` v HTML.
- `src/email/templates/optout-confirmation.js` — vstupy `{email, optedOutAt}`, struktura § 5.3. Žádné CTA, jen potvrzení.
- `src/email/templates/soft-doi.js` — vstupy `{targetUrl, hostname, confirmUrl, expiresInHours}`, struktura § 5.4, komentář „šablona na sklad, MVP nepoužívá".

Junior dodá **strukturu, vstupy, subject, layout, patičku, placeholders**. Marketer ve fázi C nahradí placeholders finálním copy.
**Acceptance criteria:**
- [ ] 5 souborů existuje (`_layout.js` + 4 šablony)
- [ ] Každá šablona exportuje funkci, která přijímá objekt a vrací `{subject, html, text}`
- [ ] HTML má `<!doctype html>`, `lang="cs"`, `<meta charset="utf-8">`, `<meta name="viewport" ...>`, `<meta name="x-apple-disable-message-reformatting">` (Apple Mail fix), max-width 600 px container
- [ ] Žádný `<img>` z externí domény, žádný `<script>`, žádný `<link rel="stylesheet">` na CDN
- [ ] Žádný tracking pixel (per risk-check § 5.2)
- [ ] Plain text twin **ručně psaný** (placeholders pro copy), ne strip z HTML
- [ ] Patička obsahuje placeholders `{{IDENTITY:JMENO}}`, `{{IDENTITY:ICO}}`, `{{IDENTITY:ADRESA}}`, `{{IDENTITY:EMAIL}}`, `{{IDENTITY:TELEFON}}`, `{{OPTOUT_URL}}` (lead-followup, soft-doi, optout-confirmation)
- [ ] `magic-link-auth.js` má v patičce **bez** opt-out odkazu (per design § 5.2)
- [ ] DRAFT v0 komentář v `magic-link-auth.js` a `soft-doi.js`
**Smoke test:** Importovat každou šablonu v node REPL, zavolat s minimálními argumenty, ověřit že vrací `{subject, html, text}` typu string.
**Pro testera:** ověřit že žádný `<img src="http">` v HTML, žádný `<script>`, plain-text neobsahuje HTML tagy.

---

### TASK-09: `/odhlasit` endpoint — Worker handler `src/optout.js`
**Role:** junior-developer
**Pruh:** B
**Odhad:** 2 h
**Závislosti:** TASK-01, TASK-02, TASK-04, TASK-07, TASK-08
**Vstupy:** `design.md` § 3.3, `risk-check.md` § 5.3
**Co se má udělat:** Handler `handleOptout(request, env, ctx)` v `src/optout.js`:
1. Parse `t` query parametr; validace: 64 hex znaků (regex). Pokud failed → render generic „odhlášeno" stránku (NE 404, per risk-check).
2. `SELECT id, email, status FROM leads WHERE unsubscribe_token = ?`.
3. Pokud nenalezen → render generic „odhlášeno" stránku (silent).
4. Pokud nalezen a `status != 'opted_out'`:
   - `UPDATE leads SET status = 'opted_out', opted_out_at = ?, last_contact_at = ? WHERE id = ?`
   - `ctx.waitUntil(sendMail(env, email, optoutConfirmation({email, optedOutAt})))`
5. Render HTML stránku „Hotovo, odhlásili jsme vás" (inline z Workeru, max 2 KB, sentence case, vykání, tokeny per `index.html`).

URL kontrakt: **`/odhlasit?t=<token>`** (query parametr `t`, ne `token` — sjednoceno per tie-breaker, viz konzistenční gate).
**Acceptance criteria:**
- [ ] Export default async funkce, která dostane `(request, env, ctx)` a vrátí `Response`
- [ ] Validace `t`: regex `/^[a-f0-9]{64}$/`. Fail → 200 generic „odhlášeno" HTML stránka, **ne 400 ani 404**
- [ ] Token nenalezen v DB → 200 generic stránka (žádný leak existence tokenu)
- [ ] Token nalezen → DB UPDATE se provede, `opted_out_at` má aktuální ISO timestamp
- [ ] Po úspěchu: `ctx.waitUntil(sendMail(...))` pro `optout-confirmation` mail
- [ ] Idempotent: druhé volání téhož tokenu nevyhodí chybu, jen se znovu vyrenderuje stránka (status už `opted_out`, žádný DUPLICATE mail)
- [ ] HTML response má `Content-Type: text/html; charset=utf-8` a `noindex` meta tag
- [ ] Žádné cookies, žádný `Set-Cookie`
- [ ] DB error → 503 s česky lidskou hláškou „Dočasná chyba. Zkuste to znovu za pár minut."
**Smoke test:** `wrangler dev` + `curl localhost:8787/odhlasit?t=$(node -e "console.log('a'.repeat(64))")` → 200 generic stránka. Pak vložit reálný token z lokální D1 a ověřit UPDATE.
**Pro testera:** invalid `t` (prázdný, krátký, dlouhý, non-hex), neexistující token (musí vypadat stejně jako úspěch), idempotence (2× klik), DB unavailable (mock).

---

### TASK-10: Worker routing — `src/worker.js` integrace `/odhlasit` a `/api/lead`
**Role:** junior-developer
**Pruh:** B
**Odhad:** 1.5 h
**Závislosti:** TASK-09
**Vstupy:** `design.md` § 3.2 + § 3.3, existující `src/worker.js`
**Co se má udělat:** Modifikovat `src/worker.js` (existující entry, který už drží routing pro `/api/analyze`):
1. Přidat route `GET /odhlasit*` → `handleOptout(...)`.
2. Přidat route `POST /api/lead` → `handleLeadPost(...)` (fallback handler — viz design § 3.2).
3. `handleLeadPost`: parse JSON body, validate per design § 3.2, zavolat `captureLead`, při úspěchu `ctx.waitUntil(sendMail(...))` pro lead-followup, vrátit 204/400/429.
4. CORS header `Access-Control-Allow-Origin: https://fakan.cz` jen pro `/api/lead`.
5. Žádný cookie, žádný `Set-Cookie`.
**Acceptance criteria:**
- [ ] `GET /odhlasit?t=...` směruje na `handleOptout`
- [ ] `POST /api/lead` směruje na nový handler
- [ ] Handler validuje `consent === true`, `email`, `consentVersion` (allowlist)
- [ ] 204 při úspěchu, 400 při validaci, 429 při rate limit (TASK-11)
- [ ] CORS pouze `https://fakan.cz`, ne `*`
- [ ] Žádný regress na `/api/analyze` (existující flow funguje)
- [ ] Test: `curl -X POST localhost:8787/api/lead -d '{"url":"https://example.cz","email":"a@b.cz","consent":true,"consentVersion":"v1-2026-05-08","source":"manual"}'` → 204
**Smoke test:** `wrangler dev` + curl výše. Zkontrolovat `SELECT * FROM leads` (lokální D1).
**Pro testera:** missing fields, `consent: false` (musí 400), invalid email, OPTIONS preflight (musí 204 s CORS hlavičkami).

---

### TASK-11: Rate limit + honeypot v `/api/lead` a `/api/analyze` lead-capture větvi
**Role:** junior-developer
**Pruh:** B
**Odhad:** 1.5 h
**Závislosti:** TASK-10, TASK-04
**Vstupy:** `design.md` § 7.1 + § 7.2
**Co se má udělat:**
1. Helper `checkRateLimit(env, ipHash, key, max, windowSec)` v `src/lib/ratelimit.js` per design § 7.1.
2. V `/api/lead` POST handler: spočítat `ipHash`, zavolat `checkRateLimit(env, ipHash, 'lead', 5, 3600)`. Při fail → 429.
3. Honeypot: pokud body obsahuje pole `company` s neprázdnou hodnotou → silent 204 (per design § 7.2), **nic neukládat**.
4. V `/api/analyze` lead-capture větvi (po `done`, viz TASK-12) stejný rate limit klíč `'lead'`.
**Acceptance criteria:**
- [ ] `src/lib/ratelimit.js` exportuje `checkRateLimit(env, ipHash, key, max, windowSec)` async, vrací bool
- [ ] 6. lead z téhož IP do hodiny → 429 `{error: 'Moc rychle. Zkuste za pár minut.'}`
- [ ] Honeypot `company` field ≠ '' → silent 204, žádný INSERT
- [ ] `/api/analyze` lead-capture větev také kontroluje rate limit (per design § 7.1)
- [ ] KV race condition akceptovaná (per design § 7.1)
- [ ] Žádný throw při KV chybě — degraded gracefully (rate limit nefunguje, ale lead capture pokračuje, log warning)
**Smoke test:** Skript který 6× za sebou pošle lead z téhož IP, šestý dostane 429.
**Pro testera:** opt-out endpoint **NESMÍ** mít rate limit (per design § 7.1 + risk-check § 5).

---

### TASK-12: `src/analyze.js` — piggyback lead capture po `done` SSE eventu
**Role:** junior-developer
**Pruh:** B
**Odhad:** 2 h
**Závislosti:** TASK-06, TASK-07, TASK-08, TASK-11
**Vstupy:** `design.md` § 1.4 + § 3.1, existující `src/analyze.js`
**Co se má udělat:** V existujícím SSE handleru `analyze.js`:
1. Parsovat z query: `em`, `c`, `v`, `s`. Pokud `c === '1'` a `em` a `v` přítomné → lead-capture větev aktivní.
2. Po `done` SSE eventu (a po `error`, kdy se HTML podařilo aspoň částečně získat — viz design § 3.1 pozn.): `ctx.waitUntil(captureLeadAndMail(...))`.
3. `captureLeadAndMail` (helper interní): rate limit check → `captureLead()` → pokud ok a ne duplicate → `sendMail(env, email, leadFollowup({...}))` → `markLeadMailed`.
4. **Žádný blocking** stávajícího SSE flow. Lead capture je server-side fire-and-forget.

`source` parametr má enum `'landing-hero' | 'landing-cta' | 'vysledek-form' | 'manual'`; default `'unknown'`.
**Acceptance criteria:**
- [ ] `analyze.js` parsuje `em`, `c`, `v`, `s` z query
- [ ] Bez `c=1` se lead capture **vůbec** nespustí (žádný DB call, žádný mail)
- [ ] S `c=1`+`em`+`v` se po `done` zavolá `captureLeadAndMail` přes `ctx.waitUntil`
- [ ] SSE flow se nezpomalí (lead capture je fire-and-forget)
- [ ] Při chybě v lead capture: `console.error('[lead] ...', err)`, SSE flow neovlivněn
- [ ] Při `error` SSE eventu (HTML stažené, analýza spadla na detektoru) se lead přesto zachytí, mail s textem „nepodařilo se stáhnout web, ale díky za zájem" (per design § 3.1 pozn.) — **MVP zjednodušení:** mail je vždy `lead-followup` template, copy v ní řeší marketer (TASK-13)
- [ ] `summary` objekt předaný do mail šablony obsahuje top 3 verdiktů z analýzy, score, securityScore, trackerCount (per design § 5.1 vstup)
**Smoke test:** `wrangler dev` + curl s `?url=...&em=test@fakan.cz&c=1&v=v1-2026-05-08&s=landing-hero`, ověřit `SELECT * FROM leads` a console.log o pokusu o mail.
**Pro testera:** flow bez consentu (žádný lead), flow s consentem ale neexistující doménou (lead se musí uložit, mail dorazí), flow s consentem a duplicitní URL+email (UNIQUE constraint, jen 1 lead), opt-out odkaz v mailu funguje.

---

### TASK-13: Copy — Privacy Policy text + verzovaný consent text
**Role:** marketer (lead) + legal-advisor (review)
**Pruh:** C + L
**Odhad:** marketer 1.5 h, legal-advisor 1 h (review + dotvoření)
**Závislosti:** —
**Vstupy:** `risk-check.md` § 2 + § 4, `design.md` § 6.5, `decisions.md`
**Co se má udělat:**
1. **`legal/consent-versions/v1-2026-05-08.md`** — verzovaný text souhlasu pro retroaktivní důkaz (per risk-check § 2.2). Obsah: finální znění z risk-check § 4.2 (`Souhlasím, aby společnost Daniel Hromada (Fakan)...`), datum účinnosti, IČO placeholder.
2. **`fakan.cz/ochrana-udaju.html`** content (markdown draft → marketer učeše do tónu vykání + 40+ → junior pak zhmotní v TASK-19): kdo zpracovává (Fakan, IČO, kontakt), co sbíráme (URL, email, hash IP, consent), právní titul (čl. 6/1/a souhlas), retence (24 měsíců, opt-out 3 roky), procesoři (Cloudflare DPF), práva subjektu (čl. 15–22), kontakt pro výmaz, datum účinnosti.

URL kontrakt: **`/ochrana-udaju`** (sjednoceno per tie-breaker — viz konzistenční gate).
**Acceptance criteria (marketer):**
- [ ] Soubor `legal/consent-versions/v1-2026-05-08.md` obsahuje finální znění souhlasu (vykání, ne tykání)
- [ ] Draft Privacy Policy v `projects/landing-v2/copy.md` (pracovní úložiště, junior z toho udělá HTML v TASK-19) má všechny sekce z risk-check § 2
- [ ] Vykání všude, sentence case, krátké věty
- [ ] Pojmy lidsky („cookies = malé soubory, které vás sledují" pokud je třeba; ale ideálně bez technického žargonu)
- [ ] Žádné anglicismy bez českého ekvivalentu
- [ ] Datum účinnosti = `2026-05-15` (předpokládaný launch)
**Acceptance criteria (legal-advisor):**
- [ ] Privacy Policy obsahuje **všech 7 povinných bodů** z risk-check § 2.4 (kdo, co, titul, retence, procesoři, práva, kontakt)
- [ ] Identifikuje správce: Daniel Hromada (Fakan), IČO `{{ICO}}`, adresa `{{ADRESA}}` (placeholders dodá owner)
- [ ] Cloudflare odkaz na DPF (per risk-check § 2.6)
- [ ] Sekce „Vaše práva" pokrývá čl. 15–22 GDPR
- [ ] Email pro výmaz: `jsem@fakan.cz`
- [ ] Žádný vágní claim („v souladu se zákonem" bez specifikace)
**Smoke test:** marketer + legal-advisor podepíší draft v `copy.md` (text-OK).
**Pro testera:** v Gate 3 ověřit, že rendrovaná HTML (TASK-19) obsahuje všechny sekce a placeholdery jsou vyplněné.

---

### TASK-14: Copy — `index.html`, `vysledek.html`, `prehled.html` (vykání + 40+ tón)
**Role:** marketer
**Pruh:** C
**Odhad:** 3 h
**Závislosti:** —
**Vstupy:** `brief.md` (cíle, cílovka, žargon-blacklist), `design.md` § 6.1 + § 6.3 + § 6.4, `decisions.md` (kompletní redesign copy)
**Co se má udělat:** Marketer napíše do `projects/landing-v2/copy.md` finální texty pro:
1. **`index.html`** — hero (H1, podtitul, CTA), sekce „Co děláme", „Jak to funguje", „Standardy", „Hosting", CTA banner, patička. Žádné: „AI agenty", „framework", „hydration", „LCP", „CLS", „INP", „WCAG", „CDN", „kernel" v hero. Slovo „cookies" pryč z hero stats. Nový tagline (na test, owner schválí v Gate 3).
2. **`vysledek.html`** — copy refresh, vykání, info banner po `done` („Výsledky vám pošleme i na {email}"), CTA banner.
3. **`prehled.html`** — celý copy projít na vykání, hero přepsat bez technického žargonu, technické sekce zachovat hlouběji (srozumitelněji).
4. **Form labely + placeholdery + texty checkboxu** pro `index.html` form per design § 6.1 + risk-check § 4.2 znění souhlasu.

`copy.md` má strukturu: pro každou stránku jednu sekci, pro každou textovou jednotku H3 ID (`hero-h1`, `hero-cta`, `consent-text`...) které junior v TASK-16/17/18 substituuje.
**Acceptance criteria:**
- [ ] `copy.md` obsahuje sekci pro každou ze tří stránek + form labely
- [ ] **0 výskytů** „ty/tvůj/tobě/tě" (kromě případně schváleného taglinu)
- [ ] **0 výskytů** žargon-blacklistu (AI agenty, framework, hydration, LCP, CLS, INP, WCAG, CDN, kernel) v hero sekcích
- [ ] Sentence case v UI titulech, ne Title Case
- [ ] Krátké věty (max 15 slov v hero)
- [ ] Konkrétní čísla tam, kde to dává smysl (žádné „rychlejší" bez čísla)
- [ ] Návrh nového taglinu (1–3 varianty) v `copy.md` sekci „Tagline návrhy" (owner volí v Gate 3)
- [ ] Form labely + placeholdery odpovídají design § 6.1
- [ ] Text checkboxu souhlasu = finální znění z TASK-13 (`legal/consent-versions/v1-2026-05-08.md`)
**Smoke test:** Quick read-through od marketera, žádné anglicismy z lenosti, žádné korpo bullshit.
**Pro testera:** v TASK-16/17/18 Lighthouse-style content scan — automatický check žargon-blacklistu (jednoduchý `grep`).

---

### TASK-15: Copy — mailové šablony (4× full copy + patička)
**Role:** marketer (lead) + legal-advisor (review pre-launch v TASK-25)
**Pruh:** C + L
**Odhad:** marketer 2 h, legal-advisor součást TASK-25
**Závislosti:** TASK-13, TASK-08 (struktura šablon)
**Vstupy:** `design.md` § 5, `risk-check.md` § 5 + § 6, `decisions.md`
**Co se má udělat:** Marketer dodá do `copy.md` finální copy pro 4 maily (placeholders `{{COPY:...}}` z TASK-08 → finální text):
1. **`lead-followup`** — soft DOI úvod („Tento email vám posíláme proto, že jste si na fakan.cz vyžádal/a analýzu webu {URL} a souhlasil/a se zasláním výsledků. Pokud to nejste vy, klikněte sem [opt-out] a smažeme váš email."), top 3 verdiktů z analýzy (template strings pro `{{summary.topVerdicts}}`), 2 odstavce „Co můžeme udělat" (audit / hosting), CTA „Domluvte si bezplatný 15min hovor" → `mailto:jsem@fakan.cz`.  **Per risk-check § 6:** explicitně „nezávazný návrh řešení, ne smluvní nabídka", žádný auto-akcept, cena orientační (vidlice).
2. **`magic-link-auth`** (draft v0) — krátký, „Klikněte pro přihlášení", platnost 15 minut, „pokud to nejste vy, ignorujte" + IP a UA pro paranoidní.
3. **`optout-confirmation`** — „Hotovo, odhlásili jsme vás", odkaz na `jsem@fakan.cz` pro chybu, žádný marketing.
4. **`soft-doi`** (na sklad) — „Potvrďte zájem o analýzu {hostname}", confirm link, platnost 24h.

**Patička pro všechny:**
- `{{IDENTITY:JMENO}}` = `Daniel Hromada (Fakan)` (owner potvrdí)
- `{{IDENTITY:ICO}}`, `{{IDENTITY:ADRESA}}` — owner dodá (TASK-23)
- `{{IDENTITY:EMAIL}}` = `jsem@fakan.cz`
- `{{IDENTITY:TELEFON}}` = `+420 604 690 539`
**Acceptance criteria:**
- [ ] Všechny 4 šablony mají kompletní HTML i plain copy v `copy.md`
- [ ] `lead-followup` má soft DOI úvodní odstavec (per risk-check § 4.3)
- [ ] `lead-followup` obsahuje frázi „nezávazný návrh řešení" (per risk-check § 6.2)
- [ ] Žádný auto-akcept smluvní nabídky („odpovědí potvrzujete..." je zakázané)
- [ ] Cena (pokud zmíněna) je orientační vidlice, ne fix
- [ ] Vykání všude
- [ ] `optout-confirmation` neobsahuje marketing CTA
- [ ] `magic-link-auth` v patičce **nemá** opt-out odkaz (per design § 5.2)
- [ ] Subject u každé šablony max 50 znaků, bez emoji
- [ ] Patička v jednotném formátu pro všechny šablony (kromě magic-link bez opt-out)
**Smoke test:** Přečíst si každý mail nahlas — zní to jako 60letý instalatér by tomu rozuměl?
**Pro testera (až v Gate 3 + TASK-25):** legal-advisor projde finální drafty proti risk-check § 5 a § 6.

---

### TASK-16: `index.html` — redesign 40+ + lead capture form
**Role:** junior-developer
**Pruh:** F
**Odhad:** 3.5 h
**Závislosti:** TASK-14 (copy)
**Vstupy:** `design.md` § 6.1, `brief.md` (a11y, mobile), `risk-check.md` § 1.3 (varování o tokenech v URL)
**Co se má udělat:** Modifikovat `fakan.cz/index.html`:
1. Substituovat copy z `copy.md` (TASK-14) — hero, sekce, CTA, patička.
2. Form: rozšířit o `<input type="email">` s mobile attrs (`autocomplete="email"`, `autocapitalize="none"`, `autocorrect="off"`, `spellcheck="false"`, `inputmode="email"`), `<input type="checkbox">` pro consent (per design § 6.1 HTML návrh), honeypot `<input name="company">` (skrytý).
3. Submit forwarduje do `/vysledek?url=...&em=...&c=1&v=v1-2026-05-08&s=landing-hero` (resp. `s=landing-cta` u CTA banner formuláře).
4. Pod URL polem malé varování: „URL bez přihlašovacích tokenů, prosím." (per risk-check § 1.3 doporučení).
5. Nový odkaz v patičce: `<a href="/ochrana-udaju">Zásady ochrany osobních údajů</a>`.
6. CSS úpravy per design § 6.1 tabulka tokenů (font-size 18 px desktop / 17 mobile, `--muted` na `#52606F`, tlačítka `min-height: 56px`, focus 3px outline + 2px offset).
7. Animace `pulse` respektuje `prefers-reduced-motion`.
8. Žádné nové cookies, žádný analytics snippet, žádné externí JS/fonty.
**Acceptance criteria:**
- [ ] Substituce copy z `copy.md` proběhla, žádné placeholdery typu `{{COPY:...}}` v output
- [ ] Form má email + consent + honeypot per design § 6.1
- [ ] Submit URL: `/vysledek?url=<urlencoded>&em=<urlencoded>&c=1&v=v1-2026-05-08&s=landing-hero`
- [ ] Varování pod URL polem je viditelné, sentence case, brand tokeny
- [ ] Odkaz na `/ochrana-udaju` v patičce
- [ ] Body font 18 px desktop, 17 px mobile
- [ ] CTA tlačítko `min-height: 56px`, padding 16x24
- [ ] `--muted` token = `#52606F` (light) — 6.0:1 kontrast na ivory
- [ ] `:focus-visible` outline 3px + 2px offset
- [ ] `prefers-reduced-motion` respektován u animací
- [ ] Lighthouse Performance ≥ 90, A11y = 100, Best Practices ≥ 95
- [ ] Mobile 375 px — žádný horizontální scroll, žádný overflow
- [ ] Žádný `<script src="...">` ze třetí strany, žádný `<link rel="stylesheet" href="https://...">` (kromě same-origin)
**Smoke test:** `python3 -m http.server` v `fakan.cz/`, otevřít v Chrome, mobile DevTools 375 px, vyplnit form, ověřit submit URL.
**Pro testera:** všechny acceptance + dark mode (DevTools Rendering > Emulate dark), screen reader (VoiceOver / NVDA): label na consent checkboxu se musí přečíst včetně odkazu na PP. Klávesnicová navigace přes form (Tab, Enter).

---

### TASK-17: `vysledek.html` + `vysledek.js` — copy + forwarding email/consent
**Role:** junior-developer
**Pruh:** F
**Odhad:** 2 h
**Závislosti:** TASK-14 (copy)
**Vstupy:** `design.md` § 6.2 + § 6.3, existující `vysledek.html` a `vysledek.js`
**Co se má udělat:**
1. `vysledek.js` — parse `em`, `c`, `v`, `s` z `location.search`, pokud `c === '1'` a `em` a `v` přítomné, přidat je do query stringu volání `/api/analyze`.
2. `vysledek.html` — substituovat copy z `copy.md`, vykání, brand tokeny aktualizované (font sizes, button heights stejně jako `index.html`).
3. Info banner po `done` SSE eventu: pokud `email` byl forwardován, zobrazit „Výsledky vám pošleme i na {email} během 5 minut." (per design § 6.3).
4. **Optional pokud zbude čas:** fallback formulář pod CTA banner pro uživatele, kteří přišli přímým linkem bez emailu — submit na `POST /api/lead`.
5. Žádné nové cookies, žádné externí JS/fonty.
**Acceptance criteria:**
- [ ] `vysledek.js` forwarduje `em`, `c`, `v`, `s` query parametry do `/api/analyze` URL
- [ ] Bez `em`+`c`+`v` se forwarduje jen `url` (zachová existující flow)
- [ ] Copy z `copy.md` substituovaný, žádné placeholdery v output
- [ ] Info banner po `done` se zobrazí jen když `email` byl předán
- [ ] Brand tokeny stejné jako v `index.html` (font 18/17, button 56)
- [ ] Bez regrese existujícího SSE flow (`hello`, `progress`, `verdict`, `done`, `error` eventy stále fungují)
- [ ] Lighthouse Performance ≥ 90, A11y = 100
- [ ] Mobile 375 px — žádný horizontální scroll
**Smoke test:** Otevřít `/vysledek?url=https://example.cz&em=a@b.cz&c=1&v=v1-2026-05-08&s=landing-hero`, ověřit SSE stream + zobrazení banneru po `done`.
**Pro testera:** flow s emailem, flow bez emailu, edge case `c=0` nebo `c=` (nesmí poslat email do `/api/analyze`).

---

### TASK-18: `prehled.html` — copy refresh
**Role:** junior-developer
**Pruh:** F
**Odhad:** 1.5 h
**Závislosti:** TASK-14
**Vstupy:** `design.md` § 6.4, existující `prehled.html`
**Co se má udělat:** Substituovat copy z `copy.md` (sekce `prehled.html`). Žádná funkční změna, jen text + brand tokeny (font, kontrast). Hero přepsat bez technického žargonu, technické sekce zachovat hlouběji ale srozumitelněji.
**Acceptance criteria:**
- [ ] Copy substituovaný, žádné placeholdery
- [ ] **0 výskytů** „ty/tvůj/tobě/tě"
- [ ] **0 výskytů** žargon-blacklistu v hero
- [ ] Brand tokeny stejné jako `index.html`
- [ ] Lighthouse Performance ≥ 90, A11y = 100
- [ ] Mobile 375 px OK
**Smoke test:** otevřít, projet, žádné anglické fragmenty, žádný horizontální scroll.
**Pro testera:** automatický grep na žargon-blacklist + tykání (`\bty\b`, `\btvůj\b`, ...) — `0` výskytů (kromě případně schváleného taglinu).

---

### TASK-19: `ochrana-udaju.html` — Privacy Policy stránka
**Role:** junior-developer
**Pruh:** F
**Odhad:** 1.5 h
**Závislosti:** TASK-13 (text)
**Vstupy:** `design.md` § 6.5, `copy.md` (Privacy Policy draft od marketer + legal)
**Co se má udělat:** Vytvořit `fakan.cz/ochrana-udaju.html`:
1. Statická HTML stránka, brand tokeny stejné jako `index.html`.
2. `<main>` s prose stylem (max-width 70ch, font 18 px, line-height 1.6).
3. Žádné SVG, žádný JS, žádné externí zdroje.
4. Substituce textu z `copy.md` (Privacy Policy sekce).
5. Header + footer stejný jako `index.html` (logo, navigace).
6. `<title>Zásady ochrany osobních údajů — fakan.cz</title>`, `<meta name="description" ...>`, JSON-LD (volitelné), canonical, OG.

URL kontrakt: **`/ochrana-udaju`** (file `ochrana-udaju.html` se serveruje z `fakan.cz/ochrana-udaju.html`, Cloudflare Pages/Workers Sites resolveruje bez `.html` díky `assets` config).
**Acceptance criteria:**
- [ ] Soubor `fakan.cz/ochrana-udaju.html` existuje
- [ ] Všechny sekce z risk-check § 2.4 přítomné (kdo, co, titul, retence, procesoři, práva, kontakt, datum)
- [ ] Brand tokeny stejné jako `index.html`
- [ ] Mobile 375 px — žádný horizontální scroll
- [ ] Lighthouse Performance ≥ 90, A11y = 100
- [ ] `<a href="https://www.cloudflare.com/dpa/">` odkaz na Cloudflare DPA (volitelně) + zmínka o EU-US DPF
- [ ] Datum účinnosti `2026-05-15`
- [ ] Odkaz na `mailto:jsem@fakan.cz` pro výmaz
- [ ] Žádné placeholdery `{{...}}` v output (vyplněné z copy.md)
**Smoke test:** Otevřít v prohlížeči, ověřit text, ověřit klávesnicovou navigaci přes nadpisy (heading hierarchy `h1 > h2 > h3`).
**Pro testera:** legal-advisor v TASK-25 projde proti risk-check § 2.4 jako finální schválení.

---

### TASK-20: `odhlasit-hotovo.html` — fallback statická stránka
**Role:** junior-developer
**Pruh:** F
**Odhad:** 0.5 h
**Závislosti:** —
**Vstupy:** `design.md` § 6.6
**Co se má udělat:** Statická HTML pro případ, že někdo přistál na `/odhlasit` bez tokenu (nebo z webu). Worker render má prioritu (TASK-09), ale tahle stránka existuje jako fallback. Krátký text: „Pro odhlášení použijte odkaz v emailu, který vám přišel. Pokud nemáte odkaz po ruce, napište nám na jsem@fakan.cz."
**Acceptance criteria:**
- [ ] Soubor `fakan.cz/odhlasit-hotovo.html` existuje
- [ ] Brand tokeny shodné s `index.html`
- [ ] Žádný JS, žádné externí zdroje
- [ ] Lighthouse Performance ≥ 90, A11y = 100
- [ ] `<title>Odhlášeno — fakan.cz</title>`, `noindex` meta
**Smoke test:** Otevřít, přečíst.
**Pro testera:** mobile 375 px, dark mode.

---

### TASK-21: Researcher — Cloudflare Email Workers + DNS + RFC 8058 + ZoEK § 7
**Role:** researcher
**Pruh:** T
**Odhad:** 2 h
**Závislosti:** —
**Vstupy:** `design.md` § 9 (otevřené otázky), `risk-check.md` § 5
**Co se má udělat:** Researcher dohledá a do `projects/landing-v2/research-email.md` zapíše:
1. **Aktuální syntaxe `[[send_email]]`** v `wrangler.toml` k `compatibility_date = "2025-05-01"`. Doložit oficiální docs URL.
2. **Quota / rate limit** outbound mailů (per den/účet, per sek). Pokud Cloudflare neuvádí číslo, popsat „abuse-prevention threshold" prakticky.
3. **`EmailMessage` API v 2026** — používá se ještě `mimetext` lib z npm, nebo je to built-in?
4. **Limit velikosti zprávy** (MB).
5. **Bounce handling** — vrací `env.EMAIL.send()` exception při hard bounce, nebo je bounce async přes inbound?
6. **DNS records pro `fakan.cz`** — přesné hodnoty pro SPF (`v=spf1 include:_spf.mx.cloudflare.net ~all`?), DKIM (selector `cf2024-1._domainkey`?), DMARC (`p=quarantine` start). Aktuální stav DNS (pokud má researcher přístup) — vypsat MX, SPF, DKIM, DMARC.
7. **RFC 8058 `List-Unsubscribe-Post: List-Unsubscribe=One-Click`** — Gmail/Yahoo 2024 požadavek pro vyšší volume. Pro 5–20 mailů/den relevantní? Researcher potvrdí, že hlavička je validní.
8. **§ 7 ZoEK 480/2004 Sb.** — co konkrétně musí být v patičce mailu (jméno, IČO, adresa)? Best practice pro CZ SMB v 2026.
9. **D1 limity 2026-05** — writes/day, reads/day, storage. Confirm forecast.
10. **Cloudflare D1 + KV + Workers free tier** — aktuální čísla, případně změny od 2024.

Output je **markdown report** (max 4 strany), který junior čerpá v TASK-01, TASK-07, TASK-15. Souběžně **commit cizího výstupu** dělá PM (researcher nemá git).
**Acceptance criteria:**
- [ ] Soubor `projects/landing-v2/research-email.md` existuje
- [ ] Každý z 10 bodů má **doložený zdroj** (URL na oficiální docs + datum přístupu)
- [ ] Žádné domněnky, žádné „pravděpodobně" — pokud Cloudflare neuvádí, zapsat „CF doc neuvádí, viz X komunita / GitHub issue"
- [ ] Pokud najde rozpor s designem (např. binding syntaxe je jiná), explicitně **flagne** v sekci „Pozor — design.md vyžaduje revize"
**Smoke test:** Researcher report má sekce 1–10 + flag sekci.
**Pro testera:** n/a (research, ne kód).

---

### TASK-22: Brand brief / CLAUDE.md — diff připravený jako PR
**Role:** junior-developer (mechanika) + marketer (text)
**Pruh:** T
**Odhad:** 1.5 h (junior 0.5 + marketer 1)
**Závislosti:** TASK-14 (copy), TASK-15 (mail copy)
**Vstupy:** `decisions.md` (auto-rozhodnutí: PR s diffem, Fakan review), `risk-check.md` § 7
**Co se má udělat:**
1. Marketer připraví do `projects/landing-v2/brand-pivot-diff.md` **navrhovaný text** pro:
   - `fakan-cz-brand-brief.md` sekce 4 „Tón a hlas" — vykání, cílovka 40+ SMB, žargon-blacklist (AI agenty, framework, hydration, LCP, CLS, INP, WCAG, CDN, kernel) v hero.
   - `CLAUDE.md` sekce 3 „Brand — jak Fakan mluví" — překlopit z tykání na vykání.
2. Junior vytvoří git branch `brand-pivot-v2` (nebo lokální patch soubor `projects/landing-v2/brand-pivot.patch`), aplikuje navrhované změny do `fakan-cz-brand-brief.md` a `CLAUDE.md`.
3. **Branch se NEMERGUJE.** Junior potvrdí v commit message, že je branch určena k Fakanovu review.
4. PM v Gate 3 explicitně zmíní: „Tady je diff brand briefu, mergne se?"
**Acceptance criteria:**
- [ ] Soubor `projects/landing-v2/brand-pivot-diff.md` (marketerův návrh) commitnutý na main
- [ ] Branch `brand-pivot-v2` existuje **lokálně** (push až po Fakanově OK), případně patch v `projects/landing-v2/brand-pivot.patch`
- [ ] Diff brand briefu reflektuje vykání + cílovku 40+
- [ ] Diff CLAUDE.md reflektuje vykání
- [ ] **Žádný merge na main** ze strany agenta (per CLAUDE.md sekce 7.4 + risk-check § 7)
- [ ] Branch má jasnou commit message: `docs(brand): pivot na vykání + cílovku 40+ — k Fakanovu review, nemerge`
**Smoke test:** `git log --oneline brand-pivot-v2` ukáže 1 commit; `git checkout main` vrátí původní brand brief beze změny.
**Pro testera:** ověřit, že main má `fakan-cz-brand-brief.md` a `CLAUDE.md` **beze změny** po dokončení iterace.

---

### TASK-23: Owner — IČO, adresa firmy, schválení patičky mailů
**Role:** owner
**Pruh:** T
**Odhad:** 0.5 h
**Závislosti:** TASK-15 (struktura patičky)
**Vstupy:** `risk-check.md` § 5.1 (povinné údaje), `design.md` § 5.5
**Co se má udělat:** Owner dodá:
- IČO firmy (pravděpodobně OSVČ Daniel Hromada)
- Adresa firmy / sídla (povinné dle § 7 odst. 1 zákona č. 480/2004 Sb.)
- Schválení znění patičky všech 4 mailů.

PM commitne odpověď do `projects/landing-v2/owner-identity.md` jménem ownera.
**Acceptance criteria:**
- [ ] `owner-identity.md` obsahuje IČO, adresu firmy, jméno (Daniel Hromada / Fakan), email (`jsem@fakan.cz`), telefon (`+420 604 690 539`)
- [ ] Owner explicitně potvrdil v textu: „Patička OK"
- [ ] Žádné placeholdery `{{...}}` po substituci v mail šablonách
**Smoke test:** Junior v TASK-15-build (post-marketer) substitutuje placeholders, žádný `{{IDENTITY:...}}` zůstane v output.
**Pro testera:** n/a (owner provides data, tester ověří v Gate 3 že maily mají všechno).

---

### TASK-24: Tester — kompletní acceptance + smoke + edge cases
**Role:** tester
**Pruh:** T
**Odhad:** 3.5 h
**Závislosti:** TASK-01 až TASK-20 hotové
**Vstupy:** všechny předchozí tasky + jejich AC
**Co se má udělat:** Pro každý junior task tester sepíše do `docs/testing/<task-id>.md` výsledky:
1. **AC checklist** — projít, zaškrtnout / failovat.
2. **Mobile** — 375×812 DevTools, žádný horizontální scroll, žádný overflow.
3. **Dark mode** — `prefers-color-scheme: dark`, čitelnost OK.
4. **A11y** — Lighthouse 100, klávesnice (Tab přes form, Enter submit), VoiceOver/NVDA spot-check (label čte celý consent text včetně odkazu).
5. **Mail deliverability** — testovací lead z `jsem@fakan.cz` na **3 schránky** (Seznam, Gmail, MS Outlook). Zaznamenat: přišel? Spam? Plain-text + HTML twin OK? Patička kompletní? Opt-out funguje?
6. **End-to-end smoke** — landing → URL submit → analýza → consent → D1 zápis (lokální `wrangler dev`) → mail → opt-out → confirm mail → DB stav `opted_out`.
7. **Edge cases** — duplicitní lead (UNIQUE), neexistující doména analýzy, honeypot triggered, rate limit (6. lead z téhož IP → 429), invalid opt-out token (200 generic), opt-out idempotent.
8. **Žargon scan** — automatický grep `^.*\b(ty|tvůj|tvoje|tobě|tě|AI agenty|framework|hydration|LCP|CLS|INP|WCAG|CDN|kernel)\b` přes `index.html`, `vysledek.html`, `prehled.html` hero sekce → musí vrátit 0 (kromě schváleného taglinu).
9. **Žádné cookies / trackery** — DevTools Network přes celý flow, žádný request mimo `fakan.cz`, žádný `Set-Cookie` v žádné response.
**Acceptance criteria:**
- [ ] `docs/testing/landing-v2-summary.md` existuje s souhrnem (počet AC pass/fail per task)
- [ ] Každý task má detailní `docs/testing/<task-id>.md` row
- [ ] 3-providerový mail test (Seznam, Gmail, Outlook) zaznamenaný včetně spam/inbox výsledku
- [ ] Žargon scan exit code 0
- [ ] Žádný `Set-Cookie` v Network logu
- [ ] Lighthouse skóre per stránka v summary
**Smoke test:** Tester spouští `wrangler dev` lokálně + reálný production smoke (po launchi v Gate 3).
**Pro testera (tj. eskalace):** pokud najde fail, **eskaluje na junior-developer + senior-architect** (review), ne mlčí.

---

### TASK-25: Legal — Pre-launch check (Gate 3)
**Role:** legal-advisor
**Pruh:** L
**Odhad:** 1 h
**Závislosti:** TASK-13, TASK-15 (final mail copy), TASK-19, TASK-09 (opt-out endpoint funkční)
**Vstupy:** `risk-check.md` sekce „Pre-launch check (vyplní legal-advisor v Gate 3)"
**Co se má udělat:** Vyplnit checklist v `risk-check.md` Pre-launch check sekci:
- [ ] Privacy Policy live a aktuální? (TASK-19 deployed)
- [ ] Souhlas v UI splňuje sekci 4 risk-checku? (TASK-16 ověřit)
- [ ] D1 schema obsahuje evidence souhlasu? (TASK-02 + TASK-06)
- [ ] Followup mail prošel mým review? (TASK-15 final copy)
- [ ] Opt-out flow funguje end-to-end (testovaný lead odhlášen do 1 minuty)? (TASK-24 smoke)
- [ ] DPA / procesor compliance dořešena? (Privacy Policy v TASK-19 odkazuje na CF DPA + DPF)
- [ ] Brand brief / CLAUDE.md diff je PR, nemergnutý? (TASK-22 ověřit)

Pokud něco fail → **blokuje Gate 3**, vrací juniorovi nebo marketerovi.
**Acceptance criteria:**
- [ ] Všech 7 položek pre-launch checklistu odškrtnuto NEBO konkrétní fail s důvodem
- [ ] Žádný blokátor zůstává otevřený před delivery (Fáze 6)
- [ ] Verdikt napsaný do `risk-check.md` Pre-launch sekce: „OK pro launch" / „Blokátor: ..."
**Smoke test:** Legal-advisor sám si projde celý flow jako uživatel.
**Pro testera:** legal verdikt = Gate 3 vstup, tester už má detailní AC v TASK-24.

---

### TASK-26: README task board — uzavření Priority 1 řádků
**Role:** project-manager
**Pruh:** T
**Odhad:** 0.5 h
**Závislosti:** TASK-24 a TASK-25 hotové
**Vstupy:** `fit-check.md` sekce 2 (mapping na README úkoly)
**Co se má udělat:** Po dokončení iterace (v Gate 3 / delivery) PM updatuje `README.md`:
- `[x] Brand pivot — vykání + cílovka 40+` — pokud copy hotov a Fakan schválil tagline. Pokud Fakan tagline neschválil, dát `[~]` s poznámkou.
- `[x] Homepage UX — mobile a lead capture` — body (a)+(b)+(c) hotové.
- `[x] Lead capture — storage + e-mail nabídky` — celý backend funkční.
- `[~] Magic link auth` — sub-bod „[x] mailové šablony připravené, čekají na implementaci endpointu" pod hlavní řádek.
**Acceptance criteria:**
- [ ] README.md odráží stav iterace
- [ ] Brand pivot řádek má správný stav podle Fakanova schválení
- [ ] Magic link auth má sub-bod o šablonách
- [ ] Commit `docs(readme): uzavřít Priority 1 po iteraci landing-v2`
**Smoke test:** `git diff README.md` ukáže smysluplné updates.
**Pro testera:** n/a.

---

### TASK-27: ADR-001 už existuje — ověření že je správný a commit pokud chybí
**Role:** junior-developer
**Pruh:** T
**Odhad:** 0.25 h
**Závislosti:** —
**Vstupy:** `design.md` § 10.1, `docs/adr/ADR-001-email-outbound-cloudflare-vs-mailchannels.md`
**Co se má udělat:** ADR-001 už existuje (commit `19800af` mimo, čerstvý — viz `docs/adr/`). Junior **přečte** soubor a ověří:
1. Stav `accepted`.
2. Sedí na obsah z design § 10.1.
3. Pokud chybí cokoliv z designu, doplnit jednoduchým commitem `docs(adr): ADR-001 doplnění důsledků`.
**Acceptance criteria:**
- [ ] ADR-001 obsahuje sekce: kontext, možnosti, rozhodnutí, důvody, trade-offy, důsledky pro implementaci
- [ ] Stav `accepted`
- [ ] Pokud OK, žádný commit nepotřeba
**Smoke test:** `cat docs/adr/ADR-001-*.md` — projet text.
**Pro testera:** n/a.

---

## B. Závislostní graf — kritická cesta a paralelizace

```
                                ┌──────────────────────────────────────┐
                                │ TASK-21 researcher (paralelně 0–2 h) │
                                │ TASK-23 owner (IČO/adresa, ASAP)     │
                                └──────────────┬───────────────────────┘
                                               │ vstupy
                                               ▼
   ┌────────────────────────────────────────────────────────────────────┐
   │ Pruh BACKEND (sériová kritická cesta lead capture)                 │
   │                                                                    │
   │ T01 wrangler.toml ──┬─▶ T02 D1 migrace ──┐                         │
   │                     │                    │                         │
   │ T03 url-strip ──────┤                    │                         │
   │ T04 hash ───────────┤                    ├─▶ T06 lead.js ──┐       │
   │                     │                    │                  │       │
   │ T05 mime ──────────────────▶ T07 mail.js ─┤                 │       │
   │                                          │                  │       │
   │ T08 šablony skeleton ────────────────────┤                  ▼       │
   │                                          │                T11 ratelimit
   │                                          │                  │       │
   │                                          ▼                  ▼       │
   │                                       T09 /odhlasit  ──▶ T10 worker.js
   │                                                                │   │
   │                                                                ▼   │
   │                                                            T12 analyze.js
   └────────────────────────────────────────────────────────────────────┘

   ┌────────────────────────────────────────────────────────────────────┐
   │ Pruh COPY (paralelně s backendem)                                  │
   │                                                                    │
   │ T13 PP + consent (legal+marketer) ──┐                              │
   │ T14 stránky copy (marketer) ────────┤                              │
   │ T15 mail copy (marketer) ───────────┤                              │
   │                                     ▼                              │
   │                      vstupy pro frontend tasky                     │
   └────────────────────────────────────────────────────────────────────┘

   ┌────────────────────────────────────────────────────────────────────┐
   │ Pruh FRONTEND (čeká na T14, paralelně s zbytkem backendu)          │
   │                                                                    │
   │ T16 index.html      ┐                                              │
   │ T17 vysledek.* ─────┼─ paralelně po T14                            │
   │ T18 prehled.html ───┘                                              │
   │ T19 ochrana-udaju ──── čeká na T13                                 │
   │ T20 odhlasit-hotovo ── nezávislé                                   │
   └────────────────────────────────────────────────────────────────────┘

   ┌────────────────────────────────────────────────────────────────────┐
   │ Pruh OPS (paralelně, v různých fázích)                             │
   │                                                                    │
   │ T22 brand pivot diff ── po T14, T15 (potřebuje finální copy tón)   │
   │ T27 ADR check ──────── kdykoliv                                    │
   └────────────────────────────────────────────────────────────────────┘

   ┌────────────────────────────────────────────────────────────────────┐
   │ Validace (sériově po implementaci)                                 │
   │                                                                    │
   │ T24 tester ────────── čeká na T01–T20                              │
   │ T25 legal pre-launch ─ čeká na T13, T15, T19, T09                  │
   │ T26 README update ─── čeká na T24, T25 (Gate 3 OK)                 │
   └────────────────────────────────────────────────────────────────────┘
```

**Kritická cesta (longest serial dependency chain):**
T01 → T02 → T06 → T11 → T10 → T12 → T24 → T25 → Gate 3.
Předpoklad: T03–T05, T07, T08 běží paralelně s T01–T02.

**Co může běžet paralelně day 1:**
- T01 (wrangler) + T03 (url-strip) + T04 (hash) + T05 (mime) + T08 (šablony skeleton)
- T13 + T14 + T15 (marketer) + T21 (researcher) + T23 (owner)

**Co je blocked až po marketer copy (T14):**
- T16, T17, T18 frontend tasky
- T22 brand pivot diff

**Co je blocked až po implementaci (T01–T20):**
- T24 tester
- T25 legal pre-launch
- T26 README update

---

## C. Kapacitní rozpočet

| Task | Role | Odhad |
|---|---|---|
| T01 | junior-developer | 1.0 h |
| T02 | junior-developer | 1.0 h |
| T03 | junior-developer | 1.0 h |
| T04 | junior-developer | 1.0 h |
| T05 | junior-developer | 2.0 h |
| T06 | junior-developer | 3.0 h |
| T07 | junior-developer | 2.0 h |
| T08 | junior-developer | 2.0 h |
| T09 | junior-developer | 2.0 h |
| T10 | junior-developer | 1.5 h |
| T11 | junior-developer | 1.5 h |
| T12 | junior-developer | 2.0 h |
| T13 | marketer 1.5 h + legal 1 h | 2.5 h |
| T14 | marketer | 3.0 h |
| T15 | marketer | 2.0 h |
| T16 | junior-developer | 3.5 h |
| T17 | junior-developer | 2.0 h |
| T18 | junior-developer | 1.5 h |
| T19 | junior-developer | 1.5 h |
| T20 | junior-developer | 0.5 h |
| T21 | researcher | 2.0 h |
| T22 | junior 0.5 h + marketer 1 h | 1.5 h |
| T23 | owner | 0.5 h |
| T24 | tester | 3.5 h |
| T25 | legal-advisor | 1.0 h |
| T26 | project-manager | 0.5 h |
| T27 | junior-developer | 0.25 h |

**Suma per role:**
- junior-developer: 1+1+1+1+2+3+2+2+2+1.5+1.5+2+3.5+2+1.5+1.5+0.5+0.5+0.25 = **27.25 h**
- marketer: 1.5+3+2+1 = **7.5 h**
- legal-advisor: 1+1 = **2 h** (+3.5 h již z risk-check)
- tester: **3.5 h**
- researcher: **2 h**
- owner: **0.5 h**
- project-manager: **0.5 h** + průběžně 3 h koordinace = **~3.5 h**
- senior-architect: **~5 h** code review průběžně (paralelně, nepočítá se do task hodin)

**CELKEM: ~46.25 h** (junior 27.25 + marketer 7.5 + legal 2 + tester 3.5 + researcher 2 + owner 0.5 + PM 3.5)

**Porovnání:**
- finance forecast: 36–47 h ✅ horní hranice
- fit-check drift cap: 41–54 h ✅ vejde se s rezervou ~8 h

**Verdikt:** Sedí. Architectovo code review (~5 h) je účtováno separátně paralelně, nepočítá se do kritické cesty.

**Co dělat při přetečení (>54 h):** scope cuts per fit-check § 3:
1. Magic-link draft maily (T08+T15) ven — −1.5 h
2. Soft DOI šablona ven (jen text v lead-followup) — −0.5 h
3. Privacy Policy minimalistická — −1 h

---

## D. Otevřené otázky / mezery

**Žádné velké mezery.** Drobné věci, které jsem si sjednotil v gate sekci níže (URL slug Privacy Policy, query param `t` vs `token`).

**Závislosti, které čekáme:**
- **TASK-21 researcher** — výstup ovlivní přesnou syntaxi `[[send_email]]` v T01 a `EmailMessage` API v T07. Junior začne kostrou per design (předpokládaná syntaxe), po researcheru doupravit. Worst case: T01 + T07 minor commit revize, +0.5 h.
- **TASK-23 owner identity** — IČO/adresa potřeba pro substituci patiček v T15 finálních mailech. Pokud owner nedodá včas, junior commitne se `{{IDENTITY:...}}` placeholdery a Gate 3 to chytne.

**Eskalace:**
- Pokud researcher (T21) odhalí, že Email Workers má hard quota / DNS setup je net-new, a Fakan ještě DNS records v dashboardu nenastavil, Gate 3 mail-deliverability test (T24) může selhat. Mitigace: PM informuje Fakana ASAP, fallback Resend ($20/měs base) je v retro flagged option (per fit-check § 5.1).

---

## E. Konzistenční gate — projito 2026-05-08

### 1. Brief vs. design — sedí scope?
- ✅ Každá vyjmenovaná stránka v briefu (`index.html`, `vysledek.html`, `prehled.html`) má task — T16, T17, T18.
- ✅ Privacy Policy stránka má task T19 (per legal blokátor risk-check § 8).
- ✅ Každá mailová šablona z decisions.md má task — `lead-followup`, `magic-link-auth` (draft v0), `optout-confirmation`, `soft-doi` (na sklad) → T08 (skeleton) + T15 (copy).
- ✅ Lead capture backend má tasky T01–T12.
- ✅ Brand brief / CLAUDE.md diff má T22 (PR připraven, **nemerge**).
- ✅ Žádný task nepřesahuje brief — žádné AI volání, žádný analytics tracker, žádný cookie banner, žádný tagline merge bez ownera.

**Verdikt:** ✅ OK.

---

### 2. Risk-check vs. tasks — všechna legal opatření zachycena?
- ✅ **Privacy Policy** task T19 + obsah T13. Existuje a má AC pokrývající 7 povinných bodů z risk-check § 2.4.
- ✅ **D1 schema** v T02 obsahuje `consent_at`, `consent_text_version`, `consent_ip_hash`, `unsubscribe_token` (NOT NULL kromě `consent_ua_hash` který je v MVP vynechán per design § 2.5).
- ✅ **Mail šablony** mají v AC „bez tracking pixelu" (T08 AC), „plain-text twin ručně psaný" (T08 AC), „opt-out odkaz" (T15 AC, kromě magic-link kde nepatří).
- ✅ **URL stripping** (utm_*, fbclid, gclid, tokeny) v T03 + T06.
- ✅ **Souhlas checkbox** není pre-checked, není v submit tlačítku — T16 AC + design § 6.1 HTML návrh.
- ✅ **Server-side `consent === true` enforcement** v T06 (`captureLead`) i T10 (`/api/lead`).
- ✅ **Verzovaný consent text** `legal/consent-versions/v1-2026-05-08.md` v T13.
- ✅ **Opt-out flow** funkční: T09 endpoint + T07 confirm mail + T15 patička s odkazem.
- ✅ **Žádný cookie / žádný tracker** — T16/17/18 AC explicitně + T24 tester scan.
- ✅ **Pre-launch check legal** je samostatný task T25 (gate 3 blocker).
- ✅ **Cron retence** záměrně **out of scope MVP** per design § 3.4 + risk-check § 2.3 (akce paralelní, neblokuje launch). Flag: zaznamenat do retro jako follow-up.

**Verdikt:** ✅ OK.

---

### 3. Forecast vs. tasks — kapacitně sedí?
- ✅ Suma odhadů = **46.25 h** ≤ 54 h drift cap (fit-check) ✅
- ✅ Žádný task nemá hidden externí cost (žádné placené API, žádné AI volání). Email Workers + D1 + KV ve free tieru.
- ✅ Researcher výstup (T21) **neblokuje** start backend pruhu — junior začíná T01–T08 s předpokládanou syntaxí, po researcherovi minor revize. Tasky jsou self-contained.
- ✅ Termín 2026-05-15 (8 dní): paralelizace mezi 6+ rolemi, ~6 h/role, žádná role se nezasekne.

**Verdikt:** ✅ OK.

---

### 4. Decisions vs. tasks — všechna rozhodnutí promítnutá?
- ✅ **Email Workers** (ne MailChannels) — T01 binding `[[send_email]]`, T07 `env.EMAIL.send()`, ADR-001 (T27).
- ✅ **Žádné AI volání** — zkontrolováno přes všechny tasky, žádný `import '@anthropic-ai/sdk'`, žádný Workers AI binding, žádný runtime AI prompt.
- ✅ **Magic-link draft v0** — T08 šablona obsahuje DRAFT v0 komentář, žádný handler v `worker.js` pro magic-link auth (nepřipojený endpoint).
- ✅ **Brand brief / CLAUDE.md** — T22 explicitně PR / branch / patch, **NEMERGE** v AC.
- ✅ **Soft DOI** — per design § 4.6 integrovaný jako úvodní odstavec do `lead-followup`, samostatná `soft-doi` šablona připravená „na sklad" pro budoucí přepnutí. T15 AC explicitně zmiňuje soft DOI úvod.
- ✅ **Lead capture URL slug `/api/analyze` piggyback + `/api/lead` fallback** — T12 piggyback, T10 fallback POST.

**Verdikt:** ✅ OK.

---

### 5. Tie-breaker konflikty (CLAUDE.md sekce 7.6)

Při rozpadu jsem narazil na **tři drobné konflikty**, které jsem sjednotil podle doménové autority. Zaznamenal jsem do `decisions.md`:

#### Konflikt 1 — URL slug Privacy Policy stránky
- **brief.md** + **risk-check.md** § 4.2: `/ochrana-udaju`
- **fit-check.md** § 4.4: `/ochrana-udaju` (legal preferuje krátký lidský)
- **design.md** § 6.5 (záhlaví) a § 6.5 sekce: `/zasady-ochrany-osobnich-udaju.html`
- **decisions.md** auto-rozhodnutí: explicitně řekl „`fakan.cz/zasady-ochrany-osobnich-udaju.html`"

**Problém:** decisions.md (legal autorita) napsal full slug `zasady-ochrany-osobnich-udaju.html`, ale fit-check (product manager) preferuje `ochrana-udaju`. risk-check (legal) také používá `ochrana-udaju` v § 4.2 znění souhlasu.

**Doména:** compliance + brand (lidskost cílovky 40+).

**Tie-breaker:** legal-advisor + brand pivot na 40+ (kratší, lidštější URL pro starší cílovku, méně cizojazyčného žargonu „zasady-ochrany-osobnich-udaju"). risk-check sám v § 4.2 finálním znění souhlasu napsal `(/ochrana-udaju)` — tj. autoritativní legal text používá krátký slug.

**Rozhodnutí:** **`/ochrana-udaju`** (soubor `fakan.cz/ochrana-udaju.html`). decisions.md auto-rozhodnutí bylo nepřesné — sjednoceno per skutečným legal textem v risk-check § 4.2.

#### Konflikt 2 — query parametr opt-out: `t` vs `token`
- **brief.md**: `/odhlasit?token=…`
- **risk-check.md** § 5.1: `https://fakan.cz/odhlasit?t=<token>`
- **design.md** § 3.3: `t=<token>`
- **README.md** úkol Lead capture: `/odhlasit?t=<token>`

**Problém:** brief má `?token=`, ostatní `?t=`.

**Doména:** tech (URL kontrakt).

**Tie-breaker:** senior-architect doménová autorita nad URL kontraktem + risk-check + README už mají `?t=`. Brief je kratší poznámka.

**Rozhodnutí:** **`/odhlasit?t=<token>`** (per design + risk-check + README). Brief poznámka byla zkratka.

#### Konflikt 3 — `MailChannels` vs `Email Workers` zmínky v risk-check § 5.3
- **risk-check.md** § 5.3 řádek „MailChannels (pokud zvolíme)" — neaktualizovaný po Gate 1
- **decisions.md** + **design.md** + **ADR-001**: Email Workers vyhrál

**Problém:** risk-check § 5.3 ještě má MailChannels jako proceesora; po Gate 1 to neplatí.

**Doména:** compliance (DPA).

**Tie-breaker:** decisions.md má přednost (Gate 1 explicitní rozhodnutí Fakana). risk-check § 5.3 zmínka je historická, ne aktuální stav.

**Rozhodnutí:** **Email Workers**, jediný procesor mailů. Žádný DPA s MailChannels nepotřebujeme. Privacy Policy v T13 odkazuje jen na Cloudflare DPA + DPF. risk-check § 5.3 update **není v scope** této iterace (legal-advisor můze v retro / následující iteraci přepsat).

---

### 6. Verdikt gate

**✅ OK pro Gate 2.**

- Žádný velký konflikt, žádný blokátor pro junior start.
- Tři drobné tie-breakery sjednoceny a zapsány.
- Researcher T21 a owner T23 běží paralelně, neblokují backend pruh.
- Kapacita 46.25 h ≤ 54 h drift cap.
- Všechny legal opatření (risk-check) mají odpovídající task nebo AC.
- Decisions promítnuty do tasků.

**Top 1 risk:** TASK-21 researcher Email Workers DNS — pokud Fakan ještě nemá v dashboardu nastavené SPF/DKIM/DMARC pro `fakan.cz`, mail-deliverability test v Gate 3 selže. Mitigace: PM informuje Fakana ASAP po Gate 2, paralelní setup před exekucí mail tasků.

---

*Aktualizováno 2026-05-08, project-manager. Po Gate 2 OK předáno juniorovi a paralelním rolím.*
