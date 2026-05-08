# `docs/` — sdílená dokumentace napříč projekty

Tady je obsah, který přežívá konkrétní iteraci a slouží celé platformě.

| Adresář | Obsah | Kdo plní |
|---|---|---|
| [`architecture/`](architecture/) | Architektonické přehledy modulů, ne specifické pro jednu iteraci. | senior-architect |
| [`adr/`](adr/) | Architecture Decision Records. ADR-NNN-<téma>.md, číslováno sekvenčně. | senior-architect |
| [`testing/`](testing/) | Test reporty per task ID. Bug reporty. | tester |
| [`research/`](research/) | Rešerše: API specs, ceny, regulace, alternativy. Datované, s URL. | researcher |

## Konvence

- **Soubory v `architecture/`:** `<modul>.md` (`forms.md`, `auth.md`, `velin.md`).
- **Soubory v `adr/`:** `ADR-001-d1-vs-kv-session.md`. Číslování sekvenční napříč celým projektem, ne per modul.
- **Soubory v `testing/`:** `<task-id>.md` (`CONTACT-02.md`). Bugy buď append do test reportu, nebo `bugs/<task-id>-<bug>.md`.
- **Soubory v `research/`:** `YYYY-MM-DD-<téma>.md` (`2026-05-08-resend-pricing.md`). Datum prefix kvůli expiraci.

## Co sem NEPATŘÍ

- ❌ Iterace zakázek — to je v [`projects/<slug>/`](../projects/).
- ❌ Strategické dokumenty PRD / brand brief / plugin spec — ty zůstávají v rootu repa, jsou Fakanovy.
- ❌ Kód, šablony, konfigy — patří do `src/`, `fakan.cz/`, `migrations/`, `wrangler.toml`.
