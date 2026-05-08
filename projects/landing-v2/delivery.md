# Delivery report — landing-v2

**Datum:** 2026-05-08
**PM zakázky:** AI agent (project-manager)
**Pre-launch verdikt:** GREEN (legal) / YELLOW (finance — KV writes na hraně, runtime stále $0/měs) — OK pro produkci s monitoringem
**Commitů iterace:** 44 (od `852fb86` scaffold po `8ee29e3` CF Web Analytics snippet)
**Agent-h celkem:** ~56 (přestřel 19 % vs. forecast 36–47 h, akceptováno per Gate 1 — Fakan delegoval rozpočet na tým agentů)

---

## 1. Zadáno (z briefu)

Citace klíčových bodů z [`brief.md`](brief.md):

- **Cílovka pivot na 40+** — majitel malé firmy v ČR, 40–60 let. Instalatér, právník, paní s e-shopem, autoservis. „Tvůj web. Bez výmluv." mu zní jako reklama na energy drink. Vykání důsledné napříč produkčním copy.
- **Lead capture chybí celá** — dnes free analýza odjede a klient zmizí. Iterace dodá end-to-end: zadat URL + e-mail + souhlas → výsledek v UI → do 24 h follow-up mail s nezávaznou nabídkou.
- **Redesign 3 stránek** — `index.html`, `vysledek.html`, `prehled.html`. Hero bez „AI agenty / LCP / WCAG / kernel / hydration". Slovo „cookies" ven z hero stats. Body font ≥ 18 px (mobil 17), CTA ≥ 56 px, kontrast WCAG 2.2 AA.
- **Mailové šablony nové** — lead followup + případné double opt-in. Bez tracking pixelu, plain-text twin, opt-out odkaz funkční.
- **Brand brief + CLAUDE.md sekce 3** připravený diff k review, **nemerge bez Fakana** (CLAUDE.md sekce 7.4).
- **Privacy Policy + souhlas** schválené legal-advisorem před produkcí. Bez toho se lead capture nepouští.
- **Termín** „hned" — pracovní 2026-05-15. **Rozpočet** „5000 tokenů" — Gate 1 vyřešen, Fakan delegoval na tým agentů.

---

## 2. Dodáno

### Frontend (5 stránek)

- `fakan.cz/index.html` (`a49a3ed`) — redesign 40+, lead capture form (URL + email + consent + honeypot), tagline „Váš web. Bez starostí.", větší typografie, hero stats bez „cookies" mantry, žargon ven z hero (TASK-16)
- `fakan.cz/vysledek.html` + `vysledek.js` (`8969fe4`, `5811365`) — copy refresh, vykání, forwarding email/consent/v/s do `/api/analyze` přes `email` query (TASK-17)
- `fakan.cz/prehled.html` (`cc50f84`, `7c99240`) — copy refresh + 40+ tón, vykání i v dema-mock a anti-lock-in sekci (TASK-18, fixováno v opravném kruhu)
- `fakan.cz/ochrana-udaju.html` (`2e53ed4`) — Privacy Policy stránka, slug per tie-breaker, retence 12m, IČO 14389096, OR MSPH C 364981, EU-US DPF + Cloudflare DPA odkazy (TASK-19)
- `fakan.cz/odhlasit-hotovo.html` (`7715455`) — fallback opt-out stránka, `noindex, nofollow`, identifikace správce (TASK-20)
- Cloudflare Web Analytics snippet (`8ee29e3`) na všech 5 stránkách — cookieless, token TBD do nasazení

### Backend (8 modulů + 1 wrangler config)

- `wrangler.toml` (`5a46cdf`, `03cada7`) — bindings `DB` (D1), `RATELIMIT` (KV), `EMAIL` (`[[send_email]]`), `run_worker_first = ["/api/*", "/odhlasit*"]`, `CONSENT_SALT` jako secret přes `wrangler secret put` (NE `[vars]`) (TASK-01)
- `migrations/0001_leads.sql` (`5358d1f`) — D1 schema 17 sloupců + UNIQUE `leads_idem` (email, url, day) + indexy `leads_status_created`, `leads_last_contact` (TASK-02)
- `src/lib/url-strip.js` (`c04181f`) — URL bez query/hash, strip utm_*, fbclid, gclid, tokenů (TASK-03)
- `src/lib/hash.js` (`976a607`) — `sha256Hex(input, salt)` + `randomTokenHex(bytes)` přes Web Crypto, bez npm (TASK-04)
- `src/lib/mime.js` (`55df053`) — vlastní mini-MIME builder, multipart/alternative, UTF-8 subject encoding, žádný `mimetext` dep (TASK-05)
- `src/lib/lead.js` (`32a53cb`, `4a20ce4`) — `captureLead()` D1 insert + idempotence (zúžený catch na `leads_idem`) + IP hash + URL stripping + consent enforcement (TASK-06)
- `src/lib/mail.js` (`c4c6bf0`) — `sendMail()` Email Workers wrapper s 1× retry + `markLeadMailed()` UPDATE statusu (TASK-07)
- `src/lib/ratelimit.js` (`a4a3c68`, `bb5dea3`) — rate limit (`lead-capture` 5/h, `analyze` 3/24h) + honeypot helper, KV-backed (TASK-11)
- `src/optout.js` (`8263b52`) — `/odhlasit?t=<token>` flow, neutrální response napříč scénáři, idempotentní opt-out, ctx.waitUntil pro confirmation mail (TASK-09)
- `src/analyze.js` (`65b5b6b`, `5811365`, `bb5dea3`, `a39d8d9`) — piggyback lead capture po `done` SSE eventu, `parseLeadParams` (consent + email + version), SSE stage labely vykání (TASK-12)
- `src/worker.js` (`e33ed93`) — routing `/odhlasit` + rate limit gate + `POST /api/lead` 501 stub (TASK-10)

### Mail šablony (4 + layout)

- `src/email/_layout.js` (`40df4a2`) — společný HTML/text layout s patičkou Indigo Studio s.r.o. (IČO 14389096, OR MSPH C 364981, sídlo Praha)
- `src/email/lead-followup.js` (`40df4a2`) — souhrn analýzy + nezávazná nabídka + soft DOI úvodní odstavec („Pokud to nejste vy a tenhle e-mail jste nečekal/a, klikněte na Odhlásit")
- `src/email/magic-link-auth.js` (`40df4a2`) — DRAFT v0, na sklad pro budoucí auth flow
- `src/email/optout-confirmation.js` (`40df4a2`) — potvrzení odhlášení, bez opt-out odkazu (uživatel už odhlášen)
- `src/email/soft-doi.js` (`40df4a2`) — na sklad, MVP nepoužívá (soft DOI je integrován do prvního odstavce lead-followup)

### Dokumenty

- `projects/landing-v2/copy.md` (`e9bcd49`) — kompletní copy (tagline, 3 stránky, 4 mail šablony, Privacy Policy, consent text v1-2026-05-08)
- `projects/landing-v2/decisions.md` — všechna rozhodnutí Gate 1 (`589e044`), tie-breakery z PM rozpadu (`39aaed4`), post-research (`5dd1911`, `41b5882`), Fáze 4 pre-launch (`5d4099b`)
- `projects/landing-v2/risk-check.md` (`0a811e3`, `69d11c7`) — risk check + pre-launch check (verdikt GREEN, 24 PASS, 1 FIX-LIGHT, 5 drobností)
- `projects/landing-v2/forecast.md` (`66487b2`, `b382e35`) — forecast + final pre-launch projection (verdikt YELLOW, runtime $0/měs)
- `projects/landing-v2/launch-plan.md` (`aea63ec`) — D-1 → D+30 sequence, KPI (20 leadů / 30 dní), tracking server-side
- `projects/landing-v2/fit-check.md` (`232ed3e`) — fit do roadmapy (Fáze 0), reuse insights (4 šablony promote po retro)
- `projects/landing-v2/design.md` (`5dec428`) — design doc D1 leads + Email Workers + opt-out flow
- `projects/landing-v2/tasks.md` (`39aaed4`) — rozpad 27 tasků + konzistenční gate
- `docs/adr/ADR-001-email-outbound-cloudflare-vs-mailchannels.md` (`f9c7a43`) — volba Email Workers nad MailChannels
- `docs/research/2026-05-08-email-workers-dns-cz-patrny.md` (`74a8a4a`) — Cloudflare docs + DNS audit fakan.cz (MX/SPF/DKIM aktivní, DMARC chybí — retro)
- `docs/research/2026-05-08-architect-review-landing-v2.md` (`2bdee5a`) — architect review APPROVED WITH FIXES (1 BLOCK + 4 FIX, všechny vyřešeny)
- `docs/testing/landing-v2-T24.md` (`31f5520`) — tester report (po fixech tests green)
- `legal/consent-versions/v1-2026-05-08.md` (`ac6e959`) — evidence textu souhlasu pro audit

### Compliance

- D1 schema obsahuje `consent_at`, `consent_text_version`, `consent_ip_hash` (NE plain IP), `unsubscribe_token` UNIQUE
- Žádný tracking pixel v mailech (audit `<img>` v `src/email/`: 0 nálezů)
- Plain-text twin v každém mailu, ručně psaný
- Opt-out odkaz `/odhlasit?t=<token>` v lead-followup (každý marketingový mail)
- Server-side enforcement consent (`analyze.js parseLeadParams` — bez `c=1` + email + verze NEVZNIKNE záznam, NEODEJDE mail)
- URL stripping (utm_*, fbclid, gclid, tokeny) v `lead.js` před INSERT
- Rate limit `lead-capture` 5/h/IP-hash (po fixu `bb5dea3`), `analyze` 3/24h/IP-hash
- Honeypot pole `name="company"` (HTML) + server-side check obou `company` i `website`
- `List-Unsubscribe` header + `List-Unsubscribe-Post: One-Click` (RFC 8058) pro lead-followup, soft-doi
- Patička obchodního mailu per § 435 NOZ — Indigo Studio s.r.o., adresa, IČO, OR spisovka

### Akceptace

- 8 unit test souborů, **všechny zelené** po opravném kruhu (`5811365`, `03cada7`, `bb5dea3`, `4a20ce4`, `7c99240`, `a39d8d9`)
- HTML strukturní validátor: 0 errors napříč 5 stránkami
- `wrangler deploy --dry-run` projde bez varování
- Tykání v produkci: **0 výskytů** napříč 5 HTML stránkami a 4 mail šablonami (po Bug #2 fix)
- `grep` na buzzwordy v hero/CTA: 0 výskytů „AI agenty", „LCP", „WCAG", „kernel", „hydration"
- SQL idempotence test: 1. INSERT ok, 2. INSERT same email+url+day → UNIQUE constraint failed, 3. INSERT jiný day → ok
- Mail šablony render: subject < 50 znaků, IČO + OR v patičce, opt-out odkaz, žádný `<img>`

---

## 3. Změny oproti původnímu briefu (vědomé, schválené)

Z [`decisions.md`](decisions.md):

- **Tagline „Tvůj web. Bez výmluv." → „Váš web. Bez starostí."** — Fakan v Gate 1 delegoval kompletní redesign copy. Marketer dodal 3 varianty v `copy.md` § 1, varianta A (doporučená) implementována. Owner schvaluje v této delivery.
- **Rozpočet „5000 tokenů" → tým agentů + runtime $0/měs** — Fakan v Gate 1: „zakázku řeší tým agentů". Agent-čas ~56 h (přestřel 19 % vs. forecast 36–47 h, akceptováno).
- **Mailový provider: MailChannels → Cloudflare Email Workers** — legal preferuje (1 procesor místo 2, menší DPA povrch), Fakan potvrdil. ADR-001 dokumentuje. Post-research ujasnil legacy `send_email` binding (free) vs. nová Email Service (Workers Paid only) — vítěz legacy.
- **AI API volání zakázáno** — Fakan v Gate 1 rozhodl. Žádné Claude API v runtime, žádný copy review přes API. Marketer napsal copy ručně.
- **Mail scope rozšířen 1 → 4 šablony** — Fakan „ano, ano, ano" na všechny tři dotázané kategorie. Lead-followup + magic-link-auth (DRAFT v0) + opt-out-confirmation + soft-doi (na sklad).
- **Privacy Policy URL: `/zasady-ochrany-osobnich-udaju.html` → `/ochrana-udaju`** — tie-breaker (legal autorita + brand pivot 40+, kratší URL).
- **Opt-out param: `?token=` → `?t=`** — tie-breaker (architect autorita + 3 ze 4 dokumentů měly `?t=`).
- **Retence dat: 24m → 12m** — datová minimalizace (GDPR čl. 5(1)(c)), legal schválil s podmínkou retro 6m.
- **Soft DOI: samostatný mail → úvodní odstavec lead-followup** — nižší drop-off, GDPR-validní (single opt-in s důkazem + záchranná brzda).
- **DMARC + UTM whitelist + `from=mail` parametr** — odloženo do retra/další iterace. DMARC nice-to-have (Gmail/Outlook deliverability OK bez něj), UTM tracking není launch blokátor.
- **Cloudflare Web Analytics snippet** — auto-rozhodnuto v Fáze 4 zapnout (cookieless, drží mantinely sekce 2 CLAUDE.md).
- **Email query param sjednocen `em` → `email`** — Bug #1 z testera, fix `5811365` napříč FE/BE/testy.
- **`POST /api/lead` jako 501 stub** — vědomý scope cut, piggyback v `/api/analyze` je primary, fallback formulář není MVP.

---

## 4. Co zůstalo otevřené (pro retro / další iteraci)

Z `decisions.md`, architect review NICE nálezů, tester flagů a launch plánu:

- **DMARC pro `fakan.cz`** — research dohledal, že chybí. Nice-to-have, samostatný úkol v README priority 2.
- **UTM whitelist v `stripUrl()` + `from=mail` v mailových linkách** — marketing tracking, není launch blokátor.
- **Cron retention task** (auto-mazání leadů po 12m) — design § 3.4 backlog. Při ~50 lead/den první vyprší 2027-04, čas dost.
- **Brand brief / CLAUDE.md PR diff** (sekce 4 / sekce 3) — TASK-22 do retra, **nemerge bez Fakana**.
- **README task board update** — TASK-26 do retra (3 řádky `[x]`, 1 řádek `[~]` magic link auth).
- **`scripts/audit-url.sh`** — untracked Lighthouse helper, vznikl side-effectem juniora, retro rozhodnutí.
- **Architect review NICE nálezy (8)** — timing leak optout, dynamic import šablon, `optout.js` HTML font Inter, `lead-followup` varianta pro „analýza nedoběhla", camelCase vs. snake_case, `mail_attempts` count v bounced UPDATE, magic-string time slice. Retro.
- **Tester flagy (3 minor)** — soft-doi opt-out odkaz (AC drift, šablona „na sklad"), ratelimit scope name `'lead'` vs. `'lead-capture'` (cosmetic), `POST /api/lead` 501 (scope cut).
- **Mail deliverability monitoring první 2 týdny po launchi** — KV writes (rate limit, denní limit 1k na free tieru) + Email Workers daily limit + spam folder check Seznam/Gmail/Outlook.
- **Lighthouse + mobile 375 px + dark mode + klávesnicová navigace** — empirická validace v Chrome, tester nemá živý browser. Owner nebo tester po deployi.

---

## 5. Otázky pro Fakana k delivery approval

1. **Schvaluješ tagline „Váš web. Bez starostí."?** Marketer dodal varianty A/B/C v `copy.md` § 1. Doporučená je A. Pokud zamítneš, varianty B („Web, který se stará sám.") nebo C („Váš web. Vyřízeno.") jsou připravené.

2. **Schvaluješ retenci 12 měsíců** v Privacy Policy? Legal schválil s podmínkou retro 6m (vyhodnotit, jestli to neutíná leadům s dlouhým nákupním cyklem). Risk-check § 2.3 původně navrhoval 24m, marketer + legal sjednotili 12m kvůli minimalizaci.

3. **Schvaluješ patičku `index.html` — `provozuje Indigo Studio s.r.o.`** místo původního `Daniel Hromada`? Web obchodní listinou není, ale identita firmy se hodí.

4. **Schvaluješ jít s Cloudflare Email Workers (legacy `send_email` binding)?** Free, stable, ADR-001 dokumentuje. Pokud bys chtěl Email Service (paid beta, $5/měs base), je to jiná iterace.

5. **Před deployem dodej 4 hodnoty z Cloudflare dashboardu:**
   - `wrangler d1 create fakan_leads` → ID nahrazuje `TBD-replace-after-...` v `wrangler.toml`
   - `wrangler kv namespace create RATELIMIT` → ID nahrazuje TBD v `wrangler.toml`
   - `wrangler secret put CONSENT_SALT` → 32+ bytes random string (NIKDY do gitu)
   - Cloudflare Web Analytics token → nahrazuje `TBD-CF-WEB-ANALYTICS-TOKEN` v `<script data-cf-beacon>` na 5 HTML stránkách

6. **Po deployi spustit migraci proti remote D1:** `wrangler d1 execute fakan_leads --file=./migrations/0001_leads.sql --remote`

---

## 6. Plán dalších kroků

- **D-1 (2026-05-14):** Fakan dodá 4 hodnoty (D1 + KV + secret + CF Web Analytics token). PM verifikuje. Tester deliverability test 4× inboxů (Gmail, Seznam, Outlook, Centrum), spam score ≤ 2/10.
- **D0 (2026-05-15) ráno:** produkční deploy přes `wrangler deploy` nebo Workers Builds CI po push do main. Worker logs ukazují normální traffic, žádné 5xx. Fakan ověří 1 reálný lead end-to-end (D1 řádek + mail v inboxu).
- **D0 odpoledne:** soft launch (5–10 lidí osobně přes WhatsApp / mail).
- **D+1:** sběr feedbacku z měkkého kruhu. Pokud ≥ 2 z 5 řeknou „nerozumím", **veřejný launch se pozdrží** a copy se přepíše.
- **D+2 (2026-05-17):** veřejný launch (LinkedIn varianta B storytelling + Twitter + Reddit r/podnikatele).
- **D+7 (2026-05-22):** první týdenní retro — počet leadů, mail deliverability, opt-out rate, top referrer, KV writes count.
- **D+30:** KPI gate — cíl 20 leadů, opt-out < 5 %, konverze ≥ 3 %. Pokud ne, debug copy/kanál (ne Ads).

---

**Status:** Pre-launch GREEN. Čeká owner approval pro produkční deploy + dodání 4 hodnot z dashboardu (D1 ID, KV ID, CONSENT_SALT, CF Web Analytics token).
