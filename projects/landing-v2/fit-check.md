# Fit check — landing-v2

**Autor:** product-manager
**Datum:** 2026-05-08
**Brief:** [`brief.md`](brief.md) · **Decisions:** [`decisions.md`](decisions.md) · **Risk:** [`risk-check.md`](risk-check.md) · **Forecast:** [`forecast.md`](forecast.md)

---

## TL;DR

**Verdikt: OK předat architectovi a PM (zakázky).** Iterace sedí do roadmapy (Fáze 0 deliverables PRD sekce 12), ne-sjednocuje žádný tie-breaker konflikt mezi vstupními dokumenty, a kapacitně se vejde s rezervou. Tři README úkoly Priority 1 dostanou po této iteraci `[x]`, čtvrtý částečně. Hlavní reuse je **šablona lead capture** a **přepsaný brand pivot na vykání + 40+** — od této chvíle to bude default napříč klientskými zakázkami.

---

## 1. Fit do roadmapy

### Která fáze PRD?

**Fáze 0 — kostra + plugin kernel.** Brief landing-v2 zavírá poslední marketingově-funkční dluhy z této fáze:

- „Landing s URL inputem, free analýza" — landing už hotový, free analýza synchronní hotová. Iterace dotahuje **lead capture** (PRD sekce 6 explicitně počítá s lead capture od začátku) a **kvalitu copy pro reálnou cílovku 40+**.
- „VOP/GDPR" — Privacy Policy stránka jako vedlejší produkt (povinný blokátor z risk-checku) zavírá první polovinu „GDPR" deliverablu. VOP zůstávají na další iteraci.
- „Auth magic link, base velín" — **mailové šablony pro magic link** se v této iteraci připravují „na sklad". Auth flow sám zůstává out-of-scope.

### Co iterace NEzavírá ve Fázi 0

- Plugin registry + manifest engine + sandboxing. Mimo scope, samostatný úkol.
- Turnstile + rate limit. Risk pro lead capture (spam attack), iterace ho nedělá — synchronizace na samostatný úkol Priority 1.
- Asynchronní vlna analýzy (Lighthouse, screenshot, AI redesign). Mimo scope per brief.
- Magic link auth flow (jen šablony se připraví, ne endpoint a ne JWT).

### Co iterace **posouvá**, i když nezavírá

- **Fáze 1 — core pluginy.** Mailové šablony lead followup + soft DOI + opt-out potvrzení = polotovar pro budoucí pluginový mailing modul (PRD sekce 5, plugin „forms" / „newsletter"). To je reuse, který se objeví ve Fázi 5.
- **Fáze 5 — Velín UX testing se starší cílovkou.** Tahle iterace dělá **brand pivot na 40+** (vykání, větší typografie, vyšší kontrast). To znamená, že až dorazí Velín, nezačíná se s designem od nuly — pivot už platí.
- **Fáze 1 — analytics-basic.** Iterace nepřidává analytics, ale lead capture do D1 dává **první funkční konverzní funnel**, ze kterého se dá měřit (Cloudflare logs + D1 leads). Marketer si po launch může nastavit první tracking events bez analytics infry.

---

## 2. Sjednocení s existujícími README úkoly

Tahle iterace pohlcuje 3 řádky Priority 1 a částečně 1 řádek. PM zakázky bude tohle psát do delivery reportu — proto explicitně:

### `[x] Brand pivot — vykání + cílovka 40+`

**Co iterace dodá:**
- Vykání napříč produkčním copy (`index.html`, `vysledek.html`, `prehled.html`, mailové šablony) — 0 výskytů „ty/tvůj" mimo případně schválený nový tagline.
- Žargon (AI agenty, framework, LCP, WCAG, CDN, hydration) ven z hera, schovaný hlouběji v detailních sekcích.
- Design 40+ tweaks: body font 18–19 px (mobil 18), CTA tlačítka ≥ 56 px, kontrast WCAG 2.2 AA u muted textu.
- Diff brand briefu (sekce 4) a CLAUDE.md (sekce 3) jako **PR připravený k review, nemerge**.

**Co tahle iterace záměrně NEDODÁ** (a v README se musí nechat zmínka, ne zaškrtnout všechno):
- Tagline finalní rozhodnutí — Fakan Gate 1 řekl „kompletní redesign copy, marketer navrhne nový". Marketer ve Fázi 4 navrhne, Fakan v delivery schválí. Pokud ne, řádek dostane `[~]` s poznámkou.
- Brand brief / CLAUDE.md merge do mainu — to je akce **na Fakanovi**, nikdo ji nedělá za něj.

### `[x] Homepage UX — mobile a lead capture`

**Co iterace dodá:**
- (a) `autocapitalize="none"` + `inputmode="url"` + `spellcheck="false"` + `autocorrect="off"` na URL inputu na obou místech.
- (b) Email pole + neforčekovaný checkbox souhlasu (samostatný, ne v submit tlačítku) s odkazem na Privacy Policy přímo v textu (legal vyžaduje).
- (c) Worker přijímá email + consent ze query stringu, validuje, ukládá do D1 a triggeruje mail. Logování `console.log` z původního zadání se rovnou nahrazuje plnou implementací (úkol „Lead capture" sjednocen s tímhle).

**Pozor:** v původním README byl bod (c) jen „prozatím jen zaloguje". Iterace skok na rovnou plnou implementaci je možný, protože Gate 1 schválil rozšířený scope.

### `[x] Lead capture — storage + e-mail nabídky`

**Co iterace dodá:**
- D1 schema `leads` rozšířené per legal (consent_at, consent_text_version, consent_ip_hash, unsubscribe_token, source) + migrace v `migrations/0002_leads.sql`.
- Cloudflare Email Workers outbound (Gate 1 vyhrál nad MailChannels — důvod: menší DPA povrch).
- Šablony: `lead-followup.html` + `.txt` twin, `soft-doi.html` + `.txt` (první mail s „pokud to nejste vy, klikněte"), `opt-out-confirm.html` + `.txt`.
- `/odhlasit?t=<token>` endpoint (UPDATE D1 + friendly stránka „odhlášeno").
- `legal/consent-versions/consent-v1.md` — verzovaný text souhlasu pro retroaktivní důkaz.

**Co iterace NEDODÁ a musí být v README poznámce:**
- Cron na retenci 24 měsíců (legal akce paralelní, neblokuje launch — viz risk-check sekce 8). Buď v této iteraci jako nice-to-have, nebo samostatný follow-up úkol. Doporučuju **samostatný úkol** — minimalizuje scope, a retence se aktivuje až za měsíce.
- DPA dokumentace (Cloudflare + Email Workers DPA dohledat odkazy do Privacy Policy) — to je legal akce ve Fázi 4 / Pre-launch.

### `[~] Magic link auth` — částečně

**Co iterace dodá:** mailové šablony pro magic link auth jako **draft v0** (Gate 1: Fakan ano na všechny tři kategorie). Soubor: `src/email/magic-link.html` + `.txt` twin, ne-publikovaný — žádný endpoint je nezpracovává.

**Co NEDODÁ:** auth flow sám (Email Routing inbound, JWT generování, sessionStorage, Velín gate). To zůstává ve Fázi 0 jako otevřený úkol.

**Doporučení pro PM zakázky:** v README ten řádek **nezaškrtávat `[x]`**. Místo toho přidat sub-bod „[x] mailové šablony připravené, čekají na implementaci endpointu" pod hlavní řádek. Aby retro vidělo, že část se dodala, ale úkol jako celek pokračuje.

---

## 3. Kapacitní plán

Finance odhadl 36–47 h. Rozpadá se to takhle:

| Role | Co dělá | Hodiny |
|---|---|---|
| **junior-developer** | Copy update 3 stránek (z draftů marketera, ne tvorba) · email + checkbox formulář (mobile attrs, validace) · D1 migrace `leads` · Email Workers integrace + opt-out endpoint · 4 mail šablony (HTML + plain twin) · Privacy Policy stránka (z draftu legal+marketer, jen markup) · design 40+ tweaks (CSS tokens) | **14–18 h** |
| **senior-architect** | Design lead capture (D1 schema sjednocení s legal požadavky, Email Workers vs. MailChannels rozhodnutí už hotové, opt-out token flow, server-side consent enforcement) · 1–2 code review · 1 řešení blokátoru (předpokládám DNS SPF/DKIM/DMARC pro Email Workers — to je nový teritoriál) | **5–7 h** |
| **marketer** | Copy redesign 3 stránek (hero, sekce, CTA) · 4 mail šablony textu (lead followup, soft DOI, magic link draft, opt-out confirm) · nový tagline návrh · landing plan · znění souhlasu češtinou · text Privacy Policy do lidštiny | **6–8 h** |
| **legal-advisor** | Risk check (hotovo, 3,5 h) · Privacy Policy obsah (sekce co sbíráme, retence, práva, DPA odkazy) · znění souhlasu finální · Pre-launch check Gate 3 · review followup mailu (smluvní oferta vs. nabídka) | **3–4 h** (z toho 3,5 už spotřebováno) |
| **tester** | AC pro každý task · smoke test celého flow (URL submit → analýza → consent → D1 zapis → mail v inboxu → opt-out funkční) · mobile (375 px, autocapitalize check) · a11y (WCAG kontrast, focus, klávesnice) · Lighthouse | **3–4 h** |
| **finance** | Forecast (hotovo, 1,5 h) · průběžný cost report v polovině exekuce · final pre-launch projection · retro skutečnost vs. forecast | **2–3 h** (z toho 1,5 už spotřebováno) |
| **researcher** | Cloudflare Email Workers outbound aktuální stav (DNS SPF/DKIM/DMARC, abuse limity, jak řešit první-time setup) · soft DOI best practice 2026 · případně MailChannels stav pro retro „proč jsme to neudělali" | **2 h** |
| **product-manager** (já) | Tenhle fit-check · průběžné kontroly konzistence · retro & promote do standardů | **2 h** |
| **project-manager** | Rozpad tasků, koordinace, Gates 2 + 3, status reporty, delivery prezentace | **3–4 h** |
| **owner** | Brief (hotovo) · Gate 1 odpověď (hotovo) · Gate 3 schválení tagline + diffů · final acceptance | **1–2 h** |
| **CELKEM** | | **~41–54 h** |

**Diff oproti finance forecastu (36–47 h):** můj rozpad je o 5–7 h výš. Důvod: finance počítal junior 12–16 h, já dávám 14–18 h. Lead capture rozšíření ze samotného „logování" na full implementaci (D1 migrace, idempotence, opt-out endpoint, 4 mail šablony) je více práce, než počítal forecast před Gate 1.

**Akce:** finance prosím v průběžném cost reportu **nový baseline 41–54 h**, ne starý 36–47 h. Pokud junior reálně sedne pod 14 h (tj. plno reuse z draftu marketera), klesne to zpět ke 36 h. Žádný blokátor, jen aktualizace.

**Co dělat, když to začne přetékat (>54 h):**
1. Magic link draft maily ven (řekneme „v0 templates, počká na auth flow"). Ušetří 1–2 h junior + 0,5 h marketer.
2. Soft DOI mail spojit s lead followup (jeden mail s „pokud to nejste vy" odstavcem nahoře). Ušetří 0,5–1 h.
3. Privacy Policy minimalistická („esenciální", ne „přívětivá narativní"). Ušetří 1 h marketer.

Termín 2026-05-15 (8 dní) sedí — i s 54 h paralelizace mezi 6 rolemi to znamená ~6,75 h/role, žádná role se nezasekne.

---

## 4. Reuse insights — co z této iterace přežije a půjde použít znovu

Tohle je můj hlavní úkol jako product-manager: aggregovat learnings napříč zakázkami, ať se příští iterace nezačíná od nuly.

### 4.1 Šablona lead capture (priority A reuse)

**Co se vytváří:** D1 `leads` schema + Email Workers outbound + soft DOI flow + opt-out token + Privacy Policy stránka + verzovaný consent text.

**Pro koho je to reuse:**
- **Každý klientský web s formulářem** — instalatér, autoservis, e-shop. Cca 90 % našich budoucích zakázek bude mít „dej mi e-mail, ozvu se". Když to máme jako šablonu, junior to nasadí za 1–2 h místo 14–18 h.
- **Plugin „forms"** (PRD Fáze 1) — tohle je polotovar. Když přijde čas na první core plugin, máme schema, opt-out flow, GDPR templates už ověřené.
- **Plugin „newsletter"** (PRD Fáze 5) — soft DOI mail flow se přesouvá do tohohle pluginu téměř beze změny.

**Co je potřeba udělat, aby to byl skutečný reuse, ne jen kód v jednom projektu:**
- Po retro vyrazit cestu šablony do `templates/lead-capture/` v repu (D1 migrace, Worker handler, mail templates, consent versioning, Privacy Policy boilerplate). Junior následně **kopíruje** odtamtud, ne z `src/`.
- Promote D1 schema decisions (consent_at, consent_text_version, consent_ip_hash, unsubscribe_token) do `docs/standards/lead-capture.md` jako **závazné minimum** pro všechny budoucí formuláře.

### 4.2 Brand-token komponenta „velký typo + vysoký kontrast" pro 40+ (priority B reuse)

**Co se vytváří:** body 18–19 px / mobil 18 px, CTA ≥ 56 px, vyšší kontrast u muted textu, tlumenější animace. To není jen tweak landing — to je **default tón pro českou SMB cílovku**.

**Pro koho je to reuse:**
- **Každý klientský web** — naše cílovka jsou malé firmy 40–60 let. Pokud je cílí instalatérova zákaznice (paní 55+ s bifokály), platí pivot stejně.
- **Velín UX** (PRD Fáze 5) — Velín je rozhraní pro zákazníka. Když přijde, je 40+ default, ne speciální tier.
- **Klientův Velín** — taky pro 40+ majitele firmy, ne pro digitálního agenta.

**Co je potřeba udělat:**
- Po retro: `tokens.css` (Priority 2 v README) musí mít body font, button height, kontrast jako tokeny **kalibrované na 40+**, ne na designerský default. Když o tom rozhoduje token, je to reuse zdarma.
- Promote do `docs/standards/typography-40-plus.md` jako závazný minimální baseline. Komponentová knihovna (až vznikne, Fáze 5) na tom postaví.

### 4.3 Mailové šablony + plain-text twin + opt-out flow (priority B reuse)

**Co se vytváří:** 4 šablony (lead followup, soft DOI, magic link draft, opt-out confirm), všechny multipart, žádný tracking pixel, opt-out token funkční.

**Pro koho je to reuse:**
- **Plugin pro mailing** (PRD Fáze 5 newsletter, případně transactional plugin pro klienty) — naše první ověřená multipart šablona, na které postaví.
- **Klientské transactional maily** — autoservis pošle „máte auto hotové", instalatér „přijdu v 14:30". Ten flow (HTML + plain + opt-out + bez trackeru) je default napříč zakázkami.

**Co je potřeba udělat:**
- Po retro: `templates/email/` v repu + dokumentace „takhle se píše brand-friendly transactional mail". Promote do `docs/standards/email-templates.md`.

### 4.4 Privacy Policy boilerplate pro CZ SMB (priority C reuse)

**Co se vytváří:** `fakan.cz/ochrana-udaju` (legal preferuje název „ochrana-udaju", ne „zasady-ochrany-osobnich-udaju" — krátce, lidsky, SEO-friendly per Gate 1 default).

**Pro koho je to reuse:**
- **Každý klientský web** — všechny budou mít aspoň formulář, takže všechny musí mít Privacy Policy.
- **Šablona `templates/privacy-policy.html`** — junior dostane parametry (firma, IČO, e-mail, retence, procesoři) a vyplývá lokalizovaná verze.

**Co je potřeba udělat:**
- Po retro: extrahovat do šablony s placeholdery + dokumentace v `docs/standards/privacy-policy.md`. Legal-advisor projde, podepíše „takhle se to píše pro CZ SMB v roce 2026".

### 4.5 Workflow learning: rozšiřování scope v Gate 1 funguje, když je každá expanze odůvodněná

Gate 1 expandoval scope (3 mailové kategorie ne 1, full lead capture ne logování). Forecast se přepočítal +5–7 h. Pokud finance přesto řekne „sedí to do kapacity" a žádná rozšíření nejsou „protože by to bylo cool", **gate funguje**. Promote do `docs/retros/landing-v2.md` po dokončení iterace.

---

## 5. Risk

### 5.1 Cloudflare Email Workers outbound je u nás první

**Pravděpodobnost:** vysoká.
**Dopad:** střední — DNS SPF/DKIM/DMARC setup může mít neočekávané kroky, mailová deliverability k velkým providerům (Seznam, Gmail, MS) může vyžadovat tuning. První lead test může jít do spamu.

**Mitigace:**
- **Researcher** dohledá aktuální Email Workers outbound setup před tím, než junior začne (Fáze 3, ne Fáze 4). Nasadit researcher úkol jako pre-task.
- **Tester** v Gate 3 musí poslat lead na **3 různé providery** (Seznam, Gmail, MS Outlook) a ověřit doručitelnost + ne-spam. Ne jen „dorazil do `jsem@fakan.cz`".
- Pokud Email Workers nezvládne první test, **fallback na Resend** ($20/měs base) je v retro flagnutý jako možnost. Ne v této iteraci.

### 5.2 Magic link auth maily „na sklad" bez živého auth flow

**Pravděpodobnost:** střední — kdykoliv v budoucnu přijde implementace auth, šablony se mohou ukázat jako mírně mimo skutečné potřeby (např. jiný query string formát tokenu).
**Dopad:** nízký — šablony jsou v `src/email/magic-link.{html,txt}` jako draft v0, nikdo je nepoužívá. Když přijde čas, junior je v 30 min upraví.

**Mitigace:**
- Označit šablony v souboru komentářem `<!-- DRAFT v0 — magic link auth flow ještě neimplementován, šablona čeká na finální token formát -->`.
- V README pod úkolem „Magic link auth" zaznamenat, že šablony existují.
- V retro zapsat, že „připravovat artefakty na sklad bez živé integrace" je akceptovatelná taktika **jen pro nízkonákladové artefakty** (HTML šablona = ano, full backend service = ne).

### 5.3 Privacy Policy = nový dokument, dva průchody legal

**Pravděpodobnost:** nízká — legal už v risk-checku detailně specifikoval, co tam musí být. Marketer to učeše do lidské řeči, legal v Pre-launch projde.
**Dopad:** střední — pokud legal v Gate 3 najde blokátor (špatná retence, chybějící DPA odkaz, špatná identifikace správce), iterace stojí 1–2 dny než marketer + legal opraví. To může nestihnout termín 2026-05-15.

**Mitigace:**
- **Legal píše obsah Privacy Policy ve Fázi 3, ne ve Fázi 4.** Tj. paralelně s exekucí, ne až po ní. Marketer dostane draft a jen ho upraví do tónu vykání + 40+. Pre-launch check tak není „píšeme obsah", ale „kontrolujeme, co marketer udělal s draftem".
- **Project-manager** v Gate 2 explicitně potvrdí, že úkol „Privacy Policy obsah" má **legal jako autora**, ne junior nebo marketer.

### 5.4 Spam attack na lead form bez Turnstile

**Pravděpodobnost:** nízká teď, vyšší po launch.
**Dopad:** střední — D1 write quota (free 100k/den, máme rezervu 5000×, ale `INSERT` bombou se to zaplní), Email Workers reputation hit (deliverability degradace pro reálné maily).

**Mitigace:**
- Není v scope této iterace. Synchronizace na samostatný úkol „Turnstile + rate limit" v Priority 1.
- **Project-manager** v Gate 3 explicitně připomene: „lead capture jde do produkce **bez** Turnstile, monitor `wrangler tail` první 48 h, při >100 leadů/den okamžitě zapnout úkol Turnstile."

### 5.5 Brand pivot diffy do strategických dokumentů

**Pravděpodobnost:** nízká — risk-check už explicitně varoval, že CLAUDE.md sekce 7.4 to zakazuje a Gate 1 default workflow je PR + review.
**Dopad:** vysoký, pokud se to stane — main commit do `fakan-cz-brand-brief.md` nebo `CLAUDE.md` bez Fakanova vědomí by porušilo bod 7.4. Iterace by se musela revertovat.

**Mitigace:**
- Senior-architect v code review **explicitně hlídá**, že žádný commit v iteraci nesahá na `fakan-cz-*.md` ani `CLAUDE.md`.
- Project-manager v Gate 3 checklist: „diff brand briefu je v separátní větvi / PR, **nemerge na main**".
- Junior v každém commitu ověří `git status` a hlídá, ať tam tyhle soubory nejsou.

---

## 6. Konzistence s tie-breaker pravidly (CLAUDE.md sekce 7.6)

Prošel jsem brief, decisions, risk-check, forecast a hledal konflikty mezi rolemi. **Bez konfliktů, dokumenty konzistentní.**

Konkrétně ověřeno:

- **Tech vs. legal (D1 schema):** brief navrhl `leads(id, url, email, consent_at, source, status, created_at)` — minimalistický. Risk-check rozšířil o `consent_text_version`, `consent_ip_hash`, `unsubscribe_token`. To je legal autorita nad compliance + cross-doménový konflikt (legal > tech). Decisions už zaznamenalo. **Konzistentní.**
- **Tech vs. compliance (Email Workers vs. MailChannels):** legal preferuje Email Workers, Fakan v Gate 1 potvrdil. Architect to musí převzít. **Konzistentní.**
- **Scope vs. brief (mailové šablony rozsah):** brief nabízel single mail (lead followup), Gate 1 expandoval na 4. Decisions to zaznamenalo. Forecast přepočítal kapacitu. **Konzistentní.**
- **Cost vs. tech (AI volání):** finance flagnuto, Fakan zakázal v Gate 1. Architect i marketer to respektují. **Konzistentní.**
- **Tón vs. brief (tagline):** brief nechal otevřené, Gate 1 řekl „kompletní redesign copy". Marketer doménová autorita nad tónem. **Konzistentní.**

Žádný nový tie-breaker zápis do `decisions.md` z mojí strany potřeba není.

---

## 7. Verdikt

**OK předat architectovi a PM (zakázky).**

- Iterace **sedí do roadmapy** (Fáze 0 deliverables, posune Fázi 1 a Fázi 5 přes reuse).
- **Sjednoutí README úkolů** je explicitní (3 řádky `[x]`, 1 řádek `[~]`).
- **Kapacita** sedí (41–54 h proti finance forecastu 36–47 h, drift +5–7 h kvůli Gate 1 expanzi je odůvodněný a má fallback plán scope cuts).
- **Reuse insights** identifikovány (4 šablony k promote po retro, 1 workflow learning).
- **Risk** mapovaný, mitigace pro každý bod je přiřazena konkrétní roli.
- **Tie-breaker konzistence** ověřena — bez konfliktů.

Žádná eskalace na Fakana není potřeba. Architect může začít navrhovat (paralelně se mnou už to dělá per zadání orchestrátora). PM (zakázky) může v Gate 2 rozpadnout iteraci na tasky bez čekání.

---

*Aktualizováno 2026-05-08. Pokud forecast/exekuce zjistí drift > 20 % oproti tomuto plánu, product-manager re-review.*
