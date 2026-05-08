# Brief — landing-v2

**Vlastník:** owner (Fakan)
**Datum:** 2026-05-08
**Stav:** Fáze 1 — brief

---

## Problém

Současný landing, výsledková stránka a komunikační tón mluví špatně k tomu, kdo si u nás reálně objedná web. Pravdivý zákazník je **majitel malé firmy 40+** — instalatér, právník, paní s e-shopem na koření, autoservis. Ten člověk:

- Nechce číst „AI agenty s lidským garantem", „LCP < 1,5 s", „WCAG 2.2 AA", „hydration tax". To ho odežene jako cizí jazyk.
- Tykání mu vadí. „Tvůj web. Bez výmluv." mu zní jako reklama na energy drink.
- Potřebuje větší písmo, jasnější tlačítka a méně blikajících věcí. Brýle na čtení už občas nestačí.
- Slovo „cookies" na webu, který se chlubí tím, že **žádné cookies nemá**, ho mate. Vidí cookies a vypne mozek.

Druhý problém: současná **lead capture neexistuje**. Free analýza odjede, klient odejde, my o něm nevíme. Není ani **mailové texty**, kterými bychom poslali nabídku. Bez toho je celý funnel slepý a žádné konverze nebudou.

Současné stránky v rozsahu redesignu: `fakan.cz/index.html`, `fakan.cz/vysledek.html`, `fakan.cz/prehled.html`. Dotkne se taky **vznikajících mailových šablon** (lead followup, případně potvrzení souhlasu).

## Cíl

Na konci iterace umím říct **„ano, tohle je verze, kterou ukážu instalatérovi z Klatov a on to pochopí na první přečtení"**.

Měřitelně:

1. **Tón** — v produkčním copy (`index.html`, `vysledek.html`, `prehled.html`, mailové šablony) je **0 výskytů „ty/tvůj/tobě/tě"** mimo případně schválený brand tagline. Vykání důsledně.
2. **Srozumitelnost** — v hero a CTA sekcích **0 výskytů** těchto slov: „AI agenty", „framework", „hydration", „LCP", „CLS", „INP", „WCAG", „CDN", „kernel". Schované hlouběji do detailu OK, v hero ne.
3. **Slovo „cookies"** mizí z hero a stats. Zůstává tam, kde to dává smysl (sekce o tom, co cizí weby mají, my ne — ne jako self-stat).
4. **Lead capture funguje end-to-end** — návštěvník zadá URL + e-mail + souhlas, dostane výsledek analýzy v UI, do 24 h mu přijde lidský follow-up e-mail s nabídkou.
5. **Konverze ze stránky výsledků na lead** — měříme od dne nasazení, cíl si stanoví marketer/finance, ale baseline = 0 (nic teď nesbíráme).
6. **Čitelnost 40+** — body font ≥ 18 px (mobil 17), tlačítka ≥ 56 px, kontrast WCAG 2.2 AA u všeho včetně muted textu a patičky. Lighthouse a11y zůstává 100.
7. **Brand brief + CLAUDE.md sekce 3** — připraven diff/PR, který reflektuje pivot. Ne mergnout bez Fakanova schválení.

## In scope

- **Landing** `fakan.cz/index.html` — celý copy redesign + úprava velikostí (písmo, tlačítka, kontrast). Layout může zůstat, pokud to bude fungovat. Hero, „Co děláme", „Jak to funguje", „Standardy", „Hosting", CTA banner — všechno projde.
- **Výsledková stránka** `fakan.cz/vysledek.html` + `vysledek.js` — copy a labely panelů, headline („Analyzuju tvůj web…" → vykání), závěrečné CTA, **přidat lead capture formulář** (e-mail + souhlas, pokud nebyl vyplněn na landingu).
- **Přehledová stránka** `fakan.cz/prehled.html` — celý copy projít na vykání, schovat technické pojmy do detailu, hero přepsat. Tahle stránka je dlouhá, ale je to klíčový sales materiál.
- **Mailové šablony**:
  - **Lead follow-up** (po free analýze) — krátký, lidský, vykání, shrnutí 3 věcí, které jsme našli + nabídka „pojďme si zavolat / pojďme to opravit". Bez tracking pixelu, plain-text alternativa.
  - **Potvrzení souhlasu / double opt-in** — pokud to bude potřeba (legal řekne). Krátký, jasný.
- **Brand brief & CLAUDE.md** — diff připravený k review. Sekce „Tón a hlas" (brand brief sekce 4), sekce 3 v CLAUDE.md. **Nemerge bez Fakana.**
- **Lead capture backend** — D1 schema `leads`, MailChannels (nebo Email Workers, viz otázka), trigger po `done` SSE eventu.

## Out of scope

- **Změna brand barev, loga, fontů.** Ivory / Midnight / Fakan Orange zůstávají. Inter / JetBrains Mono zůstávají.
- **Maskot.** Skica je v Priority 3 v README, sem nepatří.
- **Velín, plugin registry, magic link auth.** Tyhle úkoly běží mimo a v2 se jich nedotýká. Magic link mailové šablony **počkají** na implementaci magic link auth — neřešíme je teď spekulativně.
- **Tagline** — pokud Fakan rozhodne, že zůstává „Tvůj web. Bez výmluv." jako jediný tykací prvek, nepřepisujeme ho. Pokud řekne „přepsat na vykání", uděláme jednotně.
- **A/B testy, analytics, conversion tracking** — nemáme analytics infra (a nechceme cookies). Měříme z Cloudflare logů a z D1 leadů. Sofistikovaný measurement je jiný úkol.
- **Asynchronní vlna analýzy** (Lighthouse, screenshot, AI redesign) — separátní úkol v README, sem nepatří.
- **Fundamentální změna informační architektury.** Stránky zůstávají tři (index, vysledek, prehled). Nepřidáváme novou.

## Cílovka — kdo to čte

**Majitel malé firmy v ČR, věk 40–60 let.** Konkrétně:

- Má 1–15 zaměstnanců nebo dělá sám.
- Web má buď z nudné šablony před 5–10 lety, nebo mu ho dělal známý za pivo, nebo žádný nemá a živí se přes Facebook.
- Pracuje rukama, hlavou, telefonem. Není to digitální profík.
- O webu uvažuje jako o „nutném zlu", které musí mít, ale neví proč přesně.
- Naletěl agentuře nebo freelancerovi a teď je opatrný — chce slyšet **konkrétně co dostane, za kolik, do kdy**.
- Mobilem se dívá na e-maily a na Seznam. Web na mobilu si prohlíží, ale často přepne na velký monitor, když se má rozhodnout.
- Klade naivní otázky („A co když chci přidat foto?"). Tyhle otázky jsou validní a my je nesmíme odbýt.

**Co ho zajímá:** dostanu se na první stránku v Googlu, bude to fungovat na mobilu, kolik to stojí měsíčně, můžu to zrušit, je v tom někdo živý nebo jenom robot.

**Co ho NEzajímá:** že je to vanilla JS, že běží na Cloudflare, že má LCP pod 1,5 s, že tam není React.

## Constraints

**Brand & tón** (napevno, žádný kompromis):

- Vykání důsledné. „Váš web", „pošleme vám", „vyzkoušejte si".
- Krátké věty. Aktivní rod.
- Konkrétní čísla, žádné superlativy bez důkazu.
- Tagline „Tvůj web. Bez výmluv." — viz Otevřené otázky.
- **Žádné AI samochválí.** Cílovka chce slyšet, že je tam **člověk** (Fakan + tým). AI smí být nástroj, ne hrdina.
- Slovo „cookies" mizí z hero. Tam, kde zůstává (sekce o tom, co my **nemáme**), zůstává jen pokud je kontext jasný.

**Tech & ostatní** (CLAUDE.md sekce 2):

- Vanilla HTML/CSS/JS/SVG. Žádný framework.
- 0 cookies, 0 cookie banerů, 0 popupů.
- Žádné third-party fonty z CDN, žádné externí trackery.
- Mobile-first 375 × 812. Touch ≥ 44 px (a teď s 40+ pivotem ≥ 56 px na CTA).
- WCAG 2.2 AA všude, včetně muted textu.
- Auto dark/light přes `prefers-color-scheme`.
- LCP < 1,5 s, JS < 30 kB gzip.
- Cloudflare end-to-end. MailChannels nebo Email Workers, viz otázka.

**Legal** (před launchem schvaluje legal-advisor):

- Souhlas se zpracováním e-mailu pro účely zaslání nabídky musí být **jednoznačný, opt-in, nepředvyplněný**, s informací o možnosti odvolání.
- Privacy Policy musí pokrývat lead capture (jaké údaje, na jak dlouho, kdo má přístup, právo na výmaz).
- E-maily mají v patičce **opt-out odkaz**, který reálně funguje (`/odhlasit?token=…`).
- Žádný tracking pixel v e-mailu.

## Rozpočet

> **Doslova podle Fakana:** „hned, 5000 tokenů"

Co tím myslí, není jasné. Viz Otevřené otázky bod 1.

Pracovní předpoklad pro PM, dokud Fakan neujasní:
- Pokud jsou to **AI tokeny** (Anthropic Claude usage), 5 000 tokenů je extrémně málo — ne na jednu iteraci. Buď Fakan myslel **5 000 Kč**, nebo **5 mil. tokenů**, nebo úplně něco jiného.
- Finance forecast tohle musí flagnout jako blokátor.

## Termín

> **Doslova podle Fakana:** „hned"

Překlad: do konce týdne, ideálně dřív. Tahle iterace blokuje další obchod (lead capture neexistuje, takže každý den prodlení = ztracené leady).

**Pracovní termín:** 2026-05-15 (8 dní od briefu). Pokud finance/architect řeknou „nestihne se", vrací se to ke mně k řezání scope.

## Definition of Done

Iterace je hotová, když:

1. **Produkční landing** (`index.html`) má vykání, žádné z vyjmenovaných buzzwordů v hero, větší písmo a tlačítka. Lighthouse Performance ≥ 90, A11y = 100.
2. **Výsledková stránka** (`vysledek.html`) má vykání, lead capture form (e-mail + souhlas) a dotvořený CTA na konci. Submission funkčně dorazí do D1 a spustí follow-up mail.
3. **Přehledová stránka** (`prehled.html`) má vykání, hero bez technického žargonu, technické sekce zachovány hlouběji ale srozumitelnější.
4. **Lead capture backend** funguje end-to-end:
   - D1 tabulka `leads` existuje, migrace v repu.
   - Po `done` SSE eventu se lead idempotentně uloží.
   - MailChannels (nebo Email Workers) odešle follow-up.
   - Test lead z `jsem@fakan.cz` projde celým flow.
5. **Mailové šablony** (lead follow-up, případně double opt-in) jsou v repu, schválené marketerem a legal-advisorem.
6. **Brand brief + CLAUDE.md sekce 3** mají připravený PR/diff. Nemerge bez Fakana.
7. **Privacy Policy / souhlas** schválené legal-advisorem.
8. **Smoke test** — kompletní flow na produkci: landing → URL submit → výsledek → e-mail v inboxu.
9. **Retro** — finance dodá skutečný cost vs. forecast, product-manager zaznamená co fungovalo.

Schválím já. Když mi něco nesedí, vracím s konkrétním důvodem.

---

## Otevřené otázky pro Fakana — VYŘEŠENO 2026-05-08

Detail zápisu rozhodnutí v [`decisions.md`](decisions.md).

1. **Rozpočet „5000 tokenů"** → **Fakan: rozpočet řeší tým agentů.** Finance drží runtime ≈ 0 USD/měs + agent-čas 36–47 h. AI tokeny = 0 (volání zakázáno).
2. **Tagline** → **kompletní redesign copy.** Žádné lpění na „Tvůj web. Bez výmluv." Marketer navrhne nový.
3. **Brand brief / CLAUDE.md update** → **PR s diffem, Fakan review.** Default workflow.
4. **Outbound mail** → **Cloudflare Email Workers.** (Legal preferuje, Fakan potvrdil.)
5. **Znění souhlasu** → legal+marketer dodají ve Fázi 4, owner schválí v delivery.
6. **Scope mailů** → **lead followup + magic-link auth + opt-out potvrzovací + soft DOI = všechno in scope.**
7. **Slovo „cookies" v hero stats** → marketer rozhodne (vyhodit / přeformulovat).

---

## Fit check (vyplní product-manager)

<!-- Sedí to do roadmapy? Která fáze (PRD sekce 12)? Reuse: co z toho půjde použít na další zakázky? Kapacita: kolik tým-hodin / kdo? Risk: co může bouchnout? -->
