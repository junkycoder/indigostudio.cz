# AGENTS.md

Onboarding pro AI agenty (Claude Code, Codex, Cursor, Aider, …) přiřazené k projektu **fakan.cz**.

> Tohle je **30sekundový** vstupní bod. Pro detail jdi do [CLAUDE.md](CLAUDE.md) a [README.md](README.md).

---

## Dvě úrovně práce

Na repu fakan.cz pracujeme ve dvou paralelních režimech. Vyber si podle toho, co děláš:

### A) Repo task board (denní vývoj platformy)
Jdeš na úkol z [README.md](README.md) → Task board. Sem patří scaffolding, fixy, refaktor, dokumentace, brand, infrastruktura. Workflow popsaný níže.

### B) Iterace zakázky (klientský projekt nebo produktová iterace)
Spustí se triggerem **`Iteruj [název]. Brief: [zadání]`** od Fakana. Běží přes specializované role z [.claude/agents/](.claude/agents/) podle 7-fázového workflow v [CLAUDE.md sekce 6](CLAUDE.md). Detail rolí níže.

---

## A) Task board workflow — TL;DR

1. **Přečti [CLAUDE.md](CLAUDE.md)** (pravidla, brand, technologické hranice).
2. **Otevři [README.md](README.md)** sekci **Task board**.
3. **Vyber si jednu cestu:**
   - **A)** Vezmi nehotový úkol s nejvyšší prioritou, který odpovídá tvé specializaci.
   - **B)** Identifikuj vlastní úkol, který posune projekt vpřed, **přidej ho do README** a teprve pak začni.
4. **Označ úkol jako rozpracovaný** v README (`[~] (agent: kdo, co, kdy)`).
5. **Pracuj v malých commitech**, dodržuj pravidla z CLAUDE.md.
6. **Po dokončení** zaškrtni úkol (`[x]`) a napiš 1–2 věty o výsledku pod něj.

### Co znamená „odpovídá tvé specializaci"

| Profil agenta | Vhodné úkoly |
|---------------|--------------|
| **Frontend / vanilla JS** | Marketing landing, web components, brand tokens, fonty, a11y baseline, mobilní layout |
| **Cloudflare / Workers** | Free analýza, magic link auth, plugin registry, manifest engine, D1 migrace, Wrangler config |
| **DevOps / CI** | GitHub Actions, Lighthouse CI, lint setup, deployment pipeline |
| **Design / brand** | Tokens.css, dark/light paleta, maskot SVG sketch, ikon set |
| **Tech writer / docs** | Doplnění specifikací, `SECURITY.md`, `humans.txt`, dokumentace pluginů |
| **Generalista** | Cokoli z task boardu, stačí dodržet checklist hotové práce |

Pokud nejsi specialista na žádnou z těch oblastí, vezmi něco z **Priority 2 — kvalita a hygiena** nebo **Priority 3 — nice to have**.

---

## B) Tým rolí pro iterace zakázek

Definice jsou v [.claude/agents/](.claude/agents/) — Claude Code je načítá automaticky a aktivuješ je přes Task tool se `subagent_type: <name>`.

| Role | Soubor | Kdy aktivovat |
|---|---|---|
| **owner** | [.claude/agents/owner.md](.claude/agents/owner.md) | Brief, schvalování, předání |
| **product-manager** | [.claude/agents/product-manager.md](.claude/agents/product-manager.md) | Fit check, kapacita, retro, standardy |
| **project-manager** | [.claude/agents/project-manager.md](.claude/agents/project-manager.md) | Rozpad zakázky, koordinace, delivery |
| **senior-architect** | [.claude/agents/senior-architect.md](.claude/agents/senior-architect.md) | Návrh, code review, mentor pro juniora |
| **researcher** | [.claude/agents/researcher.md](.claude/agents/researcher.md) | Info, API specs, regulace, ceny |
| **junior-developer** | [.claude/agents/junior-developer.md](.claude/agents/junior-developer.md) | Atomické úkoly s acceptance criteria |
| **tester** | [.claude/agents/tester.md](.claude/agents/tester.md) | Acceptance check, edge cases, bug reporty |
| **marketer** | [.claude/agents/marketer.md](.claude/agents/marketer.md) | Positioning, copy, landing, launch plán |
| **legal-advisor** | [.claude/agents/legal-advisor.md](.claude/agents/legal-advisor.md) | GDPR, cookies, ToS/Privacy, risk check |
| **finance** | [.claude/agents/finance.md](.claude/agents/finance.md) | Cost forecast, token tracking, retro |

**Trigger iterace:** `Iteruj [název projektu]. Brief: [zadání]` nebo `Pokračuj v iteraci [název]`. Plný flow v [CLAUDE.md sekce 6](CLAUDE.md).

**Tvrdé hranice rolí:**
- junior-developer nesahá na architekturu bez senior-architect
- tester nepíše kód, jen testuje
- owner nediskutuje implementaci, jen výsledek
- researcher nedělá rozhodnutí, jen podklady
- legal-advisor negarantuje „100 % v pořádku" — vážnější věci eskaluje na živého advokáta
- finance vždy ověřuje aktuální ceník (Anthropic, Cloudflare, Resend mění ceny)

## Když si bereš úkol

1. **Edituj README.md** přímo: změň `[ ]` na `[~]` a přidej do závorky `(agent: <jméno modelu>, <co děláš>, <datum>)`.
2. **Commit ten edit jako první** (`docs(tasks): rezervace úkolu X`), ať ostatní agenti vidí, že na tom pracuješ.
3. Až teprve potom začni samotnou práci.

Příklad:

```diff
-- [ ] **Marketing landing — produkční verze.** Vyjít z …
++ [~] **Marketing landing — produkční verze.** _Agent: Claude Sonnet 4.6, scaffolding HTML + tokens.css, 2026-05-06._ Vyjít z …
```

## Když přidáváš vlastní úkol

Formát stejný jako existující úkoly:

```markdown
- [ ] **Krátký výstižný titulek.** Detail co a proč. _Reference:_ odkaz do PRD / brand briefu / plugin spec, pokud je relevantní. _Acceptance:_ jak poznám, že je hotovo.
```

Zařaď ho do správné priority (`P0` blokátor, `P1` Fáze 0 deliverable, `P2` kvalita, `P3` nice-to-have). Pokud nevíš — dej do P2 a v popisu zmiň „priorita: open".

## Když narazíš na blokátor

1. Označ úkol `[!] (blokátor: stručný popis)`.
2. Přidej úkol do **Otevřené otázky pro Fakana** v README, pokud potřebuje odpověď od člověka.
3. Vezmi jiný úkol a pokračuj.

**Nikdy** se nezasekni hodinu na čekání. Cílem je pohyb.

## Když potřebuješ udělat něco mimo task board

OK, ale:

- **Drobnosti** (překlepy, formátování, broken links v dokumentaci) — jen oprav, commit s `chore:` prefixem, do README to nepiš.
- **Větší věc, kterou další agenti budou chtít vědět** — přidej ji do README jako úkol a označ rovnou jako `[x]`, ať máme audit.

## Co NIKDY nedělej bez explicitního pokynu od Fakana

- ❌ Měnit `fakan-cz-prd.md`, `fakan-cz-brand-brief.md`, `fakan-cz-plugin-spec.md`.
- ❌ Přidat React / Vue / Next / jakýkoli framework.
- ❌ Načíst Google Fonts, Google Analytics, Meta Pixel, Hotjar, jakýkoli third-party tracker.
- ❌ Nasadit cookie banner. Vůbec.
- ❌ Push do `main` bez review (pokud Fakan neřekl jinak).
- ❌ `git push --force` na sdílené větve.
- ❌ Mazat `fakan-nabidka/` nebo `fakan.cz/` bez rezervovaného úkolu v README.

## Co dělej autonomně

- ✅ Commituj malé, logicky uzavřené kroky.
- ✅ Refaktoruj v rámci úkolu, který si vzal.
- ✅ Doplňuj komentáře a doc-stringy tam, kde to dává smysl (ale ne tam, kde kód mluví sám za sebe).
- ✅ Spouštěj lokální dev server a ověřuj výstup v prohlížeči.
- ✅ Aktualizuj README task board ihned, jak se status mění.

---

## Paralelizace

Pokud běží víc agentů současně:

- **Vyber si různé úkoly.** README task board je sdílená pravdivá tabule.
- **Pokud se úkoly dotýkají stejných souborů** — koordinujte přes README popisy nebo počkej, až druhý dokončí.
- **Při konfliktu v gitu** vyřeš ho ručně, ne `--force`. Když je konflikt netriviální, zastav se a popiš situaci v komentáři pod úkolem.

## Jak hlásit, co jsi udělal

V commit message stačí klasický conventional commit:

```
feat(landing): hero sekce + URL input
fix(velin): magic link redirect po expiraci
docs(agents): doplněna sekce o paralelizaci
```

V README pod dokončený úkol:

```markdown
- [x] **Marketing landing — produkční verze.** _Agent: Claude Sonnet 4.6, 2026-05-06._
  Postaven nový landing v `apps/web/index.html`. Lighthouse Perf 98, A11y 100. Inter + JetBrains Mono self-host, tokens.css. Deploy přes Wrangler na preview URL — viz commit `abc1234`.
```

To stačí. Žádné dlouhé zápisy.

---

## Když nevíš

- **Specifikace** → [fakan-cz-prd.md](fakan-cz-prd.md) (sekce v obsahu).
- **Brand** → [fakan-cz-brand-brief.md](fakan-cz-brand-brief.md).
- **Plugin systém** → [fakan-cz-plugin-spec.md](fakan-cz-plugin-spec.md).
- **Pravidla pro agenty + iterace** → [CLAUDE.md](CLAUDE.md).
- **Definice rolí** → [.claude/agents/](.claude/agents/).
- **Status úkolů** → [README.md](README.md) task board.
- **Pokud to fakt nikde není** → přidej do **Otevřené otázky pro Fakana** v README a vezmi jiný úkol.

---

*Tahle stránka je krátká schválně. Nepřidávej sem věci, co patří do CLAUDE.md nebo README.md.*
