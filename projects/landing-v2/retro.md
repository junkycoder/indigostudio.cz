# Retro — landing-v2

**Datum:** 2026-05-08
**PM produkt:** AI agent (product-manager)
**Iterace:** landing-v2 (brief → delivery 2026-05-08, jednodenní cyklus)
**Stav:** SCHVÁLENO ownerem (`approvals.md`), Fáze 6 finální

---

## 1. Cíl iterace vs. dodávka

- **Cíl:** redesign landing + výsledkové + přehledové stránky vč. mailových textů, cílovka 40+, vykání, méně AI/cookies žargonu, plus end-to-end lead capture (URL + e-mail + souhlas → D1 → follow-up mail).
- **Dodávka:** 5 stránek redesign (`index.html`, `vysledek.html`, `prehled.html`, `ochrana-udaju.html`, `odhlasit-hotovo.html`) + 4 mail šablony (`lead-followup`, `magic-link-auth` DRAFT v0, `optout-confirmation`, `soft-doi`) + 1 Privacy Policy + lead capture flow (D1 schema 17 sloupců, idempotence per-day, IP hash s saltem, URL stripping) + opt-out endpoint `/odhlasit?t=<token>` + rate limit (KV) + honeypot (server-side) + IČO patička + verzovaný consent text v evidenci + Cloudflare Web Analytics.
- **Verdikt:** **dodáno + bonus.** Bonusy oproti briefu: Cloudflare Web Analytics snippet (auto-rozhodnuto Fáze 4), `legal/consent-versions/v1-2026-05-08.md` jako evidence pro audit, ARES OR spisovka dohledána sama (MSPH C 364981).

## 2. Co fungovalo

- **Choreografie 7-fázového kolečka.** Fáze 1 (brief + risk + forecast paralelně), Fáze 2 (PM fit + architect design paralelně, pak PM rozpad), Fáze 3 (5 batchů paralelních junior agentů na 17 implementačních tasků). Žádný blokátor v workflow, žádná role nečekala na druhou víc než půl hodiny.
- **Tie-breaker pravidla z CLAUDE.md sekce 7.6 v ostrém provozu.** 5+ tie-breakerů během iterace, všechny vyřešené auto bez eskalace na Fakana:
  - URL slug Privacy Policy `/zasady-ochrany-osobnich-udaju.html` vs. `/ochrana-udaju` → vyhrál `/ochrana-udaju` (legal autorita + brand 40+).
  - Opt-out param `?token=` vs. `?t=` → vyhrál `?t=` (architect autorita + 3 ze 4 dokumentů).
  - MailChannels vs. Email Workers v risk-check → vyhrál Email Workers (Gate 1 explicit).
  - Email Routing legacy `send_email` vs. nová Email Service → vyhrál legacy (architect + finance veto na placený plán).
  - Retence dat 12m vs. 24m → vyhrál 12m (legal + datová minimalizace).
  - Query param `em` vs. `email` → vyhrál `email` (architect post-hoc autorita po testerově BLOCKER reportu).
  Tie-breaker poprvé v ostrém provozu, **ověřeno funkční** — ani jeden konflikt nemusel jít na živého Fakana.
- **Konzistenční gate v PM rozpadu** chytl 3 nesoulady mezi briefem/designem/risk-checkem před exekucí (URL slug, token name, MailChannels reference). Tie-breakery zaznamenané v `decisions.md`. Bez gate by se to chytlo až v testech.
- **Marketer dohledal OR spisovku** v ARES VR endpointu sám (MSPH C 364981, historie přesunů Plzeň ↔ Praha), bez round-tripu na Fakana. Proaktivní, šetřilo to ~30 min.
- **Compliance disciplinovaná napříč rolemi.** Žádný tracking pixel (audit `<img>` v `src/email/` = 0), plain-text twin v každém mailu, opt-out odkaz funkční, IP hash s saltem (ne plain), URL stripping před INSERT, separátní neforčekovaný consent checkbox, `List-Unsubscribe` + `List-Unsubscribe-Post: One-Click` (RFC 8058). Legal pre-launch GREEN bez podmínek-blokátorů.
- **Architect review APPROVED WITH FIXES** (1 BLOCK + 4 FIX + 8 NICE) — junior odvedl solidní práci (žádné npm dependencies, čistě izolované moduly, defenzivní error handling, ESM), opravný kruh proběhl 6 fix commity před launchem.

## 3. Co nefungovalo

- **API kontrakt nebyl formalizovaný v rozpadu.** Query string parametry `email` (BE `parseLeadParams`) vs. `em` (FE `vysledek.js` a `index.html`) byly nesladěné mezi tasky T16/T17 a T12. Tester to chytl jako BLOCKER (Bug #1), junior fixoval v opravném kruhu (`5811365` sjednotil na `email` napříč FE/BE/testy). **Stálo to ~3 h reworku.** Doporučení: PM v `tasks.md` přidat povinnou sekci „**API kontrakt**" — výčet URL params (s typem a regexem), header keys, JSON schema callbacků, query encoding. Všechny související tasky pak referují tutéž specifikaci, ne brief.
- **Capacity přestřel 19 %.** Finance forecast 36–47 h, skutečnost ~56 h. Příčiny dohromady:
  - Opravný kruh po architect review + tester acceptance: 6 fix commitů × ~30 min = ~3 h navíc.
  - Tester přestřel (~5 h nad plán) — empirická validace 65+ scénářů, BLOCKER + MAJOR + 5 flagů.
  - Drobný scope creep: CF Web Analytics snippet (auto-rozhodnuto Fáze 4), `consent-versions/v1-2026-05-08.md`, ARES OR spisovka.
  - Konzistenční gate ~1 h navíc (3 tie-breakery), ale ušetřil 3 chyby v implementaci → net positive.
  Doporučení: capacity plán s **bufferem +20 %** pro první iterace nového typu (lead capture flow je u nás první, brand pivot taky první).
- **Junior side-effect: `scripts/audit-url.sh`** vznikl mimo scope T16 jako Lighthouse helper. Užitečný (owner v approvals chce zachovat), ale neplánovaný a untracked. Doporučení: PM rozpad explicitně říct „**tooling = samostatný task, ne side effect**", a pokud junior helper potřebuje, hodí ho do `[~]` řádku v `tasks.md` před commitem.
- **Konflikt orchestrátor prompt vs. `tasks.md`.** Několik juniorů hlásilo „šel jsem podle X, ne podle Y" (např. honeypot pole `company` per design.md vs. `website` v `index.html` — junior držel oba „pro safety", ale je to technický dluh). Důvod: dva zdroje pravdy. Doporučení: orchestrátor prompt MUSÍ explicitně referovat `tasks.md` jako jediný zdroj a říct juniorovi „**při konfliktu drž tasks.md, eskaluj orchestrátorovi**", ne „tady je naváděcí prompt, který přepíše tasks.md".
- **Tester FAIL na BLOCKER byl chytlý, ale drahý.** Kdyby se to chytlo dřív (architect review **před** exekucí, nebo PM rozpad přes API kontrakt sekci), ušetřilo by se 3 h reworku. Architect review proběhl po implementaci — moc pozdě. Doporučení: **lehký mid-implementation review po 50 % commitů**, ne až na konci. Finance to flagovala v section 5 forecastu („příště zvážit lehčí mid-implementation review po 50% commitů").
- **`prehled.html` Bug #2 (tykání mimo hero, regrese vůči TASK-18 AC).** Junior refaktoroval jen hero (do ř. 200), zapomněl na dema-mock + Anti lock-in sekci (5+ výskytů „tvůj/ses"). Tester to chytl, junior fix `7c99240`. Doporučení: AC formulovat ve formě **přesného grep příkazu**, který tester pak spustí 1:1. „0 výskytů ty/tvůj/tobě/tě" má být `grep -E '\b(ty|tvůj|tvoje|tobě|tě|ses)\b' fakan.cz/prehled.html | wc -l → 0`. Bez konkrétní reproducible příkazu junior interpretuje „podle hera".
- **`mail_attempts` count v bounced UPDATE** se neaktualizuje (architect NICE 2.2). Forensika neúplná. Drobnost, ale typický „NICE který nikdo neopraví" — promote do follow-up tasku ať se neztratí.

## 4. Drift od plánu

| Položka | Plán | Skutečnost | Dopad |
|---|---|---|---|
| **ETA** | termín 2026-05-15 (8 dní od briefu) | brief→delivery 2026-05-08 (1 den) | dopad pozitivní — termín drží s rezervou 7 dní; deploy plánován D-1 2026-05-14 |
| **Cost (runtime)** | $0/měs (free tier) | $0/měs (sledovat KV writes 1k/den breakpoint) | bez dopadu, finance YELLOW na monitoring |
| **Cost (agent-h)** | 36–47 h forecast | ~56 h skutečnost | přestřel +19 %, akceptováno per Gate 1 (Fakan delegoval rozpočet na tým) |
| **Scope** | 3 stránky + 1 mail + 1 PP | 5 stránek + 4 maily + 1 PP + CF Analytics + consent evidence | rozšíření vědomé (Gate 1 + Fáze 4 auto), všechno schváleno |

## 5. Tie-breaker reflexe

5+ tie-breakerů, 0 eskalací na živého Fakana. Pravidla CLAUDE.md sekce 7.6 fungují bez úprav.

**Pozorování:**
- **Doménová autorita drží.** Legal vyhrával nad tech (URL stripping, IP hash, retence 12m), architect nad URL kontrakty (token name `?t=`, query param `email`), finance veto na placený plán (Email Service vs. legacy `send_email`).
- **Cross-doménový spor (legal > tech)** jasný — nikdy neproblém.
- **Nejvíc tie-breakerů (3) v PM konzistenčním gate** — zaplatilo se. Bez gate by 3 chyby šly do exekuce.
- **Tester post-hoc tie-breaker** (`em` vs. `email`) — funguje, ale je to drahé. Chyba měla být chycena dřív.

**Doporučení:** Sekce 7.6 beze změn. Žádná nová doménová autorita potřeba, žádné nové cross-doménové pravidlo.

## 6. Akce — update standardů a šablon

### Promotion do `templates/` — hlavní reuse-payoff iterace

Doporučené promotion pro **další iteraci** (samostatný úkol, ne teď):

- **`templates/lead-capture/`** — D1 schema (17 sloupců vč. compliance fields) + `wrangler.toml` bindings boilerplate + `src/lib/{url-strip,hash,mime,lead,mail,ratelimit}.js` + soft DOI integrovaný do lead-followup + opt-out token flow. Junior z 14–18 h spadne na 1–2 h kopírovacího nasazení.
- **`templates/email/`** — `_layout.js` multipart layout s parametrizovanou patičkou (IČO + sídlo + OR) + `lead-followup`, `optout-confirmation`, `soft-doi`, `magic-link-auth` DRAFT v0. Žádný `<img>`, plain-text twin, `List-Unsubscribe` headery RFC 8058.
- **`templates/privacy-policy.html`** — boilerplate pro CZ SMB s.r.o. s placeholdery (firma, IČO, OR, sídlo, e-mail správce, retence, procesoři, datum účinnosti). Slug `/ochrana-udaju`. Marketer + legal odpadne 50 % nově psaného textu.
- **`docs/standards/lead-capture-compliance.md`** — destilát z `risk-check.md` jako check-list pro každou další zakázku, kde se sbírají osobní údaje. Body: separátní consent, evidence (timestamp + verze + IP hash), opt-out token, žádný tracking pixel, plain-text twin, URL stripping, soft DOI úvodní odstavec, honeypot server-side, rate limit per IP-hash, `List-Unsubscribe` headery.

### Update CLAUDE.md / brand brief — PR diff, nemerge bez Fakana

- [ ] **CLAUDE.md sekce 3** (brand) — pivot na **vykání pro cílovku 40+**. „Tvůj web. Bez výmluv." → „Váš web. Bez starostí." (varianta A schválená ownerem). Body font 18 px (mobil 17), CTA ≥ 56 px (původně 44), kontrast WCAG 2.2 AA u muted textu. Žádné AI samochválí v hero, slovo „cookies" mizí z hero stats. PR diff připraví junior v T22 — Fakan merguje sám.
- [ ] **`fakan-cz-brand-brief.md` sekce 4** (tón a hlas) — totéž. Vykání místo tykání. Zachovat charakter (krátké věty, aktivní rod, čísla, sebekritika OK, ironie lehká). Mikro-pravidla (sentence case, číslovky 10+ číslicemi, datum „6. května 2026", měna „99 Kč") drží.
- [ ] **CLAUDE.md sekce 6** (workflow) — zvážit přidat **„API kontrakt"** do PM rozpadu jako povinnou sekci. Po retru samostatný PR, ne v rámci landing-v2.
- **CLAUDE.md sekce 7.6** (tie-breaker) — fungovalo, **žádné updates**. Pravidla bez změny.

### Update agent promptů (`.claude/agents/`)

- [ ] **`project-manager.md`** — přidat do popisu rozpadu povinnou sekci „API kontrakt" (URL params s typem a regexem, header keys, JSON schema callbacků). Aby Bug #1 typu „`em` vs. `email`" se neopakoval.
- [ ] **`junior-developer.md`** — explicitně říct: „při konfliktu mezi orchestrátor promptem a `tasks.md` drž `tasks.md` a eskaluj orchestrátorovi". Aby se tasks.md stal jediným zdrojem pravdy.
- [ ] **`tester.md`** — AC formulovat ve formě **přesného grep příkazu** kde to dává smysl (žargon-blacklist, vykání check, tracker check). Aby AC byl reproducible 1:1.
- [ ] **`senior-architect.md`** — přidat **mid-implementation review po 50 % commitů**, ne až na konci. Ušetří opravný kruh.

### README task board update

T26 — junior dodá v samostatném commitu:

- `[x]` **Brand pivot — vykání + cílovka 40+** (řádek ~107) — uzavřeno v landing-v2. Sub-bod: „PR diff brand briefu + CLAUDE.md připravený k review, **nemerge bez Fakana**."
- `[x]` **Homepage UX — mobile a lead capture** (řádek ~94) — uzavřeno v landing-v2. Body (a) (b) (c) všechny dodané v T16, T17, T12.
- `[x]` **Lead capture — storage + e-mail nabídky** (řádek ~100) — uzavřeno v landing-v2. D1 + Email Workers + idempotence + opt-out + 4 šablony.
- `[~]` **Magic link auth** (řádek ~117) — částečně. Sub-bod: „mailové šablony připravené (DRAFT v0 v `src/email/magic-link-auth.js`), čekají na implementaci endpointu — auth flow zůstává otevřený."

Plus uzavřít otevřené otázky pro Fakana (řádky 141–144) — všechny vyřešené v Gate 1 nebo tie-breakery (decisions.md).

## 7. Co odložit / co ne

### Co odložit do dalších iterací

Z `decisions.md` § Fáze 4, architect review NICE nálezů, tester flagů, launch plánu:

**Priority 1 (před nebo brzo po launchi):**
- **Migrate `magic-link-auth` flow do produkce.** Auth endpoint + Email Routing inbound + JWT generování + sessionStorage + Velín gate. Šablony jsou připravené.
- **DMARC pro `fakan.cz`.** Nice-to-have, sledovat deliverability po launchi. Research dohledal stávající DNS (MX + SPF + DKIM aktivní).
- **Cron retention task.** Auto-mazání leadů po 12m per Privacy Policy. První vyprší 2027-04, čas dost — ale založit task v README, ať se nezapomene.

**Priority 2 (drobnosti, bez termínu):**
- **UTM whitelist v `stripUrl()` + `from=mail` parametr v mailových linkách.** Marketing tracking, drobný refactor.
- **Rate limit telemetry.** Sledovat KV writes a flagovat pokud `rate_limit_hit > 1 %`.
- **Architect NICE nálezy (8):** timing leak optout, dynamic import → statický map, `optout.js` HTML font Inter, `lead-followup` varianta pro „analýza nedoběhla", camelCase vs. snake_case unifikace, `mail_attempts` count v bounced UPDATE, magic-string time slice helper, honeypot pole sjednotit (`company` per design vs. `website` v `index.html`).
- **Privacy Policy retro 6m.** Legal podmínka — vyhodnotit, jestli 12m retence neutíná leadům s 9–12 měsíčním nákupním cyklem.
- **`scripts/audit-url.sh`** — owner schválil zachovat. Junior commitne s krátkým README řádkem.

### Co NEodkládat (akce v rámci uzavření iterace)

- **Junior T22**: PR diff brand briefu + CLAUDE.md sekce 3.
- **Junior T26**: README task board update (3 řádky `[x]`, 1 řádek `[~]`).
- **Junior**: commit `scripts/audit-url.sh` + README řádek.
- **Owner**: dodat 4 hodnoty z dashboardu (D1 ID, KV ID, CONSENT_SALT, CF Web Analytics token) D-1 = 2026-05-14 dopoledne.

## 8. Capacity recommendation pro další iterace

- **Typová iterace „lead capture flow + brand pivot na novou cílovku"** (po reuse promotion z této iterace): forecast **40–55 h**. Šablony `templates/lead-capture/` + `templates/email/` + `templates/privacy-policy.html` ušetří ~12–15 h junior času.
- **Nová doména** (jiná cílovka, jiný flow, jiný tech stack): drž **50–70 h s bufferem +20 %**. První iterace nového typu má vždy hidden cost (research, opravný kruh, scope creep).

## 9. Klíčové learnings — TL;DR

1. **Tie-breaker v ostrém provozu funguje.** 5+ konfliktů vyřešeno auto, žádná eskalace na živého Fakana. Sekce 7.6 CLAUDE.md drží — beze změn.
2. **API kontrakt patří do PM rozpadu jako povinná sekce.** Bug #1 (`em` vs. `email`) by se nestal, kdyby tasks.md měl tabulku query params s reproducible grep příkazy.
3. **Mid-implementation code review** šetří opravný kruh. Architect review po 50 % commitů, ne až na konci.
4. **Šablony jsou hlavní reuse-payoff iterace.** 4 promotion-kandidáti — další iterace na lead capture spadne z 14–18 h na 1–2 h junior času.

---

**Status:** Retro hotov, iterace landing-v2 uzavřena. Owner schválil v `approvals.md` (2026-05-08). Postupuje do produkce po dodání 4 hodnot z dashboardu (D1 ID, KV ID, CONSENT_SALT, CF Web Analytics token) — D-1 = 2026-05-14 dopoledne, deploy 2026-05-15.
