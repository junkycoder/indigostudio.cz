# Copy — landing-v2

**Autor:** marketer
**Datum:** 2026-05-08
**Verze:** v1 (návrh do delivery, schvaluje owner)

---

## 0. Mantinely a kontext (proč tahle verze copy vypadá takhle)

- **Cílovka:** majitel malé firmy 40+. Instalatér, právník, paní s e-shopem, autoservis. Neumí React, neumí LCP, **chce klid**.
- **Vykání důsledné** napříč webem i maily. „Vy", „Váš web", „pošleme vám".
- **Krátké věty.** Aktivní rod. Sebekritika OK, ironie lehká.
- **Hero a CTA bez buzzwordů** — žádné „AI agenty", „framework", „LCP", „CLS", „INP", „WCAG", „CDN", „kernel", „hydration", „cookies" jako self-stat.
- **Lidský garant > AI** — Fakan má jméno, AI je nástroj.
- **Konkrétní čísla** kde to dává smysl. „99 Kč/měs", „za 30 sekund", „do 24 hodin". Žádné „rychleji".
- Slovo „cookies" pouze v sekci, kde to je rozlišovací znak proti konkurenci, a formulujeme to lidsky („žádné okénko se souhlasem"), ne jako self-stat v hero.

---

## 1. Tagline — návrhy

Současný tagline „Tvůj web. Bez výmluv." Fakan otevřel k redesignu (decisions.md, Gate 1). Cílovka 40+ vykání.

- **Varianta A:** **„Váš web. Bez starostí."**
  - Zachovává rytmus „dvě věty, druhá popírá zlozvyk".
  - „Bez starostí" je lidské, neobchodní, sedí 40+ člověku, který nechce řešit reklamace, hosting a aktualizace.
  - Slovo „starosti" mu rezonuje líp než „výmluvy" — výmluvy mu nikdo nedává, starosti má.

- **Varianta B:** **„Web, který se stará sám."**
  - Direktnější benefit-first.
  - Navazuje na podtitul „Web jako služba, ne jako artefakt" v `prehled.html`.
  - Bez vykání ve formě „vy", ale tón vyhovuje.

- **Varianta C:** **„Váš web. Vyřízeno."**
  - Hodně krátké, instalatér to ocení.
  - „Vyřízeno" je české, hovorové, dospělé. Jako když podnikateli někdo na úřadě konečně vyřídí razítko.

**Doporučení: Varianta A — „Váš web. Bez starostí."**

Důvod: drží rytmus a punc původního taglinu (dvě věty, druhá popírá), ale přepíná na vykání a mluví o tom, co cílovka **reálně cítí** (starosti se webem), ne o tom, co Fakan řeší (výmluvy). Varianta B je benefit-first, ale popisná, ne emoční. Varianta C je dobrá pro patičku nebo banner, jako hlavní tagline je málo „konkrétní".

---

## Brand claim (přidáno 2026-05-08)

**„Když web, jedině od Fakana."**

Doplňková mantra k taglinu „Váš web. Bez starostí.". Funguje jako brand-line v meta description, OG share, eyebrow v hero, a Schema.org `slogan`. Schválil owner přímou cestou 2026-05-08, mimo standardní variant A/B/C process.

**Kde se používá:**
- `index.html` — eyebrow nad hero H1 (`<p class="brand-claim">Když web, jedině od Fakana.</p>`, nový styl `.brand-claim` zachovává sentence case s tečkou)
- `index.html` + `prehled.html` — `<meta name="description">` první věta
- `index.html` Schema.org `Organization.slogan`
- `index.html` + `prehled.html` OG description + Twitter description
- Mailové podpisy (volitelně, retro/další iterace)

---

## 2. Privacy Policy — `/ochrana-udaju`

> **Pozn. pro juniora:** plný text níže patří do `fakan.cz/ochrana-udaju.html` jako prose obsah `<main>`. Stylování per design § 6.5 (max-width 70ch, stejné CSS tokeny jako index). Slug per tie-breaker v decisions.md.

> **Pozn. pro legal:** retence 12 měsíců (ne 24 navržených v risk-check § 2.3). Důvod: bootstrap fáze, malý objem leadů, kratší retence = nižší risk povrch, snadnější prokázat „minimalizaci dle GDPR čl. 5(1)(c)". Po prvních 6 měsících vyhodnotíme z retra a případně prodloužíme. Nesmí to být déle, než je obhájitelné — pro lead, který se ozval a nezakoupil, je 12 měsíců poctivé.

---

### Zásady ochrany osobních údajů

**Účinné od:** 8. května 2026
**Verze:** 1

Tyto zásady popisují, jak na webu **fakan.cz** zpracováváme vaše osobní údaje, když u nás vyplníte formulář pro analýzu webu nebo se nám ozvete.

#### 1. Kdo zpracovává vaše údaje

Správcem je společnost **Indigo Studio s.r.o.**, Chudenická 1059/30, 102 00 Praha, IČO: 14389096, zapsaná v obchodním rejstříku vedeném Městským soudem v Praze, oddíl C, vložka 364981.

Provozovatelem služby fakan.cz je Daniel Hromada (Fakan).

**Kontakt:** [jsem@fakan.cz](mailto:jsem@fakan.cz), +420 604 690 539.

Pověřence pro ochranu osobních údajů (DPO) nemáme — nezpracováváme zvláštní kategorie údajů ani neprovádíme rozsáhlý monitoring, takže ho zákon nevyžaduje.

#### 2. Jaké údaje sbíráme

Když u nás vyplníte formulář pro bezplatnou analýzu webu, ukládáme:

- **adresu vašeho webu** (URL), kterou jste zadali — bez přihlašovacích tokenů a citlivých parametrů (ty před uložením z URL odřežeme),
- **vaši e-mailovou adresu**,
- **datum a čas** vyplnění formuláře,
- **šifrovaný otisk vaší IP adresy** (jako důkaz, že jste souhlas opravdu udělili — neumíme z něj zpětně zjistit vaši IP),
- **verzi textu souhlasu**, který jste odsouhlasili,
- **zdroj** (z které stránky jste formulář odeslali — třeba úvod, výsledky, kontakt).

Co **NESBÍRÁME**:

- žádné cookies, žádné sledovací pixely, žádné fingerprintingy,
- žádné údaje od třetích stran (Google, Meta, Sklik a podobně) — nemáme s nimi nic propojené,
- žádné citlivé údaje (zdraví, politické názory, biometrika).

#### 3. Proč to sbíráme (právní základ)

Vaše údaje zpracováváme **na základě vašeho souhlasu** (čl. 6 odst. 1 písm. a) GDPR). Souhlas dáváte zaškrtnutím políčka u formuláře. Bez tohoto souhlasu od vás nic neuložíme a žádný e-mail vám nepošleme.

Účel je jediný: **poslat vám výsledky analýzy a nezávazný návrh, jak váš web zlepšit nebo o něj postaráme.**

#### 4. Jak dlouho to držíme

| Co | Jak dlouho | Co potom |
|---|---|---|
| Aktivní lead (zájemce) | **12 měsíců** od posledního kontaktu | smažeme nebo anonymizujeme |
| Odhlášený lead | **3 roky** (jen evidence odvolání souhlasu) | po 3 letech smažeme |
| Zákazník (uzavřená zakázka) | dle daňových a účetních předpisů (zpravidla 10 let) | mimo režim těchto zásad |

12 měsíců držíme krátce schválně — chceme zpracovávat **co nejméně, co nejkratší dobu**. Když si do roka neozvete, smažeme vás z databáze, abychom měli klid v hlavě my i vy.

#### 5. Komu to předáváme

Vaše údaje předáváme jen jednomu zpracovateli:

- **Cloudflare, Inc.** — provozovatel naší infrastruktury (databáze, e-maily, hosting). Cloudflare je certifikován v rámci [EU-US Data Privacy Framework](https://www.dataprivacyframework.gov/) a má s námi uzavřenou smlouvu o zpracování osobních údajů ([DPA](https://www.cloudflare.com/cloudflare-customer-dpa/)).

Žádné další třetí straně vaše údaje nepředáváme. Žádný marketingový partner, žádný analytický nástroj, nic.

#### 6. Vaše práva

Podle GDPR máte právo:

- **vědět, co o vás máme** (čl. 15) — napište nám a do 30 dnů vám pošleme výpis,
- **opravit chybný údaj** (čl. 16) — třeba špatně napsaný e-mail,
- **požádat o smazání** (čl. 17) — buď přes odhlašovací odkaz v každém našem e-mailu, nebo nám napište,
- **odvolat souhlas** kdykoliv (čl. 7 odst. 3) — jeden klik na „Odhlásit" v patičce e-mailu, hotovo,
- **podat stížnost** u Úřadu pro ochranu osobních údajů ([uoou.gov.cz](https://www.uoou.gov.cz/)).

Stačí napsat na [jsem@fakan.cz](mailto:jsem@fakan.cz) a do 30 dnů to vyřídíme.

#### 7. Bezpečnost

Vaše data jsou uložená v databázi Cloudflare (D1) v zašifrované podobě. Vaši IP adresu si neukládáme v plné podobě, ale jen jako jednosměrný šifrovaný otisk. Komunikaci chráníme HTTPS/TLS.

#### 8. Změny těchto zásad

Pokud změníme znění souhlasu, vytvoříme novou verzi tohoto dokumentu a v databázi si pamatujeme, **kterou verzi jste odsouhlasili vy**. Když se zásady významně změní, dáme vám vědět e-mailem.

Aktuální verze je **v1, účinná od 8. května 2026**.

---

## 3. Consent text — verze v1-2026-05-08

> Souhlasím, aby společnost **Indigo Studio s.r.o.** (IČO 14389096) zpracovala mou e-mailovou adresu pro účely zaslání výsledků analýzy a **nezávazného návrhu řešení**. Souhlas mohu kdykoliv odvolat kliknutím na „Odhlásit" v patičce e-mailu. Více v [zásadách ochrany osobních údajů](/ochrana-udaju).

**Pozn. k UI implementaci** (junior frontend / tester):

- separátní `<input type="checkbox">`, **NESMÍ** být `checked` defaultně,
- odkaz na zásady musí být **klikatelný uvnitř textu** (ne jen v patičce),
- bez zaškrtnutí nesmí formulář odejít (`required` atribut + server-side enforcement v Workeru per risk-check § 2.1),
- text je v souboru `legal/consent-versions/v1-2026-05-08.md` (junior založí jako součást TASK-13 backendu).

---

## 4. index.html

### Klíčové změny (proč jsem zahodil současné copy)

Současný hero říká „Tvůj web. Bez výmluv." plus „rychlost, SEO, přístupnost, bezpečnost". Pro pana instalatéra to je čínština. Tykání ho odpuzuje, „SEO" ho nezajímá (chce být v Googlu, ne mít „SEO"), „přístupnost" si splete s bezbariérovým vchodem do provozovny.

Hero stats měl „0 cookies" jako self-stat — přesně to, co cílovku mate (vidí cookies a vypne mozek). Vyhozeno. Místo toho **co reálně dostane** (zdarma, do minuty, doopravdy zdarma — bez háčků).

Sekce „Co děláme" měla „AI redesign, hosting, správa a růst" + „AI agenty s lidským garantem, vanilla HTML/CSS/JS, žádné frameworky". Cílovku zajímá, jestli ji to nezklame, a kdo za to ručí. Přepsáno na **co dostane** + **co to znamená pro něj**, ne **z čeho je to udělané**.

Standardy zůstávají, ale přepsané z žargonu („LCP < 1,5 s") na lidskou řeč („Stránka naskočí dřív, než si vzpomenete, proč jste klikli."). Detail technický věrně zachován v `prehled.html` pro IT-friendly návštěvníky.

CTA banner zachován strukturou (formulář), copy přepsán na vykání + bez „cookies" mantry.

---

### Hero

- **H1:** Váš web. Bez starostí.
- **Lead:** Zadejte adresu svého webu. Za pár sekund uvidíte, co s ním. Zdarma, bez registrace, bez háčků.
- **CTA primární:** Analyzovat zdarma →
- **Sekundární odkaz:** *(žádný — hero záměrně bez druhé volby, 40+ neřeší „dozvědět se víc", chce vidět výsledek)*
- **Pod CTA mikrocopy:** Trvá to chvilku. Žádný účet zakládat nemusíte.

> Pozn.: hero formulář se rozšiřuje o pole „e-mail" + checkbox „souhlas" per design § 6.1. Texty pro ně níže.

#### Form labels & placeholders (hero formulář)

- **Label „url":** Adresa vašeho webu
- **Placeholder „url":** vasedomena.cz
- **Label „email":** Váš e-mail
- **Placeholder „email":** vy@vasedomena.cz
- **Mikrocopy pod e-mailem:** Pošleme vám výsledky a nezávazně se ozveme. Nikam jinam to nedáme.
- **Consent checkbox:** *(viz § 3 výše — verze v1-2026-05-08)*

---

### Hero stats (3 karty místo 4)

Šel jsem ze 4 na 3. Důvod: 4 statistiky na mobilu jsou 2 řady po dvou (rozbité), 3 jsou jedna řada nebo tři pod sebou — čitelnější. „ZIP export" jsem vyhodil, není to argument pro 40+, ten o exportu nepřemýšlí dokud nenastane průšvih s konkurencí.

- **Karta 1:**
  - **Hlavní:** Do minuty
  - **Popisek:** Než si dáte kafe, uvidíte výsledky.
- **Karta 2:**
  - **Hlavní:** Zdarma
  - **Popisek:** Žádná registrace. Žádné háčky.
- **Karta 3:**
  - **Hlavní:** od 99 Kč
  - **Popisek:** Hosting měsíčně, kdyby vám u nás zůstal.

---

### Sekce „Co děláme"

- **Eyebrow:** Co děláme
- **H2:** Web, o který se nemusíte starat.
- **Lead pod H2:** Postaráme se o všechno od první obhlídky až po denní provoz. Vy nám řeknete, co potřebujete. My to uděláme.

**4 karty:**

1. **Nadpis:** Najdeme, co je špatně
   **Věta:** Zdarma vám projedeme web a ukážeme, co stojí za opravu. Bez registrace.

2. **Nadpis:** Navrhneme, jak to vyřešit
   **Věta:** Nový vzhled, opravu starého, nebo úplně nový web — vy si vyberete, co dává smysl.

3. **Nadpis:** Postavíme nebo opravíme
   **Věta:** Pevná cena, jasný termín. Když řekneme do tří týdnů, znamená to do tří týdnů.

4. **Nadpis:** Postaráme se dál
   **Věta:** Hosting od 99 Kč měsíčně. Aktualizace, zálohy, opravy — bez vašich starostí.

---

### Sekce „Jak to funguje"

- **Eyebrow:** Jak to funguje
- **H2:** Tři kroky. Žádné papíry.

**3 karty:**

1. **Nadpis:** Zadejte adresu webu
   **Věta:** Stačí napsat doménu (třeba `vasedomena.cz`). My to projedeme.

2. **Nadpis:** Uvidíte, co je špatně a co dobře
   **Věta:** Konkrétně. „Vaše stránka je pomalá — návštěvníkům naběhne za 4 vteřiny místo jedné."

3. **Nadpis:** Rozhodnete se
   **Věta:** Chcete to opravit sami? Stáhnete si přehled. Chcete, abychom to vyřešili? Napíšete a my se ozveme.

---

### Sekce „Standardy"

- **Eyebrow:** Co u nás dostanete vždycky
- **H2:** Pravidla, ze kterých neslevíme.
- **Lead pod H2:** Tohle je seznam věcí, které u jiných musíte hlídat. U nás to je samozřejmost.

**4 karty:**

1. **Nadpis:** Žádné okénko se souhlasem
   **Věta:** Žádné „akceptujte cookies", žádné popupy. Návštěvník přijde a hned vidí váš web.

2. **Nadpis:** Funguje to na mobilu
   **Věta:** 7 z 10 lidí přijde z telefonu. Děláme weby tak, aby tam fungovaly stejně dobře jako na velkém monitoru.

3. **Nadpis:** Naskočí to dřív, než to čekají
   **Věta:** Návštěvník nesnáší, když web visí. U nás stránka naběhne pod sekundu na běžném mobilu.

4. **Nadpis:** Čte to i screen reader
   **Věta:** Web musí umět přečíst slabozrakému člověku počítač. To není přepych, to je zákon (i pro malé firmy v EU od roku 2025).

---

### Sekce „Hosting"

- **Eyebrow:** Hosting
- **H2:** Když vám web bude hotový, postaráme se i o jeho provoz.
- **Lead pod H2:** Vlastní doména, šifrované spojení, denní záloha. Když budete chtít odejít, dostanete celý web v ZIPu — bez doplatků, bez výmluv.

**3 tarify** (zachované struktury):

| Tarif | Cena | Popisek pod cenou | Bullet 1 | Bullet 2 | Bullet 3 |
|---|---|---|---|---|---|
| **Lite** *(doporučeno)* | 99 Kč / měs | Pro vizitky a malé weby | 100 MB prostoru | 1 doména | Záloha + ZIP zdarma |
| **Standard** | 249 Kč / měs | Pro klasickou firmu nebo restauraci | 500 MB prostoru | Až 3 domény | Přednostní podpora |
| **Pro** | 590 Kč / měs | Pro větší web nebo malý e-shop | 2 GB prostoru | Až 10 domén | Tým s rozdělením práv |

> **Pozn. pro juniora:** ceny zůstávají z briefu (z PRD i původního landing souhlasí). Bez sezónních akcí, bez „od X Kč" v hero — dospělý zákazník nesnáší falešné lákání.

---

### CTA banner (před patičkou)

- **H2:** Zkuste to. Nebudete nic muset.
- **Lead pod H2:** Analýza je zdarma. Bez registrace. Výsledky uvidíte za pár sekund a dostanete je i e-mailem.
- **Form labels:** stejné jako v hero (URL + e-mail + souhlas)
- **CTA tlačítko:** Analyzovat zdarma →
- **Pod CTA:** Nebo napište přímo: [jsem@fakan.cz](mailto:jsem@fakan.cz)

---

### Patička

**Levý sloupec (identita):**
- © 2026 fakan.cz · provozuje Indigo Studio s.r.o.

**Pravý sloupec (kontakt + legal):**
- [jsem@fakan.cz](mailto:jsem@fakan.cz) · [+420 604 690 539](tel:+420604690539)
- [Ochrana osobních údajů](/ochrana-udaju)

**Pozn.:** patička webu je „světlá" varianta — plný IČO + spisovka jsou až v Privacy Policy a v patičce **mailu** (kde je vyžaduje § 435 NOZ na obchodních listinách). Web sám o sobě obchodní listinou není, ale hodí se identita firmy.

---

## 5. vysledek.html

### Klíčové změny

Současný titulek běží jako „Analyzuju tvůj web…" → vykání. Stage labels „Otevírám tvůj web…" → „Otevíráme váš web…". Většina panelů má jen technický nadpis (Bezpečnostní hlavičky, Cookies, Trackery, Stack & technologie, Cookie banner, SEO základy, Sdílení na sítích) — pro 40+ je „Bezpečnostní hlavičky" cizí termín. Přidávám ke každému panelu jednu **lidskou větu**, která říká „co panel ukazuje a proč by vás to mělo zajímat".

Závěrečný CTA mluvil o „placené vlně" a „připravujeme" — to je nedospělé. Vyměněno za jednoduché „Chcete to opravit? Pošleme nezávaznou nabídku." plus odkaz na e-mail.

### Hero / hlavička

- **H1 (loading):** Analyzujeme váš web…
- **H1 (po `done`):** Hotovo. Tady je rychlý souhrn.
- **H1 (po `error`):** Nešlo to projet. Podívali jsme se, kde to drhne.
- **Target line:** Cíl: **{url}**
- **Eyebrow:** Bezplatná analýza

### Stage (live status banner)

- **Stage `loading` 1:** Otevíráme váš web…
- **Stage `loading` 2:** Hledáme, co je vidět…
- **Stage `loading` 3:** Měříme, jak to běží…
- **Stage `done`:** Hotovo. Podívejte se níž.
- **Stage `error`:** Něco nevyšlo. Detail vidíte níž.

### 8 panelů — lidská věta pro každý

> Tahle věta jde pod nadpis panelu (nebo do `data-state="empty"` placeholder). Junior frontend si rozhodne kam.

1. **Status & přesměrování**
   - **Vysvětlující věta:** Když někdo zadá vaši adresu, dostane se opravdu na váš web? A jak rychle?

2. **Bezpečnostní hlavičky**
   - **Vysvětlující věta:** Drobnosti, které brání útočníkům šidit vaše návštěvníky. Měly by být zapnuté.

3. **Cookies**
   - **Vysvětlující věta:** Jaká „okénka" váš web ukládá do prohlížeče návštěvníka. Čím méně, tím méně musíte řešit GDPR.

4. **Trackery**
   - **Vysvětlující věta:** Kdo všechno vás špehuje přes váš web — Google, Meta, Sklik a další. Některé tam mít musíte, většinou ne.

5. **Stack & technologie**
   - **Vysvětlující věta:** Z čeho je váš web postavený. Kdyby ho měl někdo opravovat, tady to uvidí.

6. **Cookie banner**
   - **Vysvětlující věta:** To otravné okénko „akceptujte vše". Když ho nepotřebujete, jste ve výhodě — návštěvník hned vidí web, ne reklamu na souhlas.

7. **SEO základy**
   - **Vysvětlující věta:** Co o vás Google ví. Titulek stránky, popis, struktura nadpisů. Bez toho vás Google nenajde.

8. **Sdílení na sítích (OG)**
   - **Vysvětlující věta:** Když někdo váš odkaz pošle na Facebook nebo do Mailu, jaký náhled to ukáže. Bez náhledu se odkaz špatně klikneme.

### Finální CTA

- **H2:** Chcete to opravit? Pošleme vám nezávaznou nabídku.
- **Lead:** Projdeme detail, řekneme, co dává smysl jako první. Žádné háčky, žádný automatický odběr — prostě obyčejný e-mail.
- **CTA primární (tlačítko):** Pošlete mi nabídku
  - **(Action):** otevírá `mailto:jsem@fakan.cz?subject=Nabídka%20pro%20{hostname}`
- **CTA sekundární (link):** Analyzovat jiný web

### Pokud uživatel přišel bez e-mailu (přímý link, sdílení) — fallback formulář

> Pozn.: design § 6.3 to označuje jako „MVP optional". Pokud junior dodá, copy je tady.

- **Eyebrow:** Pošleme vám výsledky
- **H3:** Chcete tenhle výsledek dostat e-mailem?
- **Lead:** A nezávaznou nabídku, jak to opravit. Bez registrace, bez háčků.
- **Label e-mail:** Váš e-mail
- **Placeholder:** vy@vasedomena.cz
- **Consent checkbox:** *(viz § 3 — verze v1-2026-05-08)*
- **CTA:** Pošlete mi to →

### Toast po `done` (když přišel s e-mailem)

- **Text:** Výsledky vám pošleme i na **{email}** během pár minut.

---

## 6. prehled.html — copy refresh

### Klíčové změny

`prehled.html` je „dlouhý sales pager". Cílovka 40+ ho většinou nečte celý — proletí hero a první 2 sekce, zbytek si projede sken pohledem. Refresh je proto **chirurgický**: vykání všude, hero přepsané bez „AI agenty / kernel / framework", sekce „Standardy" přepsaná lidsky (jako v `index.html`), zbytek dlouhých technických bloků zůstává **víceméně tak, jak je** — protože tam doleze IT-friendly partner / novinář / investor, a ten chce technický detail.

**Sjednocující pravidlo:** kde se v textu objeví „ty/tvůj" — vykání. Kde se objeví buzzwordy v nadpisu — přepsat. Detail v body textu (bullety, code spany) zachovat.

### Hero (sekce `.hero`)

- **Eyebrow:** Pluginová platforma · ČR · 2026 *(zachovat — IT-friendly návštěvník to ocení, 40+ to přeskočí)*
- **H1:** Váš web. Bez starostí. *(stejný jako index — konzistence)*
- **Hero-sub:** Jedno místo, kde web vznikne, hostuje se, opravuje se a roste. Stará se o něj tým s lidským garantem. Žádná okénka se souhlasem. Žádné technologie, co za dva roky skončí.
- **CTA primární (link):** Co je fakan.cz → *(beze změny, vede na anchor)*
- **CTA sekundární:** Vidět cesty pro zákazníky *(„zákaznické cesty" → „cesty pro zákazníky", srozumitelnější)*

#### Hero stats (4 karty, zachovat)

- **Karta 1:** ≤ 5 s — první data z analýzy webu *(beze změny)*
- **Karta 2:** ≤ 60 s — od prvního kliku po výsledek *(zjednodušeno, „TTFV" = jargon)*
- **Karta 3:** ~30 s — od úpravy po publikaci *(„publish" → „publikaci")*
- **Karta 4:** **0 sledování** — *žádné cookies, žádní špioni* *(přepsáno z „0 cookies / na výstupních webech, defaultně" — to je samochvála v jazyce, kterému 40+ nerozumí)*

### Sekce „Co stavíme"

- **Eyebrow:** Co stavíme
- **H2:** Web jako služba, ne jako artefakt. *(beze změny — funguje)*
- **Lead:** Konkurence prodává weby jako produkt. Wix, Webnode, agentury, freelanceři — všichni vám něco vyrobí a zmizí. My prodáváme klid. Jednou zaplatíte, jednou se vrátíte, když chcete něco upravit. Jinak se to stará a roste samo.

**Hlavní text** (3 odstavce v `.card.flat`):

1. fakan.cz je **platforma s pluginy** — minimální základ (přihlášení, hosting, fakturace, editor) a všechno ostatní si přidáte podle potřeby: formuláře, SEO, analytika, fulltext, komentáře, mapy, reklama, AI údržba.
2. Tři vstupy (mám web / chci nový / přecházím od jiných), realizaci dělá **AI tým s lidským garantem**, **velín** je vaše řídicí místo, **notifikace** napříč ekosystémem. Statický výstup hostovaný na Cloudflare.
3. Mobilní aplikace přijde ve fázi 5 a 6. Pro vývojáře je marketplace s podílem z prodejů (fáze 6+). **Stáhnete si svůj web do ZIPu, kdykoliv** — žádné svazování, žádný „premium export".

> *(„kernel" v původním textu byl jediný buzzword v hero této sekce — vyhozen, nahrazen „minimální základ".)*

#### Šest věcí, které děláme jinak

> Bullety zachovat strukturou, drobné úpravy:

- **Vanilla HTML/CSS/JS/SVG.** Žádný React, Vue, Next. Žádné node_modules. *(zachovat — IT-friendly návštěvník)*
- **Static-first.** Web je předem vyrobený soubor, ne aplikace, která se každou návštěvou skládá od nuly. *(zjednodušeno, místo „Dynamika výhradně přes Workers + D1/KV/R2/DO")*
- **Žádná okénka se souhlasem.** A nedáme se přemluvit.
- **Měření bez špehování.** Víme, kolik lidí přišlo, neumíme říct kdo. To je rozdíl proti Google Analytics. *(přeformulovat „Cookieless analytics bez tracking pixelů a fingerprintingu")*
- **AI s lidským garantem.** Říkáme nahlas, že realizaci dělá AI tým. Garant má jméno a podpis.
- **Stáhnete si svůj web do ZIPu, zdarma, kdykoliv.** Na všech tarifech. *(„Tvůj web je tvůj. Vždycky." → „Vždycky je to váš web." — viz mikrocopy níže)*

### Sekce „Pozice na trhu"

- **Eyebrow:** Pozice na trhu *(beze změny)*
- **H2:** Mezi samoobsluhou, agenturou a freelancerem.
- **Lead:** Kombinace AI rychlosti, statické bezpečnosti a české lidské tváře. Web jako mikrovlnka — nestaráte se o ni každý den, ale když ji potřebujete, funguje.

**Tabulka „compare"** — beze změny obsahu (Webnode/Wix, agentury, WordPress+freelancer, fakan.cz). Drobnost: posledni sloupec „Web jako služba" → ponechat.

### Sekce „Pět hodnot"

- **Eyebrow:** Pět hodnot
- **H2:** Jak fakan.cz přemýšlí.

**5 karet:**

1. **Bez kravin** — Žádná okénka se souhlasem. Žádné popupy. Žádné „akceptujte vše". Žádné „synergie" a „omnichannel".
2. **Hned** — První výsledek do minuty. Bezplatná analýza okamžitě. Úprava webu naživo za 30 sekund. Žádné „dorazí v Q3".
3. **Konkrétně** — Místo „rychlejší" → naběhne za 0,9 s místo 3,2 s. Místo „lepší SEO" → 17 nových klíčových slov. Čísla, ne přídavná jména.
4. **Lidsky** — Vykáme. Krátké věty. Nešlo to → řekneme to. AI to dělá → řekneme to. Garant má jméno. *(změna „Tykáme" → „Vykáme" — odráží pivot brandu)*
5. **Trvanlivě** — Statika. Žádný módní framework, který za dva roky umře. Váš web přežije i nás — máte export, doménu, otevřený formát.

### Sekce „Standardy"

- **Eyebrow:** Standardy *(zachováno — toto je adresované technicky znalému návštěvníkovi)*
- **H2:** Každý web od nás splňuje, bez výjimky.
- **Lead:** Nekompromisně. Zákazník nemůže říct „chci okénko se souhlasem" a my mu ho uděláme. Když na něm trvá, je to jiný produkt mimo standard fakan.cz. Pluginy musí pravidla splnit, kernel je vynucuje při schvalování.

**Karty (8 položek):** technické nadpisy zůstávají, jen drobné úpravy:

1. **Soukromí** — Bez cookies, bez banerů. *(beze změny)*
2. **Žádné CDN, žádné fonty zvenku** → **Vše u nás** *(„Vše self-host" → „Vše u nás" — srozumitelnější, technický detail v body textu)*
3. **Mobile-first** — 375 × 812 výchozí *(beze změny)*
4. **Auto theming** — Tmavý / světlý bez přepínače *(„Dark / light bez switcheru" → vše česky)*
5. **Přístupnost** — WCAG 2.2 AA minimum *(beze změny — toto je technické)*
6. **Strukturovaná data** — Schema.org JSON-LD *(beze změny)*
7. **Rychlost** — Naskočí do 1,5 sekundy *(„LCP < 1,5 s · CLS < 0,05" → „Naskočí do 1,5 sekundy" jako card title; technický detail v body textu)*
8. **Zákonné** — GDPR-friendly defaultně *(beze změny)*

> Pozn.: tahle sekce zůstává nejvíce technická schválně — `prehled.html` čte i partner / dev. Dělat to lidsky jako v `index.html` by snížilo informační hodnotu pro správnou cílovku.

### Sekce „Cesty pro zákazníky"

- **Eyebrow:** Cesty pro zákazníky *(„Zákaznické cesty" → „Cesty pro zákazníky")*
- **H2:** Čtyři vchody dovnitř a jeden velín ven.
- **Lead:** Každý zákazník přichází jiným vchodem. Buď má web, nebo žádný nemá, nebo už u nás je, nebo přechází od konkurence. Cíl je vždycky stejný: web, který se sám stará a roste.

**Karty (5 cest):** strukturu zachovat, drobnosti:

- **Cesta A · mám web:** URL → analýza → realizace *(beze změny)*
- **Cesta B · chci nový:** Zápis poptávky → doména → realizace *(„Intake" → „Zápis poptávky")*
- **Cesta C · jsem zákazník:** Přihlašovací odkaz → velín *(„Magic link" v H3 zachovat, ale tag změnit z „existující zákazník" na „jsem zákazník")*
- **Cesta D · přecházím:** Bezplatný audit s číslem úspory → migrace *(„migruji" je gerundium, divně se to čte)*
- **Cesta E · vývojář:** SDK → odeslání → marketplace *(„submission" → „odeslání")*

### Sekce „Pluginová platforma" (kernel + 5 vrstev)

Tahle sekce je technická a její cílovka jsou pluginoví vývojáři / partneři / Fakan sám. **Necháváme „kernel" zachovaný** — pro tuhle cílovku to je správný termín.

- **Eyebrow:** Pluginová platforma *(beze změny)*
- **H2:** Kernel a pět vrstev pluginů. *(beze změny)*
- **Lead:** Vše je plugin, kromě kernelu. Kernel je auth, hosting, registry, manifest engine, editor shell, velín shell, notifikační hub, billing, marketplace, storage primitiva, i18n a audit. Všechno ostatní si zapínáte. *(změna „zapínáš" → „zapínáte")*

**Detail:** beze změny.

### Sekce „Free analýza"

- **Eyebrow:** Bezplatná analýza *(„Free analýza" → „Bezplatná analýza" — víc česky)*
- **H2:** První data za 5 sekund. Žádný spinner. *(beze změny — funguje)*
- **Lead:** Synchronní vlna do 5 s — stáhneme HTML, status, bezpečnostní hlavičky, technologie, OG meta, cookies, trackery. Asynchronní vlna 5–60 s — Lighthouse-lite, screenshot, AI redesign, hloubková SEO analýza. Streamované, ne najednou.

**Mock listing zachovat** (ukazuje, jak vypadá výstup).

**Pravý sloupec — co dostanete zdarma + mikroplatby:**

- **H3:** Co dostanete zdarma *(„dostaneš" → „dostanete")*
- **Body:** HTML stažení, HTTP status, screenshot, Lighthouse-lite, detekce technologií, bezpečnostní hlavičky, Open Graph náhled, mobil vs. desktop, detekce cookies a trackerů. Anti-bot Turnstile, 3 bezplatné analýzy za 24 h z jedné IP.
- **H3 nadpis druhé části:** Mikroplatby za hloubkovou analýzu *(beze změny)*
- **Body:** beze změny (cenové škály).

### Sekce „Hosting"

- **Eyebrow:** Hosting
- **H2:** Static-first na Cloudflare. Path-based routing. *(zachováno — IT-friendly cílovka)*
- **Lead:** Každý web staticky generovaný, dynamika výhradně přes API (Workers + D1/KV/R2/DO/Queues). Vlastní doména zákazníka je primární URL. Mirror na `fakan.cz/{host}/` má vynucenou hlavičku `X-Robots-Tag: noindex, nofollow` přímo z Workeru — neindexuje se.

**Tarify:** beze změny obsahu (Lite/Standard/Pro/Custom). Sub-popisky:

- **Lite popisek:** Drobné weby, vizitky *(zachovat)*
- **Standard popisek:** Klasická firma, restaurace *(zachovat)*
- **Pro popisek:** Středně velký web, e-shop *(zachovat)*
- **Custom popisek:** Speciální požadavky *(zachovat)*

### Sekce „Velín a notifikační centrum"

- **Eyebrow:** Velín a notifikační centrum
- **H2:** Jeden inbox napříč ekosystémem. *(beze změny)*
- **Lead:** 13 zdrojů událostí (analytika, komentáře, formuláře, editor, realizace, fakturace, hosting, domény, marketplace, komunikace, bezpečnost, marketing, systém). 3 úrovně závažnosti. 7 distribučních kanálů. **Proti přesycení:** slučování, limit 50 mailů/den, denní souhrn, smart výchozí nastavení. *(„Anti-fatigue" → „Proti přesycení", „daily digest" → „denní souhrn")*

**Detail:** drobné `tě/tvou` → vykání, jinak struktura zachována.

### Sekce „AI transparence + lidský garant"

- **Eyebrow:** AI transparence + lidský garant
- **H2:** Realizuje AI tým fakan.cz. Garantuje Fakan.
- **Lead:** Nepředstíráme čistě lidskou agenturu. Explicitně říkáme, kdy něco dělá AI a kdy stojí lidský garant svým jménem.

**SVG portrét + jméno:** zachovat.

**Body:** „Ve fázi 7+ jmenovaní garanti z partnerského programu, vždy s prokliknutelným profilem. V UI: malé, decentní `Realizuje: AI tým fakan.cz · garant: Fakan` — ne marketingově nahoře, ale jasně dostupné." → beze změny.

### Sekce „Měřitelné cíle"

- **Eyebrow:** Měřitelné cíle
- **H2:** 22 čísel, podle kterých nás budete posuzovat. *(„nás budeme posuzovat" → „nás budete posuzovat" — gramatický fix)*
- **Lead:** Žádné „chceme být lepší". Konkrétní KPI, které si můžete spočítat. Tady je výběr nejdůležitějších.

**Detail KPI karet:** drobné `tvůj/tě` → vykání, struktura zachována.

### Závěrečný CTA blok

- **H2:** Chcete to vidět v provozu?
- **Body:** PRD v0.9 je hotový. Pluginová architektura, brand brief a plugin spec mají verze 0.9 / 0.2 / 0.8. Stavíme kostru a první cestu A. Máte zájem jako klient, partner, investor nebo novinář? Ozvěte se.
- **CTA:** Napište na fakan@fakan.cz →

### Patička

- Pluginová platforma pro audit, návrh, realizaci, hosting, správu a růst webových stránek. Provoz na Cloudflare. **Provozuje Indigo Studio s.r.o.** *(přidáno — současná patička říká „Vlastník: Daniel Hromada", zachováno odkaz na Daniela jako garanta v sekci AI, ale identita firmy do patičky)*

---

## 7. Mail: lead-followup

> **Pozn. juniorovi:** šablona je `src/email/templates/lead-followup.js` per design § 5.1. Subject + tělo (HTML) + plain-text twin níže. Proměnné placeholder s formátem `{{var}}` — junior nahradí za render argumenty.

### Subject

> Analýza {{hostname}} — našli jsme tři věci

**Variace** (kdyby Fakan chtěl A/B):
- A: `Analýza {{hostname}} — našli jsme tři věci`  *(doporučeno — konkrétní, neovládá emoji, drží 50 znaků)*
- B: `Hotovo. Tady je rychlý souhrn pro {{hostname}}`

### Tělo (HTML)

```html
<p>Dobrý den,</p>

<p>posíláme vám výsledky bezplatné analýzy webu <strong>{{url}}</strong>, kterou jste si u nás na fakan.cz vyžádal/a {{date}}. Pokud to nejste vy a tenhle e-mail jste nečekal/a, klikněte na <a href="{{unsubscribe_url}}">Odhlásit</a> v patičce a okamžitě vás z databáze smažeme. Nikomu nevolejte, žádné uživatelské heslo neměňte — prostě jeden klik.</p>

<h2>Co jsme zjistili</h2>

<p>Váš web jsme projeli a celkové skóre vyšlo na <strong>{{score}} ze 100</strong>. Tady jsou tři věci, které stojí za pozornost nejdřív:</p>

<ul>
  <!-- render z {{top3issues}} pole stringů -->
  <li>{{issue_1}}</li>
  <li>{{issue_2}}</li>
  <li>{{issue_3}}</li>
</ul>

<p>Detail najdete v plné analýze: <a href="https://fakan.cz/vysledek?url={{url_encoded}}">otevřít výsledky</a>.</p>

<h2>Co můžeme udělat</h2>

<p>Pokud byste chtěl/a, abychom to vyřešili za vás, ozveme se a domluvíme detail. <strong>Tohle je jen návrh, nezávazná nabídka.</strong> Žádná smluvní oferta, žádný automatický odběr — než cokoliv potvrdíte, projdeme spolu rozsah, cenu a termín.</p>

<p>Typicky to dopadne jednou ze tří cest:</p>

<ol>
  <li><strong>Spravíme to.</strong> Tři vážné věci, které jsme našli, opravíme. Pevná cena, jasný termín.</li>
  <li><strong>Uděláme nový web.</strong> Když je toho víc nebo se vám současný stejně nelíbí.</li>
  <li><strong>Přejdete na náš hosting.</strong> Od 99 Kč měsíčně. Záloha, vlastní doména, žádné okénko se souhlasem. Web zůstává váš — kdykoliv si ho stáhnete v ZIPu.</li>
</ol>

<h2>Kdy chcete, abychom se ozvali?</h2>

<p>Stačí jednou kliknout: <a href="mailto:jsem@fakan.cz?subject=Nabídka%20pro%20{{hostname}}&amp;body=Dobrý%20den%2C%0A%0Aviděl%20jsem%20analýzu%20mého%20webu%20{{url_encoded}}%20a%20zajímalo%20by%20mě%2C%20jak%20byste%20to%20vyřešili.%0A%0AS%20pozdravem"><strong>Pošlete mi nezávaznou nabídku</strong></a>.</p>

<p>Nebo prostě odepište na tenhle e-mail. Píše vám člověk, ne robot.</p>

<p>Hezký den,<br>
<strong>Daniel „Fakan" Hromada</strong><br>
fakan.cz</p>

<hr>

<!-- Patička — generuje _layout.js z {{IDENTITY:*}} placeholderů per design TASK-08 -->
<p style="font-size: 12px; color: #6B7280; line-height: 1.5;">
  <strong>Indigo Studio s.r.o.</strong>, Chudenická 1059/30, 102 00 Praha<br>
  IČO: 14389096, zapsáno v Obchodním rejstříku vedeném Městským soudem v Praze, oddíl C, vložka 364981<br>
  Kontakt: <a href="mailto:jsem@fakan.cz">jsem@fakan.cz</a> · +420 604 690 539<br>
  <a href="{{unsubscribe_url}}">Odhlásit z e-mailů od fakan.cz</a> ·
  <a href="https://fakan.cz/ochrana-udaju">Ochrana osobních údajů</a>
</p>
```

### Tělo (plain-text twin)

```text
Dobrý den,

posíláme vám výsledky bezplatné analýzy webu {{url}}, kterou jste si
u nás na fakan.cz vyžádal/a {{date}}.

Pokud to nejste vy a tenhle e-mail jste nečekal/a, otevřete tento
odkaz a okamžitě vás z databáze smažeme:

{{unsubscribe_url}}


CO JSME ZJISTILI

Váš web jsme projeli a celkové skóre vyšlo na {{score}} ze 100.
Tady jsou tři věci, které stojí za pozornost nejdřív:

1. {{issue_1}}
2. {{issue_2}}
3. {{issue_3}}

Detail najdete v plné analýze:
https://fakan.cz/vysledek?url={{url_encoded}}


CO MŮŽEME UDĚLAT

Pokud byste chtěl/a, abychom to vyřešili za vás, ozveme se a domluvíme
detail. Tohle je jen návrh, nezávazná nabídka. Žádná smluvní oferta,
žádný automatický odběr — než cokoliv potvrdíte, projdeme spolu rozsah,
cenu a termín.

Typicky to dopadne jednou ze tří cest:

1. Spravíme to. Tři vážné věci, které jsme našli, opravíme.
   Pevná cena, jasný termín.
2. Uděláme nový web. Když je toho víc nebo se vám současný stejně nelíbí.
3. Přejdete na náš hosting. Od 99 Kč měsíčně. Záloha, vlastní doména,
   žádné okénko se souhlasem. Web zůstává váš — kdykoliv si ho stáhnete
   v ZIPu.


KDY CHCETE, ABYCHOM SE OZVALI?

Stačí odpovědět na tenhle e-mail. Nebo napsat na jsem@fakan.cz.
Píše vám člověk, ne robot.

Hezký den,
Daniel „Fakan" Hromada
fakan.cz

---

Indigo Studio s.r.o., Chudenická 1059/30, 102 00 Praha
IČO: 14389096, zapsáno v Obchodním rejstříku vedeném Městským soudem
v Praze, oddíl C, vložka 364981.

Kontakt: jsem@fakan.cz · +420 604 690 539

Odhlásit z e-mailů od fakan.cz:
{{unsubscribe_url}}

Ochrana osobních údajů:
https://fakan.cz/ochrana-udaju
```

### Proměnné

- `{{url}}` — celá adresa, kterou návštěvník zadal (po `stripUrl()` — bez query stringu)
- `{{url_encoded}}` — totéž, URL-encoded pro použití v `href`
- `{{hostname}}` — jen `example.cz` z URL
- `{{date}}` — datum, kdy lead vznikl, formát „6. května 2026" (per CLAUDE.md sekce 3, brand mikro-pravidla)
- `{{score}}` — skóre 0–100, integer
- `{{issue_1}}`, `{{issue_2}}`, `{{issue_3}}` — 3 nejhorší zjištění z analýzy, jako stringy ve tvaru lidské věty (junior backend pošle pole `top3issues: string[]`, šablona iteruje)
- `{{unsubscribe_url}}` — `https://fakan.cz/odhlasit?t=<token>` (per decisions.md tie-breaker, parametr `t`, ne `token`)

---

## 8. Mail: magic-link-auth (draft v0, na sklad)

> **Pozn. juniorovi:** per design § 5.2 — šablona se připravuje, ale handler v `worker.js` ji v MVP nezavolá (auth flow ještě neexistuje). DRAFT v0 komentář v souboru.

### Subject

> Přihlašovací odkaz pro fakan.cz

### Tělo (HTML)

```html
<p>Dobrý den,</p>

<p>někdo (snad vy) si požádal o přihlášení do fakan.cz. Pokud to nejste vy, tenhle e-mail prostě smažte — bez kliku se nic nestane.</p>

<p style="margin: 28px 0;">
  <a href="{{magic_link_url}}" style="background: #FF5722; color: #fff; padding: 14px 24px; text-decoration: none; border-radius: 999px; font-weight: 600;">Přihlásit se</a>
</p>

<p>Odkaz funguje <strong>{{expires_in_minutes}} minut</strong>. Po té vyprší a budete muset požádat o nový.</p>

<p style="font-size: 13px; color: #6B7280; margin-top: 28px;">
  Pro paranoidní:<br>
  Žádost přišla z IP <code>{{ip}}</code> a prohlížeče <code>{{user_agent}}</code> v <code>{{requested_at}}</code>.
  Pokud to nejste vy a chcete to nahlásit, napište na <a href="mailto:jsem@fakan.cz">jsem@fakan.cz</a>.
</p>

<p>Hezký den,<br>fakan.cz</p>

<hr>

<p style="font-size: 12px; color: #6B7280; line-height: 1.5;">
  <strong>Indigo Studio s.r.o.</strong>, Chudenická 1059/30, 102 00 Praha<br>
  IČO: 14389096, zapsáno v Obchodním rejstříku vedeném Městským soudem v Praze, oddíl C, vložka 364981<br>
  Kontakt: <a href="mailto:jsem@fakan.cz">jsem@fakan.cz</a> · +420 604 690 539
</p>
```

### Tělo (plain-text)

```text
Dobrý den,

někdo (snad vy) si požádal o přihlášení do fakan.cz. Pokud to nejste vy,
tenhle e-mail prostě smažte — bez kliku se nic nestane.

Pro přihlášení otevřete tento odkaz:

{{magic_link_url}}

Odkaz funguje {{expires_in_minutes}} minut. Po té vyprší a budete muset
požádat o nový.


Pro paranoidní: žádost přišla z IP {{ip}} a prohlížeče {{user_agent}}
v {{requested_at}}. Pokud to nejste vy a chcete to nahlásit, napište
na jsem@fakan.cz.

Hezký den,
fakan.cz

---

Indigo Studio s.r.o., Chudenická 1059/30, 102 00 Praha
IČO: 14389096, zapsáno v Obchodním rejstříku vedeném Městským soudem
v Praze, oddíl C, vložka 364981.

Kontakt: jsem@fakan.cz · +420 604 690 539
```

### Proměnné

- `{{magic_link_url}}` — kompletní login URL s tokenem
- `{{expires_in_minutes}}` — typicky `15`
- `{{ip}}` — IP adresa, ze které žádost přišla (plain v mailu OK — uživatel ji vidí, my si v DB neukládáme plnou per legal)
- `{{user_agent}}` — prohlížeč/OS
- `{{requested_at}}` — formát „14:30, 6. května 2026"

> **Bez opt-out odkazu** — login mail je transakční (viz design § 5.2), nelze ho vypnout, pouze přestat používat fakan.cz.

---

## 9. Mail: optout-confirmation

### Subject

> Odhlášeno z fakan.cz

### Tělo (HTML)

```html
<p>Dobrý den,</p>

<p>odhlásili jsme vás z e-mailové komunikace fakan.cz. <strong>Hotovo.</strong></p>

<p>Adresa <code>{{email}}</code> byla v našem seznamu označena jako odhlášená dnes v {{opted_out_at}}. Žádný další e-mail vám už neodejde.</p>

<p>Pokud to byla chyba a chcete se vrátit, napište nám prostě na <a href="mailto:jsem@fakan.cz">jsem@fakan.cz</a> — vrátíme vás zpět ručně.</p>

<p>Díky za zájem a hezký den.</p>

<p>Daniel „Fakan" Hromada<br>fakan.cz</p>

<hr>

<p style="font-size: 12px; color: #6B7280; line-height: 1.5;">
  <strong>Indigo Studio s.r.o.</strong>, Chudenická 1059/30, 102 00 Praha<br>
  IČO: 14389096, zapsáno v Obchodním rejstříku vedeném Městským soudem v Praze, oddíl C, vložka 364981<br>
  Kontakt: <a href="mailto:jsem@fakan.cz">jsem@fakan.cz</a> · +420 604 690 539
</p>
```

### Tělo (plain-text)

```text
Dobrý den,

odhlásili jsme vás z e-mailové komunikace fakan.cz. Hotovo.

Adresa {{email}} byla v našem seznamu označena jako odhlášená dnes
v {{opted_out_at}}. Žádný další e-mail vám už neodejde.

Pokud to byla chyba a chcete se vrátit, napište nám prostě na
jsem@fakan.cz — vrátíme vás zpět ručně.

Díky za zájem a hezký den.

Daniel „Fakan" Hromada
fakan.cz

---

Indigo Studio s.r.o., Chudenická 1059/30, 102 00 Praha
IČO: 14389096, zapsáno v Obchodním rejstříku vedeném Městským soudem
v Praze, oddíl C, vložka 364981.

Kontakt: jsem@fakan.cz · +420 604 690 539
```

### Proměnné

- `{{email}}` — odhlašovaná adresa
- `{{opted_out_at}}` — formát „14:30" (jen čas, datum už je v textu „dnes")

> **Bez opt-out odkazu v patičce** — uživatel je už odhlášený, dávat mu znova opt-out je absurdní.

---

## 10. Mail: soft-doi (na sklad, MVP nepoužívá)

> **Pozn. juniorovi:** per design § 4.6 a § 5.4 — šablona připravená pro hypotetický plný DOI flow. MVP **nepoužívá** (soft DOI je integrované do prvního odstavce `lead-followup`). Šablona se vytváří pro případ, že legal/marketer v budoucí iteraci řekne „přepneme na plný DOI". Komentář `<!-- na sklad, MVP nepoužívá -->` v souboru.

### Subject

> Potvrďte, prosím, zájem o analýzu {{hostname}}

### Tělo (HTML)

```html
<p>Dobrý den,</p>

<p>na fakan.cz si někdo vyžádal bezplatnou analýzu webu <strong>{{url}}</strong> a uvedl jako kontaktní e-mail tuto adresu. Než vám analýzu pošleme, **potřebujeme od vás potvrzení**, že to opravdu jste vy.</p>

<p style="margin: 28px 0;">
  <a href="{{confirm_url}}" style="background: #FF5722; color: #fff; padding: 14px 24px; text-decoration: none; border-radius: 999px; font-weight: 600;">Ano, jsem to já — pošlete analýzu</a>
</p>

<p>Odkaz funguje <strong>{{expires_in_hours}} hodin</strong>. Pokud na něj nekliknete, žádná analýza se neodešle a vaši adresu z naší databáze automaticky smažeme.</p>

<p>Pokud to nejste vy, prostě nic nedělejte. Bez kliku se nic neodehraje a za pár hodin vaše adresa zmizí.</p>

<p>Díky a hezký den,<br>
Daniel „Fakan" Hromada<br>
fakan.cz</p>

<hr>

<p style="font-size: 12px; color: #6B7280; line-height: 1.5;">
  <strong>Indigo Studio s.r.o.</strong>, Chudenická 1059/30, 102 00 Praha<br>
  IČO: 14389096, zapsáno v Obchodním rejstříku vedeném Městským soudem v Praze, oddíl C, vložka 364981<br>
  Kontakt: <a href="mailto:jsem@fakan.cz">jsem@fakan.cz</a> · +420 604 690 539
</p>
```

### Tělo (plain-text)

```text
Dobrý den,

na fakan.cz si někdo vyžádal bezplatnou analýzu webu {{url}} a uvedl
jako kontaktní e-mail tuto adresu. Než vám analýzu pošleme, potřebujeme
od vás potvrzení, že to opravdu jste vy.

Pro potvrzení otevřete tento odkaz:

{{confirm_url}}

Odkaz funguje {{expires_in_hours}} hodin. Pokud na něj nekliknete, žádná
analýza se neodešle a vaši adresu z naší databáze automaticky smažeme.

Pokud to nejste vy, prostě nic nedělejte. Bez kliku se nic neodehraje
a za pár hodin vaše adresa zmizí.

Díky a hezký den,
Daniel „Fakan" Hromada
fakan.cz

---

Indigo Studio s.r.o., Chudenická 1059/30, 102 00 Praha
IČO: 14389096, zapsáno v Obchodním rejstříku vedeném Městským soudem
v Praze, oddíl C, vložka 364981.

Kontakt: jsem@fakan.cz · +420 604 690 539
```

### Proměnné

- `{{url}}` — adresa zadaná v formuláři
- `{{hostname}}` — jen doména
- `{{confirm_url}}` — `https://fakan.cz/potvrdit?t=<token>` (per analogie s opt-out, junior backend rozhodne přesný path až přijde implementace)
- `{{expires_in_hours}}` — typicky `24`

---

## 11. Patička obchodního mailu (§ 435 NOZ) — kanonické znění

Tahle patička se opakuje v každém obchodním mailu. Junior dá do `_layout.js` jako jeden helper, šablony ji jen volají.

```text
Indigo Studio s.r.o., Chudenická 1059/30, 102 00 Praha
IČO: 14389096, zapsáno v Obchodním rejstříku vedeném Městským soudem
v Praze, oddíl C, vložka 364981.

Kontakt: jsem@fakan.cz · +420 604 690 539
```

**HTML varianta** — viz patičky v § 7–10 (jednotná struktura).

**Pro lead-followup, optout-confirmation a soft-doi** přidat ještě:

```text
Odhlásit z e-mailů od fakan.cz: {{unsubscribe_url}}
Ochrana osobních údajů: https://fakan.cz/ochrana-udaju
```

**Pro magic-link-auth** opt-out NEPŘIDÁVAT (transakční mail).

---

## 12. Ověření OR spisové značky — uzavřeno

Spisová značka **MSPH C 364981** dohledána z ARES Veřejného rejstříku (`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty-vr/14389096`, dotaz 2026-05-08).

**Historie zápisu** (pro kontext, kdyby se Fakan ptal):

| Od | Do | Soud | Oddíl | Vložka |
|---|---|---|---|---|
| 2022-03-29 | 2024-03-05 | MSPH (Praha) | C | 364981 |
| 2024-03-05 | 2025-06-25 | KSPL (Plzeň) | C | 44995 |
| 2025-06-25 | dnes | MSPH (Praha) | C | 364981 |

Aktuální (od 2025-06-25) je **MSPH, oddíl C, vložka 364981** — což odpovídá přesunu sídla z Plzně zpět do Prahy (2025-05-08, viz historie adres v ARES).

**Akce:** doplněno do `decisions.md` samostatným commitem.

---

## 13. Konzistenční check (markedem si projetí)

- [x] Vykání důsledné napříč všemi stránkami i maily.
- [x] V hero a CTA žádné z těchto: AI agenty, framework, LCP, CLS, INP, WCAG, CDN, kernel, hydration, cookies (jako self-stat).
- [x] Slovo „cookies" v `index.html` zmizelo z hero stats; v sekci „Standardy" přepsáno na „Žádné okénko se souhlasem".
- [x] Tagline „Tvůj web. Bez výmluv." → „Váš web. Bez starostí." (návrh A do delivery, schvaluje owner).
- [x] V mailech: identifikace odesílatele (Indigo Studio s.r.o. + IČO + spisovka MSPH C 364981 + adresa) v každé patičce.
- [x] Žádný tracking pixel, žádný click tracker — patičky jsou plain `<a href>` bez wrapperu.
- [x] Opt-out odkaz `/odhlasit?t=<token>` (parametr `t`, ne `token` — per tie-breaker).
- [x] Soft DOI v lead-followup mailu jako úvodní odstavec (per risk-check § 4.3 a design § 4.6).
- [x] Plain-text twin u všech mailů ručně psaný, ne strip z HTML.
- [x] Consent text verzovaný `v1-2026-05-08`.
- [x] Privacy Policy slug `/ochrana-udaju` (per tie-breaker, ne `/zasady-ochrany-osobnich-udaju`).
- [x] Retence 12 měsíců (legal preferoval 24, marketer navrhuje 12 — viz § 2 sekce 4 PP, důvod minimalizace dat). **Flagnuto pro pre-launch check legal.**
- [x] Datum „6. května 2026", čas „14:30", měna „99 Kč" (per CLAUDE.md sekce 3).
- [x] Číslovky 10+ číslicemi (12 měsíců, 3 roky, 100 MB, 99 Kč).

### Co je ve flag — pre-launch check

1. **Retence 12 vs. 24 měsíců** — risk-check § 2.3 navrhoval 24, PP navrhuje 12. Legal-advisor v Gate 3 schvaluje. Argumenty marketera: minimalizace dat (GDPR čl. 5(1)(c)), bootstrap fáze, snadnější obhajitelnost, retro za 6 měsíců umí prodloužit.
2. **Tagline „Váš web. Bez starostí."** — owner (Fakan) schvaluje v delivery. Pokud zamítne, varianty B nebo C jsou v § 1.
3. **Patička webu (`index.html`)** — současná verze `© 2026 fakan.cz · Daniel Hromada` v levém sloupci patičky je upravena na `© 2026 fakan.cz · provozuje Indigo Studio s.r.o.`. Ne-obchodní listina, ale identita firmy se hodí. Owner schvaluje.
4. **„AI redesign" jako placený produkt v hosting tabulce** — v původním copy bylo „od 49 Kč další varianty". Vyhozeno z hero/co-děláme. Detail mikroplateb zůstává v `prehled.html`. Pokud Fakan chce zachovat AI redesign jako prodejní hook v `index.html`, dodá variantu — neumístil jsem to schválně, protože pro 40+ je „AI redesign za 49 Kč" matoucí (znají AI z médií, „další varianty" mu nic neříká).

---

*Konec dokumentu. Veškerý copy je verze v1, do delivery k owner schválení.*
