# CLAUDE.md — fakan repo

Tenhle soubor Claude Code automaticky načte na začátku každého sezení.
Drž se ho. Pokud něco není zde, koukni do `PROMPT.md` (původní zadání)
a `auditor-worker/roadmap.md` (post-MVP fáze).

---

## Co je v tomhle repu

Jeden Cloudflare Worker (`fakan-auditor`) servuje **celý fakan.cz** —
landing, audit pipeline, audit report SPA i opt-out. Po sjednocení
zaniká dělba na tři deployments (Worker `fakan-cz`, Worker `fakan-auditor`
na `api.fakan.cz`, Pages na `audit.fakan.cz`).

Vše je v `auditor-worker/`:

- **`src/worker.js`** — entry, routing podle path
- **`src/handlers/`** — `/api/audit`, `/api/audit/{token}/data`, `/api/screenshot/{id}`
- **`src/legacy/optout.js`** — sjednocený opt-out (zkusí `env.DB` =
  `fakan_auditor`, fallback `env.LEGACY_DB` = `fakan_leads` z dávných mailů)
- **`src/audit/`** — Browser Rendering, axe, processor, strategist (Claude)
- **`src/email/`** — templates + dispatcher (cron každých 15 min, Resend)
- **`public/`** — všechna statika
  - `index.html` — landing
  - `audit/index.html` — audit report SPA (servuje pod `/audit/{token}`)
  - `ochrana-udaju.html`, `odhlasit-hotovo.html`, `prehled.html`

## Stav (aktuální commit; vždy ověř `git log` pro skutečnost)

Migrace na single Worker hotová v kódu. Před prvním deployem:

1. `wrangler secret put PUBLIC_HOST` (hodnota: `fakan.cz`).
2. Ověřit existující secrety: `RESEND_API_KEY`, `ANTHROPIC_API_KEY`.
3. **V CF dashboardu sundat custom domain `fakan.cz` ze starého Workeru
   `fakan-cz`.** Bez toho deploy auditora selže na "route already in use".
4. `npm run deploy` v `auditor-worker/` → Worker se připojí na `fakan.cz`.
5. Smoke z incognita: form → audit → mail → `/audit/{token}` → `/odhlasit/{token}`.
6. (Volitelně) Bulk Redirect v dashboardu pro odeslané maily:
   - `audit.fakan.cz/* → fakan.cz/$1` 301
   - `api.fakan.cz/* → fakan.cz/$1` 301
   Po ~3 měsících odstavit.
7. Po týdnu úspěšného běhu: `wrangler delete` Worker `fakan-cz`,
   smazat Pages projekt `fakan-audit-page`, KV `RATELIMIT` z fakan-cz.
8. Až staré opt-out odkazy z analyze flow doodejdou (~3 měsíce po
   cutoffu): smazat D1 `fakan_leads`, odstranit binding `LEGACY_DB`
   z `auditor-worker/wrangler.toml`.

## Pravidla práce

- **Stack je striktní.** Vanilla JS, ESM, žádný TypeScript, žádný build step. Žádné
  frameworky (Hono, Express, Itty Router, React, Vue, Svelte). Žádné ORM. Žádné npm
  závislosti mimo Cloudflare ekosystém + Web Platform. Komentáře česky OK,
  identifikátory anglicky.
- **Malé commity, jeden commit per fáze / per logická změna.** Po každé fázi smoke
  test (`npx wrangler deploy --dry-run` v `auditor-worker/`).
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
  → worker.js              env.ASSETS.fetch('/audit/index.html') (SPA)
  → audit/index.html       fetch /api/audit/{token}/data + img /api/screenshot/{id}

[GET /odhlasit/{token}, /odhlasit?t=, /unsubscribe?token=]
  → legacy/optout.js       zkus auditor DB, fallback LEGACY_DB → render done page
                           legacy flow taky pošle confirmation mail (env.EMAIL)

[GET /, /ochrana-udaju, /odhlasit-hotovo, /prehled]
  → env.ASSETS.fetch       statika z public/
```

Doménová mapa po sjednocení:
- `fakan.cz` — všechno (Worker `fakan-auditor`)
- `api.fakan.cz`, `audit.fakan.cz` — zaniklé (volitelně 301 přes Bulk Redirect)

## Co NEdělej

- Nesahat na `auditor-worker/wrangler.toml` `[[routes]]` ani `[[d1_databases]]` ID
  bez explicitního požadavku.
- Nepřidávat framework / TypeScript / build step (viz Pravidla).
- Necacheovat failed audity do `AUDIT_CACHE` (vrátil by se starý failed report).
- Neposílat strategist na failed audit (LLM by halucinoval bez findings).
- Nevracet email leadu / lead_id / interní fields v `/api/audit/{token}/data` payloadu —
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
| Single Worker config | `auditor-worker/wrangler.toml` |
| Worker entry + routing | `auditor-worker/src/worker.js` |
| API handlery | `auditor-worker/src/handlers/` |
| Sjednocený opt-out | `auditor-worker/src/legacy/optout.js` |
| Statika (landing + audit-page) | `auditor-worker/public/` |
| Email šablony + dispatcher | `auditor-worker/src/email/` |
| Audit pipeline | `auditor-worker/src/audit/` |
| DB schéma | `auditor-worker/db/schema.sql` |
| Setup runbook | `auditor-worker/README.md` |
| Zadání MVP fází 1–5 | `PROMPT.md` |
| Post-MVP fáze 6/7 | `auditor-worker/roadmap.md` |
| Strategist prompt (zdroj pro JS konstantu) | `auditor-worker/strategist-prompt.md` |

---

**Začátek nového sezení:** zjisti aktuální stav (`git status`, `git log -5`),
porovnej s tímhle souborem, a zeptej se Fakana, na čem pracovat. Nepouštěj se
do akce bez kontextu.
