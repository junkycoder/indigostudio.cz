# Brand pivot diff — DRAFT pro Fakanovo schválení

**Datum:** 2026-05-08
**Stav:** NESCHVÁLENO, čeká na Fakanův pokyn k merge.
**Důvod:** iterace `landing-v2` pivotovala tón na **vykání + cílovka 40+** (Fakanovo zadání 2026-05-07, schváleno ownerem 2026-05-08 v `approvals.md`). Strategické dokumenty (`CLAUDE.md` sekce 3, `fakan-cz-brand-brief.md` sekce 3) zatím říkají „tykání". Pro konzistenci je třeba aktualizovat.

**Pozn. k zadání:** orchestrátorský prompt referuje sekci 4 brand briefu („tón a hlas"). V brandovém dokumentu je ale tón **sekce 3**, sekce 4 je „Persona". Diff níže pokrývá obě — primárně sekci 3 (tón), sekundárně sekci 4 (persona — drobné konzistenční úpravy v Persona 4.2 ohledně srozumitelnosti pro 40+).

**Aplikace:** Fakan rozhodne — buď ručně přepíše soubory podle diffu, nebo schválí a agent v navazující iteraci provede edit. **Bez Fakanova pokynu se to nemerguje** (CLAUDE.md sekce 7.4 zakazuje editovat strategické dokumenty).

---

## 1. CLAUDE.md sekce 3 — diff návrh

**Soubor:** `CLAUDE.md`, řádky 51–93.

### Současné znění (verbatim)

```markdown
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
```

### Návrh nového znění

```markdown
## 3. Brand — jak Fakan mluví

Detail v [fakan-cz-brand-brief.md](fakan-cz-brand-brief.md). Kompaktní výtah:

**Tón:**

- **Vyká.** „Váš web", ne „tvůj web". Default napříč UI a maily. Cílovka 40+ tykání nemá ráda; tyká si jen okruh tech-savvy 30letých, který není naše primární publikum.
- **Krátké věty.** Jedna myšlenka = jedna věta.
- **Aktivní rod.** „Opravíme to", ne „bude to opraveno".
- **Konkrétní čísla** všude, kde se dají měřit. „Web do 1,5 vteřiny", ne „rychlejší". Technický žargon (LCP, WCAG, hydration) jen tam, kde čtenář očekává — ne v hero, ne v CTA.
- **Sebekritika OK.** „Naši AI agenti někdy udělají blbost. Když to uvidíte, řekněte nám."
- **Ironie lehká, ne kousavá.**

**Co NE:**

- ❌ Korporátní žargon (leverage, synergie, ekosystém, omnichannel).
- ❌ Falešná intimita („milý zákazníku, jsme tu pro vás").
- ❌ Marketingové superlativy bez důkazu.
- ❌ Anglicismy z lenosti (endorsement, brand awareness).
- ❌ Falešná urgentnost („už jen 2 hodiny!").
- ❌ **Tykání mimo schválený tagline.** Vykání platí napříč UI, mailovými šablonami, error stavy, success stavy, onboarding texty. Jediná výjimka je tagline (viz níže).

**Tagline:**

- Schválená varianta: **„Váš web. Bez starostí."** (Fakanovo zadání 2026-05-07, owner approval 2026-05-08.)
- Původní „Tvůj web. Bez výmluv." se nepoužívá v nové komunikaci.

**Mikro-pravidla:**

- Sentence case v UI titulech, ne Title Case. „Vaše weby", ne „Vaše Weby".
- Číslovky od 10 výš číslicemi.
- Datum: „6. května 2026" (česky), v technickém UI ISO `2026-05-06`.
- Čas 24h: „14:30".
- Měna s mezerou: „99 Kč", ne „99Kč".
- **Vykání i v UI mikrocopy** — tlačítka, error hlášky, success states, placeholdery, ARIA labels. „Zadejte e-mail", ne „Zadej e-mail".
```

### Hlavní změny — shrnutí

1. „Tyká." → „Vyká." s odůvodněním (cílovka 40+).
2. „„Tvůj web"" → „„Váš web"" napříč příklady.
3. Přidán bod do „Co NE": „Tykání mimo schválený tagline."
4. Nová pod-sekce **Tagline** s explicitní variantou „Váš web. Bez starostí."
5. Přidán mikro-pravidlový bod o vykání i v UI mikrocopy.
6. Příklad u „Konkrétních čísel" změněn z technického („LCP 0,9 s") na lidský („Web do 1,5 vteřiny") — reflektuje cílovku 40+.

**Update 2026-05-08:** Owner přidal brand claim **„Když web, jedině od Fakana."** jako doplňkovou mantru k taglinu. Při finální merge do brand briefu sekce 5.1 (Tagline / Claim) doplnit oba prvky:
- Tagline: „Váš web. Bez starostí." (varianta A)
- Brand claim: „Když web, jedině od Fakana."

Brand brief sekce 5.1 dnes nezná „claim" jako kategorii, doporučuju ji zavést.

---

## 2. fakan-cz-brand-brief.md sekce 3 — diff návrh

**Soubor:** `fakan-cz-brand-brief.md`, řádky 43–73 (sekce 3 „Tón", pod-sekce 3.1, 3.2, 3.3).

**Pozn.:** orchestrátor referuje „sekci 4", ale sekce 4 v brand briefu je „Persona". Sémanticky relevantní pro pivot tónu je **sekce 3**. Diff níže pokrývá sekci 3 (primárně) a sekci 4.2 (drobná konzistenční úprava v Personě).

### 2.1 Sekce 3.1 — současné znění (verbatim)

```markdown
### 3.1 Jak fakan.cz mluví

- **Tyká** — „tvůj web" ne „váš web". Default napříč UI a maily.
- **Výjimka — formální tón** — fáze 8 zavádí přepínač na vykání pro pluginy, které generují **texty pro koncové klienty** v konzervativních oborech (advokáti, notáři, lékaři, pohřební služby). Přepínač je na úrovni pluginu / vertikálního balíčku, ne na úrovni Velínu — interní komunikace s majitelem webu zůstává tykací.
- **Krátké věty.** Jedna myšlenka = jedna věta. Žádné podřadicí spojky-souvětí na 3 řádky.
- **Aktivní rod.** „Opravíme to" ne „bude to opraveno".
- **Konkrétní čísla** všude, kde se dají měřit. Adjektiva jsou poslední možnost.
- **Sebekritika** povolena. „Naši AI agenti někdy udělají blbost. Když to uvidíš, řekni nám."
- **Ironie** lehká, ne kousavá. Zdravá nadhled, ne arogance.
- **Český jazyk** moderní. Žádný „pánové, dovolujeme si Vám oznámit". Ale ani „čauves frajeři".
```

### 2.1 Návrh nového znění

```markdown
### 3.1 Jak fakan.cz mluví

- **Vyká** — „váš web" ne „tvůj web". Default napříč UI a maily. Důvod: cílovka 40+ (zkušení živnostníci, malé s.r.o., řemeslníci, regiony). Tykání zní této cílovce neformálně až podezřele („nikdo si se mnou ještě dnes netykal, proč to dělá tahle firma?").
- **Výjimka — schválený tagline** — „Váš web. Bez starostí." (varianta A, Fakanovo zadání 2026-05-07). Žádný tag/výjimka pro tykání jinde.
- **Výjimka — pluginy pro koncové klienty** — fáze 8 nadále zavádí přepínač tónu pro pluginy generující **texty pro koncové klienty** v konzervativních oborech (advokáti, notáři, lékaři, pohřební služby). Tato výjimka jde dál nad rámec „vykání default" — tedy z formality „neutrální vykání" na „extra formální „dovolujeme si Vás informovat"". Přepínač zůstává na úrovni pluginu, ne Velínu.
- **Krátké věty.** Jedna myšlenka = jedna věta. Žádné podřadicí spojky-souvětí na 3 řádky. (Cílovka 40+ má často horší tolerantnost vůči dlouhým větám na mobilu — krátké věty jsou pro ně i přístupnostní benefit.)
- **Aktivní rod.** „Opravíme to" ne „bude to opraveno".
- **Konkrétní čísla** všude, kde se dají měřit. Adjektiva jsou poslední možnost. **Technický žargon (LCP, WCAG, hydration, CDN) zachováme pro vývojářské sekce, ale schováme z hera, CTA a marketingových textů.** „Web do 1,5 vteřiny" místo „LCP 0,9 s".
- **Sebekritika** povolena. „Naši AI agenti někdy udělají blbost. Když to uvidíte, řekněte nám."
- **Ironie** lehká, ne kousavá. Zdravá nadhled, ne arogance. **U cílovky 40+ střídmější než původní brand zamýšlel** — ironie funguje, ale jen tam, kde je čtenář v pohodě (např. patička, About). V hero / CTA / lead capture text zní spíš věcně.
- **Český jazyk** moderní. Žádný „pánové, dovolujeme si Vám oznámit". Ale ani „čauves frajeři". **Vykání ≠ kancelářština** — drží se moderní spisovná čeština („Máme to. Díky.", ne „Děkujeme za zájem o naše služby.").
```

### 2.2 Sekce 3.3 — mikro-pravidla, doplněk

**Pod existující seznam přidat:**

```markdown
- **Vykání i v UI mikrocopy** — tlačítka, error stavy, success stavy, placeholdery, ARIA labels, push notifikace, mailové předměty. „Zadejte e-mail", ne „Zadej e-mail". Vykání je default tón.
- **Velikosti pro 40+** — body font 18 px (mobil 17), CTA min-height 56 px, kontrast WCAG 2.2 AA u muted textu (nikdy ne AA Large). Tohle není volitelné.
```

### 2.3 Sekce 4.2 — Persona vlastnosti, drobná úprava

**Soubor:** `fakan-cz-brand-brief.md`, řádky 84–89.

**Současné znění:**

```markdown
- **Srozumitelný.** Tetě by vysvětlil, co je doména, bez toho aby zněl jako kniha.
- **Pragmatický.** „Fungují tři varianty: levná, střední, drahá. Pro tvoji pizzerii by stačila ta střední."
- **Nadhled.** Když něco nejde, řekne to a navrhne alternativu.
- **Stojí si za prací.** „Kdyby to nefungovalo, vrátíme peníze. Ne za hodinu, ale do 24 hodin."
```

**Návrh:**

```markdown
- **Srozumitelný.** Tetě by vysvětlil, co je doména, bez toho aby zněl jako kniha. (Cílovka 40+ — vysvětluje technické věci tak, jako by je říkal kámošovi v hospodě, ne juniorovi na code review.)
- **Pragmatický.** „Fungují tři varianty: levná, střední, drahá. Pro vaši pizzerii by stačila ta střední."
- **Nadhled.** Když něco nejde, řekne to a navrhne alternativu.
- **Stojí si za prací.** „Kdyby to nefungovalo, vrátíme peníze. Ne za hodinu, ale do 24 hodin."
```

(Změna: „pro tvoji pizzerii" → „pro vaši pizzerii" — konzistence s vykáním.)

---

## 3. Co tento diff NEDĚLÁ

- **Nemění brand barvy** (Ivory / Midnight / Fakan Orange) — beze změny.
- **Nemění logo / maskot / vizuální direction** — sekce 5 brand briefu zůstává.
- **Nemění technický stack** ani standardy výstupu (CLAUDE.md sekce 2 a 6).
- **Nemerguje se sám** — Fakan rozhodne, kdy a jak aplikovat.

---

## 4. Aplikace po schválení

Pokud Fakan schválí, agent v navazující iteraci:

1. Přepíše `CLAUDE.md` sekci 3 podle § 1 výše.
2. Přepíše `fakan-cz-brand-brief.md` sekci 3.1, 3.3, 4.2 podle § 2 výše.
3. Verzuje brand brief: `v0.2` → `v0.3` (vykání + cílovka 40+).
4. Zaznamená v `projects/<další-iterace>/decisions.md` jako `[2026-MM-DD] [brand] pivot tykání → vykání: aplikováno per Fakanovým schválením brand-pivot-pr.md`.

Pokud Fakan vrátí, agent v další iteraci přepracuje podle feedbacku.
