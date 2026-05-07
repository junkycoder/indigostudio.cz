# CLAUDE.md

Kontext, pravidla a instrukce pro Claude Code agenty pracující na projektu **fakan.cz**.

---

## 1. Co je tenhle projekt

**fakan.cz** = pluginová platforma pro audit, návrh, realizaci, hosting, správu a růst webových stránek pro českou SMB cílovku.

Tagline: **„Tvůj web. Bez výmluv."** Fakan nedělá weby — Fakan je řeší.

Aktuální stav repa: **bootstrap fáze.** Máme:

- Detailní PRD v0.9 ([fakan-cz-prd.md](fakan-cz-prd.md))
- Brand brief v0.2 ([fakan-cz-brand-brief.md](fakan-cz-brand-brief.md))
- Plugin spec v0.8 ([fakan-cz-plugin-spec.md](fakan-cz-plugin-spec.md))
- Statický landing v [fakan.cz/](fakan.cz/) (zůstává jako placeholder)
- Reálné nabídky pro 10 firem v [fakan-nabidka/](fakan-nabidka/) (offline materiál, mimo nasazení)

Celá platforma se teprve buduje. Roadmap je v PRD sekce 12 (Fáze 0–8+).

## 2. Technologický základ — pevné hranice

**Tohle se nemění bez explicitního pokynu od Fakana.** Nepřidávej framework jen proto, že by se to dalo udělat čistěji.

| Vrstva | Co používáme | Co NE |
|--------|--------------|-------|
| Frontend | **Vanilla HTML / CSS / JS / SVG** | React, Vue, Svelte, Next, Nuxt, Astro, jQuery |
| Web Components | nativní Custom Elements + Shadow DOM | Lit, Stencil |
| Build | žádný build u statických stránek; pro pluginy/Worker minimální (esbuild/wrangler) | Webpack, Vite jako runtime, Babel |
| Hosting | **Cloudflare** end-to-end (Pages, Workers, D1, KV, R2, Durable Objects, Queues, Browser Rendering, Email Routing, Custom Hostnames) | Vercel, Netlify, AWS, vlastní VPS |
| AI | Anthropic Claude (default), BYO klíč přes plugin (fáze 6) | OpenAI jako default |
| Platby | Stripe + Comgate + GoPay | PayPal default, kryptopay |
| Fonty | **Inter** (variable, self-host), **JetBrains Mono** (mono) | Google Fonts CDN |
| Ikony | Lucide (SVG, inline) | Font Awesome, ikon CDN |

**Železná pravidla výstupu** (PRD sekce 6 — „fakan.cz Standardy"):

- ❌ **Žádné cookies, žádné cookie banery, žádné popupy.** Nikdy.
- ❌ Žádné third-party trackery, fonty z CDN, ani externí JS.
- ✅ Mobile-first (375×812 baseline), touch ≥ 44×44 px, žádný hover-only.
- ✅ Auto dark/light přes `prefers-color-scheme`. Žádný switcher v UI defaultně.
- ✅ WCAG 2.2 AA, sémantický HTML, plná klávesnicová navigace, viditelný focus.
- ✅ Schema.org JSON-LD, sitemap, robots, canonical, OG + Twitter Card per stránka.
- ✅ LCP < 1,5 s na 4G, CLS < 0,05, INP < 200 ms, JS < 30 kB gzip.
- ✅ GDPR-friendly defaultně (nesbíráme nic, k čemu bychom potřebovali souhlas).

Tohle není doporučení — když Fakan zjistí, že web má cookie banner nebo načítá Google Fonts, předěláváme.

## 3. Brand — jak Fakan mluví

Detail v [fakan-cz-brand-brief.md](fakan-cz-brand-brief.md). Kompaktní výtah:

**Tón:**

- **Tyká.** „Tvůj web", ne „váš web". Default napříč UI a maily.
- **Krátké věty.** Jedna myšlenka = jedna věta.
- **Aktivní rod.** „Opravíme to", ne „bude to opraveno".
- **Konkrétní čísla** všude, kde se dají měřit. „LCP 0,9 s místo 3,2 s", ne „rychlejší".
- **Sebekritika OK.** „Naši AI agenti někdy udělají blbost. Když to uvidíš, řekni nám."
- **Ironie lehká, ne kousavá.**

**Co NE:**

- ❌ Korporátní žargon (leverage, synergie, ekosystém, omnichannel).
- ❌ Falešná intimita („milý zákazníku, jsme tu pro tebe").
- ❌ Marketingové superlativy bez důkazu.
- ❌ Anglicismy z lenosti (endorsement, brand awareness).
- ❌ Falešná urgentnost („už jen 2 hodiny!").

**Mikro-pravidla:**

- Sentence case v UI titulech, ne Title Case. „Tvoje weby", ne „Tvoje Weby".
- Číslovky od 10 výš číslicemi.
- Datum: „6. května 2026" (česky), v technickém UI ISO `2026-05-06`.
- Čas 24h: „14:30".
- Měna s mezerou: „99 Kč", ne „99Kč".

**Barvy** (PRD/brand sekce 5.2):

| Role | Light | Dark |
|------|-------|------|
| Pozadí | `#F9F6F0` Ivory | `#0B1221` Midnight Blue |
| Text primární | `#0B1221` | `#F9F6F0` |
| Akcent (CTA, kritická notif.) | `#FF5722` Fakan Orange | `#FF6B3D` |
| UI rámečky, dividery | `#E2E8F0` Technical Grey | tlumená varianta |
| Success | `#52A47C` Tichá zelená | `#67BD93` |
| Error | `#A4243B` Burgundy | `#C44B62` |
| Sekundární text | `#6B7280` | `#94A3B8` |

**Disciplína:** Fakan Orange **jen pro CTA a kritické notifikace**. Žádné dekorativní použití.

## 4. Architektura — high level

```
fakan.cz/                    # Marketing landing
fakan.cz/dev                 # Dev portál + sandbox
fakan.cz/marketplace         # Pluginy a artefakty
fakan.cz/zpravy              # Notifikační inbox
fakan.cz/velin               # Globální Velín (zákaznický backend)
fakan.cz/api/*               # Naše API
fakan.cz/{host}/             # Mirror webu zákazníka (noindex, canonical → vlastní doména)
fakan.cz/{host}/dev          # Preview + injectovaný editor
fakan.cz/{host}/velin        # Web Velín
fakan.cz/{host}/api/*        # Worker daného webu
```

**Klíčové vrstvy:**

1. **Kernel** — minimální jádro (auth, hosting, plugin registry, manifest engine, editor shell, velín shell, notifikační hub, billing core, marketplace, storage primitiva, i18n, audit).
2. **Core pluginy** — povinné, od nás (forms, seo, analytics-basic).
3. **Oficiální pluginy** — volitelné, od nás (fulltext, comments, geo, ppc, …).
4. **Verified Partner pluginy** — fáze 7+, KYC + manual review.
5. **Hobby / Community pluginy** — fáze 6+, omezené permissions.

Detail v [fakan-cz-plugin-spec.md](fakan-cz-plugin-spec.md).

## 5. Tým agentů — kdo dělá co

Pro práci na **konkrétních zakázkách** (klientské weby, produktové iterace) máme tým specializovaných agentů. Definice jsou v [.claude/agents/](.claude/agents/) a Claude Code je načítá automaticky.

| Agent | Co řeší |
|---|---|
| **owner** | Virtuální zákazník. Formuluje brief, schvaluje, mluví business. |
| **product-manager** | Drží workflow fakan.cz, kapacitu týmu, standardy napříč projekty. |
| **project-manager** | Drží konkrétní zakázku od briefu po předání. |
| **senior-architect** | Cloudflare expert, navrhuje architekturu, dělá code review. |
| **researcher** | Najde cokoliv komukoliv. Nedělá rozhodnutí. |
| **junior-developer** | Implementuje atomické úkoly podle zadání. |
| **tester** | Ověřuje acceptance criteria, hledá bugy. |
| **marketer** | Positioning, copy, landing, SEO, launch plán, tracking. |
| **legal-advisor** | GDPR, cookies, ToS/Privacy, smlouvy, risk check. |
| **finance** | Token tracking (Claude/Workers AI/OpenAI), cost forecast a retro, unit economics. |

**Kdy aktivovat agenta:** zavolej ho přes Task tool se `subagent_type: <name>` (např. `senior-architect`), kdykoliv úkol odpovídá jeho doméně. Detail v jeho definici.

**Tvrdá pravidla rolí:**
- **Každý mluví vlastní řečí** — owner business, architect technicky, právník česky bez paragrafů, markeťák jako prodavač, finanční jako účetní. Žádný cizí žargon, žádný korpo bullshit.
- **junior-developer** nesahá na architekturu bez **senior-architect**.
- **tester** nepíše kód, jen testuje.
- **owner** nediskutuje implementaci, jen výsledek.
- **researcher** nedělá rozhodnutí, jen podklady.
- **legal-advisor** nikdy negarantuje „100 % v pořádku" — vážnější věci eskaluje na živého advokáta.
- **finance** vždy ověřuje aktuální ceník (provideři mění ceny i víc než 1× ročně).
- Žádná npm dependency bez schválení **senior-architect**.
- Secrets nikdy v kódu — jen ve `wrangler.toml` / env.

## 6. Iterace zakázky — jak běží projekt

Když přijde nová klientská zakázka nebo produktová iterace fakan.cz:

```
Owner brief → Legal risk check → PM(product) fit & kapacita → Finance forecast
   → PM(project) rozpad → Architect návrh → Researcher doplní mezery
   → Junior implementuje → Tester ověří → Architect review
   → Marketer připraví copy/launch → Legal projde Privacy/ToS/cookies
   → PM(project) předá Ownerovi
   → Schválení = fakturace | Vrácení = zpátky do plánu
   → Finance retro (skutečný cost vs. forecast) → PM(product) retro & update standardů
```

### Fáze 1 — Brief
1. **owner** zformuluje zadání (problém, cíl, rozpočet, termín, constraints)
2. **legal-advisor** projde risk check (osobní údaje, regulace, šedé zóny)
3. **product-manager** zkontroluje fit do workflow + kapacitu
4. **finance** udělá cost forecast (AI tokeny, Cloudflare, třetí strany, breakeven)
5. **project-manager** založí ticket a parsuje rozsah

### Fáze 2 — Plán
6. **senior-architect** navrhne technické řešení (Cloudflare-first)
7. **researcher** doplní co chybí (API, regulace, knihovny, ceny)
8. **legal-advisor** zkontroluje data flow / GDPR podklad pokud je relevantní
9. **project-manager** rozpadne na junior-velikost úkolů (1–4 h kus) s acceptance criteria

### Fáze 3 — Exekuce
10. **junior-developer** vezme task, implementuje
11. Když narazí — eskaluje na **senior-architect** nebo **researcher**
12. **finance** průběžně sleduje cost (zejména AI usage), flagne když to roste rychleji než plán
13. Done = kód + smoke test + krátká poznámka pro testera

### Fáze 4 — Validace
14. **tester** projde acceptance criteria + edge cases
15. **senior-architect** dělá code review
16. Bug → zpátky **junior-developer**
17. Pass → další task

### Fáze 5 — Pre-launch
18. **marketer** dodá copy (landing, hero, CTA, onboarding emaily) + launch plán + tracking events
19. **legal-advisor** projde Privacy Policy / Terms / cookie disclosures / označení reklamy
20. **finance** finální cost projection pro produkci

### Fáze 6 — Delivery
21. **project-manager** prezentuje výsledek **owner**
22. Owner schválí, nebo vrátí s konkrétním důvodem
23. Vrácení → zpátky do Plánu s feedbackem
24. Schválení → konec iterace

### Fáze 7 — Retro
25. **finance** dodá skutečný cost report (vs. forecast, top 3 spotřebiče, optimalizace)
26. **product-manager** zaznamená co fungovalo / nefungovalo
27. Update standardů, šablon, agent promptů, reusable kódu

### Trigger iterace

Pro start nové iterace stačí napsat:

> **`Iteruj [název projektu]. Brief: [zadání]`**

Nebo pokračování:

> **`Pokračuj v iteraci [název projektu]`**

Pokud chybí informace v briefu, **owner** se ptá zpátky uživatele (Fakana). Žádné domýšlení.

## 7. Jak pracují agenti na tomhle repu

**Toto je hlavní orchestrace pro Claude Code agenty. Před prací si přečti i [README.md](README.md).**

### 7.1 Workflow agenta

1. **Začni v [README.md](README.md)** — sekce „Úkoly" je pravdivá tabule rozpracované práce.
2. **Vyber si jednu z těchto cest:**
   - **A) Vezmi nejvyšší nehotový úkol** ze seznamu, který odpovídá tvé specializaci.
   - **B) Identifikuj vlastní úkol**, který posune projekt vpřed (analýza dluhu, scaffolding, refaktor, doplnění dokumentace, kontrola standardů). **Přidej ho do README.md** ještě než začneš pracovat, ať to ostatní vidí.
3. **Označ úkol jako rozpracovaný** v README.md (změň `[ ]` na `[~] (agent: krátký popis)`). Pokud pracuješ ve worktree / izolovaně, napiš to do popisu.
4. **Pracuj malými, ověřitelnými kroky.** Commituj samostatné logické jednotky. Nikdy nemíchej dvě nesouvisející věci v jednom commitu.
5. **Před commitem zkontroluj:**
   - Splňuje výstup standardy z PRD sekce 6 (cookies, mobile-first, a11y, perf)?
   - Souhlasí tón s brand briefem (tykání, krátké věty, žádný marketingový blábol)?
   - Existuje pro novou feature jednoduchý test / způsob, jak ji ověřit v prohlížeči?
6. **Po dokončení** zaškrtni úkol v README.md (`[x]`) a krátce shrň, co se udělalo (1–2 věty pod úkol).
7. **Pokud narazíš na blokátor**, popiš ho v úkolu a označ ho `[!] (blokátor: …)` — další agent na to může navázat nebo eskalovat na Fakana.

### 7.2 Kdy se neptat a kdy ANO

**Neptej se** (jeď autonomně):

- Dodržení standardů z PRD sekce 6 a brand briefu.
- Volba mezi vanilla JS variantami (jaký pattern web component použít).
- Drobné refaktory, opravy překlepů, doplnění komentářů.
- Bug fixy, kde je root cause jasný.

**Zeptej se Fakana** (commit do separátní větve, otevři PR a počkej):

- Změna technologického stacku (sekce 2 této CLAUDE.md).
- Změna pricingu, tieru, nebo obchodního flow.
- Cokoli, co se dotýká platby, billing flow, Stripe / Comgate / GoPay nastavení.
- Změna brandu (barvy, font, tón).
- Něco, co by mohlo skončit takedownem (bezpečnostní aspekty, spam protection).

### 7.3 Commitování — povinnost pro všechny role

**Root pravidlo (platí pro všechny agenty bez výjimky):** sdílej svou práci pomocí gitu — commituj své výsledky ostatním. Co není v gitu, ostatní agenti neuvidí a iterace se rozpadne.

Konkrétně:

- **Po každém ucelením kroku** stage + commit (`git add <soubor> && git commit -m "..."`).
- **Jeden commit = jedna změna.** Nikdy nemíchej dvě nesouvisející věci.
- **Stage explicitně po souborech** — žádné `git add .` ani `-A`, ať tam neuteče něco z `.env`.
- **Žádné `Co-Authored-By: Claude`**, ledaže si o to Fakan výslovně řekne.
- **Když nemáš Bash/git tool** (např. researcher), předej výstup roli, která ho má (typicky `project-manager` nebo `junior-developer`), a navrhni commit message.

Per-role kam co commitovat je v sekci „Git" konkrétní agent definice v [.claude/agents/](.claude/agents/).

Český, krátký, věcný formát:

```
feat(landing): doplněn hero CTA a snippet poptávky
fix(velin): editor neuložil draft po reloadu — chybělo flush
docs(arch): ADR-007 volba D1 vs. KV pro session storage
docs(legal): risk check projekt X
docs(finance): forecast projekt X
docs(retro): iterace Y — 40 % přestřel kvůli necachovaným promptům
chore: drobnosti v .gitignore
```

Conventional prefixy v ekosystému týmu: `feat`, `fix`, `refactor`, `docs`, `chore`, `test` + scope v závorce (modul, role, projekt).

### 7.4 Soubory, kterých se NEDOTÝKEJ bez explicitního pokynu

- `fakan-cz-prd.md`, `fakan-cz-brand-brief.md`, `fakan-cz-plugin-spec.md` — to jsou Fakanovy strategické dokumenty. Můžeš je číst, citovat, odkazovat. **Nepřepisuj je.**
- `fakan-nabidka/` — offline marketingový materiál pro reálné firmy. Mimo scope nasazení.
- `fakan.cz/index.html`, `fakan.cz/prehled.html` — současný produkční obsah. **Pokud chceš měnit, projdi to nejdřív v README úkolu** a potvrď přístup s Fakanem.

### 7.5 Spolupráce mezi agenty

- Když dva agenti pracují paralelně na samostatných úkolech — ideální stav, oba si vyberou jiný řádek z README.
- Když si všimneš, že jiný agent dělá něco podobného nebo souvisejícího, **dej to do popisu úkolu** (napiš, co děláš, ať druhý ví).
- Pokud odhalíš problém v cizím rozpracovaném úkolu, **nepřepisuj ho.** Založ vlastní úkol „Review & navázání na X".
- Pokud najdeš stejný problém řešený dvakrát, **zastav se a flagni to v README.**

## 8. Jak ověřit hotovou práci

Než označíš úkol jako hotový:

- [ ] **Renderuje se to v prohlížeči?** Otevři výsledek lokálně (`python3 -m http.server` ze správné složky) a klikni se přes hlavní flow.
- [ ] **Mobilní šířka 375 px?** DevTools → device toolbar → 375×812. Žádný horizontální scroll.
- [ ] **Dark mode?** DevTools → Rendering → Emulate CSS prefers-color-scheme: dark. Vypadá to OK, čte se to?
- [ ] **Bez sítě?** Vyjma vlastního domain by neměly létat žádné requesty na google-analytics, gstatic, fonts.googleapis.
- [ ] **Lighthouse?** Aspoň lokálně rychlý sken — Performance, Accessibility, Best Practices, SEO. Cíl Performance ≥ 90, A11y = 100.
- [ ] **Český jazyk?** `<html lang="cs">`, žádné anglické fragmenty v UI, datum/čas/měna v českém formátu.

Pokud něco z toho nejde ověřit (např. změna se neprojeví bez Workeru), **napiš to explicitně do popisu úkolu.** „Změna ověřená jen statickým renderem, runtime test čeká na implementaci kernel routeru."

## 9. Aktuální datum a kontext

- **Dnešní datum:** `2026-05-07` (7. května 2026)
- **Vlastník:** Daniel Hromada (Fakan), [jsem@fakan.cz](mailto:jsem@fakan.cz), +420 604 690 539
- **GitHub:** [github.com/junkycoder](https://github.com/junkycoder)
- **Stack reference:** sekce 9 PRD, ASCII diagram

## 10. Když narazíš na něco, co tu není

1. Hledej v PRD ([fakan-cz-prd.md](fakan-cz-prd.md)) — má 442 řádků a pokrývá většinu otázek.
2. Plugin-related věci jsou v [fakan-cz-plugin-spec.md](fakan-cz-plugin-spec.md).
3. Tón / vizuál / texty jsou v [fakan-cz-brand-brief.md](fakan-cz-brand-brief.md).
4. Pokud to fakt nikde není a blokuje tě to — přidej úkol do README sekce „Otevřené otázky pro Fakana" a pokračuj na něčem jiném.

---

*Tahle CLAUDE.md se aktualizuje, když se mění pevné hranice projektu (stack, brand, workflow agentů). Když chceš měnit roadmap nebo úkoly, mění se [README.md](README.md).*
