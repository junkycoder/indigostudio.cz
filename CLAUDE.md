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

## 5. Jak pracují agenti na tomhle repu

**Toto je hlavní orchestrace pro Claude Code agenty. Před prací si přečti i [README.md](README.md).**

### 5.1 Workflow agenta

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

### 5.2 Kdy se neptat a kdy ANO

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

### 5.3 Co psát do commitu

Český, krátký, věcný:

```
feat(landing): doplněn hero CTA a snippet poptávky
fix(velin): editor neuložil draft po reloadu — chybělo flush
docs: přepsán README.md s task boardem
chore: drobnosti v .gitignore
```

Žádné `Co-Authored-By: Claude` nepřidávej, ledaže si o to Fakan výslovně řekne.

### 5.4 Soubory, kterých se NEDOTÝKEJ bez explicitního pokynu

- `fakan-cz-prd.md`, `fakan-cz-brand-brief.md`, `fakan-cz-plugin-spec.md` — to jsou Fakanovy strategické dokumenty. Můžeš je číst, citovat, odkazovat. **Nepřepisuj je.**
- `fakan-nabidka/` — offline marketingový materiál pro reálné firmy. Mimo scope nasazení.
- `fakan.cz/index.html`, `fakan.cz/prehled.html` — současný produkční obsah. **Pokud chceš měnit, projdi to nejdřív v README úkolu** a potvrď přístup s Fakanem.

### 5.5 Spolupráce mezi agenty

- Když dva agenti pracují paralelně na samostatných úkolech — ideální stav, oba si vyberou jiný řádek z README.
- Když si všimneš, že jiný agent dělá něco podobného nebo souvisejícího, **dej to do popisu úkolu** (napiš, co děláš, ať druhý ví).
- Pokud odhalíš problém v cizím rozpracovaném úkolu, **nepřepisuj ho.** Založ vlastní úkol „Review & navázání na X".
- Pokud najdeš stejný problém řešený dvakrát, **zastav se a flagni to v README.**

## 6. Jak ověřit hotovou práci

Než označíš úkol jako hotový:

- [ ] **Renderuje se to v prohlížeči?** Otevři výsledek lokálně (`python3 -m http.server` ze správné složky) a klikni se přes hlavní flow.
- [ ] **Mobilní šířka 375 px?** DevTools → device toolbar → 375×812. Žádný horizontální scroll.
- [ ] **Dark mode?** DevTools → Rendering → Emulate CSS prefers-color-scheme: dark. Vypadá to OK, čte se to?
- [ ] **Bez sítě?** Vyjma vlastního domain by neměly létat žádné requesty na google-analytics, gstatic, fonts.googleapis.
- [ ] **Lighthouse?** Aspoň lokálně rychlý sken — Performance, Accessibility, Best Practices, SEO. Cíl Performance ≥ 90, A11y = 100.
- [ ] **Český jazyk?** `<html lang="cs">`, žádné anglické fragmenty v UI, datum/čas/měna v českém formátu.

Pokud něco z toho nejde ověřit (např. změna se neprojeví bez Workeru), **napiš to explicitně do popisu úkolu.** „Změna ověřená jen statickým renderem, runtime test čeká na implementaci kernel routeru."

## 7. Aktuální datum a kontext

- **Dnešní datum:** `2026-05-06` (6. května 2026)
- **Vlastník:** Daniel Hromada (Fakan), [jsem@fakan.cz](mailto:jsem@fakan.cz), +420 604 690 539
- **GitHub:** [github.com/junkycoder](https://github.com/junkycoder)
- **Stack reference:** sekce 9 PRD, ASCII diagram

## 8. Když narazíš na něco, co tu není

1. Hledej v PRD ([fakan-cz-prd.md](fakan-cz-prd.md)) — má 442 řádků a pokrývá většinu otázek.
2. Plugin-related věci jsou v [fakan-cz-plugin-spec.md](fakan-cz-plugin-spec.md).
3. Tón / vizuál / texty jsou v [fakan-cz-brand-brief.md](fakan-cz-brand-brief.md).
4. Pokud to fakt nikde není a blokuje tě to — přidej úkol do README sekce „Otevřené otázky pro Fakana" a pokračuj na něčem jiném.

---

*Tahle CLAUDE.md se aktualizuje, když se mění pevné hranice projektu (stack, brand, workflow agentů). Když chceš měnit roadmap nebo úkoly, mění se [README.md](README.md).*
