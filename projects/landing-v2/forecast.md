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

## Retro (Fáze 6)

<!-- Skutečnost vs. forecast. Top 3 spotřebiče. Optimalizace pro příště. -->
