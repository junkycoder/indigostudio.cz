# CLAUDE.md — Indigo Studio repo

Tenhle soubor Claude Code automaticky načte na začátku každého sezení.
Drž se ho. Pokud něco není zde, koukni do `PROMPT.md` (původní zadání auditoru)
a `roadmap.md` (post-MVP fáze).

---

## Co je v tomhle repu

Jeden Cloudflare Worker (`indigo-studio`) servuje **celé indigostudio.cz** (a po dobu cutoffu i fakan.cz). Autonomní webové
studio — vše end-to-end přes API:

- **Audit webů** (zdarma) — form → 5 min → mail s reportem → 4-mail drip.
- **AI návrhy úprav webu** (500 Kč přes Stripe ApplePay/GooglePay) — klient
  pošle URL + brief + uploady, Claude Sonnet 4.5 Vision vyrobí HTML/CSS
  variantu, Browser Rendering vykreslí preview, klient dostane mail s linkem.
- **Nákup domény** (přes Subreg) — klient vybere fqdn, vyplní registrant
  data, zaplatí, my registrujeme u Subreg, klient dostane NS + expiry mail.
- **Převod domény** (přes Subreg) — klient zadá fqdn + AuthInfo, zaplatí,
  Subreg + CZ.NIC schvalují (až 5 dní), po dokončení mail s NS.

Všechno teče přes jeden Worker, jednu D1, jeden R2 bucket. Žádné microservices.

Adresářová struktura (klasický Workers layout v rootu):

- **`wrangler.toml`** — config Workeru
- **`src/worker.js`** — entry, routing + queue dispatch (audit / strategist /
  suggestion-render / domain-register / domain-transfer)
- **`src/handlers/`** — HTTP endpointy
  - `audit.js`, `report.js`, `screenshot.js` — audit flow
  - `suggestion.js`, `suggestion-status.js` — AI návrh + status/preview/output
  - `domain-check.js`, `domain-order.js` — doménový lookup + nákup/převod + status
  - `stripe-webhook.js` — Stripe lifecycle eventy s HMAC ověřením
  - `optout.js` — `/odhlasit/{token}` + `/unsubscribe?token=…`
- **`src/audit/`** — audit pipeline (processor, strategist, scoring)
- **`src/suggestion/`** — AI render pipeline (Claude Vision → HTML/CSS → Browser Rendering screenshot)
- **`src/domain/`** — Subreg orchestrace (register + transfer + Domain_Info)
- **`src/email/`** — templates + dispatcher (drip cron) + send.js (transakční Resend)
- **`src/lib/`** — pomocné moduly (cors, stripe, subreg, claude-vision,
  html-sanitize, idempotency, files)
- **`public/`** — statika (landing, audit-page SPA, navrh status SPA,
  domena/objednat + domena/stav SPA, ochrana-udaju, .well-known/ pro Apple Pay)
- **`db/schema.sql`** — D1 schéma (`fakan_auditor`)

## Endpointy (přehled)

| Method | Path                                       | Účel                              |
|--------|---------------------------------------------|----------------------------------|
| POST   | `/api/audit`                                | spustit audit (zdarma)             |
| GET    | `/api/audit/{token}/data`                   | data pro audit-page SPA           |
| GET    | `/api/screenshot/{auditId}`                 | mobilní screenshot z R2            |
| POST   | `/api/suggestion`                           | AI návrh — order + Stripe PI       |
| GET    | `/api/suggestion/{orderId}/status`          | polling stavu návrhu              |
| GET    | `/api/suggestion/{orderId}/preview`         | preview PNG                        |
| GET    | `/api/suggestion/{orderId}/output`          | hotový HTML/CSS                    |
| GET    | `/api/domain/check?base=…`                  | dostupnost + cena pro 6 TLD       |
| POST   | `/api/domain/order`                         | registrace / převod — order + PI   |
| GET    | `/api/domain/{orderId}/status`              | polling stavu doménové operace     |
| POST   | `/api/stripe/webhook`                       | Stripe lifecycle (HMAC verified)   |
| GET    | `/odhlasit*`, `/unsubscribe`                | opt-out (sjednocený s fallbackem)  |
| —      | `/`, `/audit/{token}`, `/navrh/{orderId}`,  |                                  |
|        | `/domena/objednat`, `/domena/stav/{id}`     | statika přes asset binding         |

## Stav (aktuální commit; vždy ověř `git log` pro skutečnost)

**Rebrand Fakan → Indigo Studio (commit 2026-05-11):** Worker přejmenovaný na
`indigo-studio`, všechny public-facing texty a barvy přepsané na novou paletu
(indigo + warm paper). Doména `indigostudio.cz` se kupuje přes vlastní
`/api/domain/order` flow. Worker původně `fakan` (deployed 2026-05-09) drží
zatím i `fakan.cz`; po DNS + Apple Pay verifikaci pro novou doménu se přidá
druhá route `indigostudio.cz`.

**Studio funkčnost (commit 2026-05-09):** suggestion + domain register +
domain transfer flows kompletní v kódu, neotestované live (čeká na Apple Pay
domain verifikační soubor — viz Deploy checklist níž).

Cleanup, který je třeba udělat ručně až bude jistá stabilita:

1. CF dashboard → smazat starý Worker `fakan-cz` (už nedrží route).
2. CF dashboard → smazat starý Worker `fakan-auditor` (po rename na `fakan`
   už nedrží route, jen existuje v účtu).
3. CF dashboard → smazat Pages projekt `fakan-audit-page`.
4. CF dashboard → po deployi nového Workeru pod jménem `indigo-studio` smazat
   starý Worker `fakan` (jeho route `fakan.cz` se přesune na nový).
5. CF dashboard → po cutoffu na `indigostudio.cz` přidat Bulk Redirect:
   - `fakan.cz/*` → `https://indigostudio.cz/$1` (301)
   - `audit.fakan.cz/*` → `https://indigostudio.cz/$1` (301)
   - `api.fakan.cz/*` → `https://indigostudio.cz/$1` (301)
   Drž 3 měsíce, pak zruš a fakan.cz nech expirovat.
6. CF dashboard → smazat D1 `fakan_leads` (bývalý LEGACY_DB) — kód i binding
   už ho nepoužívá. Když je potřeba zálohu, předtím export.
7. (Volitelně) přejmenovat v CF dashboardu D1 `fakan_auditor` → `indigo_studio`,
   R2 `fakan-reports` → `indigo-reports`. Queue rename nepodporován; nechat.
   Worker je vázán na database_id / binding name, takže rename je bez dopadu
   na deploy — jen sjednotí dashboard s brandem.

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
  Co potřebuju od Daniela", commit dosavadní práci a STOP.
- **Žádný observability stack** — `console.log` je OK, Workers Logs v dashboardu stačí.

## Tonalita zákaznických textů (důležité — paměť to obsahuje, opakuju zde)

Pro **veškeré texty směřující na klienta** (mailové šablony, audit-page, validační hlášky,
SYSTEM prompt strategistovi, copy na indigostudio.cz):

- **Vykání**, malé v/v textech (kromě nově psaných pasáží, kde mám velké V/Vám/Vás —
  není to zatím sjednoceno, drž konzistenci s okolním souborem). NIKDY tykání.
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

[POST /api/suggestion]                                   (placená — 500 Kč)
  → handlers/suggestion.js  multipart parse + file sniff (PNG/JPG/WebP/PDF/DOC/TXT)
                            → R2 upload (suggestions/{orderId}/*)
                            → D1 (lead + orders + suggestions)
                            → Stripe getOrCreateCustomer + PaymentIntent
                            → return { orderId, clientSecret, publishableKey }
  Frontend → Stripe Payment Element (ApplePay/GooglePay/card) → confirmPayment
  → POST /api/stripe/webhook (HMAC verified)
    → orders.status='paid' → Queue { kind: 'suggestion-render' }
  → suggestion/render.js  Claude Sonnet 4.5 Vision (baseline screenshot
                          z auditu nebo capture teď + uploady + brief)
                          → HTML/CSS string → HTMLRewriter sanitize
                          → Browser Rendering setContent → screenshot PNG
                          → R2 (output.html + preview.png)
                          → email/send.js → tplSuggestionDone

[POST /api/domain/order]                                 (placená — 299–999 Kč/rok)
  → handlers/domain-order.js  validate + Subreg checkDomain (znova, race condition)
                              → D1 (lead + orders + domain_orders)
                              → Stripe PaymentIntent
                              → return { orderId, clientSecret, publishableKey }
  Frontend → Stripe Payment Element → confirmPayment
  → POST /api/stripe/webhook
    → orders.status='paid' → Queue { kind: 'domain-register' | 'domain-transfer' }
  → domain/register.js  Subreg Make_Order (Create_Domain | Transfer_Domain)
                        → completed: Domain_Info → orders.status='done' → mail
                        → in_progress (transfer): orders.status='processing',
                          čekáme na Subreg callback (mimo MVP — dispatcheme ručně)

[Cron */15 min]
  → email/dispatcher.js   D1 vyzvedne queued mail se send_at <= now
                          → Resend (List-Unsubscribe → /odhlasit/{token})
                          → 429/5xx posune send_at, 4xx permanent fail

[GET /audit/{token}, /navrh/{orderId}, /domena/objednat, /domena/stav/{id}]
  → worker.js              env.ASSETS.fetch('/{path}/') (SPA)

[GET /odhlasit/{token}, /odhlasit?t=, /unsubscribe?token=]
  → handlers/optout.js     UPDATE leads.status='unsubscribed' → render done page

[GET /, /ochrana-udaju, /odhlasit-hotovo, /prehled, /.well-known/*]
  → env.ASSETS.fetch       statika z public/
```

Doménová mapa:
- `indigostudio.cz` (primární po cutoffu), `fakan.cz` (legacy během přechodu) — Worker `indigo-studio` (vše)
- `api.fakan.cz`, `audit.fakan.cz` — zaniklé (volitelně 301 přes Bulk Redirect)

## Co NEdělej

- Nesahat na `wrangler.toml` `[[routes]]` ani `[[d1_databases]]` ID
  bez explicitního požadavku.
- Nepřidávat framework / TypeScript / build step (viz Pravidla).
- Necacheovat failed audity do `AUDIT_CACHE` (vrátil by se starý failed report).
- Neposílat strategist na failed audit (LLM by halucinoval bez findings).
- Nevracet email leadu / lead_id / interní fields v `/api/audit/{token}/data` —
  whitelist polí v `handlers/report.js`.
- Stripe webhook **nikdy** parsovat před `verifyWebhookSignature` — handler musí
  číst `request.text()` a poslat raw body do verifikace, jinak HMAC nesedí
  a útočník propašuje libovolný event.
- HTML output z Claude Vision **nikdy** servovat klientovi bez `sanitizeHtml()` —
  zákaz `<script>`, `on*=` handlerů, `javascript:` URL, externích `<iframe>`.
- Cena návrhu / domény je hardcoded v `handlers/suggestion.js` a
  `handlers/domain-check.js` + `domain-order.js`. Změna ceny musí jít do
  obou míst (po stabilizaci přesunout do D1 tabulky).

## Známá omezení

- `wrangler dev` queue lokálně jen mockuje. Reálný E2E test queue + Browser Rendering
  vyžaduje deploy do staging environmentu.
- Strategist few-shoty bez prompt cachingu — po stabilizaci promptu (po ~50 reálných
  auditech) zapnout `cache_control: { type: 'ephemeral' }`.
- Žádný admin UI / kanban — sahám do D1 query přímo.

## Klíčové soubory

| Co | Kde |
|----|-----|
| Worker config | `wrangler.toml` |
| Worker entry + routing + queue dispatch | `src/worker.js` |
| Audit handlery | `src/handlers/audit.js`, `report.js`, `screenshot.js` |
| Suggestion handlery | `src/handlers/suggestion.js`, `suggestion-status.js` |
| Doménové handlery | `src/handlers/domain-check.js`, `domain-order.js` |
| Stripe webhook | `src/handlers/stripe-webhook.js` |
| Stripe API klient | `src/lib/stripe.js` |
| Subreg SOAP klient | `src/lib/subreg.js` |
| Claude Vision klient | `src/lib/claude-vision.js` |
| HTML sanitizer (HTMLRewriter) | `src/lib/html-sanitize.js` |
| Idempotency klíče | `src/lib/idempotency.js` |
| File upload + sniff | `src/lib/files.js` |
| AI render pipeline | `src/suggestion/render.js` |
| Doménová orchestrace | `src/domain/register.js` |
| Email drip + dispatcher | `src/email/dispatcher.js` |
| Email transakční | `src/email/send.js` |
| Email šablony | `src/email/templates.js` |
| Opt-out | `src/handlers/optout.js` |
| Statika (landing + audit + navrh + domena) | `public/` |
| DB schéma | `db/schema.sql` |
| Zadání MVP fází 1–5 | `PROMPT.md` |
| Post-MVP fáze 6/7 | `roadmap.md` |
| Strategist prompt (zdroj pro JS konstantu) | `strategist-prompt.md` |

## Deploy checklist (poprvé / nové secrety)

**1. D1 schema migration:**
```bash
npx wrangler d1 execute fakan_auditor --remote --file=db/schema.sql
```
Idempotentní (`CREATE TABLE IF NOT EXISTS`), bezpečné spustit opakovaně.

**2. Secrety (run jednou pro live):**
```bash
echo "sk_live_…"        | npx wrangler secret put STRIPE_SECRET_KEY
echo "whsec_…"          | npx wrangler secret put STRIPE_WEBHOOK_SECRET
echo "<subreg-login>"   | npx wrangler secret put SUBREG_LOGIN
echo "<subreg-pwd>"     | npx wrangler secret put SUBREG_PASSWORD
# Existující (zkontrolovat):
#   RESEND_API_KEY, ANTHROPIC_API_KEY, PUBLIC_HOST=indigostudio.cz
```

**3. Vars v `wrangler.toml`:**
- `STRIPE_PUBLISHABLE_KEY` — vyplnit `pk_live_…` (test `pk_test_…`).

**4. Stripe Dashboard:**
- Settings → Payment methods → enable card / Apple Pay / Google Pay.
- Apple Pay → Add new domain `indigostudio.cz` (po cutoffu) / `fakan.cz` (legacy) → stáhnout
  `apple-developer-merchantid-domain-association` →
  uložit do `public/.well-known/apple-developer-merchantid-domain-association`
  (bez přípony!) → deploy → Stripe Dashboard "Verify".
- Developers → Webhooks → Add endpoint `https://indigostudio.cz/api/stripe/webhook`,
  events: `payment_intent.succeeded`, `payment_intent.payment_failed`,
  `payment_intent.canceled`, `charge.refunded`. Signing secret → step 2.

**5. Subreg Dashboard:**
- Vytvořit účet v test režimu (sandbox.subreg.cz) pro vývoj.
- Před live: `wrangler secret put SUBREG_LOGIN` / `SUBREG_PASSWORD`.
- Cena domény: `wrangler secret put SUBREG_LOGIN` se ceník automaticky
  natáhne z `Pricelist` (cache 6 h v KV). Klientský ceník je hardcoded
  v `handlers/domain-check.js` + `domain-order.js`.

**6. E2E smoke v test mode:**
```bash
npx wrangler deploy --dry-run    # bundle prochází
npx wrangler tail                # sledovat live logs
# Zkusit: free audit, suggestion s test kartou 4242 4242 4242 4242,
# domain check, domain order s test mode (Subreg sandbox).
```

**7. Live deploy:**
```bash
npx wrangler deploy
```

---

**Začátek nového sezení:** zjisti aktuální stav (`git status`, `git log -5`),
porovnej s tímhle souborem, a zeptej se Daniela, na čem pracovat. Nepouštěj se
do akce bez kontextu.
