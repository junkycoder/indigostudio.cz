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
