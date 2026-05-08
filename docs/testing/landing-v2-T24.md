# Tester report — landing-v2 T24

**Datum:** 2026-05-08
**Tester:** AI agent (Claude — tester role)
**Iterace:** landing-v2
**Stav:** **FAIL** (1 blocker, 1 major rozpor s AC, 5 minor flagů)

---

## 0. Verdikt v jedné větě

Backend lead-capture pipeline má v produkci kritickou nesrovnalost: frontend posílá `em=`, ale `parseLeadParams` v `src/analyze.js` čte `email=` — **lead capture se v produkci NIKDY nespustí.** Vše ostatní (D1 schéma, opt-out flow, mail šablony, statika, idempotence, security) drží.

---

## 1. Unit testy

| Soubor | Verdikt | Detaily |
|---|---|---|
| `src/lib/url-strip.js` | ✅ pass | 1 subtest |
| `src/lib/hash.js` | ✅ pass | 1 subtest |
| `src/lib/lead.test.js` | ✅ pass | 1 subtest, captureLead pokryt |
| `src/lib/mail.test.js` | ✅ pass | 1 subtest |
| `src/lib/ratelimit.test.js` | ✅ pass | 1 subtest |
| `src/analyze.test.js` | ✅ pass (16 testů) | **Pozor: testy parseLeadParams jedou s `email=`, ne s `em=` jako reálný frontend — viz Bug #1.** |
| `src/optout.test.js` | ✅ pass (6 testů) | |
| `src/worker.test.js` | ✅ pass (9 testů) | |

**Souhrn:** všechny testy zelené. **Ale** `analyze.test.js` testy `parseLeadParams` testují špatný kontrakt — viz Bug #1.

---

## 2. Lead capture happy path (offline mock)

Spuštěno přes Node mock DB:

```
GET /api/analyze?url=https://example.cz/page?utm=spam&em=a@b.cz&c=1&v=v1-2026-05-08&s=landing-hero
```

**Co skutečně proběhne:**
1. `worker.js` rate limit gate — pass (degraduje permissive bez RATELIMIT KV / IP)
2. `handleAnalyze(request, env, ctx)` zavolán
3. `parseLeadParams(searchParams)` — **vrací `enabled: false, reason: missing_email`** ❌
4. `console.log('[analyze] lead capture skipped: missing_email')`
5. `ctx.waitUntil(captureLeadAndMail(...))` se **NEVYVOLÁ**
6. Žádný D1 INSERT, žádný mail.

**Acceptance:** ❌ FAIL — viz Bug #1.

Pokud bych zavolal stejný endpoint s `email=` (jak to dělají testy), pipeline projde:
- `captureLead` → INSERT do D1 (URL stripnutá, IP hash 64 znaků, token 64 znaků)
- `sendMail({template:'lead-followup', to:..., vars:{...}})`
- `markLeadMailed` UPDATE status='mailed'

Tj. backend pipeline za parserem je v pořádku, jen entry point čte špatný query klíč.

---

## 3. Lead capture edge cases

Testy proběhly s mock DB v Node, **přímo voláním `captureLead()`** (obejití parseLeadParams):

| Scénář | Očekáváno | Skutečnost | Verdikt |
|---|---|---|---|
| Bez `email`/missing email v query (přes parseLeadParams) | `enabled: false, reason: missing_email` | OK pro `email=`; ale frontend posílá `em=` → parser vždy říká missing_email | ❌ Bug #1 |
| Bez `c=1` | skipped, reason `missing_consent` | OK | ✅ |
| Bez `v` | skipped, reason `missing_version` | OK | ✅ |
| Honeypot `?website=spam` | silent 200, prázdný SSE | 200, content-type `text/event-stream`, body `''` | ✅ |
| Honeypot `?company=spam` | silent 200, prázdný SSE | 200, body `''` | ✅ |
| Prázdný honeypot `?website=` | analýza poběží | 200, stream není prázdný | ✅ |
| Duplicate UNIQUE constraint | `{ ok: true, lead: { duplicate: true } }` | Reprodukováno simulací výjimky `UNIQUE constraint failed` | ✅ |
| Invalid email regex | `{ ok: false, error: 'invalid_email' }` | OK | ✅ |
| Invalid `source` mimo whitelist | `{ ok: false, error: 'invalid_source' }` | OK | ✅ |
| Invalid `consentVersion` (prázdná) | `{ ok: false, error: 'invalid_consent_version' }` | OK | ✅ |
| Missing `CONSENT_SALT` | `{ ok: false, error: 'salt_missing' }` | OK | ✅ |
| Invalid URL (nelze parsovat) | `{ ok: false, error: 'invalid_url' }` | OK | ✅ |
| Generic DB error | `{ ok: false, error: 'db_error', detail: ... }` | OK + log `[captureLead] db_error: ...` | ✅ |
| URL strip — query string odstraněn | `https://example.cz/page` | Insert hodnota: `https://example.cz/page` (bez `?utm=spam`) | ✅ |
| IP hash 64 znaků (sha256 hex) | délka 64 | Skutečná délka 64 | ✅ |
| `unsubscribe_token` 64 hex | délka 64, unique generování | Délka 64, dva volání = různé tokeny | ✅ |

**Verdikt sekce:** captureLead samotná je solidní. **Skipped path z parseLeadParams je rozbitá** — Bug #1.

---

## 4. /odhlasit flow (offline mock)

Otestováno přímým voláním `handleOptout(request, env, ctx)` s mock DB:

| Scénář | Očekáváno | Skutečnost | Verdikt |
|---|---|---|---|
| Chybějící `t` parametr | 200 generic HTML „odhlášeno" | 200, content-type `text/html; charset=utf-8`, žádný DB call, žádný mail | ✅ |
| Krátký token (`?t=abc`) | 200 generic | 200, žádný DB call | ✅ |
| Non-hex token (64×`z`) | 200 generic | 200, žádný DB call | ✅ |
| Valid format ale neexistuje v DB | 200 generic, žádný DB update, žádný mail | 200, žádný UPDATE, žádný mail | ✅ |
| Valid token, status `mailed` | 200 + UPDATE status=`opted_out` + waitUntil(sendMail optout-confirmation) | 200, UPDATE proběhl, sendMail naplánován v ctx.waitUntil | ✅ |
| Valid token, už `opted_out` (idempotence) | 200, žádný UPDATE, žádný duplicitní mail | 200, žádný UPDATE | ✅ |
| DB error při SELECT | 503 + lidská hláška | 503, body obsahuje „Dočasná chyba" | ✅ |
| Žádný `Set-Cookie` header | null | header set-cookie = null | ✅ |
| `Cache-Control: no-store` | přítomný | `no-store, max-age=0` | ✅ |
| Žádný leak existence tokenu | invalid format / not-in-DB / opted_out / success vrací stejný HTML | Všechny varianty vrací stejný `DONE_HTML` | ✅ |

**Verdikt sekce:** ✅ PASS — opt-out flow je security-correct, neprozradí útočníkovi nic.

---

## 5. Frontend — manuální smoke test

`python3 -m http.server 8765 --directory fakan.cz/`

| Stránka | HTTP | `<title>` | Komentář |
|---|---|---|---|
| `/index.html` | 200 | „fakan.cz — váš web, bez starostí" | Tagline „Váš web. Bez starostí." v `<h1>` ✅ |
| `/vysledek.html` | 200 | dynamicky | Form forwarduje `em`, `c`, `v`, `s` do `/api/analyze` |
| `/prehled.html` | 200 | OK | Velký rozsah (61 kB), žargon hluboko od ř. 579 (OK) |
| `/ochrana-udaju.html` | 200 | „Zásady ochrany osobních údajů — fakan.cz" | Datum účinnosti 8. května 2026, retence 12 měsíců, IČO 14389096, OR sp. C 364981 |
| `/odhlasit-hotovo.html` | 200 | „Odhlášeno — fakan.cz" | `noindex` meta, vykání |

### 5.1 Vykání check (Python regex s českými word-boundary)

| Soubor | Výskytů tykání (`tvůj`/`tvoje`/`tobě`/`tě`/`ty`/`ses`) | Verdikt |
|---|---|---|
| `index.html` | 0 | ✅ |
| `vysledek.html` | 0 (regex `tě` našel false-positive ve slově „obyčejný" — ignorováno) | ✅ |
| `ochrana-udaju.html` | 0 (1 false positive: `ty` ve slově „tokenů") | ✅ |
| `odhlasit-hotovo.html` | 0 | ✅ |
| `prehled.html` | **5+** (`Stahuju tvůj web…`, `Tvůj web má 6 vad`, `Tvůj web je tvůj. Vždycky.`, `kdyby ses chtěl vrátit`, `content je tvůj`) | ❌ **AC fail TASK-18** |

Bug #2 — `prehled.html` má tykání v sekci „Anti lock-in" + v dema-mock area. TASK-18 AC: **0 výskytů** „ty/tvůj/tobě/tě". Nejsou v hero (do ř. 200), takže to není absolutní deal-breaker, ale je to jasná regrese vůči acceptance criteria.

### 5.2 Žargon-blacklist v hero (do ř. 200)

| Soubor | Výskyty | Verdikt |
|---|---|---|
| `index.html` | 0 (CSS class `.email-input` matchuje `INP` — false positive) | ✅ |
| `vysledek.html` | 0 | ✅ |
| `prehled.html` | 0 v hero, vše až od ř. 579 (OK) | ✅ |

### 5.3 Externí scripty / fonty / trackery

```
grep -r "google-analytics|gtag|googletag|fonts.googleapis|hotjar|cookiebot|onetrust|smartlook|mouseflow|fullstory|logrocket" fakan.cz/  → 0 výskytů
grep -r "googleapis|gstatic|cdnjs|jsdelivr|unpkg" fakan.cz/  → 0 výskytů
grep "Set-Cookie\|document.cookie" fakan.cz/*.html  → 0 výskytů
```

Externí HTTPS odkazy:
- `ochrana-udaju.html:325` — `https://www.uoou.gov.cz/` (česká vládní stránka pro stížnosti, OK pro Privacy Policy, jen `<a href>`, žádný resource load)

`<script>` výskyty (4 souboru × 1):
- `index.html`, `ochrana-udaju.html`, `odhlasit-hotovo.html` — `application/ld+json` JSON-LD inline (povolené)
- `vysledek.html` — `<script type="module" src="/vysledek.js">` (same-origin, OK)

**Verdikt:** ✅ žádný cookie banner, žádný third-party tracker, žádný externí font.

### 5.4 HTML strukturní validace

Python `html.parser` projet všech 5 stránek → **0 mismatch tagů, 0 nezavřených tagů.**

---

## 6. wrangler.toml + migrace

### 6.1 `wrangler deploy --dry-run`

```
✨ Read 9 files from the assets directory /Users/junkycoder/fakan/fakan.cz
Total Upload: 69.72 KiB / gzip: 19.69 KiB
Bindings:
  env.RATELIMIT (KV Namespace, id TBD)
  env.EMAIL (unrestricted, Send Email)
  env.DB (fakan_leads, D1 Database)
  env.CONSENT_SALT ("" Environment Variable)
```

✅ Dry-run pass, žádné varování. **Flag #5:** `database_id` a `id` u KV jsou `TBD-replace-after-...` — před produkčním deployem nutno vytvořit přes `wrangler d1 create` a `wrangler kv namespace create`. `CONSENT_SALT` je v `[vars]` jako prázdný — nutno přepsat přes `wrangler secret put` (komentář v `wrangler.toml` upozorňuje).

### 6.2 SQL migrace

```
sqlite3 /tmp/test-leads.db < migrations/0001_leads.sql  →  schema OK
```

Tabulka `leads` + 3 indexy (`leads_idem`, `leads_status_created`, `leads_last_contact`) + 2 sqlite autoindexy (`unsubscribe_token` UNIQUE, `id` PRIMARY).

**Idempotence test:**
- 1. INSERT `('a@b.cz', 'https://x.cz', '2026-05-08')` → ok
- 2. INSERT same email+url+day → `Error: UNIQUE constraint failed: index 'leads_idem'` (exit 19) ✅
- 3. INSERT same email+url, jiný day (`2026-05-09`) → ok ✅

✅ Per-day idempotence funguje, idempotence test pass.

---

## 7. Mail šablony render

Volány přes `node -e "import('./src/email/<tpl>.js')"`:

### 7.1 `lead-followup`

```
subject: "Analýza x.cz — našli jsme tři věci"  (34 znaků, < 50 OK)
has_ICO_14389096: true
has_OR_C_364981: true
has_optout_link: true (https://fakan.cz/odhlasit?t=abc)
has_any_img: false (žádný tracking pixel)
text_len: 1599  (plain twin OK)
text_has_optout: true
text_has_ICO: true
```

✅ PASS

### 7.2 `magic-link-auth`

```
subject: "Přihlašovací odkaz pro fakan.cz"  (31 znaků)
has_ICO: true (patička stejná pro všechny)
has_OR: true
has_optout: false  (správně — magic-link je transakční, per design § 5.2)
no_img: true
text_len: 659
has_DRAFT_v0: true (komentář)
```

✅ PASS

### 7.3 `optout-confirmation`

```
subject: "Odhlášeno z fakan.cz"  (20 znaků)
has_ICO: true
has_OR: true
has_optout_link: false  (správně — uživatel je už odhlášený)
no_img: true
text_len: 558
```

✅ PASS

### 7.4 `soft-doi`

```
subject: "Potvrďte, prosím, zájem o analýzu x.cz"  (38 znaků)
has_ICO: true
has_OR: true
has_optout_link: false  ← per implementaci `withOptout: false`
```

**Flag #4:** TASK-08 AC explicitně říká „Patička obsahuje placeholders ... `{{OPTOUT_URL}}` (lead-followup, **soft-doi**, optout-confirmation)" — tj. soft-doi má mít opt-out odkaz. Implementace ho nemá. Z funkčního hlediska je to obhájitelné (soft-doi je potvrzovací mail před zařazením do databáze, ne marketing — pokud uživatel nepotvrdí, smažeme ho), ale je to **rozpor s AC**. Šablona je zatím „na sklad" (komentář v souboru), takže to neblokuje launch.

---

## 8. Brand a tón check

### 8.1 Vykání v src/email

```
grep -in "tvůj\|tvoje\|tobě" src/email/*.js  →  0 výskytů
```

✅ PASS — všechny mail šablony vykají.

### 8.2 Tagline

`<title>fakan.cz — váš web, bez starostí</title>` ✅
`<h1>Váš web. Bez&nbsp;starostí.</h1>` ✅

`copy.md` § 1 doporučuje variantu A „Váš web. Bez starostí." — implementováno per doporučení.

### 8.3 Žargon-blacklist v hero

Viz § 5.2 — pass.

---

## 9. CLAUDE.md mantinely

| Mantinel | Verdikt |
|---|---|
| Žádné cookies / cookie banery | ✅ 0 `Set-Cookie`, 0 cookie banner script |
| Žádné externí fonty (`googleapis`, `gstatic`) | ✅ 0 výskytů |
| Žádné externí JS (`cdnjs`, `jsdelivr`, `unpkg`) | ✅ 0 výskytů |
| `<html lang="cs">` | ✅ všech 5 stránek |
| Mobile-first, žádný horizontální scroll | nezkontrolováno (viz § 11 — Co netestuju) |
| Auto dark/light přes `prefers-color-scheme` | ✅ optout HTML inline má `@media (prefers-color-scheme: dark)`; statické stránky drží brand tokeny (manuálně neověřeno) |

---

## 10. Bug reporty

### Bug #1 — BLOCKER

```
Bug: Lead capture se v produkci NIKDY nespustí — frontend posílá `em=`, parser čte `email=`.
Závažnost: blocker
Kroky:
  1. Otevři fakan.cz/index.html, formulář hero. Form má `<input name="em">` (řádky 322, 526).
  2. Form action="/vysledek" method="get" → URL `/vysledek?url=...&em=jan@fakan.cz&c=1&v=v1-2026-05-08&s=landing-hero`.
  3. fakan.cz/vysledek.js (řádek 7): `params.get('em')` → ✅ čte správně.
  4. vysledek.js (řádek 34): `apiQs.set('em', email)` → posílá `em=` na `/api/analyze`.
  5. src/analyze.js parseLeadParams (řádek 128): `const email = sp.get('email');`  ❌ čte špatný klíč.
  6. parseLeadParams vrací `{ enabled: false, reason: 'missing_email' }` pro VŠECHNY produkční requesty.
  7. ctx.waitUntil(captureLeadAndMail(...)) se nikdy nezavolá.
Očekáváno: lead se uloží do D1 a uživateli odejde follow-up mail.
Skutečnost: console.log("[analyze] lead capture skipped: missing_email"), žádný D1 zápis, žádný mail.
Důkaz (přímá repro):
  $ node -e "import('./src/analyze.js').then(({parseLeadParams}) => {
      const sp = new URLSearchParams('em=jan%40fakan.cz&c=1&v=v1-2026-05-08&s=landing-hero');
      console.log(parseLeadParams(sp));
    })"
  → { enabled: false, email: null, ..., reason: 'missing_email' }
Kontext: src/analyze.js:128, src/analyze.test.js řádek 36 testuje s `email=` (test je shodný s implementací, ale jiný než reálný kontrakt).
Návrh fixu (NEUPRAVOVAL JSEM, jen popisuju):
  - Buď v `analyze.js` `parseLeadParams` změnit `sp.get('email')` → `sp.get('em')`, sjednotit s frontendem
  - NEBO ve `vysledek.js` (řádek 34) změnit `apiQs.set('em', email)` → `apiQs.set('email', email)` a v `index.html` přejmenovat input name (form předává parametry jak jsou).
  - Decisions.md / design.md přesnou variantu neurčují — query string kontrakt mezi frontendem a `/api/analyze` musí architekt sjednotit.
  - Také opravit testy v analyze.test.js (řádky 36, 52, 53, 59, 66, 201) aby používaly stejný klíč jako produkční fronted.
```

### Bug #2 — MAJOR

```
Bug: prehled.html porušuje TASK-18 AC „0 výskytů ty/tvůj/tobě/tě".
Závažnost: major
Kroky:
  1. Otevři fakan.cz/prehled.html.
  2. Hledej řádky 785, 794, 1011 (×2), 1015.
Očekáváno: 0 výskytů tykání mimo schválený tagline (TASK-18 AC explicitně).
Skutečnost: 5+ výskytů:
  - ř. 785: "Stahuju tvůj web…" (mock-line v dema)
  - ř. 794: "Tvůj web má 6 vad. Tři vážné, tři kosmetické." (result-block v dema)
  - ř. 1011: "Tvůj web je tvůj. Vždycky." (Anti lock-in heading)
  - ř. 1015: "kdyby ses chtěl vrátit", "content je tvůj"
Kontext: dema sekce + Anti lock-in jsou hluboko v souboru (ne hero), takže to neblokuje brand pivot v hero. Ale TASK-18 AC říká „celý copy projít na vykání, **0 výskytů**". Soubor 61 kB, junior pravděpodobně refaktoroval jen hero.
Návrh fixu (NEUPRAVOVAL JSEM): junior projde celý prehled.html a přepíše tykání → vykání.
```

### Flag #3 — MINOR

```
Bug: src/analyze.js — fetch progress hláška „Stahuju tvůj web…" (řádek 354).
Závažnost: minor
Kroky:
  1. SSE event `stage` po startu analýzy.
  2. Klient (vysledek.js) zobrazuje hlášku v `#stageLabel`.
Očekáváno: vykání ve všech UI textech.
Skutečnost: tykání v server-streamované hlášce, kterou uživatel uvidí během analýzy.
Kontext: Tahle hláška se posílá přímo z Workeru, nepřechází přes copy.md. Junior ji v iteraci přehlédl.
Návrh fixu: změnit na „Stahuju váš web…" v src/analyze.js:354.
```

### Flag #4 — MINOR (rozpor s AC, ne s funkcí)

```
Bug: src/email/soft-doi.js patička nemá opt-out odkaz.
Závažnost: minor
Kroky:
  1. Otevři src/email/soft-doi.js — `withOptout: false` v `layout()` voláním (řádek 70).
Očekáváno: TASK-08 AC: „Patička obsahuje placeholders ... `{{OPTOUT_URL}}` (lead-followup, soft-doi, optout-confirmation)".
Skutečnost: soft-doi se renderuje bez opt-out linku (ale soft-doi je „na sklad", MVP ho nepoužívá).
Kontext: Z funkčního hlediska je obhájitelné — soft-doi je potvrzovací mail před zařazením do databáze (před souhlasem), opt-out tam ještě nedává smysl. Z legal hlediska: pokud uživatel neklikne potvrzení, automaticky to smažeme — tedy opt-out je zbytečný. Ale TASK-08 AC to vyžaduje.
Návrh fixu: buď doplnit opt-out odkaz do soft-doi (slabě obhájitelné — token v té chvíli neexistuje, lead ještě není v DB), nebo nechat jak je a aktualizovat AC v retru.
```

### Flag #5 — MINOR (deploy-time)

```
Bug: wrangler.toml má placeholdery `TBD-replace-after-...` u D1 a KV id.
Závažnost: minor (pre-launch akce)
Kontext: design.md + tasks říkají „TBD nahradit po wrangler d1 create / kv namespace create" — komentář v wrangler.toml to přiznává. Toto NENÍ AC fail TASK-01 (AC explicitně dovoluje `TBD` placeholder s komentářem), jen flag pro Gate 3 — bez skutečných ID se deploy neprovede.
Akce před launchem:
  - $ wrangler d1 create fakan_leads → vlož ID
  - $ wrangler kv namespace create RATELIMIT → vlož ID
  - $ wrangler secret put CONSENT_SALT → vlož 32-byte random
  - $ wrangler d1 execute fakan_leads --file=./migrations/0001_leads.sql --remote
```

### Flag #6 — MINOR (ratelimit scope name)

```
Bug: TASK-11 AC říká scope `'lead'`, ratelimit.js whitelist má `'lead-capture'`.
Závažnost: minor (cosmetic AC drift)
Kontext: ratelimit.js `ALLOWED_SCOPES = new Set(['lead-capture', 'analyze'])`. AC říká `'lead'`. Worker.js volá `'analyze'` — pro `/api/analyze` je to OK. Pro hypotetický POST `/api/lead` (který v worker.js není implementovaný, jen 501 stub) by to byl `'lead-capture'`, ne `'lead'`.
Akce: AC vs. implementace — architect rozhodne, ale nenutné teď. POST /api/lead je out-of-scope.
```

### Flag #7 — MINOR (POST /api/lead je 501)

```
Bug: TASK-10 AC říká „POST /api/lead → 204/400/429", implementace vrací 501 not_implemented.
Závažnost: minor (scope cut)
Kontext: src/worker.js řádek 70 — `/api/lead` vrací 501. fit-check + decisions.md scope cut: pro landing-v2 stačí piggyback v `/api/analyze`. Komentář v kódu „TODO: implementovat až bude potřeba samostatný kontaktní formulář (post-landing-v2)".
Akce: žádná pro této iteraci, ale TASK-10 AC by se měla aktualizovat na retro: „v MVP 501, fallback POST /api/lead doplníme později".
```

---

## 11. Co jsem netestoval (explicitně)

- **Mail deliverability na 3 schránky (Seznam/Gmail/Outlook):** vyžaduje produkční Cloudflare deploy + verifikovanou Email Workers doménu + DNS (SPF/DKIM/DMARC) — TASK-21 researcher výstup ukázal, že DMARC chybí. Test mailu z `nabidky@fakan.cz` lze udělat až po deployi.
- **Lighthouse skóre (Performance ≥ 90, A11y = 100):** vyžaduje běžící Chrome DevTools / `lighthouse` CLI v headless módě. Statické stránky bez externích resourců by měly skóre vyhrát, ale neověřeno empiricky.
- **Mobile 375 px DevTools — žádný horizontální scroll:** vyžaduje vizuální kontrolu v Chrome. Strukturně všechny stránky používají brand tokeny per design § 6.1 (font 18 px desktop / 17 mobile).
- **Dark mode `prefers-color-scheme: dark`:** optout HTML má `@media (prefers-color-scheme: dark)` inline. Statické stránky to taky drží (běžně přes CSS tokeny), ale empiricky neověřeno.
- **Klávesnicová navigace + screen reader (VoiceOver/NVDA):** strukturně form má `<label for=...>`, `:focus-visible` styling — neověřeno empiricky.
- **End-to-end flow přes wrangler dev s reálnou D1 + KV + Email Workers:** vyžaduje `wrangler dev --remote` + test emaily + DNS. Toto je v jurisdikci ownera před launchem.
- **CSP / CSRF (origin check pro POST /api/lead):** out-of-scope, POST /api/lead je 501.

---

## 12. Souhrn

| Kategorie | Pass | Fail | Flag |
|---|---|---|---|
| Unit testy | 8 souborů | 0 | 1 (testy testují špatný kontrakt) |
| Lead capture (přímé volání captureLead) | 13 | 0 | 0 |
| Lead capture (přes parseLeadParams s reálnou query) | 0 | 1 | 0 |
| Opt-out flow | 10 | 0 | 0 |
| Frontend statika (HTTP, struktura, externí trackery, vykání hero) | 5 stránek | 0 | 1 (prehled.html tykání mimo hero) |
| HTML strukturní validace | 5 | 0 | 0 |
| wrangler dry-run | 1 | 0 | 1 (TBD placeholders) |
| SQL migrace + idempotence | 1 | 0 | 0 |
| Mail šablony render | 4 | 0 | 1 (soft-doi bez opt-out — AC drift) |
| Brand a tón | 5 | 0 | 1 (analyze.js stage label tykání) |
| CLAUDE.md mantinely | 6 | 0 | 0 |

- **PASS scénářů:** 65+
- **FAIL scénářů:** 2 (Bug #1 blocker, Bug #2 major)
- **FLAGS:** 5

---

## 13. Doporučení pro Gate 3

### Musí padnout, než pojede pre-launch

1. **Bug #1 fix** — sjednotit query klíč mezi frontend a `parseLeadParams` (`em` vs `email`). Bez toho lead capture nefunguje, mail nedorazí, celá iterace nemá smysl.
2. **Bug #2 fix** — `prehled.html` přepsat zbylé tykání → vykání.
3. **Flag #5 deploy-time akce** — vytvořit D1 db, KV namespace, `CONSENT_SALT` secret, spustit migraci proti remote D1.
4. **Po Bug #1 fixu re-run** unit testů s aktuálním kontraktem (testy v `analyze.test.js` musí používat stejný query klíč jako produkční fronted, aby tahle regrese už neunikla).

### Nice-to-have, doplnit po launchi

5. **Flag #3** — `analyze.js:354` „Stahuju tvůj web…" → „Stahuju váš web…" (drobnost, viditelná v UI ale mimo lead-capture flow).
6. **Flag #4** — soft-doi opt-out odkaz: rozhodnutí na architecta + legal v retru, šablona „na sklad" stejně MVP nepoužívá.
7. **Flag #6** — ratelimit scope name `'lead'` vs `'lead-capture'` — pokud `/api/lead` zůstane 501, AC se může aktualizovat na retru.
8. **Flag #7** — POST `/api/lead` 501: dokumentovat v retru jako vědomý scope cut.
9. **Empirická validace v Chrome:** Lighthouse skóre, mobile 375 px, dark mode toggling, klávesnicová navigace přes hero form (Tab → Enter), VoiceOver na consent checkbox label. Tester bez živého browseru tyto nemůže zaručit.
10. **Mail deliverability test po DNS DMARC setupu** (researcher TASK-21 flag): test mail z `nabidky@fakan.cz` na Seznam/Gmail/Outlook po deployi.

---

*Předáno orchestrátorovi 2026-05-08. Verdikt: **FAIL** (Bug #1 blocker). Zpátky `junior-developer` (`em`/`email` sjednocení) + `senior-architect` (review query string kontraktu mezi frontend a Workerem).*
