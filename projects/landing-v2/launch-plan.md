# Launch plán — landing-v2

**Autor:** marketer
**Datum:** 2026-05-08
**Stav:** Fáze 4 — pre-launch
**Souvisí:** [`brief.md`](brief.md), [`copy.md`](copy.md), [`decisions.md`](decisions.md), [`risk-check.md`](risk-check.md), [`forecast.md`](forecast.md)

---

## TL;DR

- **Cíl prvních 30 dní po launchi:** **20 leadů** (lidé, kteří vyplnili e-mail + souhlas a dostali follow-up). Baseline byla nula — měření začíná dnem nasazení.
- **Channel mix:** soft launch (přátelé / kolegové, 5–10 lidí) → veřejně LinkedIn + Twitter + 1× Reddit → opt-in pasivní příjem z Cloudflare logů.
- **Tracking výhradně server-side** přes D1 + Cloudflare logy + Cloudflare Web Analytics (cookieless). **Žádný GA, žádný pixel, žádný cookie banner** — to je rozlišovací znak proti konkurenci, nesahám na něj.

---

## 1. Audience — komu mluvíme

### Primární — kdo si reálně objedná

**Majitel malé firmy v ČR, 40–60 let.** Konkrétně: instalatér, právník, paní s e-shopem na koření, autoservis, účetní. 1–15 zaměstnanců, web má buď z šablony před 5–10 lety nebo žádný. Nesnáší cizí slova, **vykání mu sedí**, na velkém monitoru se rozhoduje.

**Co o něm vím:** detail v [`brief.md` § Cílovka](brief.md). Pivot proti původní cílovce („tech-savvy", tykání) je jádro téhle iterace.

**Kde ho potkám:**
- Na LinkedIn ho **nepotkám přímo** — on tam nesedí, sedí tam jeho IT poradce / účetní / synovec / soused, který mu radí. **LinkedIn je proxy kanál**, ne cílový.
- **Reddit r/podnikatele a r/czech** — minoritní, ale je tam. Hodí se k věcnému postu „co byste přidali do nástroje".
- **WhatsApp / Messenger / SMS doporučení** — největší kanál, který v této iteraci **nemůžu měřit** přímo. Vidím ho jen jako referrer „direct" v Cloudflare logách.
- **Mail a telefon** — když najde fakan.cz a nerozhodne se hned, napíše. Sleduju inbox.

### Sekundární — kdo to oznamuje dál

**Tech-savvy uživatelé v ekosystému** — vývojáři, designéři, IT poradci 25–45. Ti landing **nečtou pro sebe**, ale **doporučují ho** primární cílovce. Pro ně je důležitá:
- Nálepka „bez cookies, bez trackerů, vanilla JS, Cloudflare" (oni to ocení a doporučí).
- Konkrétní čísla v `prehled.html` (LCP, A11y skóre, schema.org).
- Podpora u technicky zdatných čtenářů `prehled.html` zůstává — copy.md § 6 to drží schválně.

**Z toho plyne dvojí komunikace:**
- `index.html` mluví **lidsky pro instalatéra**. Žádný buzzword v hero.
- `prehled.html` mluví **technicky pro doporučitele**. Buzzwordy zachované hlouběji v textu.
- Launch komunikace na sociálních sítích je **adresovaná doporučitelům** (technický rejstřík), ne primární cílovce přímo.

---

## 2. Co konkrétně oznamujeme

Tohle je **„relaunch" landing**, ne launch nového produktu. Co je nového proti předchozí verzi:

1. **Nový landing** — vykání místo tykání, srozumitelný tón, větší písmo, žádné „AI agenty" / „LCP" / „kernel" v hero.
2. **Lead capture funguje** — vyplníte e-mail + souhlas, do pár minut dorazí výsledky analýzy + nezávazný návrh řešení od člověka. Předtím lead capture neexistovala — analýza odjela do prázdna.
3. **Privacy Policy zveřejněna** na `/ochrana-udaju` — krátká, srozumitelná, retence 12 měsíců, jeden procesor (Cloudflare).
4. **Žádný cookie banner, žádný tracker** — to není „nová" feature, ale je to **rozlišovací znak** proti konkurenci a stojí za to to říct nahlas v každém launch postu.

**Co NEoznamujeme:**
- ❌ Magic-link auth flow ani velín — není v produkci, šablony jsou „na sklad".
- ❌ Mobilní aplikaci, marketplace, garanty — to je fáze 5+, nepatří sem.
- ❌ Tagline „Váš web. Bez starostí." jako hlavní message — to je tagline na webu, ne hook do postu (hook je „lead capture bez cookies").

---

## 3. Launch sequence — co se kdy děje

| Den | Co se děje | Kdo | Kanál | Done = |
|---|---|---|---|---|
| **D-1 (2026-05-14)** | Final smoke test produkce — celý flow: zadat URL → dostat výsledek → dorazí mail → opt-out funguje | Fakan + tester | browser, inbox | mail dorazil do 4 testovacích inboxů (Gmail, Seznam, Outlook, Centrum), opt-out odhlásil za < 1 min |
| **D-1 odpoledne** | Deliverability test — odeslat 4× testovací mail, zkontrolovat spam folder, headers (SPF, DKIM aligned), spam score | Fakan + tester | mail-tester.com nebo manuální | ≤ 2/10 spam score, žádný v promo/spam folderu |
| **D0 ráno (2026-05-15)** | Deploy do produkce přes `wrangler deploy` (nebo Worker Builds CI po push do main) | Fakan | Cloudflare dashboard | Worker logs ukazují normální traffic, žádné 5xx |
| **D0 ráno + 30 min** | Post-deploy validace — manuálně zadat 1 reálnou URL, ověřit lead v D1 + mail v inboxu | Fakan | browser | D1 řádek se `consent_at`, `consent_text_version=v1-2026-05-08`, mail dorazil |
| **D0 dopoledne** | Cloudflare Web Analytics zapnuté na fakan.cz (cookieless, viz § 5.2 níže) | Fakan | Cloudflare dashboard | dashboard začíná sbírat agregáty |
| **D0 odpoledne** | **Soft launch** — sdílím v užším kruhu (5–10 lidí: 3 IT poradci, 2 majitelé SMB z mého okruhu, 2 designéři, 1 účetní) přes WhatsApp / mail | Fakan | osobně | každý dostal odkaz + 1 větu „mrkni a řekni, jestli to pro paní z e-shopu dává smysl" |
| **D+1** | Sběr feedbacku z měkkého kruhu — vyhodnocení, jestli copy mluví správně k cílovce | Fakan | mail/zpráva | min. 5 odpovědí; když ≥ 2 řeknou „nerozumím", **pozdržet veřejný launch** a přepsat |
| **D+2 (2026-05-17)** | **Veřejný launch** — LinkedIn post + Twitter post + 1× Reddit r/podnikatele post (viz § 4) | Fakan | LinkedIn, Twitter, Reddit | posty publikované, odkaz vede na fakan.cz/?utm_source=… (UTM jen v sociálních postech, viz § 5.3) |
| **D+3** | Sledování první vlny — počet návštěv, počet leadů, opt-out rate, spam-folder hlášení | Fakan + finance | Cloudflare Analytics + D1 | první report v `delivery.md` |
| **D+7 (2026-05-22)** | **Týdenní retro** — počet leadů, mail deliverability, opt-out rate, top 5 referrer, top 3 frikční body | Fakan + finance + product-manager | reporting, retro v `retro.md` | retro zápis hotový, akční položky pro další iteraci |
| **D+14** | Druhá retrospektiva — pokud >5 leadů, vyhodnotit konverzní funnel (kolik z nich napsalo zpět). Pokud <5, urgentní debug. | Fakan + product-manager | reporting | rozhodnutí: pokračovat / přepsat / přidat kanál |
| **D+30** | **30denní cíl gate** — 20 leadů? 100 návštěv? Pokud ne, co změnit? | Fakan + product-manager | retro | rozhodnutí o pokračování campaign / pivot |

**Princip:** soft launch dřív než veřejný. Když 2 z 5 lidí řeknou „nerozumím", veřejný launch se pozdrží — protože to znamená, že jsme stále nepřeklenuli buzzword propast.

---

## 4. Channels — kde se to říká

### 4.1 LinkedIn (Fakanův osobní profil)

**Cíl:** doporučitelé v ekosystému (IT poradci, designéři) → ti dál říkají primární cílovce.

**Hook (návrh, varianta A — technicky):**

> Předělali jsme fakan.cz pro lidi 40+, kteří nesnášejí cizí slova.
>
> Co se změnilo:
> – tykání → vykání důsledně
> – „AI agenty s lidským garantem" → „web, o který se nemusíte starat"
> – „LCP < 1,5 s" → „naskočí dřív, než si vzpomenete, proč jste klikli"
>
> Co zůstalo:
> – žádné cookies, žádné trackery, žádný cookie banner
> – Cloudflare end-to-end, vanilla JS, < 30 kB JS
> – lead capture (zadáte URL + e-mail, do pár minut máte výsledky a nezávazný návrh)
>
> Když znáte v okolí někoho, kdo má web ze šablony a stěžuje si, že už neví, jak ho obsluhovat — pošlete mu to. Bezplatná analýza, bez registrace.
>
> 👉 fakan.cz

**Hook (návrh, varianta B — emoční):**

> Paní Marie z mého okruhu má e-shop s kořením. 8 let. Donedávna měla web z šablony, kterou ji „kámoš udělal".
>
> Loni přišel cookie banner. „Co je to ta GDPR?" Pak měla v patičce 3 různé trackery. „A na co?" Teď chce, aby web fungoval na mobilu.
>
> Většinu nástrojů jí nemůžu doporučit, protože jsou pro ni v cizím jazyce.
>
> Tak jsme předělali fakan.cz: vykání, větší písmo, žádný cookie banner, žádný „AI agent", žádné „LCP". Mluví na ni.
>
> Bezplatná analýza, bez registrace, výsledky do minuty.
>
> 👉 fakan.cz

**Doporučuju variantu B** — má příběh, je o člověku, ne o featuře. Konverze z storytellingu je u CZ LinkedIn vyšší než z bullet listu.

**Timing:** D+2 dopoledne (úterý 2026-05-17 ~10:00, kdy má LinkedIn algoritmus nejvyšší engagement v ČR).

**Tracking:** odkaz s `?utm_source=linkedin&utm_medium=social&utm_campaign=landing-v2`.

### 4.2 Twitter / X (Fakanův osobní profil)

**Cíl:** rychlá distribuce do techbubliny + zpětná vazba.

**Hook (krátký, drží 280 znaků):**

> Předělali jsme fakan.cz pro lidi 40+. Vykání, větší písmo, žádné „AI agenty" v hero. Bez cookies, bez trackerů, vanilla JS na Cloudflare. Bezplatná analýza vašeho webu — žádná registrace, výsledky do minuty.
>
> 👉 fakan.cz

**Timing:** D+2 souběžně s LinkedIn.

**Tracking:** `?utm_source=twitter&utm_medium=social&utm_campaign=landing-v2`.

### 4.3 Reddit r/podnikatele (CZ subreddit pro podnikatele)

**Cíl:** dostat se k SMB majiteli organicky. **Pozor:** Reddit detekuje samo-promo a banuje. Post musí být **hodnota-first**, ne reklama.

**Hook (formát „nezávazná pomoc komunitě"):**

> **Ahoj, udělal jsem nástroj, co audituje váš web — co byste přidali?**
>
> Měli jsme tu tým, který dělá weby pro malé firmy (instalatéři, právníci, e-shopy). Pořád se nás ptali to samé: *„Můj web je k ničemu, ale nevím proč. Můžete se podívat?"*
>
> Tak jsme udělali nástroj, kde zadáte adresu webu a do minuty vidíte:
> – jestli máte cookie banner (a proč ho možná nepotřebujete)
> – jestli web naskočí pod sekundu na mobilu nebo se 4 sekundy točí
> – jestli vás Google najde (titulek, popis, struktura)
> – jestli se odkaz hezky sdílí na FB
>
> Je to zdarma, bez registrace. Žádná verze pro 9 990 / měsíc, žádný „premium plán".
>
> Vyzkoušejte na svém webu a napište, co byste tam ještě chtěli vidět. Mám rozdělané další kontroly, ale nechci je dělat naslepo.
>
> 👉 fakan.cz

**Timing:** D+2 odpoledne (po LinkedIn / Twitter, ať je to mimo špičku jejich algoritmu — Reddit je o sběru komentářů, ne o broadcast).

**Tracking:** `?utm_source=reddit&utm_medium=community&utm_campaign=landing-v2`.

**Risk:** pokud admin subredditu post smaže nebo se moderátor naštve, **smazat a nereagovat**. Reddit má dlouhou paměť. Záložní kanál: r/czech (méně podnikatelů, ale tolerantnější k self-promo, pokud je hodnota-first).

### 4.4 Direct outreach (5–10 lidí)

**Cíl:** soft launch, sběr feedbacku před veřejným postem.

**Forma:** WhatsApp / Messenger / e-mail. **Ne** hromadný BCC mail — vypadá to spamově. Každému osobně 2 věty.

**Šablona zprávy:**

> Ahoj, mrkni prosím na fakan.cz — předělali jsme to pro 40+ cílovku. Pokud znáš někoho, kdo by si měl analyzovat web (paní z e-shopu, místní instalatér), pošli mu to. A mně dej vědět, jestli je tam něco, co bys přepsal.

**Tracking:** UTM `utm_source=direct&utm_medium=personal&utm_campaign=soft-launch` — ale vzhledem k tomu, že odkaz copy-pastnou z WhatsApp, většinou UTM přijdou.

### 4.5 Co NEDĚLÁM v této iteraci

- ❌ **Placené Ads** (Google Ads, Meta Ads, Sklik) — bootstrap fáze, žádný rozpočet, organické kanály prokážou, jestli copy funguje. Až bude konverze měřitelná, můžeme uvažovat.
- ❌ **Newsletter / mailing** — nemáme distribuční seznam, lead list je v jednotkách. Až bude 100+ leadů, dává smysl.
- ❌ **PR / media outreach** — fakan.cz není dost zralý na novinářskou pozornost. Až bude první 100 zákazníků, můžeme oslovit Lupa.cz.
- ❌ **Cold outreach SMB seznamem** — to je marketing přes oprávněný zájem, vyžadovalo by jiný legal základ než lead capture (viz [`risk-check.md` § 2.1](risk-check.md)). **Out of scope.**
- ❌ **Influenceři / podcastové sponzorství** — žádný rozpočet a špatný kanál pro 40+ cílovku.

---

## 5. Tracking — co měříme bez cookies a bez trackerů

**Pravidlo:** žádný GA4, žádný Meta Pixel, žádný Mixpanel, žádný Hotjar (viz [`risk-check.md` § 3](risk-check.md)). Měřit jen to, co lze ze server-side zdrojů.

### 5.1 Server-side counts (D1 + KV + Worker logs)

Tyto jsou **autoritativní** zdroje pravdy. Architect a junior je naimplementují v rámci lead capture flow — většina už v `tasks.md` je.

| Event | Zdroj | Jak měřit | Co znamená |
|---|---|---|---|
| `analyze_started` | Worker logs | count GET `/api/analyze` | kolik lidí kliklo „Analyzovat zdarma" a worker začal stahovat web |
| `analyze_completed` | Worker logs | count `done` SSE eventů | kolik analýz došlo do konce (nezavřeli záložku) |
| `analyze_abandoned` | derived | `analyze_started` − `analyze_completed` | kolik lidí odešlo před koncem analýzy |
| `lead_captured` | D1 `leads` | `COUNT(*)` z `leads` per den | hlavní KPI — kolik leadů přibylo |
| `lead_duplicate` | D1 + Worker logs | duplicitní `INSERT OR IGNORE` count | kolik lidí pokusů 2× se stejným mailem (idempotence test, signál „chce to znova, mail nedorazil?") |
| `mail_sent` | D1 `leads.status='mailed'` | count | kolik mailů odešlo přes Email Workers |
| `mail_failed` | D1 `leads.status='mail_failed'` | count | kolik mailů selhalo (nevalidní adresa, kvóta atd.) |
| `opt_out` | D1 `leads.unsubscribed_at IS NOT NULL` | count | kolik lidí odhlásilo |
| `rate_limit_hit` | KV counts | count keys s prefixem `ratelimit:` které dosáhly limitu | telemetrie agresivních botů + edge case false positives |
| `honeypot_hit` | Worker logs | count requestů s vyplněným honeypotem | botová aktivita |
| `consent_missing` | Worker logs | count odmítnutých submitů (server-side enforcement) | kolik se pokusilo bez `consent=true` (signál UI bugu nebo botů) |

### 5.2 Cloudflare Web Analytics (cookieless, opt-in)

**Rozhodnutí (autonomně, drží mantinely):**

Cloudflare Web Analytics **zapínám**. Je to JS snippet od Cloudflare, **bez cookies**, bez fingerprintingu, bez PII. Sbírá agregát: počet visitů, top stránky, top referrer, performance metriky (LCP, FID, CLS) z Real User Monitoring. **Splňuje brand mantinely** (viz CLAUDE.md sekce 2 — „Žádné third-party trackery" je o trackerech, kteří sbírají PII; Cloudflare Web Analytics je vlastní infra a nesbírá PII).

**Risk:** technicky je to třetí JS snippet. Pokud architect v Gate 3 řekne „radši ne, ať máme čistý <head>", **respektuju** a měříme jen ze serveru. **Eskalace na architecta** v § 9 níže.

**Co z toho vidím:**
- Počet unique visitors per den (best-effort odhad bez cookies, založen na IP+UA hash s rotací)
- Top stránky (kolik lidí se dostane na `prehled.html`?)
- Top referrer (LinkedIn? přímý? Reddit?)
- LCP / FID / CLS distribuce (validace performance KPI z briefu — naskakuje to pod 1,5 s na reálných uživatelích?)

**Co tam není (a je to OK):**
- Conversion tracking (kdo kliknul na CTA → zadal lead)
- User journey (kde lidé padají z funnelu)

Tohle dohromady doplníme přes UTM (§ 5.3) a server-side counts (§ 5.1).

### 5.3 UTM parametry

UTM pouze v **sociálních / přímých postech** (LinkedIn, Twitter, Reddit, direct). **Ne v organic SEO** (UTM v Google search results vypadá podezřele a Google to umí penalizovat).

| Kanál | UTM string |
|---|---|
| LinkedIn | `?utm_source=linkedin&utm_medium=social&utm_campaign=landing-v2` |
| Twitter / X | `?utm_source=twitter&utm_medium=social&utm_campaign=landing-v2` |
| Reddit r/podnikatele | `?utm_source=reddit&utm_medium=community&utm_campaign=landing-v2` |
| Direct outreach (WhatsApp/mail) | `?utm_source=direct&utm_medium=personal&utm_campaign=soft-launch` |

**UTM se ukládá do D1 `leads.source`** (per [`risk-check.md` § 1.2](risk-check.md), schéma `leads` má pole `source`). Worker při zpracování formuláře vezme `document.referrer` + URL parametry a uloží jako string typu `linkedin/social/landing-v2`. Tak vidím, **z kterého kanálu konkrétní lead přišel**, ne jen kolik leadů celkem.

**URL stripping vs. UTM:** [`risk-check.md` § 1.3](risk-check.md) říká stripnout senzitivní parametry (`token`, `session`, `auth`…), **ale UTM zachovat** — ty osobní údaj nejsou. Junior to musí v kódu rozlišit: `utm_*` whitelist, ostatní známé senzitivní blacklist, zbytek default ponechat.

### 5.4 Reply rate (manuálně)

Bez tracking pixelu **neumíme měřit open rate** mailů. Místo toho:

- **Reply rate** = kolik lidí odpoví na mail přes `mailto:jsem@fakan.cz` link nebo direct reply. Sleduji v inboxu.
- **Click-to-results rate** = kolik lidí klikne v mailu na „otevřít výsledky" a dostane se na `vysledek.html`. Měřitelné přes server-side log toho endpointu (URL `vysledek?url=…&from=mail` s `from=mail` parametrem v mail šabloně). **Akční položka pro juniora:** přidat `from=mail` parametr do `lead-followup` mail šablony, ať se dá segmentovat.

### 5.5 Manuální týdenní reporting

Fakan jednou týdně (každé pondělí 9:00) otevře:

1. **Cloudflare Web Analytics dashboard** — návštěvy, top stránky, top referrer, LCP/CLS distribuce
2. **D1 query** přes `wrangler d1 execute` nebo dashboard:
   ```sql
   SELECT
     DATE(created_at) AS den,
     source,
     COUNT(*) AS leadu,
     SUM(CASE WHEN status='mailed' THEN 1 ELSE 0 END) AS odeslano,
     SUM(CASE WHEN unsubscribed_at IS NOT NULL THEN 1 ELSE 0 END) AS odhlaseni
   FROM leads
   WHERE created_at > date('now', '-7 days')
   GROUP BY DATE(created_at), source
   ORDER BY den DESC, leadu DESC;
   ```
3. **Inbox `jsem@fakan.cz`** — počet replies, počet manuálních dotazů, top 3 friction body
4. **Worker logs** přes `wrangler tail` (nebo Logpush) — anomálie (`rate_limit_hit > 1 % requests`, `mail_failed > 5 %`, `honeypot_hit > 1 %`)

Zápis do `delivery.md` § týdenní reporting nebo do `retro.md` při retro-gate.

---

## 6. Success metrics — co chci vidět

### 6.1 KPI (top 3, podle priority)

1. **Lead count** — počet úspěšně zachycených leadů s odeslaným mailem.
   - **D+7:** ≥ 5 leadů (validace, že flow funguje a zájem existuje)
   - **D+14:** ≥ 12 leadů
   - **D+30:** ≥ 20 leadů (cíl iterace)

2. **Mail deliverability proxy = opt-out rate** — bez open trackingu je nejlepší proxy.
   - **Cíl:** opt-out rate < 5 % (z odeslaných mailů ≤ 5 % se odhlásí). Vyšší znamená, že mail je obtěžující nebo neočekávaný.
   - **Kritický flag:** opt-out rate > 15 % → **stop campaign**, přepsat mail nebo souhlas.

3. **Konverze landing → lead** — z unique visitors kolik vyplní formulář.
   - **Cíl:** ≥ 3 % (ze 100 návštěv 3 leadi). Je to konzervativní — pro lead capture s kvalitní cílovkou bývá 5–10 %, ale jsme nový brand.
   - **Kritický flag:** < 1 % → copy nemluví k cílovce, eskalovat do retro.

### 6.2 Sekundární metriky (informativní, nepříjímám rozhodnutí jen na nich)

- **Analyze completion rate** = `analyze_completed / analyze_started`. Cíl ≥ 70 %. Pod 50 % = analýza je pomalá nebo padá.
- **Reply rate** = počet replies / počet `mail_sent`. Cíl ≥ 10 % (ze 20 leadů aspoň 2 odpoví na mail). Pod 5 % = mail nevyvolává reakci.
- **Direct conversion** = počet leadů z `utm_source=direct` / počet osob v soft launch. Cíl 30 % (z 10 osob 3 lead). Pod 10 % = soft launch nezacílen správně.
- **LCP p75** (z Cloudflare Web Analytics) — ≤ 1,5 s. Validace performance KPI z briefu.

### 6.3 Co NEsleduji

- **Bounce rate, time on page, scroll depth** — bez cookies / bez fingerprintingu to nejde a stejně by mě to neposunulo k rozhodnutí. Když Cloudflare Web Analytics ukáže, že lidi koukají jen na hero a odejdou, neumím říct, jestli to je proto, že hero nezaujme, nebo proto, že přišli omylem. Server-side counts v § 5.1 dají lepší odpověď.
- **Open rate mailů** — bez pixelu to neměříme. Reply rate je rozumný proxy.
- **Vanity metrics** — počet LinkedIn likes, počet Twitter retweets. Sleduju mimochodem, ale rozhodnutí podle nich nedělám.

---

## 7. Anti-goals — co se NEMÁ stát

1. **Spam volume** — bot zahltí formulář a odešle 1 000 leadů s falešnými e-maily. **Mitigace:** Turnstile + rate limit (3 analýzy/24h/IP, viz [`tasks.md` lead capture task](tasks.md)) + honeypot. Sledování `honeypot_hit` a `rate_limit_hit` jako early warning.
2. **Cookie banner skrz back door** — nikdo nesmí v rámci campaign navrhnout „dáme jen Hotjar lite na týden", „jen GA4 do retra", „jen Meta Pixel pro retargeting". **Hard veto** ([`risk-check.md` § 3](risk-check.md)). Brand má držet.
3. **Mail v spam folderu** — pokud první vlna mailů půjde do spamu (Gmail, Seznam), reputační hit, který se opravuje měsíce. **Mitigace:** D-1 deliverability test 4× inboxů, monitor `mail_failed`, scope DMARC do priority 2 (research dohledal MX/SPF/DKIM aktivní, DMARC chybí — přidat samostatný úkol v README).
4. **Špatná cílovka** — landing přitáhne tech-savvy lidi, kteří nikdy nezaplatí, místo SMB majitelů. **Měřitelné** přes UTM + reply obsahem. Pokud po D+14 reply text vypadá technicky („proč ne React?", „jaká D1 migrace?"), pivot copy v retro.
5. **Drahá akvizice** — bootstrap fáze nemá rozpočet na placené Ads. Pokud se dostaneme do situace „máme 5 leadů za 30 dní, musíme přidat Ads", **vrátit se k retro a debugovat copy/kanál**, ne lít peníze do mrtvého funnelu.
6. **Skrytá smluvní oferta v mailu** — viz [`risk-check.md` § 6](risk-check.md). Mail follow-up musí explicitně říct „nezávazný návrh", žádná „odpovědí potvrzujete objednávku". Junior to v copy.md § 7 má, ale tester ověří v Gate 3.

---

## 8. Risks a mitigace launch

| Risk | Pravděpodobnost | Dopad | Mitigace | Kdo hlídá |
|---|---|---|---|---|
| Mail deliverability problém (spam folder) | střední | vysoký (žádné leady doručené) | D-1 test 4× inboxy, monitor `mail_failed`, DMARC do priority 2 | Fakan + tester |
| Rate limit edge case (NAT z kanceláří) | střední | nízký (legitimní user nedostane analýzu) | sledovat `rate_limit_hit` po launchi, pokud > 1 % requestů zvednout limit | Fakan |
| Honeypot false positives (password manageři) | nízká | nízký (ztráta legitimního leadu) | sledovat `honeypot_hit`, pokud > 1 % submitů audit polí | tester |
| Reddit ban za samo-promo | střední | nízký (jeden kanál odpadá) | post hodnota-first, pokud smazán, nereagovat, jet bez Redditu | Fakan |
| Soft launch feedback negativní (2/5 řekne „nerozumím") | střední | vysoký (veřejný launch by byl plýtvání) | gate v § 3 timeline — pozdržet veřejný launch, přepsat copy | Fakan |
| LinkedIn algoritmus pohřbí post | střední | nízký (jeden kanál slabší) | timing 10:00 úterý, hashtagy minimum (LinkedIn je nesnáší) | Fakan |
| Konkurent okopíruje copy | nízká | nízký (vykání + bez cookies není jejich brand DNA) | žádná aktivní mitigace, držet kvalitu | — |
| AI samochvála se vrátí do copy přes review | nízká | střední (porušení brand pivotu) | tester checkne `prehled.html` v Gate 3 na výskyt „AI agenty" v hero pozicích | tester |

---

## 9. Otevřené otázky pro Fakana / další fáze

1. **Cloudflare Web Analytics — zapnout?** Můj návrh: ano, splňuje brand mantinely (cookieless, vlastní infra). **Eskalace na senior-architect** pro ADR-check, jestli to má být <script> v <head>. Pokud architect řekne ne, měříme jen ze serveru a UTM.

2. **DMARC pro fakan.cz** — research dohledal, že chybí. Pro tuhle iteraci out of scope (Gmail/Outlook deliverability je OK bez DMARC). **Akce:** přidat samostatný úkol v README priority 2 — „doplnit DMARC pro fakan.cz".

3. **Public release notes / changelog** — na `/zpravy` (PRD plánovaný notifikační hub)? Pro tuhle iteraci ne, hub neexistuje. Pro veřejné oznámení stačí LinkedIn / Twitter post.

4. **Druhý launch volume po retro D+30** — pokud cíl 20 leadů splníme nebo přestřelíme, máme spustit druhou vlnu (např. mailing partnerů, podcastové oslovení)? **Rozhodnutí v retro D+30**, ne teď.

5. **A/B test variant LinkedIn hooku** — varianta A (technicky) vs. B (storytelling). **Doporučuji jen B**, A/B test na jednom postu je metodicky nesmyslný (LinkedIn nemá nativní A/B test, máme málo dat). Pokud chce Fakan A/B, musí to být dvě iterace.

---

## 10. Co předávám dál

- **Junior backend (TASK-XX z `tasks.md`):** přidat `from=mail` parametr do `vysledek?url=…` linku v `lead-followup.html` šabloně. UTM whitelist v URL stripperu (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` = zachovat, ostatní default).
- **Tester (Gate 3):** validace deliverability D-1, ověření opt-out flow, ověření že `prehled.html` nemá „AI agenty" v hero pozicích.
- **Senior-architect (Gate 3):** rozhodnutí Cloudflare Web Analytics — ano / ne / s podmínkou.
- **Finance (D+7 retro):** skutečný cost vs. forecast, breakdown per kanál.
- **Product-manager (D+30 retro):** vyhodnocení KPI cílů, akční položky pro další iteraci.

---

## 11. Krátký debrief — co tahle iterace neřeší a další iterace na to navazují

- **Velín / dashboard pro klienty** — fáze 5+, čeká na implementaci magic link auth.
- **Mobilní aplikace** — fáze 5+, mimo current scope.
- **Marketplace / pluginy 3rd party** — fáze 6+, mimo current scope.
- **Newsletter / mailing pro existující leady** — až po 100+ leadech, samostatná iterace s vlastním legal základem.
- **Placené kanály (Ads)** — až bude měřitelná konverze (CAC vs. LTV), samostatná iterace.

---

*Verze launch-plan v1, do delivery k owner přečtení v Gate 3. Aktualizace podle skutečnosti v `retro.md` po D+30.*
