# Decisions log — landing-v2

Záznam rozhodnutí z konzistenčního gate a tie-breakerů (viz [CLAUDE.md sekce 7.6](../../CLAUDE.md)).

Formát: **`[YYYY-MM-DD] [doména] konflikt: A vs. B → vyhrál: X. Důvod: Y.`**

---

## Rozhodnutí

### Gate 1 — eskalace na Fakana, odpověď 2026-05-08

- **[2026-05-08] [budget] Rozpočet „5000 tokenů" nejasný → vyřešeno: Fakan deleguje rozpočet na tým agentů.** Důvod: „zakázku řeší tým agentů". Aplikace: finance drží runtime ≈ 0 USD/měsíc + agent-čas v rámci 36–47 h kapacity. AI API volání zakázáno (viz níže), takže AI tokeny nula. Pokud forecast přeteče, eskalace zpět.
- **[2026-05-08] [brand] Tagline „Tvůj web. Bez výmluv." vs. nová verze → vyhrál: kompletní redesign copy.** Důvod: „Copy bych předělal kompletně" — marketer dostává volnou ruku, žádné lpění na původním taglinu. Aplikace: marketer ve Fázi 4 navrhne nový tagline s vykáním, hero copy, mailové podpisy. PRD a brand brief dostanou diff jako PR po skončení iterace.
- **[2026-05-08] [tech/compliance] Outbound mail — MailChannels vs. Cloudflare Email Workers → vyhrál: Email Workers.** Důvod: legal preferuje (1 procesor místo 2 → menší DPA povrch), Fakan potvrdil. Aplikace: architect navrhne lead capture s Cloudflare Email Workers outbound, ne MailChannels.
- **[2026-05-08] [scope] Mailové šablony do v2 → vyhrály všechny tři: lead followup + magic-link auth maily + opt-out potvrzovací + soft DOI mail.** Důvod: Fakan „ano, ano, ano" na všechny tři dotázané kategorie. Aplikace: architect a marketer počítají s rozšířeným mail scope. Magic-link auth maily v scope, i když auth flow ještě není implementovaný — připravíme šablony „na sklad", aby byly hotové, až auth dorazí.
- **[2026-05-08] [budget/scope] AI API volání během iterace → ne.** Důvod: „API volání ne" — Fakan vyloučil placené Claude API volání pro copy generování / review. Aplikace: marketer píše copy ručně (přes běžný Claude Code workflow agent-mode, ne přes API), žádné runtime AI volání ve workeru, finance počítá AI náklady = 0.

### Auto-rozhodnuto orchestrátorem (Fakan to neeskaloval, default platí)

- **[2026-05-08] [proces] Update brand briefu / CLAUDE.md → PR s diffem, Fakan review.** Důvod: CLAUDE.md sekce 7.4 zakazuje editovat strategické dokumenty bez pokynu. Default workflow je PR + review. Aplikace: po skončení iterace junior připraví samostatný PR s diffem brand briefu (sekce 4 „Tón a hlas") a CLAUDE.md (sekce 3) reflektující vykání + cílovku 40+. Fakan merguje sám.
- **[2026-05-08] [compliance/copy] Znění souhlasu → finální verze připraví legal+marketer ve Fázi 4.** Důvod: legal má doménovou autoritu nad compliance, marketer nad textem. Aplikace: legal dodá GDPR-validní wording (separátní neforčekovaný checkbox, odkaz na Privacy Policy v textu, „nezávazná nabídka" jasně vyznačena), marketer ho učeše do tónu vykání + 40+. Owner schválí jako součást delivery.
- **[2026-05-08] [copy] Slovo „cookies" v hero stats → vyhodit, marketer rozhoduje.** Důvod: marketer doménová autorita nad copy + Fakan řekl „kompletní redesign copy". Aplikace: marketer při návrhu hero stats nahradí cookies-stat něčím srozumitelnějším pro 40+ („žádné okénko se souhlasem", „web bez špehování" apod.).

### Auto-rozhodnuto orchestrátorem (legal autorita nad compliance)

- **[2026-05-08] [compliance] D1 schema `leads` rozsah → vyhrál legal.** Důvod: legal má doménovou autoritu nad osobními údaji + cross-doménový spor (legal > tech). Aplikace: D1 `leads` musí obsahovat `consent_at` (timestamp), `consent_text_version` (verze textu souhlasu), `consent_ip_hash` (hash IP, ne plain), `unsubscribe_token`. URL v leadu se před uložením stripuje od senzitivních query parametrů (utm_*, tokenů). Architect tohle musí převzít do designu.
- **[2026-05-08] [compliance] Tracking pixel v mailech → zakázáno.** Důvod: legal autorita. Aplikace: žádné `<img>` na trackovací pixely v mailech, plain-text twin povinný, opt-out odkaz `/odhlasit?token=…` v každém mailu.
- **[2026-05-08] [compliance] Privacy Policy povinná před prvním leadem do produkce.** Důvod: legal autorita, GDPR čl. 13 informační povinnost. Aplikace: blokuje Gate 3 (pre-launch). Junior musí dodat `fakan.cz/zasady-ochrany-osobnich-udaju.html` (název přesně podle úzu, ne „privacy-policy"). Marketer s legal dodá obsah.

---

*Aktualizováno 2026-05-08 po Gate 1.*
