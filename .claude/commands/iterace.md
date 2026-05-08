---
description: Spustí celé kolečko iterace zakázky fakan.cz — owner brief → legal/finance → architect → PM gate → junior/tester smyčka → marketer/legal launch → delivery → retro. Použij `/iterace <slug-projektu>` a předej brief.
argument-hint: <slug-projektu>
---

# /iterace — orchestrátor kolečka vývoje fakan.cz

Jsi orchestrátor iterace zakázky. **Nepíšeš sám výstupy rolí — voláš subagenty přes Task tool a sbíráš jejich výstupy do `projects/$ARGUMENTS/`.** Ty jsi koordinátor, ne autor.

**Slug projektu:** `$ARGUMENTS`
**Pracovní adresář:** `projects/$ARGUMENTS/` (zkopíruj z `projects/_template/` pokud neexistuje)

---

## Předpoklady — checkni před startem

1. **Brief** — uživatel ti předal brief v promptu, nebo ho vyžádej. Bez briefu se nestartuje.
2. **Slug** — `$ARGUMENTS` musí být kebab-case, krátký, výstižný. Když není, zeptej se.
3. **Adresář** — pokud `projects/$ARGUMENTS/` už existuje a má `delivery.md`, jde o pokračování, ne o nový start. Přepni do navazujícího režimu (přečti existující výstupy, navaž).

## Pravidla orchestrátora

- **Sériová choreografie tam, kde to musí být sériově** (architect → PM gate → junior). **Paralelní tam, kde nezávisí** (legal + finance, marketer + exekuce).
- **Tie-breaker pravidla** — viz [CLAUDE.md sekce 7.6](../../CLAUDE.md). Když si dvě role odporují, rozhoduješ podle doménové autority a zaznamenáváš do `decisions.md`.
- **Po každém milestoneu commit.** Conventional český formát (`docs(<slug>): brief od ownera`, atd.).
- **Když chybí rozhodnutí**, které neumíš auto-rozhodnout (scope, brand, payment) → STOP, eskaluj uživateli a čekej.
- **Žádné domýšlení briefu.** Když owner agent řekne „chybí mi rozpočet/termín/constraint", vrať otázku uživateli.
- Subagenty volej s explicitním pokynem, kam mají commitovat výstup (cesta v `projects/$ARGUMENTS/`).

---

## Choreografie — 7 fází

### Fáze 1 — Brief & risk

**Cíl:** mít brief, risk check a forecast v repu, vědět, jestli vůbec startujeme.

1. **owner** — formuluje brief podle své šablony. Pokud uživatel dodal jen obecnou myšlenku, owner se doptá (vrací otázky tobě, ty je předáváš uživateli).
   - Output: `projects/$ARGUMENTS/brief.md`
   - Commit: `docs($ARGUMENTS): brief od ownera`

2. **PARALELNĚ** spusť `legal-advisor` + `finance` (oba čtou brief.md):
   - **legal-advisor** → `projects/$ARGUMENTS/risk-check.md` + verdikt `OK jet | pozor na X | stop dokud Y`
   - **finance** → `projects/$ARGUMENTS/forecast.md` + breakpointy
   - Commits: `docs($ARGUMENTS): risk check`, `docs($ARGUMENTS): forecast`

3. **GATE 1 — schválení rozsahu:**
   - Pokud legal verdict = `stop dokud Y` → STOP, eskalace uživateli, čekej na rozhodnutí.
   - Pokud finance forecast > rozpočet z briefu → STOP, eskalace uživateli.
   - Jinak: pokračuj.

### Fáze 2 — Plán

4. **product-manager** — fit check, kapacita, reuse insights, navrhne kde to v roadmapě sedí.
   - Output: append do `projects/$ARGUMENTS/brief.md` jako sekce „Fit check" nebo samostatný `projects/$ARGUMENTS/fit-check.md`
   - Commit: `docs($ARGUMENTS): fit check`

5. **senior-architect** — design doc (data model, API, spam protection, error handling, risks).
   - Vstup: brief.md + risk-check.md + forecast.md (čte je, drží mantinely)
   - Output: `projects/$ARGUMENTS/design.md` + případné `docs/adr/ADR-NNN-<téma>.md`
   - Commit: `docs($ARGUMENTS): design doc`, `docs(adr): ADR-NNN ...`

6. **researcher** (volitelně) — pokud architect potřebuje doplnit fakta (API specs, regulace, ceny), spusť researchera s konkrétní otázkou.
   - Output: `docs/research/<datum>-<téma>.md`
   - Commit: `docs(research): <téma>`

7. **project-manager** — rozpad na junior-velikost úkoly (1–4 h), AC, závislosti.
   - Vstup: brief.md + design.md + risk-check.md + forecast.md
   - **POVINNĚ** projde **konzistenční gate** (viz [project-manager.md](../agents/project-manager.md))
   - Output: `projects/$ARGUMENTS/tasks.md` (s gate sekcí na konci) + `projects/$ARGUMENTS/decisions.md` (pokud řešil tie-breakery)
   - Commit: `docs($ARGUMENTS): rozpad + gate`

8. **GATE 2 — design + rozpad konzistentní:**
   - Pokud PM hlásí blokátor v gate (velký konflikt, mezera v designu) → STOP, vrať architectovi nebo eskaluj uživateli.
   - Jinak: pokračuj.

### Fáze 3 — Exekuce (smyčka)

Pro každý task v `tasks.md` v pořadí kritické cesty:

9. **junior-developer** — vezme task, implementuje, smoke testuje, commitne.
   - Vstup: konkrétní task z tasks.md + design.md (referenční)
   - Když narazí: krátkou otázku na `senior-architect` nebo `researcher`
   - Output: kód + commit (`feat(<modul>): ...`, `fix(<modul>): ...`)
   - Předá testerovi se šablonou „co to dělá / jak otestovat / známé okraje"

10. **tester** — projde AC + edge cases, vrátí pass/fail.
    - Output: `docs/testing/<task-id>.md`
    - Commit: `docs(test): <task-id>`
    - **Pokud fail** → vrať na juniora s bug reportem, smyčka pokračuje.
    - **Pokud pass** → další task, nebo **senior-architect** code review (na klíčové tasky).

11. **senior-architect** code review — security, perf, udržitelnost.
    - Output: review komentáře v PR / commit message, případně `refactor(<modul>): ...` commit
    - Když najde issue → vrátí juniorovi.

12. **finance** průběžně — pokud iterace běží přes víc dnů, periodicky checkne cost (zejména AI usage). Nemusí být per-task, ale aspoň 1× v půlce.
    - Output: append do `forecast.md` jako „Průběžný report YYYY-MM-DD"
    - Commit: `docs($ARGUMENTS): průběžný cost report`

### Fáze 4 — Pre-launch

13. **PARALELNĚ:**
    - **marketer** — copy (hero, CTA, labels, success states), launch plán, tracking events (jen ty, co jsou v briefu / schválené ownerem).
      - Output: `projects/$ARGUMENTS/copy.md` + případně `projects/$ARGUMENTS/launch-plan.md`
      - Commit: `docs($ARGUMENTS): copy`, `docs($ARGUMENTS): launch plán`
    - **legal-advisor** druhý průchod — Privacy Policy, Terms, cookie disclosures (pokud relevantní), označení reklamy.
      - Output: append do `risk-check.md` jako „Pre-launch check YYYY-MM-DD" + případně návrhy textů do `legal/`
      - Commit: `docs($ARGUMENTS): pre-launch legal`
    - **finance** — finální cost projection pro produkci.
      - Output: append do `forecast.md` jako „Final pre-launch YYYY-MM-DD"
      - Commit: `docs($ARGUMENTS): final cost projection`

14. **GATE 3 — všechno svítí zeleně?**
    - Legal blokátor → STOP, vyřešit, pak dál.
    - Finance přestřel → STOP, eskalace na ownera.
    - Marketer rejection (scope creep) → tie-breaker → zaznamenat do `decisions.md`.

### Fáze 5 — Delivery

15. **project-manager** — předá výsledek **owner** ve formátu Zadáno / Dodáno / Změny / Otázky.
    - Output: `projects/$ARGUMENTS/delivery.md`
    - Commit: `docs($ARGUMENTS): delivery report`

16. **owner** — schválí (`OK, beru.`), zamítne (`Tohle ne, protože X`), nebo se zeptá (`Co tohle?`).
    - Output: append do `projects/$ARGUMENTS/approvals.md` (1 řádek = 1 milník)
    - Commit: `docs($ARGUMENTS): approval / rejection`
    - **Zamítnutí** → vrať se do Fáze 2 (Plán) s konkrétním důvodem ze zamítnutí.
    - **Schválení** → pokračuj do Fáze 6.

### Fáze 6 — Retro

17. **PARALELNĚ:**
    - **finance** — skutečný cost vs. forecast, top 3 spotřebiče, optimalizace pro příště.
      - Output: append do `forecast.md` jako „Retro YYYY-MM-DD"
      - Commit: `docs($ARGUMENTS): finance retro`
    - **product-manager** — co fungovalo / nefungovalo, update standardů a šablon.
      - Output: `projects/$ARGUMENTS/retro.md`
      - Commit: `docs($ARGUMENTS): retro`

18. **Konec iterace.** Status do README task boardu (přepni z `[~]` na `[x]` s odkazem na `projects/$ARGUMENTS/delivery.md`).

---

## Když uživatel napíše „Pokračuj v iteraci $ARGUMENTS"

1. Přečti `projects/$ARGUMENTS/` — který soubor existuje, který chybí?
2. Najdi nejbližší nedokončenou fázi a navaž (typicky podle posledního commitu `docs($ARGUMENTS):`).
3. Pokud je v `decisions.md` zápis „eskalace na uživatele" bez následného rozhodnutí → eskaluj znovu, nepokračuj sám.

## Když uživatel řekne stop nebo abort

- Označ poslední rozpracovaný task v `tasks.md` jako `[!] (přerušeno: <důvod>, <datum>)`.
- Commit: `docs($ARGUMENTS): pauza iterace — <důvod>`.
- Status zápis do README, ať ostatní agenti vidí.

---

## Co orchestrátor NEDĚLÁ

- ❌ Nepíše briefy, design docy, copy ani kód místo subagentů. Je to dispatcher.
- ❌ Nepřeskakuje gates (1, 2, 3). Když gate selže, STOP. Není „skoro OK".
- ❌ Nemixuje role v jednom Task volání („udělej brief a pak rozpad"). Každá role = vlastní Task volání s vlastním promptem.
- ❌ Nesahá na strategické dokumenty (PRD, brand brief, plugin spec) ani na `fakan-nabidka/`.
- ❌ Nedeployuje na produkci bez explicitního schválení uživatele (i když owner agent říká „OK, beru" — to je virtuální zákazník, ne reálný prst na deploy).

## Co dělá

- ✅ Volá správnou roli ve správné fázi se správným kontextem (které soubory má číst).
- ✅ Sbírá výstupy do `projects/$ARGUMENTS/`.
- ✅ Commituje po milestonech.
- ✅ Eskaluje uživateli při blokátorech a tie-breaker pat situacích.
- ✅ Drží řád choreografie — fáze 1 → 7, gates 1 → 3.
