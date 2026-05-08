# Cost forecast — landing-v2

**Autor:** finance
**Datum:** 2026-05-08
**Stav:** Fáze 1 — forecast, čeká Gate 1

---

## TL;DR pro orchestrátora

- **Nejpravděpodobnější interpretace „5000 tokenů"** = **5 000 Kč peněžně** nebo **~50 hodin lidské práce**. Doslovných 5 000 AI tokenů je technicky nesmysl pro iteraci tohoto rozsahu — to jsou tak 3 promptíky.
- **Reálný runtime cost** redesignu: **prakticky nula** (0–5 USD/měsíc), všechno se vejde do Cloudflare free tieru. MailChannels free, D1 free, Workers free při očekávaném traffic.
- **Skutečný náklad iterace = lidský čas** — 35–50 h napříč rolemi, většinou agent-hodiny.
- **Eskalace na ownera ANO** — potvrdit interpretaci „5000 tokenů" a politiku AI použití (smí agent volat Claude na copy review, nebo všechno musí napsat ručně?). Bez toho má iterace dvě různé cenovky.

---

## 1) Interpretace „5000 tokenů" — co tím Fakan mohl myslet

Fakan napsal doslova *„hned, 5000 tokenů"*. Bez kontextu se to dá číst čtyřmi způsoby. Vyhodnocení:

| Scénář | Co to znamená | Vejde se to? | Verdikt |
|---|---|---|---|
| **A — 5 000 AI tokenů** (Anthropic / Workers AI) | Při Claude Sonnet 4.5 ~3 USD/M input + ~15 USD/M output. 5 000 tokenů = ~0,02 USD = **~50 haléřů**. Reálně to vystačí na **3–5 promptíčků** (jeden system prompt + krátký dotaz + odpověď). | Pro celý redesign tří stránek + 2 mail šablon **NE**, pokud agenti smí volat AI na copy review. Pokud iterace AI nepoužívá vůbec (všechno píšou agenti svým „mozkem" v rámci běžného tool-callu, který Fakan neplatí zvlášť) — pak ANO, nula spotřeba. | **Realisticky NE**, ledaže Fakan myslel doslova „dělejte to bez AI volání jako doplňkového nástroje". |
| **B — 5 000 Kč peněžně** | ~210 USD při kurzu 23,8 Kč/USD. Měsíční rozpočet pro Cloudflare + třetí strany + případné AI tokeny. | Cloudflare free tier pokryje 100 % očekávaného traffic. Reálná spotřeba: **0–5 USD/měsíc** (viz tabulka níže). 5 000 Kč zbyde 200+ USD jako rezerva. | **ANO, sedíme s velkou rezervou.** |
| **C — 5 000 hodin** | ~625 pracovních dní = 2,5 roku full-time. | Pro „hned, do týdne" **nesmysl**. | Vyhodit z úvahy. |
| **D — 50 hodin lidské práce** (interpretace „5k tokenů ≈ pár desítek hodin práce") | 50 h napříč rolemi = ~6 dní jednoho agenta na full úvazek, nebo ~8 dní s paralelizací (architect, junior, marketer, tester, legal, finance). | Pasuje na termín 2026-05-15 (8 dní). Rozpad níže v sekci 4. | **ANO, sedíme přesně.** |

**Bottom line interpretace:** B nebo D, případně oboje současně (5 000 Kč jako rozpočtový strop, ~50 hodin jako kapacita). A je matematicky nesmysl pro tenhle rozsah.

---

## 2) Předpoklad runtime nákladů

Co iterace landing-v2 vlastně spotřebuje v provozu, jakmile pojede:

- **Traffic landing:** odhad 1 000 visitů/den (v začátku méně, optimisticky pro forecast)
- **Free analýzy:** ~50–100/den, deterministické detektory v `src/analyze.js`, **žádné AI volání**
- **Lead capture submisí:** ~5–20/den (consent rate 10–30 % z analyzátorů)
- **Outbound mail:** ~5–20 follow-upů/den
- **Browser Rendering / screenshot:** Out of scope této iterace (asynchronní vlna je samostatný úkol)
- **AI volání v produkci:** **NULA**, free analýza je čistě deterministická

---

## 3) Měsíční runtime náklady

| Položka | Spotřeba (odhad) | Free tier | Placená spotřeba | Cena |
|---|---|---|---|---|
| **Cloudflare Workers requests** | ~30 000/měsíc (1k visit/den × 1 doc + API) | 100 000/den (3M/měsíc paid plánu) | 0 | **0 USD** |
| **Cloudflare Workers CPU** | <10 ms avg na request | 30 s CPU/request, 50ms na free | 0 | **0 USD** |
| **D1 reads** (lead lookup, idempotence) | ~3 000/měsíc | 5M/den | 0 | **0 USD** |
| **D1 writes** (lead inserts) | ~600/měsíc | 100k/den | 0 | **0 USD** |
| **D1 storage** | <1 MB (řádově tisíce řádků) | 5 GB | 0 | **0 USD** |
| **KV** (případně rate limit / idempotence token) | <10k reads, <2k writes | 100k reads/den, 1k writes/den | možná drobně přes free | **~0 USD** |
| **R2 storage** (mailové obrázky, OG) | <100 MB | 10 GB | 0 | **0 USD** |
| **R2 egress** | jakýkoliv | zdarma vždy | 0 | **0 USD** |
| **MailChannels** (outbound přes Workers) | ~600 mailů/měsíc | zdarma pro Cloudflare Workers | 0 | **0 USD** *(ověřit aktuální politiku)* |
| **Cloudflare Email Routing** (alternativa, inbound) | irelevantní pro outbound | zdarma | 0 | **0 USD** |
| **Doména `fakan.cz`** | už vlastněná | — | 0 | **0 USD** (mimo iteraci) |
| **AI tokeny v produkci** | 0 (nepočítá se) | — | 0 | **0 USD** |
| **AI tokeny při vývoji iterace** | viz risk flags níže | — | viz scénář A | **0–10 USD** |

**CELKEM MRR cost:** **~0 USD/měsíc** (prakticky nula, plus minus pár halířů za drobné překroky KV)

**Per-lead cost:** **~0 USD** — ani halíř, dokud nepřekročíme free tier MailChannels nebo Workers requests

**Per-analýza cost:** **~0 USD** — deterministické detektory, žádné AI

---

## 4) Lidský čas — rozpad iterace (interpretace D)

Pokud Fakan myslel kapacitu, rozpočet času na celou iteraci. Odhad agent-hodin per role:

| Role | Co dělá | Odhad |
|---|---|---|
| **owner** | brief (hotovo), schvalování | 2 h |
| **legal-advisor** | risk check, Privacy diff, znění souhlasu, mail compliance | 3–4 h |
| **finance** | tenhle forecast + průběžné sledování + retro | 2 h |
| **product-manager** | fit check, kapacita | 1 h |
| **project-manager** | rozpad, koordinace, gates, status reporty | 3–4 h |
| **senior-architect** | návrh lead capture (D1 schema, Worker route, MailChannels integrace), code review | 4–5 h |
| **researcher** | doplnit MailChannels aktuální politiku, double opt-in best practice | 1–2 h |
| **junior-developer** | implementace: copy redesign 3 stránek, lead form, D1 migrace, MailChannels send, mail šablony | 12–16 h |
| **tester** | acceptance criteria, smoke test celého flow, mobile a a11y check | 3–4 h |
| **marketer** | copy redesign (vykání, 40+ tón, žádný buzzword), mail šablony | 5–7 h |
| **CELKEM** | | **~36–47 h** |

Sedí to do **interpretace D (50 h)** s mírnou rezervou. Sedí to do **termínu 2026-05-15** (8 dní × 6 paralelních rolí ≈ 48 dostupných agent-hodin/den, žádná role se nezasekne).

---

## 5) Breakpointy — kdy to začne stát

Současný forecast = nula. Začne stát peníze, když:

| Breakpoint | Hranice | Co se stane |
|---|---|---|
| **Workers requests** | >100k/den | Z free tieru do paid (5 USD/měsíc base + 0,30 USD/M nad 10M). Při 1k visit/den máme rezervu 100×. |
| **D1 writes** | >100k/den | Z free do paid. Při ~600/měsíc rezerva 5 000×. |
| **MailChannels** | abuse limit (přesné číslo není veřejné, anti-spam ~stovky/den per sender) | Pokud začneme posílat masově (newsletter, bulk), MailChannels nás může omezit. **Této iterace se to netýká** — single transactional follow-up. Když přijde newsletter, jiný účtovaný provider (Resend ~20 USD/měsíc base). |
| **AI tokeny v produkci** | jakákoliv hodnota >0 | Iterace teď nezavádí AI volání. Pokud později (asynchronní vlna, AI redesign), nový forecast. |
| **R2 mail attachmenty** | >10 GB | Pokud bychom posílali velké přílohy. Mailové šablony plain-text + HTML jsou KB, ne MB. |
| **Lead spam attack** | >2 000 leadů/den (10× normál) | Spam botem zahlcený formulář. **Mitigace v iteraci:** Turnstile + rate limit (samostatný úkol, ale doporučená synchronizace). Bez toho riziko D1 write quota nebo MailChannels reputation hit. |

**Eskalace na ownera při překročení:** automatický flag z `wrangler tail` do retro reportu, denní limit kontroluje finance.

---

## 6) AI tokeny při vývoji — risk flags

Tady je největší nejistota a důvod eskalace. Fakanova fráze „5000 tokenů" se může týkat AI použití **při vývoji iterace** (agent volá Claude na copy review). Tři scénáře:

**Scénář P0 — agenti AI nepoužívají vůbec při vývoji.** Vše napíšou agenti v rámci běžného Claude Code tool-callu (který Fakan neplatí jako extra spotřebu nad rámec předplatného). Spotřeba: **0 dodatečných tokenů**. Sedí do scénáře A.

**Scénář P1 — agent volá Claude API přímo na copy review** (např. „přepiš tento odstavec pro 40+ cílovku"). Realistický odhad pro celou iteraci: 5–15 volání × 2 000 tokenů avg = **10–30 tisíc tokenů**. Při Claude Sonnet ~0,15 USD. Pokud Fakan myslel doslova 5 000 tokenů, **přestřelíme 2–6×**, ale finančně mluvíme o haléřích.

**Scénář P2 — agent generuje copy přes Claude bulk** (např. „napiš mi 10 variant hero textu"). Realistický odhad: 50 volání × 5 000 tokenů = **250 tisíc tokenů**, ~1,5 USD. Nad 5 000 tokenů 50×, ale stále <50 Kč.

**Doporučená pojistka v iteraci** (pokud Fakan potvrdí, že myslel AI):

- **Limit per AI volání:** max 1 500 tokenů output, max 3 000 tokenů context
- **Limit počtu AI volání per iterace:** 20 (s logem, kdo volal, na co, kolik)
- **Cap prompt cache:** systémové prompty agentů se cache-ují (Anthropic prompt caching), aby se neplatilo znovu

I s těmito pojistkami se vejdeme **pod 1 USD = pod 25 Kč** za AI použití při vývoji. To je řádově jiné než „5 000 tokenů" jako absolutní strop.

---

## 7) Pricing reference (k 2026-05-08)

> ⚠️ **Researcher prosím ověř,** ceny se mění. Tady je moje aktuální mentální mapa:

- **Cloudflare Workers** — Free 100k requests/den, paid Workers Bundled 5 USD/měsíc base + 0,30 USD/M nad 10M
- **Cloudflare D1** — Free 5M reads/den, 100k writes/den, 5 GB storage
- **Cloudflare KV** — Free 100k reads/den, 1 000 writes/den
- **Cloudflare R2** — Free 10 GB storage, 1M Class A ops/měsíc, 10M Class B ops/měsíc, **egress vždy zdarma**
- **MailChannels** — historicky free pro Cloudflare Workers, **politika se v 2024 měnila, prosím research aktuální stav** (možná teď vyžaduje SPF/DKIM nebo placený plán pro non-CF zákazníky)
- **Anthropic Claude Sonnet 4.5** — ~3 USD/M input, ~15 USD/M output, prompt caching -90 %
- **Browser Rendering** — Workers Paid $5/měsíc plán nutný, 10 minut/den free pro paid users

**Doporučení:** researcher dohledá aktuální MailChannels politiku **před** Gate 1, protože pokud změnili podmínky, vrací to architekta zpět k volbě „MailChannels vs. Email Workers vs. placený provider".

---

## 8) Doporučení Fakanovi (1 odstavec, business řečí)

**Pokud jste myslel 5 000 Kč jako rozpočet, sedíme s rezervou — runtime náklad iterace je prakticky nula, vejde se to do Cloudflare free tieru a 5 000 Kč zbyde celá. Pokud jste myslel ~50 hodin agent-času, sedíme přesně, máme tam ~36–47 h reálné kapacity. Pokud jste myslel doslova 5 000 AI tokenů, je to nesplnitelný strop pro iteraci toho rozsahu — vejdeme se jen tehdy, pokud agenti nesmí volat Claude API na copy review a všechno bude napsáno v rámci běžného Claude Code workflow (v praxi to nepoznáte, AI Anthropic API faktura zůstane na nule). Doporučuji potvrdit, kterou interpretaci jste myslel, abychom věděli, jestli máme zakázat AI copy review nebo ne. Mimo to: lead capture flow nezavádí žádné AI volání v produkci, takže provozní cena zůstává nula bez ohledu na traffic.**

---

## 9) Risks (souhrn)

| Risk | Pravděpodobnost | Dopad | Mitigace |
|---|---|---|---|
| **MailChannels změnil politiku** (placený plán, KYC) | střední | středně vysoký (blokuje lead capture) | Researcher ověří před Gate 1. Fallback: Resend (~20 USD/měsíc base). |
| **Spam bot zahlcení formuláře** | nízká teď, vyšší po launch | střední (D1 quota, MailChannels reputation) | Turnstile + rate limit (synchronizovat se samostatným úkolem v Priority 1). |
| **AI tokeny utečou při vývoji** | nízká, ale jdou se kontrolovat | nízký finančně, vysoký compliance vůči interpretaci „5000 tokenů" | Limit per volání + log. |
| **Termín 2026-05-15 nestihne se** | střední | vysoký (blokuje obchod) | Scope cutting: mailové šablony zjednodušit na 1 verzi (lead followup), double opt-in jen pokud legal trvá. |
| **Brand pivot konflikt s tagline** | jistý dle briefu | nízký | Otevřená otázka pro Fakana, blokátor pro copy. Eskalace přes PM. |

---

## Průběžný report (vyplní finance v Fázi 3)

<!-- Skutečná spotřeba zatím, drift od forecastu, akce. -->

## Final pre-launch projection (Fáze 4)

<!-- Aktualizovaný forecast s reálnými čísly z exekuce. -->

---

## Final pre-launch projekce 2026-05-08

Kontext: po Gate 1, po implementaci, po architect code review (APPROVED WITH FIXES) a po opravách (5× fix commit). Vstupy: `decisions.md` (legacy `send_email` binding, AI API zakázáno), `design.md`, research `2026-05-08-email-workers-dns-cz-patrny.md`, code review `2026-05-08-architect-review-landing-v2.md`.

### 1. Runtime náklady — produkce

Předpoklad traffic pro launch: **~1 000 visitů/den, ~50 leadů/den, ~50 mailů/den** (analýza, follow-up). Lookups na opt-out řádově desítky/den.

| Položka | Free tier | Reálné využití (předpoklad) | Cena/měsíc |
|---|---|---|---|
| Cloudflare Workers requests | 100 000/den | ~1k visit/den × 5 reqs = **5 000/den** | **$0** |
| Cloudflare Workers CPU | 10 ms/req free, 50 ms strop | <10 ms avg (deterministické detektory + 1 D1 insert) | **$0** |
| Cloudflare D1 reads | 5M/den | ~100/den (opt-out lookup, idempotence check) | **$0** |
| Cloudflare D1 writes | 100 000/den | ~50/den (lead inserts) + drobně updates | **$0** |
| Cloudflare D1 storage | 5 GB | <1 MB (řádově tisíce řádků leads) | **$0** |
| Cloudflare KV reads | 100 000/den | ~5 000/den (rate limit checks `lead:ip:*`) | **$0** |
| Cloudflare KV writes | 1 000/den | **~500–1 000/den** (rate limit increments) | **$0–nízké** ⚠ |
| Cloudflare Email Workers (legacy `send_email`) | unlimited (dynamicky upravované) | ~50 mailů/den | **$0** |
| Cloudflare R2 storage | 10 GB | 0 (nepoužíváme) | **$0** |
| Doména `fakan.cz` | — | Fakan už platí externě | **mimo iteraci** |
| AI API volání (Claude / Workers AI) | — | **0** (decisions.md zakázalo) | **$0** |
| **CELKEM runtime** | | | **~$0/měsíc** |

**TL;DR:** Produkce stojí **0 USD/měsíc** při očekávaném traffic. Žádný breakpoint v dohledu pro bootstrap fázi.

### 2. Breakpointy — kdy se to mění

Kdy zaplatíme první korunu, seřazeno podle pravděpodobnosti:

1. **KV writes 1 000/den (rate limit)** — **první ohrožený limit**. Při 1k visit/den a každý spustí 1 rate-limit increment, jsme na hraně. Pokud spam bot zahltí formulář, přeskočíme limit za hodinu. **Cena nad limit:** $0,50/M writes, takže i 10× nad limit = $0,15/měs (zanedbatelné). Ale je to první signál, že něco škálujeme.
2. **Workers requests 100k/den** — viral hit (~30 000 unikátních visitorů/den) by tohle protrhl. Cena: $0,30/M nad free tier + $5/měs Workers Paid base. V bootstrap fázi nereálné, ale po launchi sleduj.
3. **Email Workers daily limit** — Cloudflare ho v docs neuvádí, dynamicky upravuje per-account. Bootstrap fáze (~50 mailů/den) je hluboko pod prahem. Pokud někdy přijde „daily limit exceeded", **Limit Increase Request** je free.
4. **D1 writes 100k/den** — neaktuální risk. Při ~50 leadech/den máme rezervu **2000×**. Spam attack 100k leadů/den by to teoreticky protrhl, ale rate limit dříve.
5. **D1 storage 5 GB** — při ~50 leadech/den × ~1 KB/řádek = ~18 MB/rok. Na 5 GB cíl trvá **270 let**. Ne.

### 3. Migrace na Email Service Email Sending — kdy zvážit

- **Současný stav:** legacy `send_email` binding, free, žádné placené plány. Pro 100–500 mailů/měsíc to pohodlně stačí.
- **Breakpoint na migraci:** **při >3 000 mailů/měsíc** (~100/den) zvážit přechod na novou Email Service Email Sending. Nutné: Workers Paid plán **$5/měsíc**, pak 3 000 free + $0,35/1 000 dalších.
- **Ekonomika:** pro 5 000 mailů/měsíc by stálo $5 + $0,70 = $5,70/měs. Pro bootstrap fázi (zatím ~1 500/měs) **legacy zůstává vítěz**.
- **Důvod migrace dřív** by byl: 1) potřeba broadcastu (newsletter, ne MVP), 2) hard limit na legacy bindingu, 3) potřeba doručitelnosti SLA. Nic z toho teď.

### 4. Skutečný cost iterace landing-v2 (agent-čas)

Iterace měla **37 commitů** v rozpadu:
- **17× feat(landing-v2)** — implementační tasky (TASK-01 až TASK-20)
- **13× docs** — brief, risk-check, forecast, fit-check, design, ADR-001, copy, rozpad, post-research, OR spisovka, code review, acceptance test
- **6× fix(landing-v2)** — opravy po code review a acceptance testu (em/email mismatch, prázdný CONSENT_SALT, rate limit chybějící, idempotence catch, prehled vykání, SSE labely)
- **1× chore** — scaffold

Hrubý odhad agent-času (vážený podle rolí):

| Role | Co dělala | Odhad |
|---|---|---|
| **owner** | brief + Gate 1 odpovědi + delivery approval + dodal IČO/sídlo | ~3 h |
| **legal-advisor** | risk check + Privacy Policy + consent text + pre-launch check | ~5 h |
| **finance** | tenhle forecast + průběžně + final projekce + retro | ~3 h |
| **product-manager** | fit check, kapacita | ~1 h |
| **project-manager** | rozpad + konzistenční gate + tie-breakery + delivery | ~5 h |
| **senior-architect** | design doc + ADR-001 + post-research rozhodnutí + code review s fixy | ~7 h |
| **researcher** | Email Workers + DNS fakan.cz + CZ patička + ARES VR | ~3 h |
| **junior-developer** | TASK-01..TASK-20 implementace + 6 oprav + 5 dodatečných souborů | **~18 h** |
| **tester** | T24 acceptance + edge cases + 1 blocker reportován | ~4 h |
| **marketer** | tagline „Tvůj web. Tvoje pravidla." + copy 3 stránek + 4 mail šablony + Privacy Policy + consent | ~7 h |
| **CELKEM hrubě** | | **~56 h** |

Forecast Fáze 1 byl **36–47 h**, **realita ~56 h** = **~19 % přestřel** (typický range pro první iteraci nového typu).

**Důvody přestřelu:**
- 5 fix commitů po code review + acceptance test = ~3–4 h navíc nečekaného opraváctví
- Konzistenční gate odhalil 3 tie-breakery (URL slug PP, opt-out token name `t`, MailChannels reference v risk-check) = ~1 h navíc
- Research o Email Workers měl flag „dvě Cloudflare služby, snadno se zamění" = post-research rozhodnutí navíc

**AI tokeny:** **0** v rámci API volání (decisions.md zakázalo). Tokeny v běžném Claude Code workflow neměříme.

### 5. Retro vstup — top 3 spotřebitelé času (ne peněz)

Pro PM produktu retro:

1. **Junior-developer (~18 h)** — drtivá většina implementačního času. Distribuce: ~12 h prvních feat commitů + ~3–4 h fix kolo + ~2 h scaffolding helpers (mime, hash, url-strip).
2. **Architect (~7 h) + Marketer (~7 h)** — design doc s kompletní D1/Email Workers architekturou + ADR-001 + code review byl těžkotonážní. Marketer redesignoval kompletní copy 3 stránek + 4 mail šablon + Privacy Policy.
3. **PM + Legal (~5 h každý)** — rozpad 20+ tasků, konzistenční gate s 3 tie-breakery, risk-check s GDPR articulátem.

**Tip pro další iterace:**
- **Konzistenční gate je drahý** (~1 h navíc), ale ušetřil 3 chyby v implementaci (špatný URL slug, špatný query param). Stojí to za to.
- **Code review po implementaci stál ~3–4 h fix kruh.** Příště zvážit lehčí mid-implementation review po 50% commitů, ne až na konci.
- **Research s flagem „dvě verze služby"** = vždy explicitně rozhodnout v decisions.md. Tohle se povedlo až post-research, mohlo se rozhodnout dříve a ušetřit kontextové přepínání.

### 6. Finance verdikt pro Gate 3

**🟡 YELLOW.**

Důvod: **runtime ekonomicky bezpečný (~$0/měs do desetinásobku predikovaného traffic)**, ale jeden konkrétní risk k watchování:

- **KV writes 1 000/den limit** je první breakpoint, který skutečně může spadnout. Při 1k visit/den jsme na hraně, spam attack to protrhne za hodinu. Cena překročení je řádově $0,15/měs (zanedbatelné), ale **monitorovat se to musí** — Cloudflare dashboard, KV namespace `RATELIMIT`, denní writes count.

Pokud Fakan akceptuje YELLOW se sledováním KV writes po 1. týdnu produkce, **GREEN se autoupgraduje** jakmile bude reálná data. Zatím není důvod blokovat Gate 3 — žádný kritický náklad ani externí riziko.

**Co sleduji po launchi (první 2 týdny):**
1. KV writes per den v Cloudflare dashboardu
2. Email Workers `mail_attempts > 1` v D1 (signal o problémech s deliverability)
3. Lead/visit conversion rate (sanity check forecastu — pokud >10× nad odhad, breakpointy se posouvají)

## Retro (Fáze 6)

---

## Retro 2026-05-08

**Autor:** finance
**Vstupy:** delivery report (44 commitů, ~56 agent-h), decisions.md (Fáze 4 — přestřel 19 % akceptován), approvals.md (owner OK), tester report T24 (FAIL → fix kruh), architect review (APPROVED WITH FIXES, 1 BLOCK + 4 FIX → fix kruh).

### 1. Skutečný cost vs. forecast

| Položka | Forecast | Skutečnost | Diff |
|---|---|---|---|
| Runtime cost / měsíc | $0–5 | $0 (pre-launch, traffic = 0) | **0** |
| AI tokeny (API volání) | 0 (Gate 1 zakázal) | 0 | **0** |
| Externí náklady (provideři, licence, fonty) | $0 | $0 | **0** |
| Agent-h celkem | 36–47 h | **~56 h** | **+19 % přestřel** |
| Commitů iterace | n/a | 44 | n/a |
| Cash-out Fakana | 0 Kč | 0 Kč | **0 Kč** |

**Bottom line:** Iterace ekonomicky **zelená**. Žádný cent peněz neuteklo, runtime $0/měs do 10× predikovaného traffic, breakeven proti rozpočtu „5000 Kč" (interpretace B z Gate 1) je 100% dosažený se 100% rezervou. Drift je výhradně v agent-čase, který Fakan v Gate 1 explicitně delegoval na tým.

### 2. Top 3 spotřebitelé času (ne peněz)

#### 1. Opravný kruh po code review + acceptance test (~3–4 h navíc)

**Co:** 6 fix commitů po architect review (APPROVED WITH FIXES) a tester acceptance (FAIL):
- `5811365` — kontraktní bug `em` vs. `email` napříč FE/BE/testy (BLOCKER z testera, fixoval architect call)
- `03cada7` — prázdný `CONSENT_SALT` v `[vars]` smazán (BLOCK z architect review, security incident in waiting)
- `bb5dea3` — `lead-capture` rate limit připojen v `captureLeadAndMail` (FIX z architect review, anti-abuse vrstva chyběla)
- `4a20ce4` — idempotence catch zúžen na `leads_idem` (FIX z architect review, cross-table false positive)
- `7c99240` — `prehled.html` dokončit vykání mimo hero (MAJOR z testera, AC drift TASK-18)
- `a39d8d9` — SSE stage labely vykání v `analyze.js` (minor z testera, hláška během analýzy)

**Spotřeba:** 6 fixů × průměrně 30 min juniora = **3 h**, plus rework testů + re-run = ~30 min. Celkem **~3,5 h ze ~56 h iterace = 6 % celkového času** strávilo opravováním už hotové práce. To je rework, ne nová hodnota.

**Příčina koncentrovaná do jednoho:** **kontraktní bug `em` vs. `email`** — junior implementoval `em=` ve frontendu (per design.md § 3.1), ale `parseLeadParams` v `analyze.js` četl `email=` (zřejmě protože si junior četl test fixture, ne design). Tester to zachytil, ale teprve **po** dokončení implementace. Architect review bug nezachytil, protože reviewoval kód proti sobě (FE i BE psal stejný junior, oba byly „konzistentní v rámci kódu", jen jiné než design).

#### 2. Tester acceptance — přestřel 8,5 h vs. forecast 3–4 h (~+5 h)

**Co:** Tester poctivě prošel 11 sekcí (8 unit testů + lead capture happy path + edge cases + opt-out flow + frontend smoke + HTML strukturní validátor + wrangler dry-run + SQL migrace + 4 mail šablony render + brand check + CLAUDE.md mantinely). Na výstupu 65+ PASS, 2 FAIL, 5 FLAGS. Dohromady **8,5 h** podle reálné spotřeby z delivery reportu.

**Forecast byl 3–4 h** (forecast Fáze 1, sekce 4) — to je **2× přestřel**, řádově horší než celkových 19 % iterace. Důvod: forecast počítal s spot-checkem kritických cest, realita byla plná acceptance celé iterace včetně mail render, idempotence reprodukce, security audit honeypot, vykání regex sken všech 5 stránek + 4 mail šablon.

**Hodnota přestřelu:** **vysoká.** Tester sám zachytil 1 BLOCKER (Bug #1 `em`/`email`) + 1 MAJOR (`prehled.html` tykání) + 5 FLAGS. Bez něj by lead capture v produkci nikdy nenaběhla — Fakan by zjistil sám až po prvním reálném leadu, který se neobjevil v D1.

#### 3. Konzistenční gate v PM rozpadu — 3 tie-breakery (~1 h navíc)

**Co:** Při rozpadu na tasky (commit `39aaed4`) PM odhalil 3 nekonzistence napříč dokumenty:
- URL slug Privacy Policy: `/zasady-ochrany-osobnich-udaju.html` (design + decisions auto) vs. `/ochrana-udaju` (risk-check § 4.2 + fit-check § 4.4) → vyhrál `/ochrana-udaju`
- Opt-out query parametr `?token=` (brief) vs. `?t=` (design + risk-check + README) → vyhrál `?t=`
- MailChannels reference v risk-check § 5.3 vs. Email Workers v Gate 1 + ADR-001 → vyhrál Email Workers

**Spotřeba:** ~1 h PM práce navíc + dohledávání v dokumentech. **Hodnota: vysoká.** Bez gatu by junior implementoval podle jednoho zdroje a ignoroval druhý → 3 chyby v produkci → další opravný kruh za další ~3 h. **ROI ~3:1**, gate se vyplatil.

### 3. Optimalizace pro příští iterace

#### A. Explicitní API kontrakt v rozpadu (PM tasks.md)

**Problém:** Bug `em` vs. `email` vznikl tím, že copy.md, design.md a tasks.md neformalizovaly query string kontrakt jako jediný zdroj pravdy. Junior si při implementaci sáhl do nejbližšího referenčního bodu (test fixture), který byl jiný než design.

**Řešení:** PM v rozpadu dodá samostatnou sekci **„API kontrakt"** v `tasks.md` se všemi parametry napříč FE/BE — query stringy, response formáty, query klíče přesně jak je vidí prohlížeč. Při review se kontroluje proti této sekci, ne proti kódu sobě.

**Cena:** ~30 min při rozpadu. **Návratnost:** ušetří ~3 h opravného kruhu = **ROI 6:1**.

#### B. Tester cap 4 h pro malé iterace + opravný kruh budget

**Problém:** Tester přestřelil 5 h (8,5 h vs. 3,5 h forecast) — pro malou iteraci to je hodně.

**Řešení dvojí:**
1. **Cap testera na 4 h pro acceptance** v capacity plánu, plus rezervovat **1–2 h opravný kruh budget** explicitně. Plné acceptance jen pro produkční launch features.
2. **Pro opakované iterace stejného typu** (lead capture v2, lead capture v3) **spot-check sample** stačí, full acceptance jen poprvé.

Forecast bude přesnější: **prv í iterace nového typu = 6 h tester (4 h acceptance + 2 h opravný kruh), druhá iterace = 2 h spot-check.**

#### C. Buffer +20 % v capacity plánu pro první iterace

**Problém:** Drift 19 % (36–47 h forecast → 56 h skutečnost) je typický pro první iteraci nového typu. Buffer chyběl.

**Řešení:** Pro první iteraci nového typu (lead capture compliance, BYO klíč flow, billing flow, …) PM přičte **+20 % rezervu** do capacity plánu. Druhá iterace stejného typu má naopak rezervu díky reuse a learnings.

**Praktický dopad:** kdybychom měli buffer od Fáze 1, forecast by byl 43–56 h místo 36–47 h, drift by byl **0 %**, ne 19 %.

#### D. Side-effect tooling jako samostatný task, ne improvizace

**Problém:** `scripts/audit-url.sh` (Lighthouse helper) si junior vytvořil jako vedlejší produkt T16 smoke testu, neaktivně zacommitoval. Owner v approval řekl „commitněte ho s krátkým README, ať to ostatní vidí", ale strukturálně to do iterace nepatřilo.

**Řešení:** PM v rozpadu explicitně říct **„pokud potřebuješ tooling, navrhni samostatný task s odhadem, nedělej side-effect z jiného tasku".** Buď to bude task s hodinou rozpočtu, nebo to nebude — žádné stealth deliverables.

**Cena:** drobná disciplína. **Hodnota:** čistý audit time spent + lepší reuse (samostatný task má vlastní AC a dokumentaci, side-effect má v hlavě jen junior).

### 4. Reuse / promotion do standardů (kandidáti pro PM produkt retro)

Top 3 reuse z fit-checku, které doporučuju **promotovat do `templates/`** v rámci PM produkt retra:

#### 1. Šablona lead capture (D1 schema + Email Workers + soft DOI + opt-out token) → `templates/lead-capture/`

**Co reusovat:**
- `migrations/0001_leads.sql` — 17 sloupců, 3 indexy, idempotence per-day, UNIQUE token
- `src/lib/lead.js` + `src/lib/hash.js` + `src/lib/url-strip.js` — capturing logika
- `src/lib/mail.js` + `src/lib/mime.js` — Email Workers wrapper bez `mimetext` dep
- `src/optout.js` — opt-out flow s neutrálním response (security-correct)
- `src/lib/ratelimit.js` — KV-backed throttling

**Hodnota:** příští iterace vyžadující lead capture / kontaktní formulář / objednávkový formulář ušetří **~10–14 h** (junior + architect design).

#### 2. Brand-token komponenta 40+ (typografie, kontrast, animace) → tokens.css v Priority 2 README

**Co reusovat:**
- Body font ≥ 18 px (mobil 17), CTA ≥ 56 px, kontrast WCAG 2.2 AA — z hero `index.html`, `vysledek.html`, `prehled.html`
- Brand barvy z PRD sekce 5.2 + 40+ adjustace (větší typografie, vyšší line-height)
- Sentence case v UI titulech, vykání default

**Hodnota:** příští klientský web pro 40+ cílovku ušetří **~3–5 h** redesignu.

#### 3. Mailové šablony (multipart, opt-out, bez trackeru, CZ patička) → `templates/email/`

**Co reusovat:**
- `src/email/_layout.js` — společný HTML/text layout s patičkou Indigo Studio s.r.o. (parametrizace názvu firmy + IČO + OR pro budoucí zákazníky fakan.cz)
- `src/email/lead-followup.js` + `optout-confirmation.js` + `soft-doi.js` + `magic-link-auth.js` (DRAFT v0)
- Pravidlo: **0 `<img>` v šablonách** (žádný tracking pixel), plain-text twin povinný, `List-Unsubscribe` + `List-Unsubscribe-Post: One-Click` (RFC 8058)
- Patička per § 435 NOZ — identifikace firmy parametrizovaná

**Hodnota:** příští iterace s mailingem ušetří **~5–7 h** marketer + legal compliance kontroly.

### 5. AI tokeny — proč zůstaly na nule

Fakan v Gate 1 explicitně zakázal AI API volání v iteraci („API volání ne"). Marketer napsal copy ručně přes běžný Claude Code workflow agent-mode, který se jako AI tokeny **neúčtuje zvlášť** — Fakan platí předplatné Claude Code, ne per-token spotřebu agentů. Ve výsledku:

- **Anthropic API faktura za iteraci:** 0 USD / 0 Kč
- **Cloudflare Workers AI faktura:** 0 USD (žádné runtime AI volání, decisions.md zakázalo)
- **OpenAI:** nepoužito (mantinel sekce 2 CLAUDE.md, default Claude)

Toto je **opakovatelný vzorec** pro bootstrap fázi — copy řeší marketer ručně, runtime AI počká na Fáze 6+ (BYO klíč, AI redesign). Žádná blokace, žádný náklad.

### 6. KV writes monitoring (z final pre-launch projekce, sekce 6)

**Připomínka pro D+7 retro (první týdenní retro po launch):** Cloudflare dashboard, KV namespace `RATELIMIT`, denní writes count. Free tier 1 000 writes/den — při 1k visit/den a 1 rate-limit increment per visit jsme na hraně. Pokud reálná data ukáží, že jsme stabilně pod 500/den, **YELLOW se autoupgraduje na GREEN**. Pokud nad 1 000/den, cena překročení je $0,15/měs (zanedbatelné), ale signál škálování.

### 7. Verdikt iterace landing-v2

**Finanční verdikt: GREEN.**

- Runtime $0/měs (do 10× predikovaného traffic žádný breakpoint v dohledu)
- Žádný externí přečerpaný náklad, žádné AI tokeny, žádný cash-out Fakana
- Agent-h přestřel 19 % je **akceptovatelný drift pro první iteraci nového typu**, Fakan v Gate 1 delegoval rozpočet na tým agentů a v approvals přestřel explicitně schválil
- Druhá iterace stejného typu (lead capture v2 / další klient) by měla **sedět nebo podsouvat forecast** díky šablonám z reuse sekce 4

**Doporučení pro příští iteraci (3 bullety):**
1. Capacity plán s **bufferem +20 %** pro první iterace nového typu
2. Pre-rozpadu sekce **„API kontrakt"** v `tasks.md` jako jediný zdroj pravdy pro FE/BE query string + response format
3. **Tester cap 4 h** + 1–2 h opravný kruh budget explicitně v capacity plánu (full acceptance jen pro produkční launch features)

**Pro PM produkt retro (paralelně):** top reuse kandidát = šablona lead capture (`templates/lead-capture/`), úspora pro příští iteraci stejného typu ~10–14 h juniora.
