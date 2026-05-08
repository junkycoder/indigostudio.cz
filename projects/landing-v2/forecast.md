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

<!-- Skutečnost vs. forecast. Top 3 spotřebiče. Optimalizace pro příště. -->
