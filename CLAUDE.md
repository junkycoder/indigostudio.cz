# CLAUDE.md — fakan repo

Tenhle soubor Claude Code automaticky načte na začátku každého sezení.
Drž se ho. Pokud něco není zde, koukni do `PROMPT.md` (původní zadání auditoru)
a `roadmap.md` (post-MVP fáze).

---

## Co je v tomhle repu

Jeden Cloudflare Worker (`fakan`) servuje **celý fakan.cz**. Začalo to
jako auditor, postupně přibývají další featury:

- **Audit webů** — form na fakan.cz → 5min → mail s reportem → 4-mail drip.
- **Placené návrhy** (chystá se) — AI (Claude) podle Fakanových instrukcí
  + zadání uživatele dodá redesign návrh, klient platí předem.
- **Nákup domény** (chystá se) — fakan.cz prodává doménu klientovi
  (registrar API + platba).

Všechno teče přes jeden Worker, jednu D1, jeden bucket. Žádné microservices.

Adresářová struktura (klasický Workers layout v rootu):

- **`wrangler.toml`** — config Workeru
- **`src/worker.js`** — entry, routing podle path
- **`src/handlers/`** — endpointy (`audit.js`, `report.js`, `screenshot.js`,
  budoucí: `suggestion.js`, `domain.js`)
- **`src/audit/`** — audit pipeline (processor, strategist, scoring)
- **`src/email/`** — templates + dispatcher (cron každých 15 min, Resend)
- **`src/legacy/`** — sjednocený opt-out s fallbackem na původní fakan_leads DB
- **`src/lib/`** — pomocné moduly (cors, …)
- **`public/`** — statika (landing, audit-page SPA, ochrana-udaju, …)
- **`db/schema.sql`** — D1 schéma (`fakan_auditor`)

## Stav (aktuální commit; vždy ověř `git log` pro skutečnost)

Worker `fakan` běží na fakan.cz (deployed 2026-05-09). Sjednocení tří
původních deploymentů (`fakan-cz` Worker, `fakan-auditor` Worker na
api.fakan.cz, Pages na audit.fakan.cz) je hotové, code i deploy.

Cleanup, který Fakan dělá ručně až bude jistá stabilita:

1. CF dashboard → smazat starý Worker `fakan-cz` (už nedrží route).
2. CF dashboard → smazat starý Worker `fakan-auditor` (po rename na `fakan`
   už nedrží route, jen existuje v účtu).
3. CF dashboard → smazat Pages projekt `fakan-audit-page`.
4. (Volitelně) CF dashboard → Bulk Redirects:
   - `audit.fakan.cz/*` → `https://fakan.cz/$1` (301)
   - `api.fakan.cz/*` → `https://fakan.cz/$1` (301)
   Drž 3 měsíce, pak zruš.
5. (~3 měsíce po cutoffu) — až staré opt-out tokeny z analyze flow odejdou:
   - smazat D1 `fakan_leads`
   - odstranit binding `LEGACY_DB` a `[[send_email]] EMAIL` ve `wrangler.toml`
   - smazat `src/legacy/`

## Pravidla práce

- **Stack je striktní.** Vanilla JS, ESM, žádný TypeScript, žádný build step. Žádné
  frameworky (Hono, Express, Itty Router, React, Vue, Svelte). Žádné ORM. Žádné npm
  závislosti mimo Cloudflare ekosystém + Web Platform. Komentáře česky OK,
  identifikátory anglicky.
- **Malé commity, jeden commit per fáze / per logická změna.** Po každé fázi smoke
  test (`npx wrangler deploy --dry-run` v rootu).
- **`wrangler.toml` resource ID nikdy nevyplňuj v repu** — placeholder `REPLACE_ME`,
  uživatel je vyplní lokálně. (Existující ID v repu zůstávají.)
- **Tajemství** přes `wrangler secret put`, nikdy do `wrangler.toml` ani kódu.
- **Když se zasekneš** — napiš `BLOCKERS.md` s "Co jsem zkusil / Proč to nefunguje /
  Co potřebuju od Fakana", commit dosavadní práci a STOP.
- **Žádný observability stack** — `console.log` je OK, Workers Logs v dashboardu stačí.

## Tonalita zákaznických textů (důležité — paměť to obsahuje, opakuju zde)

Pro **veškeré texty směřující na klienta** (mailové šablony, audit-page, validační hlášky,
SYSTEM prompt strategistovi, copy na fakan.cz):

- **Vykání**, malé v/v textech (kromě nově psaných pasáží, kde mám velké V/Vám/Vás —
  Fakan zatím nesjednotil, drž konzistenci s okolním souborem). NIKDY tykání.
- **Minimální technické znalosti klienta.** Žargon (HSTS, CSP, FCP, EAA, CMS, CDN,
  WebP, lazy-loading…) buď nepoužívat, nebo vysvětlit v jedné větě lidsky.
- **Asertivní > defenzivní.** Krátké věty, konkrétní čísla z findings, jasná
  doporučení. Žádné "možná by stálo za zvážení".
- **Stručnost.** Jeden bod = jedna věta. Žádné prodejní klišé ("revoluční",
  "synergie", "nadupaný", "moderní řešení").
- **Žádné emoji, žádné vykřičníky.**
- **"Hned" mentalita.** Konkrétní termíny ("do 2 prac. dnů", "do 5 minut"),
  ne "v dohledné době".
- **Interní texty (commity, README, BLOCKERS.md, code komentáře, PROMPT.md)** —
  tahle pravidla NEPLATÍ. Můžeš tykat, používat slang, být úsečný.

## Architektura — minimum pro orientaci

```
[POST /api/audit]
  → handlers/audit.js     validate + rate limit + cache → D1 (lead+audit+placeholder mail) → Queue
  → audit/processor.js    puppeteer + axe + cookies + seo + cms + headers
                          → R2 screenshot → D1 findings + score
                          → UPDATE placeholder mail (send_at = now)
                          → Queue { kind: 'strategist' }   (jen při úspěchu)
  → audit/strategist.js   Claude API (sonnet-4-5) + few-shoty
                          → D1 strategist_outputs
                          → scheduleEmail #2 +2d, #3 +5d, #4 +30d

[Cron */15 min]
  → email/dispatcher.js   D1 vyzvedne queued mail se send_at <= now
                          → Resend (List-Unsubscribe → /odhlasit/{token})
                          → 429/5xx posune send_at, 4xx permanent fail

[GET /audit/{token}]
  → worker.js              env.ASSETS.fetch('/audit/') (audit-page SPA)
  → public/audit/index.html  fetch /api/audit/{token}/data + img /api/screenshot/{id}

[GET /odhlasit/{token}, /odhlasit?t=, /unsubscribe?token=]
  → legacy/optout.js       zkus auditor DB, fallback LEGACY_DB → render done page
                           legacy flow taky pošle confirmation mail (env.EMAIL)

[GET /, /ochrana-udaju, /odhlasit-hotovo, /prehled]
  → env.ASSETS.fetch       statika z public/
```

Doménová mapa:
- `fakan.cz` — Worker `fakan` (vše)
- `api.fakan.cz`, `audit.fakan.cz` — zaniklé (volitelně 301 přes Bulk Redirect)

## Co NEdělej

- Nesahat na `wrangler.toml` `[[routes]]` ani `[[d1_databases]]` ID
  bez explicitního požadavku.
- Nepřidávat framework / TypeScript / build step (viz Pravidla).
- Necacheovat failed audity do `AUDIT_CACHE` (vrátil by se starý failed report).
- Neposílat strategist na failed audit (LLM by halucinoval bez findings).
- Nevracet email leadu / lead_id / interní fields v `/api/audit/{token}/data` —
  whitelist polí v `handlers/report.js`.
- Nesmazat `LEGACY_DB` binding ani Email Workers `EMAIL` binding, dokud nepostane
  jasné, že už nikdo z dávných mailů na opt-out neklikne (~3 měsíce po cutoffu).

## Známá omezení

- `wrangler dev` queue lokálně jen mockuje. Reálný E2E test queue + Browser Rendering
  vyžaduje deploy do staging environmentu.
- Strategist few-shoty bez prompt cachingu — po stabilizaci promptu (po ~50 reálných
  auditech) zapnout `cache_control: { type: 'ephemeral' }`.
- Žádný admin UI / kanban — Fakan přes D1 query přímo.

## Klíčové soubory

| Co | Kde |
|----|-----|
| Worker config | `wrangler.toml` |
| Worker entry + routing | `src/worker.js` |
| API handlery | `src/handlers/` |
| Sjednocený opt-out | `src/legacy/optout.js` |
| Statika (landing + audit-page) | `public/` |
| Email šablony + dispatcher | `src/email/` |
| Audit pipeline | `src/audit/` |
| DB schéma | `db/schema.sql` |
| Zadání MVP fází 1–5 | `PROMPT.md` |
| Post-MVP fáze 6/7 | `roadmap.md` |
| Strategist prompt (zdroj pro JS konstantu) | `strategist-prompt.md` |

---

**Začátek nového sezení:** zjisti aktuální stav (`git status`, `git log -5`),
porovnej s tímhle souborem, a zeptej se Fakana, na čem pracovat. Nepouštěj se
do akce bez kontextu.
