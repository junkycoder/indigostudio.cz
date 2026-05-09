# CLAUDE.md — fakan repo

Tenhle soubor Claude Code automaticky načte na začátku každého sezení.
Drž se ho. Pokud něco není zde, koukni do `PROMPT.md` (zadání) a `auditor-worker/roadmap.md` (post-MVP fáze).

---

## Co je v tomhle repu

Dva nezávislé Cloudflare projekty pod jedním git stromem:

- **`fakan.cz/`, `src/`, `migrations/`, `wrangler.toml` v rootu** — landing page **fakan-cz**
  s formulářem na free analýzu. Live na `fakan.cz`. D1 `fakan_leads`, KV `RATELIMIT`,
  Email Worker `EMAIL`. Tomu se nesahá, pokud o něj uživatel sám nepožádá.
- **`auditor-worker/`** — autonomní auditor webů, MVP hotové. Form klient zadá URL →
  do 5 min mail s reportem → 4-mail drip. Cloudflare Workers + D1 + KV + R2 + Queues +
  Browser Rendering, Pages frontend pro `audit.fakan.cz`. Plný popis fází 1–5 v
  `PROMPT.md`. Roadmap fází 6 (auto-reply Email Worker) a 7 (B2B profilování) je
  v `auditor-worker/roadmap.md`.

## Stav (aktuální commit; vždy ověř `git log` pro skutečnost)

MVP auditoru hotové, čeká na deploy. Konkrétní úkoly před prvním spuštěním:

1. Vyplnit `REPLACE_ME` v `auditor-worker/wrangler.toml` (D1 + 2× KV id).
2. `wrangler d1/kv/r2/queues create …` pro auditor zdroje (viz `auditor-worker/README.md`).
3. `npm run db:init` v `auditor-worker/`.
4. `wrangler secret put RESEND_API_KEY` a `ANTHROPIC_API_KEY`.
5. Ověřit doménu `fakan.cz` v Resend dashboardu (jinak Resend vrací 403).
6. `npm run deploy` (Worker → `api.fakan.cz`).
7. `wrangler pages deploy audit-page --project-name=fakan-audit-page` (Pages → `audit.fakan.cz`).
8. Custom domain `api.fakan.cz` přes `[[routes]]` v `wrangler.toml` (auditor) nebo dashboard.

## Pravidla práce

- **Stack je striktní.** Vanilla JS, ESM, žádný TypeScript, žádný build step. Žádné
  frameworky (Hono, Express, Itty Router, React, Vue, Svelte). Žádné ORM. Žádné npm
  závislosti mimo Cloudflare ekosystém + Web Platform. Komentáře česky OK,
  identifikátory anglicky.
- **Malé commity, jeden commit per fáze / per logická změna.** Po každé fázi smoke
  test (`npx wrangler deploy --dry-run` v `auditor-worker/`).
- **`wrangler.toml` resource ID nikdy nevyplňuj v repu** — placeholder `REPLACE_ME`,
  uživatel je vyplní lokálně.
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

## Architektura auditoru — minimum pro orientaci

```
[POST /api/audit fakan.cz]
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
                          → Resend (List-Unsubscribe header)
                          → 429/5xx posune send_at, 4xx permanent fail

[Pages audit.fakan.cz]
  → audit-page/index.html  fetchne https://api.fakan.cz/audit/{token}/data
                           + screenshot z /screenshot/{auditId} (R2 proxy)
```

Doménová mapa:
- `fakan.cz` — landing, jiný projekt v repu
- `api.fakan.cz` — auditor Worker (POST /api/audit, GET /audit/{token}, /audit/{token}/data, /screenshot/{auditId}, /unsubscribe)
- `audit.fakan.cz` — Cloudflare Pages s `auditor-worker/audit-page/`

## Co NEdělej

- Nesahat na fakan-cz landing (`src/`, `fakan.cz/`, `wrangler.toml` v rootu) bez explicitního požadavku.
- Nepřidávat framework / TypeScript / build step (viz Pravidla).
- Necacheovat failed audity do `AUDIT_CACHE` (vrátil by se starý failed report).
- Neposílat strategist na failed audit (LLM by halucinoval bez findings).
- Nevracet email leadu / lead_id / interní fields v `/audit/{token}/data` payloadu —
  whitelist polí v `report.js`.
- Nepoužívat `_redirects` na Pages tak, aby `/audit/{token}` vracelo 200 + index.html
  pro neexistující tokeny — to už funguje, jen nepřepisovat.

## Známá omezení

- `wrangler dev` queue lokálně jen mockuje. Reálný E2E test queue + Browser Rendering
  vyžaduje deploy do staging environmentu.
- Strategist few-shoty bez prompt cachingu — po stabilizaci promptu (po ~50 reálných
  auditech) zapnout `cache_control: { type: 'ephemeral' }`.
- Žádný admin UI / kanban — Fakan přes D1 query přímo.

## Klíčové soubory

| Co | Kde |
|----|-----|
| Zadání MVP fází 1–5 | `PROMPT.md` |
| Post-MVP fáze 6/7 | `auditor-worker/roadmap.md` |
| Strategist prompt (zdroj pro JS konstantu) | `auditor-worker/strategist-prompt.md` |
| DB schéma | `auditor-worker/db/schema.sql` |
| Setup runbook | `auditor-worker/README.md` |

---

**Začátek nového sezení:** zjisti aktuální stav (`git status`, `git log -5`),
porovnej s tímhle souborem, a zeptej se Fakana, na čem pracovat. Nepouštěj se
do akce bez kontextu.
