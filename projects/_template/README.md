# Šablona iterace zakázky

Kostra adresáře pro novou iteraci. Když spustíš `/iterace <slug>`, orchestrátor zkopíruje obsah `_template/` do `projects/<slug>/` a začne plnit.

## Soubory

| Soubor | Kdo plní | Kdy |
|---|---|---|
| `brief.md` | owner | Fáze 1 |
| `risk-check.md` | legal-advisor | Fáze 1 + pre-launch v Fázi 4 |
| `forecast.md` | finance | Fáze 1 + průběžně + retro |
| `fit-check.md` | product-manager | Fáze 2 |
| `design.md` | senior-architect | Fáze 2 |
| `tasks.md` | project-manager | Fáze 2 (s konzistenčním gate na konci) |
| `decisions.md` | project-manager | Kdykoliv proběhne tie-breaker |
| `changes.md` | project-manager | Když owner mění scope |
| `copy.md` | marketer | Fáze 4 |
| `launch-plan.md` | marketer | Fáze 4 (volitelně) |
| `delivery.md` | project-manager | Fáze 5 |
| `approvals.md` | owner | Fáze 5 |
| `retro.md` | product-manager | Fáze 6 |
| `status.md` | project-manager | Průběžně, kdykoliv si někdo řekne |

**Ne každá iterace potřebuje všechno.** Mini-úkol může mít jen `brief.md` + `tasks.md` + `delivery.md`. Velká zakázka má kompletní set.

## Konvence

- **Datum:** ISO `2026-05-08` v technickém kontextu, „8. května 2026" v textu pro člověka.
- **Časové razítka v zápisech:** vždy datum, ne „dnes" nebo „včera".
- **Slug projektu:** kebab-case, krátký, výstižný — `kontaktni-formular`, `velin-mvp`, `audit-noveklienty-cz`.
