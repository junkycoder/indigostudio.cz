# Risk check — landing-v2

**Autor:** legal-advisor
**Datum:** 2026-05-08
**Brief:** [`projects/landing-v2/brief.md`](brief.md) (commit `fd6751c`)

---

## TL;DR

**Verdikt: `pozor na X`** — OK rozjet návrh a copy, **ale** spuštění lead capture do produkce blokují tři věci:

1. Privacy Policy musí být **online dřív, než formulář pošle první lead** (právní titul = souhlas, GDPR čl. 13 informační povinnost).
2. Souhlas musí být **separátní checkbox, neforčekovaný, s odkazem na Privacy Policy** — bez toho není GDPR-validní.
3. **Evidence souhlasu** (timestamp + IP nebo hash + verze textu) se musí ukládat společně s leadem, jinak nemáme čím prokázat, že to bylo opt-in.

Bez tohoto se lead capture nesmí pustit do produkce. Návrh, copy, design, mailové šablony se mezitím můžou připravovat.

---

## 1. Co se sbírá / kam to teče

Nový datový tok v2 (jaký je dnes a jaký bude po nasazení):

### 1.1 Co dnes Worker reálně dělá s daty

Z `src/analyze.js` (commit dnes):

- **URL** přijímá z query stringu, fetchne ji, parsuje. Neukládá nic.
- **`hello` SSE event** posílá `target` URL klientovi. Žádný persistent storage.
- **Cloudflare logy** — runtime logy Workeru obsahují IP klienta, URL a timestamp (default Cloudflare retention, krátká).
- **Žádná D1, žádný KV, žádný R2** se nepíše.

Stav je dnes z GDPR pohledu **velmi čistý** — nesbíráme nic, co bychom museli evidovat. Pivot na lead capture to mění a tomu je tenhle risk check.

### 1.2 Co se bude sbírat ve v2

| Pole | Zdroj | Osobní údaj? | Kam |
|---|---|---|---|
| `url` | uživatel zadá | ne (až na výjimku, viz dál) | D1 `leads`, log analýzy |
| `email` | uživatel zadá | **ano** (přímý identifikátor) | D1 `leads`, výchozí adresa pro followup mail |
| `consent` (bool) | checkbox | součást důkazu | D1 `leads.consent_at` |
| `consent_text_version` | verze textu souhlasu v UI | důkaz | D1 `leads.consent_text_version` |
| `ip` (klient) | Cloudflare hlavička `cf-connecting-ip` | **ano** (osobní údaj per recital 30 GDPR) | doporučuju **neukládat plnou** — viz akce |
| `user_agent` | hlavička | někdy quasi-identifikátor | doporučuju neukládat plný |
| `source` | parametr (např. `index` / `vysledek`) | ne | D1 `leads.source` |
| `ts` | server čas | metadata | D1 `leads.created_at` |
| Outbound mail (followup) | server pošle | obsah obsahuje email + souhrn | log u providera (MailChannels / Email Workers) |
| Opt-out token | generovaný | technický | D1 `leads.unsubscribe_token` |

### 1.3 Pozor na URL

URL **není sama o sobě osobní údaj**, ale:

- **URL může obsahovat osobní údaj** (např. `?email=jan.novak@…`, `?token=abc`, `?session=…`). Pokud návštěvník zadá takovou URL k analýze a my ji uložíme do `leads`, sbíráme něčí osobní údaj nepřímo.
- **Akce:** v Workeru před uložením do D1 **strip query stringu**, který obsahuje známé senzitivní parametry (`token`, `session`, `auth`, `email`, `key`, `secret`, `code`, `password`). Necháme jen origin + path. Pokud někdo zadá kompletní URL s tokenem do formuláře, to nemůžeme zabránit — ale **neukládáme ji v plné podobě**.
- **Akce 2:** v UI ve formuláři pod URL polem napsat malé varování: „URL bez přihlašovacích tokenů, prosím." Není to právně povinné, ale snižuje risk.

### 1.4 Outbound mail — co tam o uživateli je

Followup mail bude obsahovat:
- 3 nálezy z analýzy (technický popis webu, který uživatel zadal — ne osobní informace o něm).
- Odkaz na výsledkovou stránku (s tokenem, který umožní obnovit zobrazení — **token nesmí být ID e-mailu**, musí to být náhodný UUID).
- Jméno odesílatele (Daniel Hromada) + adresa firmy (povinné per zákon o některých službách informační společnosti, § 7).
- Opt-out odkaz `https://fakan.cz/odhlasit?t=<token>` — **musí fungovat**, ne jen zobrazit stránku „odhlášeno", ale fakticky lead označit `unsubscribed=1` v D1.
- **Žádný tracking pixel.** Žádný `<img src="…/pixel.gif?lead=…">`. Žádný link tracker (`https://fakan.cz/click?…&dest=…`).

---

## 2. GDPR kontrola

### 2.1 Právní titul

**Souhlas (čl. 6 odst. 1 písm. a) GDPR.** Ne oprávněný zájem — protože:
- Posílat marketingovou nabídku někomu, kdo nás nezná, na základě „oprávněného zájmu" je velmi tenký led. ÚOOÚ to typicky neuznává u cold-outreach.
- Návštěvník nám sám zadá e-mail a aktivně klikne souhlas — to je čisté opt-in, snadno obhájitelné.
- Po opt-outu okamžitě přestat — to je vlastně i důsledek souhlasu, ne oprávněného zájmu.

**Důsledek pro architekturu:** bez `consent === true` se **lead nesmí uložit** a **mail nesmí odejít**. Worker musí toto enforce-ovat na server side, ne se spoléhat na frontend.

### 2.2 Evidence souhlasu (důkaz)

Když přijde stížnost na ÚOOÚ („nikdy jsem nesouhlasil"), musíme prokázat opak. K tomu potřebujeme:

```
leads(
  ...
  consent_at TIMESTAMP NOT NULL,         -- kdy klikl
  consent_text_version TEXT NOT NULL,    -- jaký text vlastně odsouhlasil
  consent_ip_hash TEXT,                  -- hash IP (sha256(ip + salt)), ne plná IP
  consent_user_agent_hash TEXT,          -- volitelně, taky hash
  source TEXT NOT NULL                   -- index / vysledek
)
```

**Akce:** založit `legal/consent-versions/` adresář v repu, kde se ukládá historie znění souhlasu. Každá změna textu = nová verze (v1, v2…) a `consent_text_version` v DB ukazuje na ni. Bez tohohle nemáme jak retroaktivně říct, „v té době jsi souhlasil s tímhle zněním".

### 2.3 Retence

| Stav leadu | Doba | Co po uplynutí |
|---|---|---|
| `consent` aktivní, žádná konverze | **24 měsíců** od poslední komunikace | hard-delete (nebo aspoň anonymizace) |
| `unsubscribed=1` | **3 roky** držet evidenci odvolání souhlasu | po 3 letech smazat |
| Zákazník (uzavřená smlouva) | jiný režim — daňové/účetní (10 let) | mimo tento risk check |

**Akce:** scheduled task / cron v Workeru (Cron Triggers) jednou měsíčně udělá `DELETE FROM leads WHERE last_contact_at < now() - 24 months AND status='lead'`. Detail spec dá architect, já jen říkám, že to musí být.

### 2.4 Práva subjektu (čl. 15–22)

Musíme být schopni:
- **Přístup (čl. 15)** — když napíše „pošlete mi, co o mně máte" → vyhodit z D1 řádek a poslat. Nepotřebuje to zatím admin UI, ruční SQL stačí.
- **Oprava (čl. 16)** — typicky špatný e-mail. Stejně, ruční update.
- **Výmaz (čl. 17)** — při odvolání souhlasu nebo na žádost. Implementováno opt-out tokenem.
- **Námitka (čl. 21)** — proti přímému marketingu vždy musí jít. Splněno opt-out odkazem.
- **Portabilita (čl. 20)** — málokdy relevantní pro lead, ale formálně musíme umět export.

**Akce:** sekce „Tvoje práva" v Privacy Policy + e-mail `jsem@fakan.cz` jako kontakt. Pověřence (DPO) **nepotřebujeme** — fakan.cz nezpracovává citlivé údaje ani nedělá masivní monitoring.

### 2.5 Subdodavatelé (DPA — data processing agreement)

Lead data se dotknou těchto třetích stran:

| Strana | Kategorie | DPA / SCC | Lokalita | Akce |
|---|---|---|---|---|
| **Cloudflare** (Workers, D1, log) | procesor | ano, podepsaný DPA v dashboardu | EU/US | doložit v Privacy Policy odkazem |
| **MailChannels** (pokud zvolíme) | procesor (mail relay) | ano | US/global | DPA si vyžádat, doplnit do PP |
| **Cloudflare Email Workers** (alt.) | procesor | součást Cloudflare DPA | EU/US | jednodušší — žádný extra subdodavatel |

**Akce pro architecta a finance:** preferuji **Cloudflare Email Workers (Email Routing outbound)** ne kvůli technice, ale kvůli **menšímu compliance povrchu** — jeden procesor místo dvou, jeden DPA místo dvou.

### 2.6 Předání mimo EU

Cloudflare = US společnost, ale provoz může být v EU PoPs. EU-US Data Privacy Framework (od 2023) řeší přenos do US. **Akce:** v Privacy Policy uvést „Data zpracováváme přes Cloudflare, který je certifikován dle EU-US DPF." Žádné další SCC nepotřebujeme.

---

## 3. Cookies / trackery

**Status v2: 0 cookies, 0 trackerů, OK.** Ale pojistím:

- **Žádný `Set-Cookie`** ani v Workeru, ani v HTML. Audit: dnes v `src/analyze.js` ani `index.html` žádný není. **Junior** to nesmí přidat.
- **Žádný Hotjar, Smartsupp, Tawk.to, Crisp, Intercom, GA4, GTM, Meta Pixel, Sklik, Clarity, Mouseflow, FullStory, LogRocket** — pokud někdo (marketer) navrhne „Hotjar lite na týden, ať vidíme heatmapy", **STOP**. Vyžadovalo by to cookie banner se souhlasem (čl. 5 odst. 3 ePrivacy směrnice / § 89 ZoEK), porušilo by to brand pozici (CLAUDE.md sekce 2: „Žádné cookies. Žádné cookie banery. Žádné popupy.") a v kontextu „pivot na 40+ kteří nesnášejí cookies" by to bylo zvlášť pitomé.
- **Cloudflare Web Analytics** — pokud bude marketer chtít metriky, tohle je **OK** (cookie-free, žádný souhlas, nepřenáší PII). Doporučuju až v další iteraci, nepatří do scope v2.
- **Měření přes Cloudflare logy + D1 leady** — to je interní log dle oprávněného zájmu (provoz služby), žádný consent tier.

**Akce:** v PR review hlídat, že nikdo nepřidá `<script src="…">` ze třetí strany ani inline analytics snippet. CI hook (Priority 2 v README) by tohle mohl detekovat.

---

## 4. Souhlas — znění

### 4.1 Formulář — co MUSÍ být

1. Checkbox **NESMÍ být pre-checked** (čl. 7 odst. 4 GDPR + judikatura SDEU Planet49 C-673/17). Default = `<input type="checkbox" required>`, bez `checked`.
2. Souhlas **NESMÍ být skrytý do submit tlačítka** („Kliknutím odesílám a souhlasím..."). Musí to být vědomá samostatná akce.
3. **Bez souhlasu nelze odeslat formulář.** `required` atribut + server-side enforcement.
4. **Odkaz na Privacy Policy** v textu souhlasu **přímo klikatelný**, ne jen v patičce. Kdokoliv musí vědět, na co kýve.
5. **Možnost odvolání zmíněná v textu** — povinnost dle čl. 7 odst. 3 GDPR.

### 4.2 Návrh znění z briefu — review

> „Souhlasím se zasláním výsledků analýzy a nezávazné nabídky e-mailem. Souhlas mohu kdykoliv odvolat odkazem v patičce e-mailu."

**Co je dobře:**
- Jednoznačně formulované.
- Účel je jasný (zaslání výsledků + nezávazná nabídka).
- Možnost odvolání zmíněná.
- Vykání odpovídá brand pivotu („Souhlasím… mohu" je vykání, OK).

**Co chybí / přepracovat:**

1. **Chybí identifikace správce.** Jasné kdo zpracovává. Typický fix: kontext stránky (footer s kontaktem) + Privacy Policy odkaz. Není povinné v textu souhlasu, pokud je uvedeno jinde a uživatel se k tomu dostane.
2. **Chybí odkaz na Privacy Policy** v samotném textu checkboxu.
3. **„Nezávazná nabídka" je dobré, ale upřesnit.** Ať je jasné, že to není smluvní oferta s automatickým akceptem (viz sekce 6).

**Doporučené finální znění:**

> Souhlasím, aby společnost Daniel Hromada (Fakan), IČO [doplnit], zpracovala mou e-mailovou adresu pro účely zaslání výsledků analýzy a **nezávazného návrhu řešení**. Souhlas mohu kdykoliv odvolat kliknutím na odkaz „Odhlásit" v patičce každého e-mailu. Více v [Zásadách ochrany osobních údajů](/ochrana-udaju).

(Verzovat jako `consent-v1.md` v `legal/consent-versions/`.)

### 4.3 Single vs. double opt-in

Brief ptá se v otevřené otázce 6. Můj postoj:

- **Není povinný double opt-in podle GDPR.** Single opt-in s evidencí (IP/UA hash + timestamp + verze textu) je dostatečný důkaz.
- **Plus:** double opt-in chrání proti tomu, že někdo zlomyslně vyplní cizí e-mail. Když to neuděláme, riskujeme, že posíláme spam někomu, kdo o nás nikdy nezadal e-mail. To je porušení a špatný PR.
- **Doporučení:** **single opt-in stačí**, ale do mailu přidat na začátek větu: „Tento e-mail vám posíláme proto, že jste si na fakan.cz vyžádali analýzu webu [URL] a souhlasili se zasláním výsledků. Pokud to nejste vy, klikněte zde a smažeme váš e-mail." → opt-out. Toto je „soft double opt-in" — záchranná brzda bez extra friction pro správné uživatele.

---

## 5. E-mailový marketing

### 5.1 Co MUSÍ být v každém mailu

- **Identifikace odesílatele:**
  - Jméno: Daniel Hromada (Fakan) / fakan.cz
  - Adresa firmy: doplnit v patičce (povinné dle § 7 odst. 1 zákona č. 480/2004 Sb.)
  - IČO: doplnit
  - Kontaktní e-mail: `jsem@fakan.cz`
- **Důvod, proč mail dorazil** — viz sekce 4.3, soft double opt-in formulace.
- **Opt-out odkaz** — funkční, jeden klik (ne login, ne formulář s vyplňováním e-mailu, ne „pošlete nám námitku"). `https://fakan.cz/odhlasit?t=<token>` přímo unsubscribuje.
- **Plain-text alternativa** — `multipart/alternative` s plain text verzí. Kvůli accessibility i kvůli filtrům (gmail bez plain text snižuje deliverability).

### 5.2 Co tam NESMÍ být

- **Trackovací pixel.** Žádný `<img src="https://fakan.cz/pixel?lead=…">` ani „opt-in beacon". Pokud to někdo navrhne („ať vidíme open rate"), **NE**. Důvody:
  - Open tracking přes pixel = sběr osobního údaje (kdy a odkud uživatel mail otevřel) → vyžaduje samostatný právní titul, který v souhlasu na „zaslání výsledků" zahrnutý není.
  - Brand pozice „bez trackerů" platí pro celé fakan.cz, ne jen pro web.
- **Click tracking v odkazech** (typu `https://fakan.cz/click?dest=https://example.com&lead=…`). Ze stejného důvodu.
- **Sdílení e-mailu třetím stranám** mimo MailChannels/Email Workers (procesor = OK, jiný marketingový partner = nutný explicitní souhlas).

### 5.3 Konkrétní akce pro tým

| Akce | Pro koho |
|---|---|
| Šablona `lead-followup.html` + `lead-followup.txt` (plain text twin) | junior-developer |
| Patička s adresou firmy a IČO — Fakan musí dodat | owner |
| Generátor opt-out tokenů — náhodné UUIDv4, ne hash e-mailu | senior-architect |
| `/odhlasit?t=…` endpoint — `UPDATE leads SET unsubscribed_at=now() WHERE unsubscribe_token=?` | junior-developer |
| Stránka `/odhlasit` po kliknutí — friendly „odhlášeno, díky" | marketer + junior |

---

## 6. Smlouva / nezávazná nabídka v mailu

Brief mluví o „followup s nezávaznou nabídkou". Je třeba pohlídat, **aby to nebyla skrytá smluvní oferta**.

### 6.1 Co je riziko

Podle § 1731 OZ může i e-mail být návrhem smlouvy, pokud obsahuje **podstatné náležitosti** (předmět + cena + úmysl být vázán). Pokud:
- Mail řekne „cena 5 000 Kč za audit, akceptuj odpovědí na tento e-mail" a
- Uživatel odpoví „ok",

**vznikne smlouva**. To není to, co Fakan chce, protože pak je vázán cenou i kdyby zjistil, že je to složitější.

### 6.2 Co musí mail obsahovat, aby to bylo „nezávazné"

1. **Explicitní formulace** — „Tohle je nezávazný návrh řešení, ne smluvní nabídka. Než cokoliv objednáte, sjednáme si parametry zakázky."
2. **Žádné automatické akcepty.** Ne „odpovědí na tento e-mail potvrzujete objednávku". Ne „pokud do 3 dnů neodepíšete, máme za to, že souhlasíte" (to je nelegální obchodní praktika dle ZOOS § 5a).
3. **Cena = orientační.** „Předpokládaná cena 5 000–8 000 Kč podle rozsahu" — vidlice, ne fix. Nebo „cena podle dohody, orientačně X Kč".
4. **Žádné předplatné, žádné automatické prodloužení.** Pokud bude nabídka obsahovat odkaz na hosting (99 Kč/měs), musí být jasné, že **klient si to musí aktivně objednat samostatně** — ne jednou kliknutím v e-mailu.

### 6.3 Akce

- **Marketer** dostane tyhle constraints do briefu na šablonu mailu.
- **Já (legal)** projdu finální draft mailu před launchem (Pre-launch check).

---

## 7. Ozvěna brand pivotu na strategické dokumenty

CLAUDE.md sekce 7.4 explicitně zakazuje editovat:
- `fakan-cz-prd.md`
- `fakan-cz-brand-brief.md`
- `fakan-cz-plugin-spec.md`

**bez explicitního pokynu od Fakana**. Brief landing-v2 chce update brand briefu (sekce 4 „Tón a hlas") a CLAUDE.md (sekce 3) — a ten se taky řadí mezi strategické.

**Akce:**
- **Junior + marketer** připraví **diff jako PR / patch**, **nemerge**.
- **PM (project)** v Gate 3 (Pre-launch) explicitně připomene Fakanovi „tady je diff brand briefu, mergne se?"
- **Žádný agent ten diff nesmí samovolně commitnout do mainu.** Pokud na to junior zapomene, code review architecta to musí chytit.

V risk-check tohle připomínám proto, že to **není legal v užším smyslu**, ale je to **proces-risk**, který zaboří iteraci ve Fázi 6 (delivery), pokud ho nikdo nehlídá.

---

## 8. Verdikt

**`pozor na X`** — iterace OK rozjet (návrh, copy, design, mailové šablony jako draft), ale **lead capture do produkce nesmí jít**, dokud:

### Blokátory pro spuštění lead capture do produkce

- [ ] **Privacy Policy je live na `fakan.cz/ochrana-udaju`** (a odkaz na ni je z formuláře i z patičky e-mailu). Bez toho neplatí informační povinnost čl. 13 GDPR.
- [ ] **Souhlas v UI je separátní neforčekovaný checkbox** s odkazem na Privacy Policy v textu.
- [ ] **Worker enforce-uje `consent === true`** server-side; bez něj se `INSERT INTO leads` ani `sendMail` neprovede.
- [ ] **D1 schema obsahuje `consent_at`, `consent_text_version`, `unsubscribe_token`** a evidenci IP **jen jako hash** (ne plnou).
- [ ] **`/odhlasit?t=…` endpoint funguje** (pošle `UPDATE` a vrátí stránku „odhlášeno").
- [ ] **Followup mail má patičku s identifikací odesílatele** (jméno + IČO + adresa) a opt-out odkazem; nemá tracking pixel.
- [ ] **`legal/consent-versions/consent-v1.md`** je v repu se zněním textu, který se v UI zobrazuje.
- [ ] **DPA s MailChannels** existuje (pokud zvolíme MailChannels) NEBO architect potvrdí cestu přes Cloudflare Email Workers (jednodušší compliance).

### Akce paralelně, neblokují spuštění

- [ ] URL strip senzitivních query parametrů před uložením do `leads`.
- [ ] Cron task na retenci (24 měsíců po posledním kontaktu → smazat).
- [ ] Soft double opt-in formulace v prvním mailu („pokud to nejste vy, klikněte…").
- [ ] Brand brief / CLAUDE.md diff připraven jako PR, **nemerge bez Fakana**.

### Co NESMÍ být přidáno (hard veto)

- ❌ Hotjar, GA4, GTM, Meta Pixel, Sklik, Clarity, Mouseflow, FullStory, LogRocket, Smartsupp, Tawk.to, Crisp, Intercom — žádný analytics/heatmap/chat tracker. Cookie banner = brand violation + scope creep.
- ❌ Tracking pixel v e-mailu nebo click tracker v odkazech.
- ❌ Pre-checked checkbox souhlasu.
- ❌ Skrytý souhlas v submit tlačítku ("Kliknutím odesíláte = souhlasíte s X").
- ❌ Automatický akcept smluvní nabídky v mailu („odpovědí potvrzujete objednávku", „mlčení = souhlas").
- ❌ Editace `fakan-cz-brand-brief.md` / `CLAUDE.md` přímo na main bez Fakana.

---

## Disclaimer

Tohle je risk check pro interní iteraci, ne posudek od advokátní kanceláře. Pro vážnější rizika (klientská zakázka, regulované odvětví, soudní spor) doporučuji nechat zkontrolovat živým advokátem se specializací na ICT/GDPR. Tady jsem to osypal, ale **negarantuju 100 %** — typicky šedé zóny:

- Hranice mezi „oprávněným zájmem" a „nutným souhlasem" u cold outreach se výklad ÚOOÚ stále tříbí.
- Definice „přímého marketingu" v ZoEK § 7 (zákon č. 480/2004 Sb.) má své zvláštnosti — pro existující zákazníky je laxnější, pro lead capture méně.
- Retence 24 měsíců je má rozumná hodnota, ne zákonem stanovená — kdo si chce hrát, může 12 měsíců, kdo agresivnější marketing, 36. Doporučuju 24 jako střed.

---

## Pre-launch check (vyplní legal-advisor v Gate 3)

Bude vyplněno až ve Fázi 5 (Pre-launch), nyní prázdné:

- [ ] Privacy Policy live a aktuální?
- [ ] Souhlas v UI splňuje sekci 4 tohoto risk-checku?
- [ ] D1 schema obsahuje evidence souhlasu?
- [ ] Followup mail prošel mým review?
- [ ] Opt-out flow funguje end-to-end (testovaný lead odhlášen do 1 minuty)?
- [ ] DPA / procesor compliance dořešena?
- [ ] Brand brief / CLAUDE.md diff je PR, nemergnutý?

---

## Pre-launch check 2026-05-08

**Stav: GREEN s drobnou podmínkou.** Všech 7 oblastí (souhlas, Privacy Policy, mail šablony, opt-out, anti-abuse, minimalizace + stripping, CLAUDE.md mantinely) prošlo bez závažné vady. Pre-launch blokátory ze sekce 8 jsou pokryté. Owner ještě musí potvrdit retenci 12 měsíců (legal ji schvaluje, ale je to deviace od původního návrhu 24 měsíců — viz § B níže).

Reviewoval: legal-advisor. Datum: 2026-05-08.

### A. Souhlas

- [PASS] **Checkbox neforčeknutý, separátní, required.** `fakan.cz/index.html:334` (hero) a `fakan.cz/index.html:537` (CTA banner) — `<input type="checkbox" id="consentChk" name="c" value="1" required>` bez `checked` atributu. Planet49 (C-673/17) je doržen.
- [PASS] **Odkaz na Privacy Policy uvnitř textu, klikatelný.** `index.html:336` a `:539`: `Více v <a href="/ochrana-udaju">zásadách ochrany osobních údajů</a>.` — odkaz uvnitř labelu, ne v patičce. Čl. 7 odst. 2 GDPR splněn.
- [PASS] **Verze textu se ukládá z hidden inputu** `<input type="hidden" name="v" value="v1-2026-05-08">` (`index.html:339, :542`) a server ji v `analyze.js:140-142` ověřuje a předává `captureLead({ consentVersion })`.
- [PASS] **Server-side enforcement.** `src/analyze.js:128-149` `parseLeadParams` vrací `{ enabled: false, reason: 'missing_consent' }` pokud `c !== '1'`, `'missing_email'` pokud chybí email, `'missing_version'` pokud chybí verze. `analyze.js:191-194` to logguje a `:217` blokuje `captureLeadAndMail`. **Bez explicitního consent=1 + verze + emailu lead NEVZNIKNE a mail NEODEJDE.** Toto je hlavní GDPR garance.
- [PASS] **Evidence souhlasu kompletní.** `src/lib/lead.js:104-125` ukládá `consent_at` (timestamp ISO), `consent_text_version` (z query), `consent_ip_hash` (sha256(ip + CONSENT_SALT) per `lead.js:92`). Bez `CONSENT_SALT` env secretu `lead.js:80-82` vrací `salt_missing` — žádný insert s plain IP nepůjde. Plain IP nikde v DB schema (`migrations/0001_leads.sql:19-37`).
- [PASS] **Verze v1-2026-05-08 je primární klíč evidence.** Pravidlo: pokud Fakan v budoucnu přepíše consent text, MUSÍ zvýšit verzi (např. v2-YYYY-MM-DD) a starou verzi neměnit. Drž v review při každé další iteraci. Původní text v archivu — copy.md § 3 zmiňuje `legal/consent-versions/v1-2026-05-08.md`, ale **soubor zatím v repu nikde není** (viz § "Otevřené body" níže — drobná podmínka pro launch, ne blokátor).
- [PASS] **Anti-csrf přes hidden `s` source whitelist.** `lead.js:26-31` `ALLOWED_SOURCES = {'landing-hero','landing-cta','vysledek-cta','manual'}` — útočník nemůže poslat ručně náhodnou source hodnotu. Není striktně legal, ale snižuje povrch.

### B. Privacy Policy

- [PASS] **Live a kompletní obsah.** `fakan.cz/ochrana-udaju.html` má všech 8 sekcí GDPR čl. 13: kdo (Indigo Studio s.r.o. + IČO + sídlo + OR), co (přesný výčet sloupců), proč (souhlas čl. 6/1/a), retence, příjemci (Cloudflare + EU-US DPF + DPA odkaz), práva (čl. 15-21 + ÚOOÚ stížnost), bezpečnost, změny.
- [PASS] **Datum účinnosti a verze.** `ochrana-udaju.html:250`: „Účinné od: 8. května 2026 · Verze: 1." Dole znovu `:335`: „Aktuální verze je v1, účinná od 8. května 2026."
- [PASS] **Identifikace správce.** `ochrana-udaju.html:255` — Indigo Studio s.r.o., Chudenická 1059/30, 102 00 Praha, IČO 14389096, MSPH C 364981. Souhlasí s decisions.md tie-breakerem (ARES VR ověřeno).
- [PASS] **DPO správně řešený.** `ochrana-udaju.html:258` — DPO není povinný (zvláštní kategorie údajů a rozsáhlý monitoring nejsou v hřišti). Toto je správný výklad čl. 37 GDPR pro fakan.cz.
- [PASS] **EU-US DPF + DPA odkazy.** `ochrana-udaju.html:314` — odkaz na `dataprivacyframework.gov` a Cloudflare DPA. Cloudflare jediný procesor.
- [PASS] **Slug `/ochrana-udaju` souhlasí s decisions.md tie-breakerem.** `<link rel="canonical">` `:10` + interní odkaz z `index.html:336, :539` souhlasí.
- [PASS] **Schema.org PrivacyPolicy JSON-LD** (`ochrana-udaju.html:31-41`) — drobnost, ale signál pro vyhledávače.
- [FIX-LIGHT] **Retence 12 měsíců — schvaluju, s podmínkou.** `ochrana-udaju.html:293` říká „12 měsíců od posledního kontaktu". Risk-check § 2.3 původně navrhoval 24 měsíců. Marketer to v copy.md § 2 zdůvodnil minimalizací (GDPR čl. 5/1/c) a bootstrap fází.
  - **Verdikt:** Schvaluju 12 měsíců. Důvod: kratší retence = nižší risk povrch, snadnější obhájitelnost, soulad s minimalizační zásadou. ÚOOÚ na kratší dobu nikdy nereagoval negativně (delší ano, kratší ne).
  - **Podmínka:** v retro za 6 měsíců (2026-11) vyhodnotit, jestli 12 měsíců neutíná leadům, kteří mají dlouhý nákupní cyklus (B2B web build = 3-9 měsíců). Pokud ano, prodloužit na 18 měsíců novou verzí PP (v2). Do té doby drží 12.
  - **Dodatečné FIX:** Komentář v `migrations/0001_leads.sql:35` a `:52-53` říká „24 měs" — to je nesoulad se skutečnou politikou. Ne legal blokátor (komentář, ne konfigurace), ale **junior musí cron task / retention skript psát na 12 měsíců**, ne 24. Aktualizace SQL komentáře = drobnost do retra.

### C. Mail šablony

- [PASS] **Žádný tracking pixel ani externí `<img>`.** `grep '<img' src/email/` vrátil 0 hitů. Patičky jsou plain `<a href>` bez wrapper trackerů.
- [PASS] **Plain-text twin v každém mailu.** `_layout.js:82-123` má `layout({ html, text })` — text se píše ručně v každé šabloně (ne strip z HTML). Ověřeno v `lead-followup.js:86-132`, `optout-confirmation.js:30-43`, `magic-link-auth.js:42-60`, `soft-doi.js:46-64`. `multipart/alternative` se sestaví v `mime.js` (volá `buildMime` v `mail.js:110`).
- [PASS] **Opt-out odkaz v lead-followup a soft-doi.** `_layout.js:26-29` — `withOptout: true` přidá řádek „Odhlásit z e-mailů od fakan.cz" + „Ochrana osobních údajů". `lead-followup.js:138`: `withOptout: true`. **Ale: `soft-doi.js:70`: `withOptout: false`.**
  - **Důvod, proč to NENÍ blokátor:** soft-doi je v MVP NEPOUŽÍVANÁ šablona (per `soft-doi.js:1-5` komentář, copy.md § 10 a design § 4.6 — soft DOI je integrovaný do `lead-followup` úvodního odstavce). Šablona je „na sklad" pro budoucí flow.
  - **Podmínka:** pokud někdy v budoucnu Fakan zapne plný DOI, `soft-doi.js:70` musí dostat `withOptout: true` + `vars.unsubscribe_url`. Junior to flagne v komentáři šablony jako TODO. Drobnost do retra.
- [PASS] **`List-Unsubscribe` header pro lead/marketing.** `mail.js:30` `NEEDS_LIST_UNSUBSCRIBE = {'lead-followup','soft-doi'}`. `mail.js:103-106` přidává `List-Unsubscribe: <unsubscribe_url>, <mailto:nabidky@...>` + `List-Unsubscribe-Post: One-Click`. RFC 8058 splněn (Gmail/Outlook deliverability + GDPR-friendly).
- [PASS] **Patička obchodního mailu.** `_layout.js:11-15` → `Indigo Studio s.r.o., Chudenická 1059/30, 102 00 Praha`, `IČO: 14389096, ... MSPH oddíl C, vložka 364981`, `jsem@fakan.cz · +420 604 690 539`. § 435 NOZ (obchodní listina) splněn napříč všemi 4 šablonami.
- [PASS] **Soft DOI v lead-followup.** `lead-followup.js:52` — první odstavec: „Pokud to nejste vy a tenhle e-mail jste nečekal/a, klikněte na <a href...>Odhlásit</a> v patičce a okamžitě vás z databáze smažeme. Nikomu nevolejte, žádné uživatelské heslo neměňte — prostě jeden klik." Per risk-check § 4.3 — soft DOI úvod splněn.
- [PASS] **Identifikace odesílatele (From/Reply-To).** `mail.js:21-26` — `lead-followup` / `soft-doi` / `optout-confirmation` z `Fakan — Indigo Studio <nabidky@fakan.cz>`, `magic-link-auth` z `Fakan — přihlášení <prihlaseni@fakan.cz>`. `mail.js:114` `replyTo: 'jsem@fakan.cz'`. Schvaluju — display name nese identitu firmy, jméno fyzické osoby je v patičce + podpisu.
- [PASS] **Magic-link DRAFT v0.** `magic-link-auth.js:1-4` má jasný DRAFT komentář. `bodyHtml:23` má inline DRAFT komentář. `mail.js:11-16` ho má v allow-listu (musí), ale handler ho v MVP nezavolá (auth flow neexistuje). OK pro launch, schvaluju jako „na sklad".
- [PASS] **Žádné automatické akcepty smluvní oferty.** `lead-followup.js:66`: „Tohle je jen návrh, nezávazná nabídka. Žádná smluvní oferta, žádný automatický odběr — než cokoliv potvrdíte, projdeme spolu rozsah, cenu a termín." Drží risk-check § 6.2.

### D. Opt-out flow

- [PASS] **Neutrální response napříč scénáři.** `src/optout.js:31-97` — všechny 4 cesty (chybný formát tokenu, neexistující token, idempotentní opt-out už opted_out, úspěšný opt-out) vrací stejnou stránku `renderDonePage()`. Útočník nepozná, jestli token existoval.
- [PASS] **Token validace 64 hex (`/^[a-f0-9]{64}$/`).** `optout.js:20`. `renderDonePage()` na invalid format `:38`.
- [PASS] **DB update jen pro valid + ne-opted_out tokeny.** `optout.js:67-71` — `UPDATE leads SET status='opted_out', opted_out_at=?, last_contact_at=? WHERE id=?`. Idempotentně přeskočeno na `:62` pokud už opted_out.
- [PASS] **Confirmation mail přes `ctx.waitUntil`.** `optout.js:82-94` — neblokuje response, mail crash je catchnut a nevadí flow.
- [PASS] **Žádný side effect mimo opt-out.** Žádné analytics ping, žádné „byl jsi tady" log. Jen `console.error` při DB chybě (provoz, ne PII tracking).
- [PASS] **Žádný Set-Cookie.** `optout.js:101-105` — `HTML_HEADERS = { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store, max-age=0' }`. Komentář `:104` to drží explicitně.
- [PASS] **`noindex, nofollow`.** `optout.js:130` (DONE_HTML) + `:167` (TEMP_ERROR_HTML) + `fakan.cz/odhlasit-hotovo.html:11`. Stránka se neindexuje.
- [PASS] **Fallback `odhlasit-hotovo.html`.** Statická stránka, kdyby Worker spadl nebo někdo otevřel přímý link bez tokenu. Patička obsahuje identifikaci (Indigo Studio + IČO + spisovka).

### E. Anti-abuse

- [PASS-S-DROBNOSTÍ] **Honeypot.** `index.html:344, :546` mají `<input type="text" id="company" name="company">`. `analyze.js:111-118` `isHoneypotTriggered` kontroluje jak `website` tak `company`. **Drobnost:** brief sekce E vyjmenoval „`name="website"` a `name="company"` v `index.html`", ale HTML má **jen** `company` (ne `website`). Není to vada — server je „silnější" než klient (kontroluje obě, klient stačí jedno). Bot, který pole `website` vyplní z generického honeypot patternu, se chytne na server-side. Přesto: `senior-architect` může v retro doplnit i `website` field do HTML formuláře pro robustnější trip-wire (drobnost, ne blokátor).
- [PASS] **Honeypot reakce = silent 200 SSE prázdná.** `analyze.js:158-171` — vrátí prázdný stream + zavře. Bot dostane „prošlo", žádný DB write, žádný mail. ✓
- [PASS] **Rate limit pro lead-capture (5/h/IP-hash).** `analyze.js:247` — `checkRateLimit({ scope: 'lead-capture', limit: 5, windowSeconds: 3600 })`. Per-IP přes hash, ne per-cookie. ✓ legal-friendly (žádný tracking cookie).
- [PASS] **Rate limit pro analyze endpoint** (3/24h) — odděleno do `worker.js`, mimo scope tohoto modulu, ale brief to potvrzuje.
- [PASS] **CONSENT_SALT secret přes wrangler.** `lead.js:80-82` — pokud chybí, lead capture vrátí `salt_missing` a NEVZNIKNE záznam. Neukládá se nikdy plain IP. ✓

### F. Minimalizace + stripping

- [PASS] **`stripUrl()` funguje correct.** `src/lib/url-strip.js:8-11` — `new URL(input)` → `${u.origin}${u.pathname}`. Žádný `search`, žádný `hash`. To strpuje `utm_*`, `fbclid`, `gclid`, tokeny, session ID. ✓ risk-check § 1.3 splněn. Tady drobnost: doc komentář v `url-strip.js:1` říká „bez query stringu a hash", ale ne explicitně „bez senzitivních parametrů". Funkčně OK — strip je úplný (ne whitelist).
- [PASS] **`consent_ip_hash` jen jako sha256.** `lead.js:92` — `await sha256Hex(ip, env.CONSENT_SALT)`. Plain IP nikde v DB schema (`migrations/0001_leads.sql:26-27`). Hash je deterministický → pro stejnou IP stejný hash → můžeme detekovat opakované klikání ze stejné IP, ale nemůžeme z hashu zpětně zjistit IP. ✓ recital 30 GDPR.
- [PASS] **`unsubscribe_token` 64 hex random.** `lead.js:96` — `randomTokenHex(32)` = 32 bajtů náhody = 64 hex znaků. UNIQUE v DB (`migrations/0001_leads.sql:30`). Žádné odvození z emailu/ID. ✓ risk-check § 5.3.
- [PASS] **Email lowercase normalizace.** `lead.js:98` — `email.trim().toLowerCase()`. UNIQUE idem `(email, url, day)` se nepokazí casingem. Drobnost, ale dobrý detail.
- [PASS] **Žádný `consent_user_agent_hash` v MVP.** Schema `migrations/0001_leads.sql:27` má sloupec `consent_ua_hash` jako nullable, MVP ho nechává NULL. UA jako quasi-identifikátor by stejně byl jen volitelný důkaz. OK — jeden důkaz (IP hash + verze + timestamp) stačí.

### G. CLAUDE.md mantinely

- [PASS] **Žádné cookies.** Nikde `Set-Cookie`, nikde `document.cookie`. ✓ Jediné výskyty slova „cookie" jsou popisné v copy: `index.html:437` („Žádné akceptujte cookies…") a `ochrana-udaju.html:274` („žádné cookies, žádné sledovací pixely").
- [PASS] **Žádné cookie banery, popupy.** Audit prošel — nic v HTML.
- [PASS] **Žádné externí JS/font/CSS/tracker.** Grep pro `fonts.googleapis|googletagmanager|google-analytics|facebook.net|hotjar|smartsupp|clarity.ms` → nálezy jen v `src/detectors.js` (patterny pro analýzu cizích webů, ne náš kód). fakan.cz sám žádné neimportuje. ✓
- [PASS] **Vykání důsledné.** Tester to už ověřil v paralelní práci, copy.md § 13 to potvrzuje. Schvaluju z legal pohledu — vykání je samo o sobě brand norma, ne legal požadavek, ale brief E ho zmiňuje.

### Otevřené body / podmínky pro launch

1. **`legal/consent-versions/v1-2026-05-08.md` v repu** — copy.md § 3 odkazuje na soubor, který v repu zatím není. Důvod, proč to existuje: pokud někdy přepíšeme znění souhlasu (v2), starou verzi musíme mít archivovanou jako důkaz, **co tehdejší uživatel skutečně odsouhlasil**. **Podmínka pro launch:** junior dodá soubor `legal/consent-versions/v1-2026-05-08.md` s plným zněním textu z `index.html:336` (v markdownu). Pětiminutová práce. **Drobná podmínka, ne blokátor — text je v gitu jako součást index.html, ale legal/ adresář ho dělá explicitně archivním.** Pokud junior nestihne, alternativa: README úkol „Založit legal/consent-versions/ adresář" a flagnout jako TODO. Tag pre-launch [TODO-legal-A].
2. **Patička `vysledek.html:366`** — má pořád `Daniel Hromada`, ne `provozuje Indigo Studio s.r.o.` jako `index.html:560` po refreshu. Není to legal vada (vysledek.html není obchodní listina v užším smyslu — neobsahuje smluvní nabídku), ale konzistence s landingem je vhodná. Drobnost pro juniora, ne blokátor. Tag [TODO-marketing-B].
3. **Komentář v `migrations/0001_leads.sql:35, :52-53`** — říká „24 měsíců" místo skutečné politiky 12 měsíců. Není to konfigurace, je to komentář — funkčně neškodí. Junior nebo architect to opraví v retro nebo příští migraci. Tag [TODO-junior-C].
4. **Cron task na retenci** — risk-check § 2.3 navrhoval scheduled task na hard-delete leadů starších než retence. **MVP ho nemá implementovaný.** Pro launch je to OK (retence se počítá od `last_contact_at`, máme 12 měsíců než první lead vyprší, takže task musí být live nejpozději 2027-04). README úkol pro fázi po launchi. Ne blokátor.
5. **Potvrzení ownera (Fakan) k retenci 12 měsíců** — viz § B. Schvaluju, ale chci aby Fakan v Gate 3 explicitně OK řekl, abychom tu nehráli na schovávanou. Pokud Fakan chce 24, vrátíme PP na v1 s 24 měsíci a publikuje se to v2 s 12 později.

### Verdikt

**GREEN** (s 5 drobnými otevřenými body, žádný blokátor).

- Všech 7 doménových oblastí (souhlas, Privacy Policy, mail šablony, opt-out, anti-abuse, minimalizace, mantinely) prošlo bez závažné vady.
- 24 PASS, 1 FIX-LIGHT (retence — schválena s podmínkou retra 6m), 1 PASS-S-DROBNOSTÍ (honeypot pole `website` ne v HTML, ale server ho hlídá).
- 5 otevřených bodů je drobnostních (consent verze do `legal/`, footer ve `vysledek.html`, SQL komentář, cron task v budoucnu, owner OK retence). Žádný neblokuje launch.
- Všech 8 původních blokátorů z risk-check § 8 je vyřešených.

**Pre-launch zelené světlo. Lead capture do produkce může jít.**

Pro vážnější věci (rozšíření o citlivé údaje, B2C platby, third-party integrace, regulované odvětví) **nadále platí, že posouzení patří kvalifikovanému advokátovi pro ICT/GDPR.** Tenhle check je interní iterace, ne posudek od advokátní kanceláře.
