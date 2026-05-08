# fakan.cz

**Pluginová platforma pro audit, návrh, realizaci, hosting, správu a růst webových stránek.**

Static-first, vanilla HTML / CSS / JS / SVG, Cloudflare end-to-end. Bez cookie banerů. Bez frameworků. Bez výmluv.

> 📖 Než začneš cokoli psát do tohohle repa, přečti si [CLAUDE.md](CLAUDE.md) — pravidla, brand a workflow pro agenty.

---

## Pro agenty na první pohled

- **Co dělat:** vyber si úkol z [Task boardu](#task-board) níže — buď vezmi nehotový řádek, nebo si přidej vlastní.
- **Jak pracovat:** [CLAUDE.md sekce 5](CLAUDE.md#5-jak-pracují-agenti-na-tomhle-repu) má detail.
- **Kdy se ptát:** stack / brand / billing změny → ano. Drobnosti uvnitř hranic → ne, jeď.
- **Hotovo = ověřeno v prohlížeči, ne jen „kompiluje to".** Checklist v CLAUDE.md sekce 6.

---

## Co tu už je

| Co | Kde | Stav |
|----|-----|------|
| **PRD v0.9** | [fakan-cz-prd.md](fakan-cz-prd.md) | hotová strategie, **needit** |
| **Brand brief v0.2** | [fakan-cz-brand-brief.md](fakan-cz-brand-brief.md) | hotový, **needit** |
| **Plugin spec v0.8** | [fakan-cz-plugin-spec.md](fakan-cz-plugin-spec.md) | hotová specifikace, **needit** |
| **Marketing landing** | [fakan.cz/index.html](fakan.cz/index.html) | produkce, formulář redirectuje na `/vysledek` |
| **Free analýza — sync** | [src/analyze.js](src/analyze.js) + [fakan.cz/vysledek.html](fakan.cz/vysledek.html) | SSE stream, 8 panelů, bez Turnstile / rate-limit |
| **Prezentace platformy** | [fakan.cz/prehled.html](fakan.cz/prehled.html) | čerstvá, lze používat jako referenci tónu |
| **Offline nabídky 10 firem** | [fakan-nabidka/](fakan-nabidka/) | marketingový materiál, mimo deployment |
| **Pravidla pro agenty** | [CLAUDE.md](CLAUDE.md) | povinná četba před prací |
| **Onboarding pro agenty** | [AGENTS.md](AGENTS.md) | 30sekundový vstupní bod |

## Co tu chybí (a buduje se)

Roadmap je v [PRD sekce 12](fakan-cz-prd.md). V repu zatím **není nic z kernelu** — tohle je opravdu green-field. První kroky míří na:

1. Veřejný marketingový landing (Fáze 0).
2. Free analýza URL (Fáze 0–1).
3. Auth magic link + base Velín (Fáze 0).
4. Plugin kernel + manifest engine (Fáze 0).

Detail úkolů níže.

---

## Task board

Formát: `[ ]` čeká, `[~]` rozpracováno (kým), `[x]` hotovo, `[!]` blokátor.

Při braní úkolu **změň `[ ]` na `[~] (agent: krátký popis, čas)`**. Po dokončení `[x]` a 1–2 věty pod úkol, co se udělalo a kde je výsledek.

### 🔴 Priority 0 — fundament

Bez tohohle se nedá pokračovat.

- [x] **Vyber Cloudflare project shape.** _Agent: Claude Opus 4.6, 2026-05-06._
  Workers s `[assets]` — statické soubory z `fakan.cz/`, Worker pro API routes. `wrangler.toml` v root, `src/worker.js` jako entry point. `npm run dev` startuje na `localhost:8787`.
- [x] **Nastav `package.json` + minimální dev workflow.** _Agent: Claude Opus 4.6, 2026-05-06._
  `package.json` se scripty `dev`, `deploy`, `format`. Wrangler v4 jako devDependency. `.gitignore` už existoval.
- [x] **Sepiš `AGENTS.md` orchestration guide.** _Agent: Claude Opus 4.7, 2026-05-06._
  Vytvořen [AGENTS.md](AGENTS.md) jako 30sekundový vstupní bod pro nové agenty — odkazuje na CLAUDE.md a README.md, popisuje workflow při braní úkolu, paralelizaci a co nedělat bez Fakanova pokynu.
- [ ] **Doménový stack v Cloudflare.** Ověř (s Fakanem), kdo drží `fakan.cz` doménu, jestli je už v Cloudflare účtu a jaký account ID použít. **Tohle je Fakanův úkol** — agent jen připraví otázky.
- [~] **Migrace produkce z Cloudflare Pages na Workers (volba B).** _Agent: Claude Opus 4.7, 2026-05-07, rozpracováno._
  Fakan rozhodl 2026-05-07: jdeme do plné migrace, ne rychlé Worker Route záplaty. Cíl: doména `fakan.cz` cílí na worker `fakan-cz`, Pages projekt `fakan` zaniká, deploy běží buď z lokálu nebo z GitHubu, **`wrangler.toml` v tomhle repu je jediná pravda**.
  **Pre-checks (hotovo):** Worker `fakan-cz` deployovaný a funkční na `fakan-cz.junkycoder.workers.dev/api/analyze` (SSE stream, OK). `wrangler.toml` má `[assets]` + `run_worker_first = ["/api/*"]`. Repo nemá `functions/` ani `_worker.js`, tedy assets-only Worker projekt podle Cloudflare migration guide.
  **Postup po krocích (každý se ověřuje před dalším):**
    1. **Custom domain swap.** Fakan v Cloudflare dashboardu: Pages → `fakan` → Custom Domains → Remove `fakan.cz` (a `www.fakan.cz` pokud je). Hned poté Workers & Pages → `fakan-cz` → Settings → Domains & Routes → Add Custom Domain → `fakan.cz`. _Akceptace:_ `curl -sI https://fakan.cz/api/analyze?url=https://example.com` má `content-type: text/event-stream`. _Rollback:_ doména zpět na Pages (stejnou cestou).
    2. **Smazání Pages projektu `fakan`.** Až po ověření kroku 1. Pages → `fakan` → Settings → Delete project. _Pozor:_ smaže git auto-deploy (Pages CI). Statika je v `fakan.cz/` v gitu, takže se nic neztratí, ale od této chvíle musí někdo deployovat ručně, dokud nebude krok 3.
    3. **CI/CD náhrada za Pages auto-deploy.** Fakan rozhodl 2026-05-07: **b + c** (Workers Builds jako primární auto-deploy, manuální `npm run deploy` jako fallback z lokálu).
       - **c) Manuální `npm run deploy`** — již hotové, `package.json` script `"deploy": "wrangler deploy"` funguje (vyžaduje `wrangler login`).
       - **b) Cloudflare Workers Builds** — Fakan v dashboardu: Workers & Pages → `fakan-cz` → Settings → Builds → **Connect**. Repository: `junkycoder/fakan`, Production branch: `main`, Build command: _(prázdné)_, Deploy command: _(default `npx wrangler deploy`)_, Root directory: `/`. Worker name v dashboardu (`fakan-cz`) **musí matchovat** `name` v `wrangler.toml` — checked, máme `name = "fakan-cz"`. _Akceptace:_ push do `main` spustí build v Workers & Pages → `fakan-cz` → Builds, který skončí s deployem na produkci.
  **Status:** krok 1 (custom domain swap) — hotovo 2026-05-07, ověřeno curl `text/event-stream`. Krok 2 (smazání Pages projektu) a krok 3 (Workers Builds connect) — čeká na provedení Fakanem v dashboardu.
  _Reference:_ Cloudflare „Migrate from Pages to Workers" (přes MCP guide).
  **Diagnóza:**
  1. `wrangler.toml` měl jen `[assets] directory = "fakan.cz"` — to vedlo k tomu, že Worker se na `/api/*` nespouští. **Fix v repu:** přidáno `run_worker_first = ["/api/*"]`. Worker `fakan-cz` byl deploynutý a na `https://fakan-cz.junkycoder.workers.dev/api/analyze?url=…` **funguje** (SSE stream, OK). Tenhle krok je hotový.
  2. Po deployi ale `https://fakan.cz/api/analyze?…` stále vrací HTML. Důvod: `fakan.cz` jako custom domain **nedrží Worker `fakan-cz`**, ale samostatný **Cloudflare Pages projekt `fakan`** (`fakan.pages.dev` + `fakan.cz`, modifikován dnes ~1 h zpátky přes git auto-deploy). Pages projekt nemá `/api/*` route → SPA fallback servíruje `index.html`. Frontend pak EventSource zavře (`MIME type "text/html"`) a UI ukáže „Analýza neproběhla."
  **Důsledek:** `wrangler deploy` z tohohle repa publikuje Worker, ale **doména na něj neukazuje**. Reálnou produkci (na fakan.cz) zatím obsluhuje Pages projekt — separátní pipeline mimo tenhle repozitář.
  **Cesty řešení (vyžadují Fakanův pokyn — DNS / produkční doména):**
  - **A) Rychlá záplata.** Přidat Worker Route `fakan.cz/api/*` → worker `fakan-cz`. Workers Routes mají přednost před Pages. `/api/*` jde na Worker, statika dál na Pages. ~10 min, žádný downtime, ale architektura se rozdvojí (dvě deployment pipelines, dva zdroje pravdy pro statiku).
  - **B) Migrace na Workers (doporučeno).** Smazat Pages projekt `fakan`, přemapovat custom domain `fakan.cz` na worker `fakan-cz` (Workers → Triggers → Custom Domains), nastavit GitHub Actions s `wrangler deploy` jako nahradu Pages git CI. Po tomhle je tenhle repo + `wrangler.toml` jediná pravda. ~30–60 min, krátký výpadek (~sekundy) při swapu domény. _Reference:_ Cloudflare „Migrate from Pages to Workers" guide.
  **Otevřená otázka pro Fakana:** A nebo B? Viz Otevřené otázky.

### 🟠 Priority 1 — Fáze 0 deliverables (PRD sekce 12)

- [x] **Marketing landing — produkční verze.** _Agent: Claude Opus 4.6, 2026-05-06._
  Nový `fakan.cz/index.html` — hero s URL inputem pro free analýzu, sekce Co děláme / Jak to funguje / Standardy / Hosting / CTA. Brand barvy, dark/light auto, mobile-first, Schema.org JSON-LD, OG meta, skip-link, focus-visible. Tykání. Mailto fallback dokud nebude `/api/analyze`.
- [x] **Free analýza — synchronní vlna (TTFV ≤ 5 s).** _Agent: Claude Opus 4.7, 2026-05-06._
  Worker endpoint `/api/analyze` streamuje SSE s eventy `hello → stage → status → headers → cookies → meta → stack → trackers → banners → score → done`. Detektory v `src/detectors.js` pokrývají 22 stack signaturí (WP, Shopify, Wix, Webnode, Next, Astro…), 17 trackerů (GA4, GTM, Meta Pixel, Sklik, Smartsupp, Hotjar, HubSpot…) a 10 cookie banerů (Cookiebot, OneTrust, Iubenda…). 6 security headers se boduje. Klient `fakan.cz/vysledek.html` + `vysledek.js` zobrazuje 8 panelů + verdikty + OG preview. Landing formulář teď redirectuje na `/vysledek?url=…` místo mailto. SSRF ochrana proti localhostu/privátním IP, body limit 2 MB, fetch timeout 8 s. **Otevřené:** Turnstile a rate-limit zatím nezapojeno (samostatný úkol). Asynchronní vlna (Lighthouse, screenshot, AI redesign) také samostatný úkol.
- [x] **Free analýza — robustnější error handling.** _Agent: Claude Opus 4.7, 2026-05-06._
  UI ukazovalo `Něco se rozbilo.` bez ohledu na to, co skutečně padlo. Teď: každá chyba má vlastní lidskou zprávu (DNS not found, TLS, redirect loop, refused, reset, timeout). Ošetřen self-fetch (Worker na fakan.cz neumí čistě stáhnout fakan.cz). `parseMeta` a `detectFromText` poběží přes `safeRun` — když rozbije jeden regex, ostatní panely pořád dorazí. Catch-all v `handleAnalyze` loguje do `console.error` a vrací zprávu s typem chyby místo generické hlášky.
- [ ] **Free analýza — asynchronní vlna.** Lighthouse-lite, Browser Rendering screenshot, AI redesign. Queue + DO pro stav. UI inkrementálně doplňuje výsledky.
- [ ] **Turnstile + rate limit.** 3 free analýzy / 24 h / IP. _Reference:_ PRD sekce 5.1, anti-bot.
- [x] **Homepage UX — mobile a lead capture.** Tři navazující drobnosti na `fakan.cz/index.html` (Fakanovo zadání 2026-05-07).
  _Agent: tým landing-v2 iterace, 2026-05-08._ Doplněn `autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="url"` na URL input, přidán povinný email + checkbox souhlasu (separátní, neforčekovaný), Worker přijímá email + consent + loguje server-side. Detail v `projects/landing-v2/delivery.md`.
  - **a) Mobil — vypnout autocapitalize.** Na URL inputu (i v hero, i v CTA banneru) iOS/Android navrhuje velké písmeno na začátku, což u domény vadí. Doplnit `autocapitalize="none" autocorrect="off" spellcheck="false" inputmode="url"`.
  - **b) Email + checkbox souhlasu.** Vedle URL přidat povinný email (`type="email"`, `inputmode="email"`, `autocapitalize="none"`) a checkbox „Souhlasím se zasláním analýzy a nezávazné nabídky e-mailem. Souhlas mohu kdykoliv odvolat." (přesné znění viz Otevřené otázky). Bez souhlasu form nesubmituje. Frontend forwarduje `email` + `consent` do `/vysledek?url=…&email=…&consent=1` a `vysledek.js` dál do `/api/analyze?…`.
  - **c) Worker přijímá email + consent.** `src/analyze.js` z query stringu vytáhne email + consent, validuje formát, **prozatím jen zaloguje** (`console.log` → `wrangler tail`). Skutečné storage / odeslání nabídky je samostatný úkol (viz „Lead capture" níže).
  **Acceptance:** Mobile Safari (iOS), Chrome (Android) — klávesnice u URL/emailu nestartuje s velkým písmenem; bez souhlasu CTA submit nepustí; v `wrangler tail` se po každé analýze objeví `{ url, email, consent: true, ts, ip }`. Žádné cookies, žádný localStorage.
  **Závislost:** ideálně po brand pivotu (úkol „Brand pivot") — ať se copy formuláře nemusí přepisovat dvakrát. Pokud spěchá, lze udělat dřív a brand pivot přepíše copy v jediném míste.
- [x] **Lead capture — storage + e-mail nabídky.** Backend pro to, co úkol „Homepage UX" jen loguje.
  _Agent: tým landing-v2 iterace, 2026-05-08._ D1 schema `leads` (17 sloupců vč. compliance polí), idempotence per `(email, url, day)`, IP hash s saltem, URL stripping. Outbound mail přes **Cloudflare Email Workers** (legacy `send_email` API, tie-breaker vyhrál nad MailChannels — Gate 1 explicit + finance veto na placený plán). 4 šablony (`lead-followup`, `magic-link-auth` DRAFT v0, `optout-confirmation`, `soft-doi`), opt-out flow `/odhlasit?t=<token>` s `List-Unsubscribe` headery (RFC 8058). Detail v `projects/landing-v2/delivery.md`.
  - D1 schema `leads(id, url, email, consent_at, source, status, created_at)` + migrace v `migrations/0001_leads.sql`.
  - Worker po `done` SSE eventu zapíše lead do D1 (idempotentně po `(email, url, day)`).
  - Outbound mail: **MailChannels přes Cloudflare Workers** (zdarma, není třeba SMTP účet). Šablona v `src/email/lead-followup.js` — krátký souhrn analýzy + lidská nabídka, vykání, brand-friendly.
  - Trigger: po dokončení free analýzy (v Workeru, ne v UI) a jen pokud `consent === true`.
  **Acceptance:** test lead skončí v D1, e-mail dorazí do schránky (zkusit `jsem@fakan.cz`), v hlavičce není trackovací pixel, plain-text alternativa existuje, opt-out odkaz směruje na `/odhlasit?token=…`. _Reference:_ PRD sekce 6 (lead capture), CLAUDE.md sekce 3 (tón mailů).
  **Blokátor / otevřená otázka:** preferuje Fakan MailChannels, nebo Cloudflare Email Workers (Email Routing outbound)? Viz Otevřené otázky.
- [x] **Brand pivot — vykání + cílovka 40+.** Změna tónu a designu pro starší SMB publikum (Fakanovo zadání 2026-05-07). _Toto je změna brandu — úkol vyžaduje Fakanovo finální schválení textů a tagline (viz Otevřené otázky), ale rozpracování může jít._
  _Agent: tým landing-v2 iterace, 2026-05-08._ Vykání + 40+ design napříč 5 stránkami (`index.html`, `vysledek.html`, `prehled.html`, `ochrana-udaju.html`, `odhlasit-hotovo.html`) a 4 mailovými šablonami. Tagline „Váš web. Bez starostí." (varianta A schválená ownerem). Body font 18 px (mobil 17), CTA min-height 56 px, kontrast WCAG 2.2 AA. PR diff `CLAUDE.md` sekce 3 + `fakan-cz-brand-brief.md` sekce 4 připravený jako draft v `projects/landing-v2/brand-pivot-pr.md`, **nemerge bez Fakana**. Detail v `projects/landing-v2/delivery.md`.
  - **Copy:**
    - Tykání → vykání napříč produkcí: `fakan.cz/index.html`, `fakan.cz/vysledek.html`, `fakan.cz/vysledek.js`, `fakan.cz/prehled.html`.
    - Hero a CTA bez technického žargonu: pryč „AI agenty", „framework", „LCP", „WCAG", „CDN", „hydration tax". Tyhle pojmy buď nahradit lidskou řečí („web do 1,5 vteřiny", „čitelný i pro zrakově slabší"), nebo schovat hlouběji do detailních sekcí.
    - Méně buzzwordy v sekci „Co děláme" (zachovat pojmy „audit / nový vzhled / hosting / správa", ne „AI redesign").
    - Mailové i UI texty výslovně bez frází typu „naše AI to zvládne za vás" — cílovka 40+ chce vědět, že je tam **člověk**.
  - **Design 40+:** body `font-size` 17 → 18–19 px (mobil 17 → 18), tlačítka `min-height` 52 → 56 px, větší kontrast `--muted` (zkontrolovat WCAG 2.2 AA pro tělo i pro patičku), klidnější animace (žádný extra parallax / blink), eyebrow popisky o stupínek větší. Brand barvy beze změny (Ivory / Midnight / Fakan Orange — sekce 5.2 brand briefu).
  - **Strategické dokumenty:** návrh diff pro `fakan-cz-brand-brief.md` (sekce 4 „Tón a hlas") a `CLAUDE.md` (sekce 3) — agent připraví PR / patch, **nemerge dokud Fakan neschválí** (CLAUDE.md sekce 5.4 zakazuje editovat brand brief bez pokynu).
  **Acceptance:** v produkčním copy 0 výskytů „ty/tvůj/tobě/tě" mimo schválený tagline; v hero žádné z výše vyjmenovaných buzzwordů; Lighthouse a11y zůstává 100; brand brief má diff připravený k review. Doporučený rozsah: jeden PR s copy změnami + jeden samostatný PR s update brand briefu.
  **Závislost:** udělat **dřív** než „Homepage UX (b)" — jinak se text formuláře přepisuje dvakrát.
- [ ] **Magic link auth.** Cloudflare Email Routing → Worker → JWT v sessionStorage. _Reference:_ PRD sekce 7.
  _Stav 2026-05-08:_ Mailové šablony připravené v iteraci landing-v2 jako draft v0 (`src/email/magic-link-auth.js`), čeká implementace auth flow (endpoint, JWT, sessionStorage, Velín gate).
- [ ] **DMARC pro `fakan.cz`.** Doplnit `_dmarc.fakan.cz` TXT záznam (deliverability pojistka, MX/SPF/DKIM už aktivní). _Z retra landing-v2 — research dohledal, že chybí. Priority 2._
- [ ] **UTM whitelist v `stripUrl()` + `from=mail` parametr v mailových linkách.** Marketing tracking — drobný refactor, aby `stripUrl()` propouštěl `utm_*` a `from`. _Z retra landing-v2. Priority 2._
- [ ] **Cron retention task.** Auto-mazání leadů po 12m podle Privacy Policy retence. První lead vyprší 2027-04, ale cron ať existuje dřív. _Z retra landing-v2. Priority 2._
- [ ] **Rate limit telemetry.** Sledovat KV writes, flagovat pokud `rate_limit_hit > 1 % requests` (indikuje příliš restriktivní limit). _Z retra landing-v2. Priority 2._
- [ ] **Verzovat consent text — workflow.** Pokud Fakan přepíše znění consentu, MUSÍ zvýšit verzi (`v2-…`) a starý nechat. `legal/consent-versions/v1-2026-05-08.md` je první. _Z retra landing-v2. Priority 3 — proces, ne kód._
- [ ] **Base Velín shell.** `fakan.cz/velin` po loginu — minimální verze: profil, weby (zatím prázdné), audit log, odhlášení. _Reference:_ PRD sekce 5.24.
- [ ] **Plugin registry skeleton (D1 schéma).** Tabulky `plugins`, `plugin_versions`, `plugin_installations`. Migrace ve `migrations/`. _Reference:_ PRD sekce 10, plugin spec.
- [ ] **Manifest engine v0.** Validace `plugin.json` proti JSON Schema. _Reference:_ plugin-spec sekce 2.

### 🟡 Priority 2 — kvalita a hygiena

- [ ] **Brand tokens jako CSS variables.** Jeden `tokens.css` se všemi barvami, fonty, radii ze sekce 5.2 a 5.3 brand briefu. Importovat všude. _Acceptance:_ žádný hex color hardcoded mimo tokens.css.
- [ ] **Inter + JetBrains Mono self-hosted.** Stáhnout, woff2, `font-display: swap`, subsetting na latin-ext. Žádný `fonts.googleapis.com`.
- [ ] **A11y baseline.** Skip-link, focus styles, `prefers-reduced-motion`, `aria-live` regiony tam, kde to dává smysl.
- [ ] **CI — GitHub Actions.** Lint (eslint nebo biome), HTML validate, Lighthouse CI na PR. _Acceptance:_ PR s regresí v Lighthouse fail.
- [ ] **`SECURITY.md` a `humans.txt`.** Krátké, věcné, brand-friendly.

### 🟢 Priority 3 — nice to have / průzkum

- [ ] **Maskot — sketch.** Z brand briefu sekce 5.1: kluk s notebookem, černá silueta + Fakan Orange akcent. Inline SVG, použitelný jako logo + 404 ilustrace. _Open:_ finální design dělá designér, ale prvotní skica je užitečná.
- [ ] **Demo plugin.** Postav `fakan-plugin-hello` podle plugin-spec sekce 10.1, ať máme něco, co prochází plugin registrem. Nemusí dělat nic užitečného.
- [ ] **`/dev` portal mockup.** Statická stránka s tier tabulkou (Hobby / Pro / Studio / Enterprise) — viz PRD sekce 5.12.
- [ ] **Audit existujícího `fakan-nabidka/index.html`.** Doporuč, jestli to integrovat někam, nebo nechat jako offline materiál.

### ⚪ Otevřené otázky pro Fakana

Sem si agenti přidávají, na co potřebují odpověď před pokračováním.

- **Tagline „Tvůj web. Bez výmluv."** Je to brand element zafixovaný v PRD i brand briefu. Při pivotu na vykání měnit na „Váš web. Bez výmluv." (konzistence s novým tónem), nebo nechat jako jediný tykací prvek (charakterní kotva)? — _Blokuje finální copy hero v úkolu „Brand pivot"._
- **Brand brief / CLAUDE.md update.** Má agent připravit PR s diffem brandového dokumentu (a počkat na review), nebo to chceš editovat sám? — _Blokuje uzavření úkolu „Brand pivot"._
- **Outbound mail — MailChannels nebo Cloudflare Email Workers?** MailChannels je rychlejší rozjezd (zdarma, dokumentovaná cesta z Workerů), Email Workers vyžaduje aktivní outbound z Email Routing. — _Blokuje úkol „Lead capture"._
- **Souhlas — přesné znění.** Návrh: „Souhlasím se zasláním výsledků analýzy a nezávazné nabídky e-mailem. Souhlas mohu kdykoliv odvolat odkazem v patičce e-mailu." — schválit / přepsat. Případně se k tomu má vyjádřit někdo s GDPR pohledem (hint: čistě opt-in, bez „pre-checked"). — _Blokuje finální podobu formuláře._
- **Deploy fixu `run_worker_first`.** Fix v repu commit-ready. Mám provést `wrangler deploy` (publikace na produkci), nebo to nasadíš sám? — _Blokuje obnovení produkční free analýzy._ ~~Update 2026-05-07: deploy proběhl, Worker funguje na `workers.dev`. Skutečný blokátor je níže.~~
- ~~**Pages vs. Workers — která cesta?**~~ _Vyřešeno 2026-05-07: Fakan zvolil B (migrace). Detail v Priority 0 task „Migrace produkce z Cloudflare Pages na Workers"._
- ~~**Volba CI po smazání Pages projektu.**~~ _Vyřešeno 2026-05-07: Workers Builds + manuální `npm run deploy` jako fallback._

### 📦 Dokončené

- [x] **Repo bootstrap — pravidla a dokumentace.** _Agent: Claude Opus 4.7, 2026-05-06._ Sepsána [CLAUDE.md](CLAUDE.md) (technologické hranice, brand, workflow agentů) a tento README.md (task board + onboarding). Paměť v `~/.claude/projects/-Users-junkycoder-fakan/memory/` ponechána prázdná, fresh start.

---

## Lokální vývoj

```bash
npm install        # jednou, nainstaluje wrangler
npm run dev        # spustí lokální dev server na http://localhost:8787
npm run deploy     # nasadí na Cloudflare (vyžaduje wrangler login)
```

## Struktura repa

```
.
├── CLAUDE.md                       # Pravidla pro agenty (povinná četba)
├── AGENTS.md                       # 30sekundový onboarding
├── README.md                       # Tenhle soubor — task board
├── package.json                    # Dev workflow (wrangler)
├── wrangler.toml                   # Cloudflare Workers config
├── src/
│   ├── worker.js                   # Worker entry — router /api/*
│   ├── analyze.js                  # Free analýza — synchronní vlna (SSE)
│   └── detectors.js                # Stack / tracker / cookie banner pravidla
├── fakan-cz-prd.md                 # Strategie v0.9
├── fakan-cz-brand-brief.md         # Brand v0.2
├── fakan-cz-plugin-spec.md         # Plugin spec v0.8
├── fakan.cz/                       # Statické assety (servíruje Wrangler)
│   ├── index.html                  # Marketing landing
│   ├── prehled.html                # Přehled platformy
│   ├── vysledek.html               # Stránka výsledků free analýzy
│   └── vysledek.js                 # Klient — EventSource + rendering panelů
└── fakan-nabidka/                  # Offline materiál — 10 firem
```

## Pravidla výstupu (zkráceně)

Detail v [CLAUDE.md sekce 2–6](CLAUDE.md). Tady jen seznam **veta:**

- Žádné cookies. Žádné cookie banery. Žádné popupy.
- Žádné third-party trackery, fonty z CDN, externí JS.
- Mobile-first 375×812, touch ≥ 44×44, žádný hover-only.
- Auto dark/light přes `prefers-color-scheme`.
- WCAG 2.2 AA, sémantický HTML, klávesnice, focus.
- LCP < 1,5 s, CLS < 0,05, INP < 200 ms, JS < 30 kB gzip.

## Kontakt

- **Daniel Hromada (Fakan)** — [jsem@fakan.cz](mailto:jsem@fakan.cz), +420 604 690 539
- **GitHub** — [github.com/junkycoder](https://github.com/junkycoder)

---

*Aktualizováno 7. května 2026. Produkce má blokátor `/api/*` (fix v repu, čeká deploy). Rozpracovaný balík: homepage UX, lead capture, brand pivot na vykání + 40+.*
