# Architect code review — landing-v2 (Fáze 3)

**Datum:** 2026-05-08
**Reviewer:** senior-architect
**Stav:** **APPROVED WITH FIXES** (4× FIX, 1× BLOCK, 8× NICE)

Reviewuji moduly z TASK-02, 05, 06, 07, 09, 10, 11, 12 proti `design.md`, `risk-check.md` a `decisions.md`. Junior odvedl rozumný kus práce — vrstva je čistě izolovaná, error handling je všude defenzivní, žádné npm dependency, vanilla JS, žádné cookies. Hlavní problémy: 1× konfigurační BLOCK na `wrangler.toml`, 1× chybějící volání rate limitu pro lead-capture, 1× regex prepustí cizí UNIQUE chyby do bounce a 1× netěsnost v idempotenci. Detail níže.

---

## 1. Bezpečnost

### 1.1 [BLOCK] `CONSENT_SALT` jako prázdný `[vars]` v `wrangler.toml`

- **Kde:** `wrangler.toml:42-43`
- **Co:** `[vars] CONSENT_SALT = ""` se commituje s prázdnou hodnotou. Wrangler aplikuje `[vars]` při každém `wrangler deploy` a **přepíše secret nastavený přes `wrangler secret put CONSENT_SALT`** prázdným stringem. To je dokumentované chování (vars > secrets pro stejné jméno). Důsledek:
  1. `sha256Hex(ip, '')` je deterministický napříč všemi nasazeními → IP se dá zpětně vyhledat dictionary attackem (4 mld IPv4 hashů spočítáš za hodiny).
  2. `lead.js:80` má guard `env.CONSENT_SALT.length === 0` → každý lead capture skončí s `{ ok: false, error: 'salt_missing' }` a v produkci se neuloží žádný lead. Equivalent celkového výpadku feature.
- **Doporučení:** Smazat `[vars] CONSENT_SALT = ""` úplně. Salt řešit výhradně přes `wrangler secret put CONSENT_SALT` (plus `.dev.vars` pro lokální dev s instrukcí v README). Místo `[vars]` přidat komentář:

  ```toml
  # CONSENT_SALT je secret — nastavit přes `wrangler secret put CONSENT_SALT`.
  # Pro lokální dev založit `.dev.vars` se stejnou proměnnou. NIKDY do gitu.
  ```

- **Severity:** BLOCK. Nesmí jít do produkce. Buď deploy přepíše secret na prázdný string, nebo (pokud secret zatím není nastaven) první deploy potřebuje secret nastavit ručně před prvním requestem. Žádná z variant nesmí jít naslepo do prod.

### 1.2 [FIX] `lead-capture` rate limit definovaný, ale **nikdy nezavolaný** v produkčním kódu

- **Kde:** `src/worker.js:42-48` volá jen `scope: 'analyze'` (3/24h). `scope: 'lead-capture'` (5/h per design § 2.4) má whitelist v `ratelimit.js:8` a unit testy v `ratelimit.test.js`, ale produkční kód ho nikde nezavolá.
- **Co:** `analyze.js` v `captureLeadAndMail()` (řádky 242–309) volá `captureLead → sendMail → DB update` bez jakéhokoli per-IP throttlingu. Útočník může s jednou IP přes `/api/analyze?em=…&c=1&v=…` poslat 3× za 24 h (analyze rate limit) a každý request vyrobí 1 lead = pošle 3 maily. To je technicky pod limitem, ale `analyze` limit existuje aby chránil **CPU/fetch**, ne mailing kanál. Jakmile někdo dostane vyšší analyze limit (rozumný next-iteration request), 5/h/lead je nutný.
- **Doporučení:** Přidat druhý gate **uvnitř `captureLeadAndMail()`** v `analyze.js` — a to PŘED `captureLead()`:

  ```js
  const leadRl = await checkRateLimit({
    env, request, scope: 'lead-capture', limit: 5, windowSeconds: 3600,
  });
  if (!leadRl.ok) {
    console.warn('[analyze] lead-capture rate limit hit, skipping insert+mail');
    return;
  }
  ```

  Není to UI gate (uživatel SSE viděl normálně), ale lead se neuloží a mail neodejde. To je správné chování — anti-abuse limit má být tichý, ne 429 v UI.
- **Severity:** FIX. Před launchem.

### 1.3 [FIX] Idempotence chytá UNIQUE chyby moc široce → cross-table false positive

- **Kde:** `src/lib/lead.js:141`
- **Co:** `if (msg.includes('UNIQUE constraint failed'))` — dnes `leads` tabulka má **dvě** UNIQUE constrainty: `leads_idem` (email, url, day) a `unsubscribe_token UNIQUE`. Když se `randomTokenHex(32)` (1 ku 2^256) trefí do existujícího tokenu, current kód to vyhodnotí jako duplicitu leadu a vrátí `{ duplicate: true }` — ale **lead se neuložil**, takže follow-up mail odejde někomu, kdo nemá řádek v DB, a opt-out nebude moct nic najít. (Ano, kolize je extrémně nepravděpodobná, ale architectonicky špatně — rozhodování o duplicitě se má dělat jen na základě konkrétní idempotenční chyby.)
- **Také:** SQLite vrací `UNIQUE constraint failed: leads.unsubscribe_token` vs. `UNIQUE constraint failed: leads.email, leads.url, ...` — string už ten rozdíl říká, jen ho ignorujeme.
- **Doporučení:** Zúžit match na konkrétní index/sloupce idempotence:

  ```js
  if (msg.includes('UNIQUE constraint failed: leads.email') ||
      msg.includes('leads_idem')) {
    return { ok: true, lead: { duplicate: true } };
  }
  // všechno ostatní = jiná UNIQUE chyba → bubla nahoru jako db_error
  ```

- **Severity:** FIX. Před launchem (dnes je to teoretické riziko, ale je to taky spolehlivá past pro budoucí UNIQUE constrainty, které někdo přidá — třeba na email).

### 1.4 [PASS] IP hashing s saltem — správně

- **Kde:** `src/lib/lead.js:87-92` + `src/lib/hash.js:12-21`
- **Co:** `sha256Hex(ip, env.CONSENT_SALT)` je voláno před INSERT, plain IP se nikam nepíše. `console.error('[captureLead] db_error:', msg)` v `lead.js:147` je jen DB error message, **neobsahuje IP**. Audit `analyze.js`, `optout.js`, `mail.js`, `worker.js` — nikde plain IP nelogujeme.
- **Pozn.:** `lead.js:90` má fallback `'unknown'` když chybí `cf-connecting-ip` (lokální dev). Hash z `'unknown' + salt` je sice deterministický, ale nese 0 PII — OK.

### 1.5 [PASS] `/odhlasit` token tampering — správně

- **Kde:** `src/optout.js:31-97`
- **Co:** Verifikováno všech 4 cest:
  1. Neplatný formát tokenu (`!TOKEN_RE.test(token)`) → `renderDonePage()`. Žádná DB query, žádný leak.
  2. Token validní formát ale neexistuje → `SELECT … WHERE unsubscribe_token = ?` vrátí `null`, `renderDonePage()`. Stejná stránka, stejné headery.
  3. Token existuje, status `opted_out` → `renderDonePage()` bez UPDATE bez mailu.
  4. Token existuje, fresh → UPDATE + ctx.waitUntil(sendMail).
- HTTP body, status, headers a cache-control jsou ve všech čtyřech cestách identické (200, `text/html; charset=utf-8`, `cache-control: no-store, max-age=0`). Útočník nepozná z response, jestli token reálně existuje.
- **Timing leak — minimální:** Cesta 1 (formátová validace) je o jeden DB roundtrip rychlejší než cesty 2–4. To **je** observable pres timing attack. Pro brute force 64 hex tokenu je to ale irelevantní (search space 16^64 ≈ 2^256). Kdyby se mělo opravit, šlo by před `renderDonePage()` v cestě 1 přidat fake `await env.DB.prepare(...).first()` se stejně dlouhým query. **Severity:** NICE only.

### 1.6 [PASS] SQL injection — všude prepared statements

- `lead.js:105-125`: `prepare(...).bind(...)`, žádný string concat.
- `optout.js:44-46`, `optout.js:69-71`: `prepare(...).bind(...)`.
- `analyze.js:293-305`: `prepare(...).bind(...)`.
- Audit grep `prepare\(` napříč src — všechno přes `bind()`. **Konzistentní, čisté.**

### 1.7 [PASS] XSS v mail šablonách + `/odhlasit` HTML

- `_layout.js:17-24` definuje `escapeHtml()` a všechny šablony jí pouštějí user-supplied vars (`escapeHtml(url)`, `escapeHtml(email)`, `escapeHtml(unsubscribe_url)`, `escapeHtml(ip)`, `escapeHtml(user_agent)` — všechny jsem ověřil). **Pozor:** `optout.js` HTML response je **statický** — žádný user input se neinterpoluje, takže XSS surface = 0. Správné.
- `lead-followup.js:62`: `?url=${urlEncoded}` (po `encodeURIComponent`) v `mailto:` a v `https://fakan.cz/vysledek` linku. URL escape je zde správně, ne `escapeHtml`. Ověřeno.

### 1.8 [PASS] Honeypot — server-side enforcement

- `analyze.js:108-117`: `isHoneypotTriggered()` checkuje `website` + `company` v query stringu, vrací 200 s prázdným SSE streamem (žádná fetch, žádná lead capture). **Boti dostanou „prošlo", lidé to neuvidí.** Konzistentní s `ratelimit.js:103` pro `POST /api/lead` (zatím 501 stub).

### 1.9 [PASS] Souhlas evidence — všechno se ukládá

- `lead.js:115-124`: `consent_at`, `consent_text_version`, `consent_ip_hash` všechny NOT NULL bind. `consent_ua_hash` zůstává NULL per design § 2.5 (úmyslně, MVP).
- `lead.js:73`: `stripUrl()` se volá PŘED INSERT, naprosto správně. URL se uloží jako `origin + pathname`, query string + hash padá. Risk-check § 1.3 splněn.
- **Pozor:** `url-strip.js:8-11` je ultra minimalistický — `stripUrl()` zahodí **celý** query string. Risk-check § 1.3 ovšem mluvil o deny-listu („utm_*, fbclid, gclid, token, …") — tj. zachovat „bezpečné" query parametry. Junior to uřízl ostře. **Tahle interpretace je přísnější (= bezpečnější)** než risk-check, takže žádný conflict — naopak menší attack surface. PASS.

### 1.10 [PASS] `mail.js` neposílá tracking pixel

- `lead-followup.js`, `optout-confirmation.js`, `soft-doi.js`, `magic-link-auth.js` — **nikde `<img src="https://…">`**. Audit přes grep `<img` v `src/email/` — nula nálezů. `_layout.js` neobsahuje žádný image. Risk-check § 5.2 splněn.

### 1.11 [PASS] Multipart/alternative — plain text twin v každém mailu

- `mime.js:138-151`: `text/plain` část před `text/html`, oba base64. RFC 2045 ordering correct (nejjednodušší typ první).
- `_layout.js:119-121`: každá šablona má `text` výstup z manuálně psaného `bodyText`. Audit šablon — všechny čtyři mají non-empty plain-text. **PASS.**

---

## 2. Perf

### 2.1 [PASS] `ctx.waitUntil` cascade — chyby neshazují celý promise

- **Kde:** `analyze.js:216-222` + `captureLeadAndMail()` 242-309.
- **Co:** Každý kritický blok je v try/catch, který vrací `return` (ne throw). `captureLead` throw → catch → log + return. `sendMail` throw → catch + return. DB UPDATE throw → catch + log. Žádná z těchto cest neshazuje `waitUntil` promise. **Cascade správně izolovaná, fail-closed-but-graceful.**

### 2.2 [PASS] Mail send fail handling → DB status='bounced'

- **Kde:** `analyze.js:298-305`. Pokud `mail.ok === false`, `UPDATE leads SET status='bounced', mail_last_error=?, last_contact_at=?`. Truncate na 500 znaků (`mail.error.slice(0, 500)`) match design § 4.5.
- `mail_attempts` se v UPDATE **neaktualizuje** — defaultně zůstává 0 z INSERTu. To je drobná nekonzistence s migration commentem (`mail_attempts: 0..2 (orig + 1 retry)`) a design § 4.5. **Severity:** NICE only — bounced status sám o sobě signalizuje fail, attempts count je jen forensika.

### 2.3 [FIX] Race condition v idempotenci pro paralelní requesty

- **Kde:** `lead.js:104-149` + `migrations/0001_leads.sql:44-45`
- **Co:** UNIQUE index na `(email, url, substr(created_at, 1, 10))` chytí duplikát mezi requesty. Ale **edge case**: dva requesty se stejným (email, url) startují v 23:59:59.999 a 00:00:00.001 přes půlnoc UTC → unique key je různý (jiný `day`), oba projdou, **odejdou dva maily**. Per-day granularita to akceptuje, ale junior dostal explicitní otázku „race condition v idempotenci je správně ošetřena". Odpověď: **uvnitř téhož dne ano, přes půlnoc UTC ne**. To není dnes blocker (5 leadů/h limit + objem ~1 lead/den brání), ale stojí za poznámku.
- **Doporučení:**
  1. Přidat poznámku do `lead.js` JSDoc: „Idempotence je per-UTC-day. Lead odeslaný v 23:59 a v 00:01 následujícího dne se uloží 2× — akceptováno (znovu projevený zájem)."
  2. Na test bench: junior nemá test pro paralelní `Promise.all([captureLead(), captureLead()])` se stejnými args. Tester ať doplní do acceptance.
- **Severity:** FIX dokumentace, NICE pro chování.

### 2.4 [PASS] Worker CPU per request

- `handleAnalyze` synchronní (bez `await`) odbavuje response v ~1 ms — vrací SSE stream a vrací se. `runAnalysis` běží asynchronně v transformstreamu, neúčtuje se do `fetch handler` CPU. Lead capture cascade celá v `ctx.waitUntil` — má vlastní 30s budget mimo response CPU. **Žádné CPU reservoir issue.**
- Subrequesty: `analyze.js` 1× `fetch(target)`, `lead.js` 1× DB INSERT, `mail.js` 1× `EMAIL.send()` (+ retry až 1× navíc), `analyze.js` 1× DB UPDATE = max 5 subrequestů. Free tier 50/req limit s velkou rezervou. **PASS.**

### 2.5 [PASS] KV consistency model — known limitation, akceptovatelná

- `ratelimit.js:69-78`: `get` pak `put` není atomic. Race umožní 6. lead místo 5. Junior to **explicitně dokumentoval** v komentáři (řádky 17-19). Per design § 7.1 anti-abuse limit, ne security boundary — akceptovatelné. **PASS.**

### 2.6 [NICE] `analyze.js:218` `analysisPromise.then(...)` váže lead capture na úspěšné dokončení analýzy

- **Co:** Když `runAnalysis` throwne (zachycený v `analyze.js:202-211`), `analysisPromise` se **resolvne** (catch nehází dál) → `then()` proběhne → lead capture se spustí i při fail. To je správně (per design § 3.1 chybová varianta).
- **Pozn.:** `summary.score = null, verdicts = []` v error path → mail šablona dostane `score=0` (řádek 280) a `top3issues=['—', '—', '—']`. Marketingově to znamená „web nešel stáhnout, ale díky za zájem", ale šablona to dnes neřeší explicitně — pošle „skóre 0/100" a tři pomlčky. **Marketer/legal v retro:** lepší by bylo varianta šablony pro „analýza nedoběhla". Severity NICE.

---

## 3. Udržitelnost

### 3.1 [PASS] Žádné npm dependencies

- `package.json`: jen `wrangler` v devDependencies. Žádný `mimetext`, žádný runtime lib. Architect veto z design.md § 4.5 splněn. **PASS.**

### 3.2 [PASS] ESM imports konzistentní

- Všechny moduly mají `export ... function`, žádný CommonJS, žádný default export uvnitř toho samého souboru bez důvodu. `import` paths jsou explicitní s `.js` příponou (Cloudflare Workers ESM compat). **PASS.**

### 3.3 [PASS] Error handling konzistentní vrací `{ ok, error }`

- `lead.js`, `mail.js`, `ratelimit.js` všechny vrací `{ ok: bool, ... }`. Žádný throw přes API hranici (interní throw do try/catch jen v `lead.js:73-76` pro `stripUrl`). **Konzistence držená, čitelnost dobrá.**

### 3.4 [NICE] `optout.js:78` magic-string `nowIso.slice(11, 16)` pro „14:30"

- **Kde:** `src/optout.js:78`
- **Co:** `optedOutTime = nowIso.slice(11, 16)` — slice index 11–16 z ISO `2026-05-08T14:30:00.000Z` = `14:30`. Funguje, ale je to fragile (jiný timezone fmt by to rozbil). Šablona `optout-confirmation` to chce v UI string, takže to je rendering concern, ne data concern.
- **Doporučení:** Pojmenovat helper `extractTimeUtc(iso)` ve `lib/` (je to teď duplicitní s `czech-date` patterny v `lead-followup.js`, kde je `formatCzDate`). NICE only.

### 3.5 [NICE] Naming `vars.opted_out_at` (snake) vs. `vars.unsubscribe_url` vs. `vars.expires_in_hours`

- Vars do mail templates jsou **snake_case**. Funkční argumenty `captureLead({ url, email, source, consentVersion })` jsou **camelCase**. Mix. Konzistence by chtělo sjednotit (camelCase je standard v JS).
- **Doporučení:** v retro / následující iteraci sjednotit na camelCase napříč. Není to BLOCKer ani FIX, ale junior za 6 měsíců se zarazí.

### 3.6 [NICE] `mail.js:91` dynamický import šablon `import(\`../email/${template}.js\`)`

- **Co:** Funguje, ale dynamic import s template string je past pro bundlery (esbuild/wrangler bundle nemusí všechny varianty zahrnout). `TEMPLATES` whitelist je bezpečnostně OK, ale Wrangler 3+ může bundle udělat statický import všech čtyř variant.
- **Doporučení:** Switch na statický map (větší boilerplate, ale bezpečnější bundling):

  ```js
  import { render as leadFollowup } from '../email/lead-followup.js';
  import { render as magicLink } from '../email/magic-link-auth.js';
  // ...
  const TEMPLATES_MAP = { 'lead-followup': leadFollowup, ... };
  ```

  **Researcher úkol:** ověřit že wrangler 4 dynamický import s template string bundluje. Pokud ano, NICE only. Pokud ne, FIX.

### 3.7 [NICE] `ratelimit.js:104` honeypot sleduje **jak** `company` **tak** `website`

- Junior v komentáři přiznává: „v `index.html` použil `website`, design § 7.2 říká `company`". Místo aby sjednotil, drží oba pro safety. To je technický dluh — design.md říká `company`. Buď opravit `index.html` na `company`, nebo update design.md. Ne držet oba.
- **Severity:** NICE. Pickni jeden a nech ho. Tester ať ověří.

### 3.8 [NICE] Komentář `analyze.js:13` říká „TASK-12“

- Tag-it odkazy na TASK-XX v inline komentářích (`// (TASK-12)…`) jsou užitečné během iterace, ale nejsou stabilní reference (čísla se přečíslují, retro je smaže). Junior za 6 měsíců neuvidí tasks.md. Lépe odkazovat na `design.md § 3.1` apod. — to je stabilnější. NICE.

---

## 4. Design.md compliance

### 4.1 [PASS] D1 schema 1:1 s design § 2.1

- `migrations/0001_leads.sql` kontrola sloupec po sloupci: id, created_at, url, email, consent_at, consent_text_version, consent_ip_hash, consent_ua_hash, source, status, unsubscribe_token, mail_sent_at, mail_attempts, mail_last_error, opted_out_at, last_contact_at, notes — **všechny tam, ve správných typech, NOT NULL kde má být, default `'new'` u status, default 0 u `mail_attempts`.**
- Indexy: `leads_idem` UNIQUE (email, url, substr(created_at,1,10)), `leads_status_created`, `leads_last_contact` — všechny per § 2.1. **PASS.**

### 4.2 [PASS] Worker endpointy 1:1 s design § 3

- `GET /api/analyze?url=…&em=…&c=1&v=…&s=…` — match (analyze.js parsuje `email`, `c`, `v`, `s`). **Pozn.:** design § 3.1 píše `em` jako parametr, ale `analyze.js:128` čte `sp.get('email')`. Index.html (řádek ~334) submituje `name="email"`. Tj. junior + frontend používají `email`, ne `em`. **Konzistentní v rámci kódu** (form → JS forwarding → worker), ale **odchylka od design.md**. NICE — sjednotit (já jako architect autorita říkám: změnit design § 3.1 na `email`, kratší tahá, ale jasnější).
- `GET /odhlasit?t=<token>` — match (`optout.js:33` reads `t`). **PASS.**
- `POST /api/lead` jako 501 stub — per design § 3.2 fallback, junior správně neimplementoval (decisions říkají piggyback je primary). **PASS.**

### 4.3 [PASS] Email Workers binding `EMAIL` (ne `EMAIL_BINDING`, ne MailChannels)

- `wrangler.toml:37-38`: `[[send_email]] name = "EMAIL"`. `mail.js:78` checkuje `env.EMAIL.send`. **PASS.**

### 4.4 [PASS] Mail šablony — struktura per design § 5

- Každá šablona má `subject`, `html`, `text` output přes `layout()`. Patička jednotná v `_layout.js`. **PASS.**

### 4.5 [PASS] List-Unsubscribe + List-Unsubscribe-Post hlavičky

- `mail.js:103-106`: pro `lead-followup` + `soft-doi` se nastaví `List-Unsubscribe: <url>, <mailto:>` + `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. Per design § 4.5 + research. **PASS.** RFC 8058 compliant.

### 4.6 [PASS] Sender from per template

- `mail.js:21-26`: `nabidky@fakan.cz` pro lead/marketing/optout, `prihlaseni@fakan.cz` pro magic-link. Reply-To jednotně `jsem@fakan.cz`. Match design § 4.3. **PASS.**

---

## 5. Mantinely (CLAUDE.md sekce 2)

### 5.1 [PASS] Vanilla JS, žádný framework

- Audit `src/**/*.js` + `fakan.cz/*.html` — žádný React/Vue/Svelte/Astro/Lit. Web Components nejsou použité (zbytečné), pure HTML+JS. **PASS.**

### 5.2 [PASS] Cloudflare-first, žádný third-party hosting

- Workers + D1 + KV + Email Workers + Pages. Žádný Resend, žádný Sentry, žádný Stripe (yet). **PASS.**

### 5.3 [PASS] Žádné cookies, žádné trackery, žádné externí JS

- `optout.js` HTML response: žádný `Set-Cookie`, žádný `<script src=…>`, žádný `<img>`. Inline CSS, žádný webfont. **PASS.**
- `analyze.js` SSE response: jen `text/event-stream` headery, žádný cookie. **PASS.**
- Mail šablony: žádný tracking pixel (řešeno v 1.10). **PASS.**

### 5.4 [NICE] `optout.js:140` `font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;`

- Brand brief říká **Inter** (variable, self-host) jako primární font. `optout.js` HTML response používá system font stack. Pro mail je to OK (mailoví klienti `@font-face` často nepodporují), ale pro response stránku v prohlížeči by se mělo použít Inter z `/fonts/`. **Severity:** NICE — opt-out stránka je low-traffic, fix v retro.

---

## 6. Top 5 nálezů — must fix před Gate 3 (Pre-launch)

1. **BLOCK 1.1: `wrangler.toml [vars] CONSENT_SALT = ""` smazat.** Salt jen jako secret přes `wrangler secret put`. Nesmí jít do produkce — buď se přepíše secret prázdným stringem (security incident), nebo lead capture spadne na `salt_missing` errors (feature outage).
2. **FIX 1.2: Zavolat `checkRateLimit({ scope: 'lead-capture', limit: 5, windowSeconds: 3600 })` v `analyze.js → captureLeadAndMail()` před `captureLead()`.** Bez něj nemáme limit per design § 2.4 — anti-abuse vrstva chybí pro lead/mail kanál.
3. **FIX 1.3: Zúžit idempotence catch v `lead.js:141` na konkrétní `leads.email` nebo `leads_idem`.** Aktuální `includes('UNIQUE constraint failed')` chytí i token kolizi → mail odejde, lead chybí v DB.
4. **FIX 2.3: Doplnit JSDoc poznámku o per-UTC-day idempotenci v `lead.js`.** Junior + tester musí vidět, že 23:59 a 00:01 = 2 maily (akceptováno, ale dokumentované).
5. **FIX 4.2: Sjednotit `em` vs. `email` query param.** Design.md § 3.1 píše `em`, frontend + worker používá `email`. Já jako architekt autorita: přepsat design.md na `email`, ne kód. Záznam do decisions.md.

---

## 7. Top 5 nálezů — nice to have, retro/další iterace

1. **NICE 1.5:** Timing leak v `optout.js` (formátová validace nedělá DB roundtrip). Pro 2^256 token search space irelevantní, ale clean fix = fake DB call. Retro.
2. **NICE 3.6:** `mail.js` dynamic import → statický map. Researcher ať ověří wrangler 4 bundling.
3. **NICE 3.7:** Honeypot pole sjednotit (`company` per design vs. `website` v `index.html`). Pickni jeden.
4. **NICE 5.4:** `optout.js` HTML response použít Inter font místo system stack.
5. **NICE 2.6:** `lead-followup` šablona pro variant „analýza nedoběhla" (dnes pošle skóre=0 + tři pomlčky).

Bonus: **NICE 3.5** Sjednotit camelCase vs snake_case v args/vars napříč moduly. **NICE 2.2** UPDATE bounced statusu doplnit `mail_attempts = 2`.

---

## 8. Verdikt

**APPROVED WITH FIXES** — ke spuštění do produkce po vyřešení BLOCK 1.1 + FIX 1.2, 1.3, 2.3, 4.2.

Junior odvedl solidní práci: vrstvení modulů je čisté (lead.js → mail.js → mime.js bez kruhových závislostí), defenzivní error handling všude, `ctx.waitUntil` cascade správně izolovaná, prepared statements konzistentně, escapování v mail šablonách, žádné npm dependencies. Čeho si vážím obzvlášť: explicitních komentářů u každého modulu odkazujících na design.md/risk-check.md sekce — to je dobrá disciplína.

Tři nálezy jsou klíčové: chybějící `lead-capture` rate limit (FIX 1.2 — junior to napsal a otestoval, ale zapomněl zavolat), prázdný CONSENT_SALT v `[vars]` (BLOCK 1.1 — security ohrožení) a moc široký catch idempotence (FIX 1.3 — past pro budoucí UNIQUE constrainty). Po opravě těchto čtyř + dokumentační FIX 2.3 + 4.2 je code ready k Gate 3 a launch.

Tester má paralelně acceptance — pokud najde funkční bugy (např. mail nedorazí, opt-out neproběhne), s tím se případně ještě vrátíme. Architectonicky je vrstva v pořádku.
