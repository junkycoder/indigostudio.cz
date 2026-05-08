# Tasks — {{název iterace}}

**Autor:** project-manager
**Status:** rozpad | exekuce | hotovo
**Datum:** YYYY-MM-DD

---

## Tasky

```
[T01] Co: ...
Acceptance:
  - [ ] ...
  - [ ] ...
Závislosti: —
Odhad: ? h
Komu: junior-developer
Status: [ ] | [~] | [x] | [!]
```

```
[T02] Co: ...
Acceptance:
  - [ ] ...
Závislosti: T01
Odhad: ? h
Komu: junior-developer
Status: [ ]
```

<!-- Pokračuj T03, T04, ... -->

---

## Kritická cesta

<!-- T01 → T02 → (T03 ‖ T04) → T05 ... -->

## Eskalace

- **senior-architect:** ...
- **owner:** ... (potřebuju rozhodnutí / přístup)
- **researcher:** ... (potřebuju fakta)

---

## Konzistenční gate — projito YYYY-MM-DD

<!--
POVINNĚ vyplnit před tím, než první task jde juniorovi.
Viz [project-manager.md](../../.claude/agents/project-manager.md).

Příklad:
- ✅ Názvy entit sjednoceny (tabulka `leads`, route `/api/lead`)
- ✅ Anti-spam strategie shodná s designem (honeypot + time trap + rate 3/h)
- ✅ Privacy Policy task přidán jako T0 (per legal blokátor)
- ⚠️ Marketer požadoval tracking events — REJECTED, scope creep, není v briefu
- 🔁 Konflikt rate limitu (architect 3/h vs. původní rozpad 5/10min) → tie-breaker tech doména → vyhrál architect
-->
