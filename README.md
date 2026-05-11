# Indigo Studio

**Autonomní webové studio — vše end-to-end přes API.**

Jeden Cloudflare Worker (`indigo-studio`) servuje celé indigostudio.cz: audit
webů zdarma, AI návrhy úprav (přes Stripe ApplePay/GooglePay), nákup a převod
domén (přes Subreg). Žádné microservices, žádné frameworky, žádný build step.

> **Než cokoliv změníš v repu, přečti si [CLAUDE.md](CLAUDE.md).** Tam jsou
> pravidla práce, tonalita, architektura, deploy checklist a omezení. Tenhle
> soubor je krátký rozcestník — CLAUDE.md je zdroj pravdy.

---

## Co Worker dělá

| Flow | Vstup | Výstup | Cena |
|------|-------|--------|------|
| **Audit webu** | URL + email | Mail s reportem do 5 min + 4-mailový drip | zdarma |
| **AI návrh úprav** | URL + brief + uploady | HTML/CSS varianta + preview PNG mailem | 500 Kč |
| **Nákup domény** | fqdn + registrant data | Registrace u Subreg, NS + expiry mail | 299–999 Kč/rok |
| **Převod domény** | fqdn + AuthInfo | Transfer u Subreg + CZ.NIC, mail po dokončení | 299–999 Kč/rok |

Drip a transakční maily teče přes Resend, scheduling přes D1 + cron `*/15 min`.

**Identita:** anonymní `indigo_device` cookie (httpOnly, 1 rok) — klient vidí
svoje journeys hned bez registrace. Opt-in účet přes magic link (žádné heslo,
žádný registrační formulář), který sjednotí journeys napříč všemi device tokeny
podle emailu lead.

## Stack

- **Runtime:** Cloudflare Workers (`compatibility_date = "2025-04-01"`,
  `nodejs_compat`)
- **Storage:** D1 (`fakan_auditor` — legacy interní jméno, binding `DB`),
  KV (cache + rate limit), R2 (screenshoty, hotové návrhy)
- **Async:** Queues (`fakan-audit-jobs` — legacy interní jméno), cron trigger
- **Browser Rendering:** `@cloudflare/puppeteer` (audit screenshoty, preview
  návrhů)
- **AI:** Claude Sonnet 4.5 (strategist + Vision pro AI návrhy)
- **Mail:** Resend (transakční + drip)
- **Platby:** Stripe Payment Element (ApplePay / GooglePay / karta)
- **Domény:** Subreg SOAP API (registrace + transfer + ceník přes Pricelist)
- **Frontend:** vanilla HTML/CSS/JS, žádný build, žádné npm závislosti mimo
  Cloudflare ekosystém

## Struktura repa

```
.
├── CLAUDE.md                  # pravidla, brand, architektura — povinná četba
├── roadmap.md                 # post-MVP fáze 6+
├── strategist-prompt.md       # zdroj pro JS konstantu strategistu
├── wrangler.toml              # config Workeru
├── package.json               # dev scripty (wrangler)
├── db/
│   └── schema.sql             # D1 schéma (idempotentní)
├── src/
│   ├── worker.js              # entry — routing + queue dispatch
│   ├── handlers/              # HTTP endpointy
│   │   ├── audit.js           # POST /api/audit + GET /audit/{token}/data
│   │   ├── report.js          # data pro audit-page SPA
│   │   ├── screenshot.js      # mobilní screenshot z R2
│   │   ├── suggestion.js      # POST /api/suggestion (multipart + Stripe PI)
│   │   ├── suggestion-status.js
│   │   ├── domain-check.js    # /api/domain/check (6 TLD)
│   │   ├── domain-order.js    # registrace + převod
│   │   ├── stripe-webhook.js  # HMAC verified Stripe lifecycle
│   │   ├── me.js              # GET /api/me — device + account + journeys
│   │   ├── account.js         # POST /start (magic link), GET /verify
│   │   └── optout.js          # /odhlasit/{token}, /unsubscribe
│   ├── audit/                 # processor + strategist + scoring
│   │   ├── processor.js       # puppeteer + axe + cookies + seo + cms
│   │   ├── strategist.js      # Claude API + few-shoty
│   │   ├── scoring.js
│   │   └── checks/
│   ├── suggestion/
│   │   └── render.js          # Claude Vision → HTML/CSS → preview screenshot
│   ├── domain/
│   │   └── register.js        # Subreg orchestrace (Make_Order + Domain_Info)
│   ├── email/
│   │   ├── send.js            # transakční přes Resend
│   │   ├── dispatcher.js      # cron drip
│   │   └── templates.js
│   └── lib/                   # cors, stripe, subreg, claude-vision,
│                              # html-sanitize, idempotency, files, identity
└── public/                    # statika přes ASSETS binding
    ├── index.html             # landing
    ├── prehled.html
    ├── ochrana-udaju.html
    ├── odhlasit-hotovo.html
    ├── audit/                 # audit-page SPA
    ├── navrh/                 # AI návrh status SPA
    ├── domena/                # objednat + stav SPA
    ├── akvizice-podklady/     # marketingový materiál (unlisted)
    └── .well-known/           # Apple Pay domain verification
```

## Endpointy (zkrácený přehled)

| Method | Path | Účel |
|--------|------|------|
| POST | `/api/audit` | spustit audit (zdarma) |
| GET | `/api/audit/{token}/data` | data pro audit-page SPA |
| GET | `/api/screenshot/{auditId}` | mobilní screenshot z R2 |
| POST | `/api/suggestion` | AI návrh — order + Stripe PI |
| GET | `/api/suggestion/{orderId}/{status,preview,output}` | polling + výstup |
| GET | `/api/domain/check?base=…` | dostupnost + cena pro 6 TLD |
| POST | `/api/domain/order` | registrace / převod — order + PI |
| GET | `/api/domain/{orderId}/status` | polling stavu doménové operace |
| POST | `/api/stripe/webhook` | Stripe lifecycle (HMAC verified) |
| GET | `/api/me` | device + account + journeys (anonymní vidí svoje, ověřený všechny) |
| POST | `/api/account/start` | pošle magic link na email (rate-limit 3 / 10 min) |
| GET | `/api/account/verify?t=…` | ověří token, sváže device s účtem |
| GET | `/odhlasit{,/{token}}`, `/unsubscribe` | opt-out |

Plný přehled vč. statiky a SPA cest je v [CLAUDE.md](CLAUDE.md#endpointy-přehled).

## Lokální vývoj

```bash
npm install                  # nainstaluje wrangler + @cloudflare/puppeteer
npm run dev                  # wrangler dev na http://localhost:8787
npm run deploy               # nasadit (vyžaduje wrangler login)
npm run db:init              # spustí db/schema.sql lokálně
npm run db:init:remote       # spustí db/schema.sql na produkční D1
```

Tajné proměnné přes `wrangler secret put` (nikdy do `wrangler.toml` ani kódu):

```
RESEND_API_KEY
ANTHROPIC_API_KEY
PUBLIC_HOST              # "indigostudio.cz"
STRIPE_SECRET_KEY        # sk_live_… / sk_test_…
STRIPE_WEBHOOK_SECRET    # whsec_…
SUBREG_LOGIN
SUBREG_PASSWORD
```

`STRIPE_PUBLISHABLE_KEY` jde do `[vars]` v `wrangler.toml` (není citlivý).

**Pozor:** `wrangler dev` queue jen mockuje a Browser Rendering lokálně neběží.
Reálný E2E test vyžaduje deploy do staging environmentu. Detail v
[CLAUDE.md — Známá omezení](CLAUDE.md#známá-omezení).

## Deploy

Plný checklist (D1 migrace, Stripe Dashboard, Apple Pay verifikace,
Subreg sandbox, smoke test) je v
[CLAUDE.md — Deploy checklist](CLAUDE.md#deploy-checklist-poprvé--nové-secrety).

Pro běžný re-deploy:

```bash
npx wrangler deploy --dry-run    # bundle prochází
npx wrangler deploy              # publikace
npx wrangler tail                # live logs
```

## Architektura ve zkratce

```
[Audit zdarma]
  POST /api/audit
    → D1 + Queue
    → audit/processor.js (puppeteer + axe + cookies + seo + cms + headers)
    → R2 screenshot, D1 findings + score
    → Queue { kind: 'strategist' }
    → audit/strategist.js (Claude Sonnet 4.5)
    → drip 4 mailů (#1 hned, #2 +2d, #3 +5d, #4 +30d)

[AI návrh — placený]
  POST /api/suggestion (multipart + Stripe PI)
    → Stripe webhook payment_intent.succeeded
    → Queue { kind: 'suggestion-render' }
    → suggestion/render.js (Claude Vision → HTML/CSS → sanitize → Browser
      Rendering screenshot)
    → R2 (output.html + preview.png) → mail

[Doména — placená]
  POST /api/domain/order (Subreg checkDomain znova kvůli race)
    → Stripe webhook
    → Queue { kind: 'domain-register' | 'domain-transfer' }
    → domain/register.js (Subreg Make_Order → Domain_Info → mail)

[Cron */15 min]
  email/dispatcher.js → vyzvedne queued mail → Resend
```

Plné schéma datových toků v [CLAUDE.md — Architektura](CLAUDE.md#architektura--minimum-pro-orientaci).

## Klíčové dokumenty

| Co | Kde |
|----|-----|
| Pravidla, brand, deploy, omezení | [CLAUDE.md](CLAUDE.md) |
| Post-MVP fáze 6–10 (vč. developer ekosystému) | [roadmap.md](roadmap.md) |
| Strategist prompt — zdroj pro JS konstantu | [strategist-prompt.md](strategist-prompt.md) |
| D1 schéma | [db/schema.sql](db/schema.sql) |
| Worker config | [wrangler.toml](wrangler.toml) |

## Tonalita zákaznických textů

Pro **veškeré texty směřující na klienta** (mailové šablony, audit-page,
validační hlášky, copy na indigostudio.cz) platí přísná pravidla — vykání, minimum
technického žargonu, krátké věty, žádné emoji ani vykřičníky, „hned" mentalita
s konkrétními termíny. Detail v
[CLAUDE.md — Tonalita zákaznických textů](CLAUDE.md#tonalita-zákaznických-textů-důležité--paměť-to-obsahuje-opakuju-zde).

Tenhle README, commity, kód a interní dokumenty (PR description, BLOCKERS.md,
code komentáře) tahle pravidla NEDODRŽUJÍ — můžeš tykat a být úsečný.

## Kontakt

- **Indigo Studio s.r.o.**, IČO 14389096
- **Daniel Hromada** — [daniel@indigostudio.cz](mailto:daniel@indigostudio.cz),
  +420 604 690 539
- **GitHub** — [github.com/junkycoder](https://github.com/junkycoder)
