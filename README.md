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
| **Statický landing** | [fakan.cz/index.html](fakan.cz/index.html) | starší placeholder, čeká na nahrazení |
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

- [ ] **Vyber Cloudflare project shape.** Rozhodni: `fakan.cz` jako Workers Site, Pages, nebo kombinace? Doporuč jeden z modelů, sepiš `wrangler.toml` skeleton, vlož do repa. _Why:_ celý další build závisí na tom, kam co nasazujeme.
- [ ] **Nastav `package.json` + minimální dev workflow.** `npm i -D wrangler`, scripty `dev`, `deploy`, `format`. Žádné runtime dependencies (zatím). _Acceptance:_ `npm run dev` spustí lokální server u root pathu.
- [x] **Sepiš `AGENTS.md` orchestration guide.** _Agent: Claude Opus 4.7, 2026-05-06._
  Vytvořen [AGENTS.md](AGENTS.md) jako 30sekundový vstupní bod pro nové agenty — odkazuje na CLAUDE.md a README.md, popisuje workflow při braní úkolu, paralelizaci a co nedělat bez Fakanova pokynu.
- [ ] **Doménový stack v Cloudflare.** Ověř (s Fakanem), kdo drží `fakan.cz` doménu, jestli je už v Cloudflare účtu a jaký account ID použít. **Tohle je Fakanův úkol** — agent jen připraví otázky.

### 🟠 Priority 1 — Fáze 0 deliverables (PRD sekce 12)

- [ ] **Marketing landing — produkční verze.** Vyjít z [fakan.cz/prehled.html](fakan.cz/prehled.html) jako referenčního stylu, ale postavit nový landing podle PRD sekce 5.1 + brand brief sekce 6.1. URL input → free analýza CTA. Mobile-first, dark/light auto. _Acceptance:_ Lighthouse Perf ≥ 95, A11y = 100, žádné externí requesty.
- [ ] **Free analýza — synchronní vlna (TTFV ≤ 5 s).** Worker endpoint `/api/analyze`, fetch HTML, parse status / headers / OG / cookies / trackers, stack fingerprint. Stream přes SSE. _Reference:_ PRD sekce 5.1.
- [ ] **Free analýza — asynchronní vlna.** Lighthouse-lite, Browser Rendering screenshot, AI redesign. Queue + DO pro stav. UI inkrementálně doplňuje výsledky.
- [ ] **Turnstile + rate limit.** 3 free analýzy / 24 h / IP. _Reference:_ PRD sekce 5.1, anti-bot.
- [ ] **Magic link auth.** Cloudflare Email Routing → Worker → JWT v sessionStorage. _Reference:_ PRD sekce 7.
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

- (žádné zatím — agenti přidávejte sem)

### 📦 Dokončené

- [x] **Repo bootstrap — pravidla a dokumentace.** _Agent: Claude Opus 4.7, 2026-05-06._ Sepsána [CLAUDE.md](CLAUDE.md) (technologické hranice, brand, workflow agentů) a tento README.md (task board + onboarding). Paměť v `~/.claude/projects/-Users-junkycoder-fakan/memory/` ponechána prázdná, fresh start.

---

## Lokální vývoj

Aktuálně repo nemá žádný build krok. Pro statický náhled stačí:

```bash
cd fakan.cz
python3 -m http.server 8000
# otevři http://localhost:8000
```

Až bude `package.json` (úkol P0), workflow přejde na `npm run dev` (Wrangler).

## Struktura repa

```
.
├── CLAUDE.md                       # Pravidla pro agenty (povinná četba)
├── README.md                       # Tenhle soubor — task board
├── fakan-cz-prd.md                 # Strategie v0.9
├── fakan-cz-brand-brief.md         # Brand v0.2
├── fakan-cz-plugin-spec.md         # Plugin spec v0.8
├── fakan.cz/                       # Současný produkční obsah (statika)
│   ├── index.html
│   └── prehled.html
└── fakan-nabidka/                  # Offline materiál — 10 firem
```

Až přijde kernel build, struktura naroste. Plánovaný shape (k diskusi):

```
.
├── apps/
│   └── kernel/                     # Root Worker fakan.cz/*
├── packages/
│   ├── sdk/                        # @fakan/sdk
│   └── tokens/                     # tokens.css + brand assets
├── plugins/
│   ├── core-forms/
│   ├── core-seo/
│   └── core-analytics-basic/
├── migrations/                     # D1 SQL migrace
└── …
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

*Aktualizováno 6. května 2026.*
