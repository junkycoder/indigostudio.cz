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

### Tie-breakery z konzistenčního gate (PM rozpad, 2026-05-08)

- **[2026-05-08] [compliance/brand] URL slug Privacy Policy → vyhrál `/ochrana-udaju`.** Konflikt: design.md § 6.5 + decisions auto-rozhodnutí měly `/zasady-ochrany-osobnich-udaju.html`, ale risk-check § 4.2 (autoritativní finální znění souhlasu od legal-advisora) i fit-check § 4.4 (product-manager) používají krátký `/ochrana-udaju`. Důvod: legal autorita nad compliance + brand pivot na cílovku 40+ (kratší, lidštější URL, méně cizojazyčného žargonu). Aplikace: soubor `fakan.cz/ochrana-udaju.html`, route `/ochrana-udaju`. Decisions auto-rozhodnutí bylo nepřesné — opraveno per skutečným legal textem v risk-check § 4.2. Design § 6.5 a fit-check § 4.4 sjednoceny.
- **[2026-05-08] [tech] Opt-out query parametr `t` vs `token` → vyhrál `t`.** Konflikt: brief.md říkal `/odhlasit?token=…`, design.md § 3.3 + risk-check § 5.1 + README úkol Lead capture říkali `/odhlasit?t=<token>`. Důvod: senior-architect doménová autorita nad URL kontraktem + tři ze čtyř dokumentů mají `?t=`. Brief poznámka byla zkratka. Aplikace: kontrakt `/odhlasit?t=<token>` (64 hex znaků).
- **[2026-05-08] [compliance] MailChannels vs Email Workers v risk-check § 5.3 → vyhrál Email Workers.** Konflikt: risk-check.md § 5.3 měl historickou zmínku „MailChannels (pokud zvolíme)" + DPA požadavek; Gate 1 + ADR-001 vybral Email Workers. Důvod: Gate 1 explicitní rozhodnutí Fakana má přednost; risk-check zmínka je historická. Aplikace: jediný procesor mailů = Cloudflare Email Workers, žádný extra DPA s MailChannels. Privacy Policy v TASK-13 odkazuje jen na Cloudflare DPA + EU-US DPF. Update risk-check § 5.3 není ve scope landing-v2 (může legal-advisor v retro nebo následující iteraci).

### Auto-rozhodnuto orchestrátorem (po researcheru, 2026-05-08)

- **[2026-05-08] [tech] Email Routing `send_email` binding (legacy) vs. nová Email Service Email Sending → vyhrál legacy `send_email` binding.** Důvod: senior-architect doménová autorita nad outbound mail tech volbou + design.md sekce 4 už `send_email` binding předpokládá + finance veto na placený plán (Email Service je Workers Paid only) + bootstrap fáze (100–500 leadů/měsíc) — legacy free tier sedí. Aplikace: `wrangler.toml` má `[[send_email]]` syntaxi (ne `[[email_sending]]`), import `EmailMessage` z `cloudflare:email`, `mimetext` ano (architect ověří údržbu před schválením dep). ADR-001 dostane upřesnění v PR připravovaném ve Fázi 6 (retro / následná iterace).
- **[2026-05-08] [tech] DMARC pro fakan.cz → mimo scope této iterace.** Důvod: research dohledal DNS — MX + SPF + DKIM (`cf2024-1`) jsou aktivní, DMARC chybí. Bez DMARC je deliverability OK pro běžné inboxy (Gmail, Outlook). Doplnění DMARC je „nice to have", architect doporučuje samostatný úkol v README priority 2. Aplikace: junior backendu DMARC nepřidává, jen flagne v retru.
- **[2026-05-08] [scope/owner-input] IČO + sídlo Fakana pro patičku obchodního mailu → vyřešeno.** Fakan 2026-05-08 dodal:
  - **Firma:** Indigo Studio s.r.o. (právní forma **s.r.o.**, ne OSVČ — research předpokládal špatně)
  - **IČO:** 14389096
  - **Sídlo:** Chudenická 1059/30, Hostivař, 102 00 Praha
  - **BÚ:** 2802169026/2010 Fio (volitelný údaj, ne povinný v patičce, pro fakturaci OK)
  - **OR spisová značka:** TBD — protože je to s.r.o., § 435 NOZ vyžaduje navíc údaj o zápisu v OR včetně oddílu a vložky. Orchestrátor dohledá v ARES paralelně se spuštěním Fáze 3, doplní do tohoto záznamu.
  Aplikace: marketer v TASK-15 použije patičku ve formátu „Indigo Studio s.r.o., Chudenická 1059/30, 102 00 Praha, IČO: 14389096, zapsáno v Obchodním rejstříku vedeném [Městský soud v Praze], oddíl C, vložka [XXXX]." Až bude OR spisovka dohledaná, marketer doplní.

---

*Aktualizováno 2026-05-08 po Gate 1 + tie-breakery z PM rozpadu + research.*
