# PRD — fakan.cz

**Pluginová platforma pro audit, návrh, realizaci, hosting, správu a růst webových stránek**
Verze 0.9 · ČR · vlastník: Fakan

> Změny od v0.8 (zapracovaný feedback v0.2):
> - **G1 TTFV strategie konkretizována** — první data analýzy do 5 s, AI návrh asynchronně s progres-barem (sekce 2 a 5.1).
> - **Path-based hosting noindex** explicitně přes HTTP hlavičku `X-Robots-Tag: noindex, nofollow` na úrovni Cloudflare Workeru (sekce 5.5).
> - **Export webu (ZIP)** zařazen jako standardní feature dostupná **od Hobby tieru** — anti lock-in marketingová zbraň (sekce 5.5, nový bod 5.26).
> - **Plugin „AI Údržbář"** doplněn do backlogu (sekce 11 + plánováno fáze 7+).
> - **Stavy „Vím o tom" / self-healing** doplněny jako rozšíření notifikačního centra (sekce 5.23).
> - **Brand brief** povýšen na v0.2, **plugin spec** na v0.8 — viz changelogy v jednotlivých dokumentech.

> Změny od v0.7 — finalizace dříve otevřených bodů a rozdělení dokumentace:
> - **Velín** finalizováno jako pojmenování zákaznického backendu.
> - **Path-based hosting** potvrzeno (mirror s noindex, canonical na vlastní doménu).
> - **Real-time funkce** (chat, livestream, kolaborace v reálném čase) explicitně out-of-scope pro „fakan.cz Standard".
> - **2FA** — TOTP (Authenticator) primární, SMS jen fallback pro critical akce.
> - **AI transparence** — explicitně říkáme, že to dělá AI, s **lidským garantem**.
> - **PWA** zařazena jako mezikrok ve fázi 5, plný Capacitor až fáze 6.
> - **Dev program** otevřen ve fázi 6.
> - **Hobby tier** = 0 Kč/měs, ale **maximum 1 free plugin v marketplace** + 30 % transaction fee.
> - **Komentáře** — e-mail povinný (s validací magic link), zobrazuje se jen jméno; vlastník webu může ve velíně povolit anonymní.
> - **Minimum payout** partnerům 500 Kč, do té doby kumulace.
> - **Support burden** — my triage, partner SLA podle dev tieru, pravidla v dev program ToS.
> - **Plugin spec** vyčleněn do `plugin-spec.md`.
> - **Dev program detail** vyčleněn do `dev-program.md` (vznikne ve fázi 6).
> - **Brand brief** vznikl jako `brand-brief.md` v0.1.

---

## 1. TL;DR

`fakan.cz` jako **pluginová platforma** s vrstevnatým ekosystémem:

1. **Kernel** — minimální jádro (auth, hosting, plugin registry, manifest, notifikace, billing, marketplace, velín, editor shell).
2. **Core pluginy** *(povinné, od nás, MVP)* — formuláře, SEO základ, analytics základ.
3. **Oficiální pluginy** *(volitelné, od nás)* — fulltext, komentáře, GEO, PPC, sociální sítě, agregátory, BYO AI, advanced analytics, mini-kurzy.
4. **Partnerské pluginy** *(verified vývojáři, fáze 6+)*.
5. **Komunitní pluginy** *(otevřené, fáze 6+ Hobby tier)*.
6. **Marketplace artefaktů** — témata, komponenty, datasety, integrace.

Tři vstupní cesty (mám web / chci nový / migruji), realizace AI agenty na **fakan.cz Standardy** (sekce 6), **Velín** jako řídicí centrum, **notifikační centrum** napříč ekosystémem, **path-based hosting** na `fakan.cz/{host}/`, **static-first**, vanilla HTML/CSS/JS/SVG, Cloudflare end-to-end. Mobile přes PWA (fáze 5) → Capacitor (fáze 6).

---

## 2. Cíle

| # | Cíl | Měřitelnost |
|---|-----|-------------|
| G1 | TTFV ≤ 60 s na free analýze (první data ≤ 5 s) | čas od kliku po první výsledek; první měřitelná data (status, screenshot, headers) musí být na obrazovce do 5 s |
| G2 | Konverze z free na mikroplatbu | ≥ 5 % |
| G3 | Konverze z mikroplatby na realizaci | ≥ 10 % |
| G4 | Automatizovat 80 % komunikace | poměr auto-vyřízených ticketů |
| G5 | Provoz výhradně na Cloudflare bez frameworku | 0 dependencies typu React/Vue/Next |
| G6 | Recurring revenue z hostingu | ≥ 30 % zakázek skončí na našem hostingu |
| G7 | Plně automatický onboarding nového webu | bez ručního zásahu pod limit |
| G8 | Konverze z migračního auditu na realizaci | ≥ 25 % |
| G9 | Recurring revenue z poradenství | ≥ 15 % zákazníků si v 1. roce dokoupí |
| G10 | Editor adopce | ≥ 50 % zákazníků s realizací → ≥ 1 edit/měs |
| G11 | Self-service edity bez agentů | ≥ 70 % drobných změn jde mimo agenty |
| G12 | Marketplace partnerské zakázky | ≥ 10 % nových zakázek od partnerů (fáze 7+) |
| G13 | Analytics adopce | ≥ 60 % zákazníků otevře dashboard ≥ 1×/měs |
| G14 | Fulltext search adopce | ≥ 30 % webů s 10+ stránkami |
| G15 | Recurring revenue stabilita | měsíční churn < 5 % |
| G16 | BYO AI úspora | ≥ 20 % power-userů přijde s vlastním klíčem |
| G17 | Marketplace artefakty | ≥ 50 instalovatelných do konce fáze 8 |
| G18 | Notifikační adopce | ≥ 50 % notifikací s akcí má klik do 7 dní |
| G19 | Komentáře a interakce | ≥ 20 % webů zapne do 6 měsíců |
| G20 | Plugin instalovanost | ≥ 3 aktivní pluginy per web do 6 měs |
| G21 | Dev program adopce | ≥ 25 vývojářů do 12 měs od otevření |
| G22 | Marketplace transaction volume | ≥ 100 000 Kč/měs do 18 měs od otevření |

---

## 3. Cílová skupina

- **SMB v ČR** — řemeslníci, malé e-shopy, restaurace, ordinace, agentury, lokální služby.
- **Neziskovky a spolky** s nízkým rozpočtem.
- **Osobnosti / OSVČ** — konzultanti, fotografové, lektoři, umělci.
- **Středně velké firmy** s prezentačním webem mimo hlavní e-shop.
- **Lidé platící předražený hosting / CMS, který nepotřebují** (cílové pole pro Cestu D — migrace).
- **Marketingově orientovaní** — reálný rozpočet na PPC/SEO/GEO.
- **AI-aware** — chtějí být vidět v ChatGPT/Perplexity (GEO).
- **Privacy-paranoid** — chtějí vlastní AI klíč, kontrolu nad daty.
- **Starší cílovka** — proto MVP cílí na e-mail + web, mobile apka až fáze 6, UX testing Velínu povinný.
- **Vývojáři a malé agentury (CZ + SK)** — B2D cílovka pro dev program (fáze 6+).

---

## 4. Klíčové uživatelské cesty

### 4.1 Cesta A — „Mám web"
URL → Turnstile → free analýza + 1 free AI redesign → mikroplatby za hlubší reporty/varianty → konfigurátor → faktura → realizace.

### 4.2 Cesta B — „Nemám web, chci nový"
Intake → vyhledávač domén (Subreg API) → 3 free preview směry → konfigurátor → faktura → realizace. Doména objednána až po platbě.

### 4.3 Cesta C — Existující zákazník
Magic link → Velín → správa všech webů, zakázek, předplatného, marketplace.

### 4.4 Cesta D — „Migruji od jiného poskytovatele"
„Platíš za hosting moc?" → free migrační audit s číslem úspory → self-service B1 nebo assisted B2 (s lidským expertem). Doména zůstává u stávajícího registrátora, zákazník mění jen DNS.

### 4.5 Editorové flow
Magic link → vybrat web → editor s manifestem → klik na prvek → změna → uložit → review → publish → live ~30 s.

### 4.6 Cesta E — Vývojář
`fakan.cz/dev` → registrace dev programu (Hobby zdarma) → SDK + sandbox → vývoj → submission → review → marketplace listing → recurring revenue.

---

## 5. Funkční požadavky

### 5.1 Free analýza
HTML fetch, status, screenshot (Browser Rendering), Lighthouse-lite, stack detection, security headers, OG preview, mobile vs. desktop, cookies/trackers detekce. Anti-bot: Turnstile + per-IP rate limit (3 free/24h/IP).

**Strategie TTFV (G1):** uživatel nesmí cítit, že systém zamrzl. Implementace v dvou vlnách:

1. **Synchronní vlna ≤ 5 s** — fetch HTML, HTTP status, security headers, stack fingerprint, OG meta tagy, cookies/trackers parsing. Toto vše běží přímo v request handleru a okamžitě se streamuje na klienta (SSE / chunked response). První viditelná data jsou na obrazovce do 5 sekund.
2. **Asynchronní vlna (5–60 s)** — Lighthouse-lite, screenshot přes Browser Rendering, AI redesign, hluboká SEO analýza. Běží na pozadí přes Queue, výsledek se inkrementálně doplňuje na stránku přes WebSocket nebo polling. Klient zobrazuje **progres-bar s konkrétními kroky** (viz brand brief sekce 6.2 — „Stahuju tvůj web… Měřím… Koukám…"), nikoli generický spinner.

První interakční CTA („Zaplatit hloubkový SEO report") se zobrazí jakmile dorazí synchronní vlna — uživatel nečeká až do konce 60 s, aby viděl, co může koupit.

### 5.2 Free AI redesign
Cesta A: 1 zdarma. Cesta B: 3 zdarma.

### 5.3 Placené reporty (mikroplatby)
SEO hloubkový (49–99 Kč), a11y (49–99 Kč), výkon (39–79 Kč), OG/Social (19–39 Kč), print (29 Kč), e-mail/newsletter (49 Kč), Cloudflare ochrana (49 Kč), použitelnost (79 Kč), 3 další redesigny (99 Kč), kompletní balík -30 %.

**Minimum 49 Kč** kvůli poplatkům platebních bran. Pod tím balíčky.

### 5.4 Doménový vyhledávač a registrace
Real-time check `.cz`, `.com`, `.eu`, `.sk`, `.online`, `.shop`, `.cloud`, `.dev`. Cena registrátora + 100 Kč fee. Backend: **Subreg.cz API** (Forpsi nemá veřejné API → vyřazeno). Dlouhodobě (fáze 8+) vlastní akreditace u CZ.NIC.

### 5.5 Hosting + plugin runtime

**Static-first architektura.** Každý web staticky generovaný, dynamika výhradně přes API (Workers + D1/KV/R2/DO/Queues).

**Path-based URL routing:**

| URL | Co tam běží |
|-----|-------------|
| `fakan.cz/` | Marketing landing |
| `fakan.cz/dev` | Náš dev/sandbox + portál pro vývojáře |
| `fakan.cz/marketplace` | Marketplace |
| `fakan.cz/zpravy` | Notifikační inbox |
| `fakan.cz/velin` | Globální velín |
| `fakan.cz/api/*` | Naše API |
| `fakan.cz/{host}/` | Mirror webu zákazníka (canonical → vlastní doména, noindex) |
| `fakan.cz/{host}/dev` | Preview + injectovaný editor |
| `fakan.cz/{host}/velin` | Web velín |
| `fakan.cz/{host}/api/*` | Worker daného webu (form, search, atd.) |

Vlastní doména zákazníka zůstává primární URL pro veřejnost (přes CF Custom Hostnames). Mirror má `noindex` a canonical na vlastní doménu.

**SEO ochrana mirroru — bezpečnost path-based hostingu:** Cloudflare Worker při každém response na URL `fakan.cz/{host}/*` (mimo `/dev`, `/velin`, `/api`) vynutí HTTP hlavičku `X-Robots-Tag: noindex, nofollow`. To má přednost před případným `<meta name="robots">` v HTML a brání indexaci mirroru ve vyhledávačích — zabraňuje poškození SEO klienta duplicitním obsahem na naší doméně. Hlavička je nastavena na úrovni Workeru, ne v HTML, aby ji zákazník nemohl omylem přepsat.

**Tarify:** Lite 99 Kč (100 MB / 50 GB / 1 doména), Standard 249 Kč (500 MB / 250 GB / 3), Pro 590 Kč (2 GB / 1 TB / 10), Custom dohodou. Hard limit řešen throttlingem, ne takedownem.

**Real-time funkce out-of-scope** — chat, livestream, kolaborace v reálném čase. Buď partnerský plugin, nebo custom produkt mimo standardy.

### 5.6 Konfigurátor nabídky
Personalizovaný formulář, předvybráno podle analýzy/intake, pro každý plugin „proč to potřebuješ" generované AI. Live cena, slider rozpočet jako filtr. Možnost „raději mi zavolejte".

### 5.7 Upload podkladů
Presigned PUT do R2, MIME sniff (magic bytes), per-zakázka kvóta. Indexace pro agenty (text z PDF/DOCX, parse CSV, thumbnail + EXIF strip + paleta z obrázků, sanitizace SVG). Retention 12 měsíců po dokončení zakázky.

### 5.8 Migrace ze stávajícího řešení
Migrační audit free (provider fingerprinting, odhad nákladů). Self-service B1 (2 990–9 990 Kč), assisted B2 (od 14 990 Kč) s lidským expertem. Doménu nepřevádíme — návody pro Forpsi/Wedos/Webhouse/Active24/GoDaddy/Subreg.

### 5.9 Orchestrace AI agentů
Designer, Content, SEOBot, A11yBot, PerfBot, EmailBot, DeployBot, DomainBot, HostBot, IndexBot, AnalyticsBot, GEOBot, SocialBot, DirectoryBot, ModerationBot, ReplyBot. Komunikace přes Queues, stav v DO, transcripty v R2.

**AI transparence** — explicitně říkáme, že realizaci dělá AI s lidským garantem („Realizuje: AI tým fakan.cz, dohled: Fakan"). Nepředstíráme čistě lidskou agenturu.

### 5.10 Plugin architektura — kernel platformy

Vše je plugin, kromě kernelu. Kernel obsahuje: auth, hosting, plugin registry, manifest engine, editor shell, velín shell, notifikační hub, billing core, marketplace, storage primitiva, i18n, audit.

**Detailní spec v `plugin-spec.md`.** Tento PRD popisuje jen high-level. Klíčové body:
- `plugin.json` v rootu pluginu, povinný.
- Permissions deklarované jako mobilní apka (storage, eventy, UI, AI, external fetch, payment).
- Vlastní Worker isolate per plugin (sandbox).
- Semver, kompatibilita kernel n-2 verze.
- Lifecycle: install → configure → activate → update → deactivate → uninstall (data retention 30 dní).

### 5.11 Marketplace
Pluginy + témata + komponenty + šablony + agenti + integrace + datasety. Trust tiers: Core / Official / Verified Partner / Community / Beta / Deprecated. Quality gating (auto check + lidská review). 30–50 seedů od nás na startu, aby marketplace nestartoval prázdný.

### 5.12 Dev program

| Tier | Cena/měs | Pluginů v marketplace | Transaction fee | Review SLA |
|------|----------|------------------------|-----------------|------------|
| Hobby | 0 Kč | **1** | 30 % | 14 dní |
| Pro | 990 Kč | 10 | 20 % | 7 dní |
| Studio | 4 990 Kč | neomezeně | 15 % | 5 dní |
| Enterprise | dohodou | neomezeně | dohodou | 3 dny |

Roční sleva ~15 %. Hobby tier omezen na 1 plugin v marketplace — kdo chce víc, upgraduje. **Min payout 500 Kč**, do té doby kumulace. Výplaty přes Stripe Connect / SEPA.

**Detail v `dev-program.md`** (vznikne ve fázi 6 spolu s otevřením programu).

### 5.13 Plugin SDK a sandbox
JS knihovna `@fakan/sdk`, CLI `fakan-cli` (init, dev, validate, submit), TypeScript types. Sandbox: lokální Worker simulace, mock AI proxy s omezenou kvótou pro vývojáře, test instance Velínu.

Submission flow: automatický check (manifest, permissions vs. kód, bundle limit, security scan) → lidská review (funkce, UX, bezpečnost, duplicita).

### 5.14 Fakturace, platby, partner payouts
ARES IČO lookup, PDF přes Browser Rendering, Stripe + Comgate + GoPay. Recurring billing, dunning (0/1/3/7/14/30 dní), self-service v Velíně. Manuální faktury (převodem) s párováním přes Fio API. Partner payouts: měsíční, Stripe Connect, min 500 Kč.

### 5.15 Editor (kernel modul)
Společný core (auth shell, web list, renderer, inspector/picker, schema engine, field editors, submit pipeline, audit, asset library, verze/rollback, conflict resolution, notifications). Per-web specifika přes `fakan.json` manifest. Klienti: web app, Chrome ext, Capacitor mobile (fáze 6).

**Detail manifestu** v `manifest-spec.md` (fáze 4).

### 5.16 Mobilní strategie

**Fáze 5 — PWA jako mezikrok.** Bez App Store / Play Store, instalovatelné z prohlížeče. Push notifikace přes Web Push API. Žádný native foto upload (jen browser file picker), žádný offline-first.

**Fáze 6 — Capacitor full apka.** iOS + Android, native kamera, nativní push, file system, App Store + Play Store distribuce.

### 5.17 Marketing pluginy *(fáze 7)*

Oficiální plugin balíček:
- `fakan-plugin-seo` *(core, MVP)*
- `fakan-plugin-geo` — Generative Engine Optimization (`llms.txt`, audit citovatelnosti v ChatGPT/Perplexity).
- `fakan-plugin-ppc-assist` — AI setup kampaní + audit + napojení partnera (Sklik nezapomenout).
- `fakan-plugin-social` — content kalendář, cross-posting do FB/IG/LinkedIn z editoru.
- `fakan-plugin-directories` — Firmy.cz, Mapy.cz, GBP, Najisto.cz, oborové.
- `fakan-plugin-newsletter` *(fáze 5)*.
- `fakan-plugin-udrzbar` — **AI Údržbář** *(fáze 7+)*: měsíční automatická kontrola webu (broken links, SEO skóre, kontrola cen v ceníku, dostupnost, certifikáty, drobné opravy). Měsíční mail majiteli ve stylu „Udělal jsem 3 drobné opravy, tvůj web je v kondici. Fakan." Cross-plugin přístup k SEO, CRM, hosting eventům přes deklarovaná `required_events`.

### 5.18 Fulltext search
`fakan-plugin-fulltext` (fáze 5). D1 FTS5 s `unicode61 remove_diacritics 2` pro češtinu. Crawl per deploy, `<fakan-search>` web component ~3 kB. Sémantický search přes Vectorize ve fázi 8+.

### 5.19 Analytics
- `fakan-plugin-analytics-basic` *(core, MVP, zdarma)* — vrstvy 1+2 (CF Web Analytics + edge counter), dashboard.
- `fakan-plugin-analytics-pro` *(official, 99 Kč/měs)* — pokročilá retention, segmenty, custom cíle.

Cookieless. Bez tracking pixelů. Bez fingerprintingu. Žádné session recordings ani heatmapy — out of scope.

### 5.20 Billing modul (kernel)
Druhy plateb: mikroplatby, jednorázové zakázky, subscripce, usage-based, partnerské komise. Recurring s 5. dnem měsíce. Dunning 0/1/3/7/14/30. Self-service v Velíně (změna tarifu, příplatky, platební metody, zrušení s grace 30 dní + retention).

### 5.21 BYO AI plugin
`fakan-plugin-byoai` (fáze 6). Anthropic / OpenAI / vlastní endpoint OpenAI-compatible. Per-feature routing v Velíně, monthly limit alerting, šifrované tokeny v D1, fallback na náš klíč při selhání + notifikace. Gemini fáze 5+, Mistral/Cohere fáze 6+.

### 5.22 Komentáře a interakce
`fakan-plugin-comments` (fáze 5). Komentáře, recenze, lajky, Q&A, hostbook. **E-mail povinný** s validací magic link na první komentář, pak token v `sessionStorage` 30 dní; vlastník webu může v Velíně povolit anonymní (jen jméno). Anti-spam: Turnstile + honeypot + AI moderace. 4 moderace módy (pre/post/auto-approve/AI prefilter).

### 5.23 Notifikační centrum (kernel)
Sjednocený inbox `fakan.cz/zpravy` + zvonek v UI. 13 zdrojů eventů (analytics, komentáře, formuláře, editor, realizace, billing, hosting, domény, marketplace, komunikace, security, marketing, systém). 3 severity (info / important / critical). 7 distribučních kanálů (in-app, inbox, mail, web push, mobile push, SMS jen critical, webhook). Anti-fatigue: coalescing, rate limit 50 mailů/den, daily digest, smart defaults. Akce přímo z notifikace.

**Stavy „Vím o tom" a self-healing:** notifikace o problému se nikdy nezobrazí jako pasivní hláška „Něco je rozbité". Vždycky obsahuje **akční tlačítko** „Fakane, vyřeš to", které spustí AI agenta (LifecycleBot / HostBot / DomainBot) — ten se pokusí o automatickou nápravu:

- Plugin nereaguje → restart Worker isolate.
- Cache není konzistentní → invalidate + warm cache.
- Build pipeline selhal → znovu pustit s posledním známým good commitem.
- Doména blízko expirace → otevřít direct flow prodloužení (jeden klik, fakturace).
- DNS chyba → spustit DNS asistenta s diagnostikou.

Při úspěchu agenta dorazí follow-up notifikace „Vyřešeno: restart pluginu Komentáře, běží 3 minuty bez chyb". Při neúspěchu eskalace na Fakana / lidského garanta s plnou diagnostikou v contextu.

### 5.24 Velín (kernel shell + plugin sekce)

**Globální velín** `fakan.cz/velin`: Přehled, Profil, Fakturace, Tým, AI klíče, API tokeny, Audit log, Bezpečnost, Zprávy, Marketplace, Podpora.

**Web velín** `fakan.cz/{host}/velin`: Přehled, Editor, Obsah, Komentáře, Formuláře, Analytics, Marketing, Hosting, Doména, Marketplace, Backup, Nastavení.

5 rolí: Vlastník / Editor obsahu / Marketingář / Účetní / Read-only host. RBAC v Workeru.

**2FA** — TOTP přes Authenticator app primární, SMS jen fallback pro critical akce (publish, delete, change billing). SMS provider: open question 11.46.

UX testing se starší cílovkou pred fází 5 — povinné. Velín nesmí být IDE.

### 5.25 Poradenství a osobní kontakt

**Poradenství:** mini-kurzy (290–1 490 Kč), online call 1:1 (1 990 Kč/60 min), workshop (9 990 Kč/180 min/10 lidí), firemní školení online (od 14 990), u zákazníka (od 24 990 + cestovné), retainer „máte se na koho zeptat" (1 990 Kč/měs).

Témata: sociální sítě CZ 2026, agregátory a katalogy, AI nástroje pro malé podnikání, bezpečnost online, GDPR pro malou firmu, web jako nástroj.

**Osobní kontakt:** online call (1 990 Kč), schůzka u nás (4 990), výjezd do 50 km (9 990), výjezd po ČR (14 990 + cestovné), retainer „náš člověk" (7 990/měs). Booking přes CalDAV (provider open question 11.19).

### 5.26 Export webu (anti lock-in)

**Funkce:** „Stáhnout web v ZIPu" — kdykoli z Velínu, jedním klikem.

**Dostupnost:** od **Hobby tieru** (tj. zdarma, i pro neplatící Hobby zákazníky). Záměrně nemá tier-locking — je to nejsilnější marketingový argument proti lock-inu konkurence (Webnode, Wix, WordPress.com), kde export buď neexistuje nebo je zaplacený zvlášť.

**Obsah ZIP:**
- Statické HTML / CSS / JS / SVG všech stránek webu (vygenerovaný snapshot, ne build artefakty).
- Asset složka (obrázky, fonty, ikony) — vše self-host, žádné externí odkazy.
- `README.md` s návodem, jak web pustit lokálně (`python -m http.server`) a jak ho nahrát na vlastní Apache / Nginx (vzorové configy).
- `fakan.json` manifest webu (struktura kolekcí, schéma) — kdyby se zákazník chtěl vrátit, můžeme z něj rekonstruovat editor.
- `LICENSE` info — všechen content je zákazníkův, struktura/template je MIT.

**Co v ZIP NENÍ:** dynamické backendy (komentáře, formuláře, fulltext API) — ty běží na Workerech a nejsou portovatelné. V README je vysvětleno, jak je nahradit (pokud se rozhodne hostit jinde).

**Generování:** asynchronně přes Queue, výsledek do R2, signed URL platná 7 dní, notifikace „tvůj export je hotový".

**Marketingově:** tagline „Tvůj web je tvůj. Vždycky." na pricing stránce a v cancel flow.

---

## 6. Standardy výstupu

Každý web od nás splňuje **bez výjimky**:

- **Bez cookies, bez banerů, bez popupů** — auth přes signed JWT v sessionStorage; analytics cookieless (CF Web Analytics + edge counter).
- **Bez third-party trackerů, fontů, CDN** — vše self-host.
- **Mobile-first** — 375×812 výchozí, touch ≥ 44×44, žádný hover-only, žádný horizontal scroll.
- **Auto dark/light** přes `prefers-color-scheme`. Žádný switcher v UI defaultně.
- **Přístupné** — WCAG 2.2 AA minimum, sémantický HTML, plná klávesnicová navigace, viditelný focus, screen-reader testing.
- **Strukturované** — schema.org JSON-LD, sitemap, robots, canonical, Open Graph + Twitter Card per stránka.
- **Rychlé** — LCP < 1.5 s na 4G, CLS < 0.05, INP < 200 ms, JS < 30 kB gzip.
- **Legální** — GDPR-friendly defaultně (nesbíráme nic, k čemu bychom potřebovali souhlas).

**Nekompromisní.** Zákazník nemůže říct „chci cookie banner" a my ho uděláme. Pokud trvá → custom produkt mimo „fakan.cz Standard".

Pluginy MUSÍ standardy splňovat. Kernel enforce-uje při review.

---

## 7. Komunikační kanály
In-app (Velín) + e-mail (Cloudflare Email Routing → Worker s HMAC + DKIM). Magic link na rizikové akce. Eskalace na člověka při ≥ 15 000 Kč nebo klíčových slovech.

---

## 8. Práva, scrape, podmínky užití
Zákazník zadávající svůj web → souhlas v ToS. Cizí web → klauzule „mám právo nechat analyzovat" + limit (free 3/měs, paid 30/měs). Robots.txt, rate limit 1 req/s, identifikace UA `fakan.cz-bot/1.0`. Smazání na vyžádání do 30 dní. Out: bypass paywallů, harvest osobních dat, použití cizího obsahu jako training data, reprodukce > 15 slov.

---

## 9. Architektura — high level

```
┌──────────────────────────────────────────────────────────────────────┐
│  KLIENTI (vanilla JS shared core)                                    │
│  Web app · Chrome ext · PWA (fáze 5) · Capacitor (fáze 6)            │
└────────────────────────────┬─────────────────────────────────────────┘
                             │ HTTPS
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│  KERNEL — Root Worker fakan.cz/* + per-web Workers                  │
│  Path Router · Auth · Plugin Registry · Manifest · Velín shell      │
│  Notification Hub · Billing · Marketplace · i18n · Audit            │
│                             ▲                                        │
│  ┌──────────────────────────┴──────────────────────────────────────┐ │
│  │  PLUGINY (každý vlastní isolate, scoped storage, RBAC)         │ │
│  │  Core + Official + Verified Partner + Community                 │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──┬──────────────────────────────────┘
   ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼  ▼
  D1 KV DO Q  R2 BR  AI ER PG CH WS Stripe Connect
External: Subreg · Stripe/Comgate/GoPay · Resend/MailChannels · ARES ·
          Fio · Vonage/Twilio · zákaznické AI endpointy · VAPID push
```

---

## 10. Datový model
Vše ze v0.7 (customers, sites, domains, audits, orders, payments, subscriptions, hostings, uploads, agent_runs, email_threads, email_messages, inapp_messages, notifications, marketplace_artifacts, installations, fts_pages, analytics_events, goals, ai_providers, ai_usage, comments, reactions, team_members, audit_log, api_tokens, plugins, plugin_installations, plugin_versions, plugin_reviews, dev_accounts, dev_subscriptions, marketplace_transactions, partner_payouts, plugin_audit, push_subscriptions, quiet_hours, notification_webhooks, notification_preferences, consultations, migrations, courses, course_access, availability_slots).

---

## 11. Otevřené otázky / risks

Po finalizaci v0.8 zůstávají otevřené:

1. **VOP a forbidden content na hostingu** (právník, fáze 0).
2. **Migrace WP webů** — jen statika ve fázi 4, dynamika později.
3. **Doručení výstupu mimo náš hosting** (zip/git PR/FTP) — volitelně dle balíčku.
4. **SLA hostingu** — návrh uptime 99,9 %, čeká na potvrzení.
5. **Brand a tón finalizace** → **`brand-brief.md` v0.1** k diskusi.
6. **CalDAV provider** — Apple / Google / Fastmail? Záleží, který kalendář Fakan používá.
7. **2FA SMS provider** — Vonage / Twilio / SMSbrana / T-Mobile B2B. Open.
8. **Cestovné sazba** — návrh 12 Kč/km nad 50 km zdarma okruhu.
9. **Forbidden poradenství** — dropshipping shitware, kryptoscam, dark patterns. Mít ve VOP.
10. **Trvání zákazníka na trackování (GA4)** — buď odmítáme, nebo „custom" produkt mimo standardy.
11. **Manifest a plugin breaking changes** — kernel n-2 kompatibilita potvrzena, fork pravidlo pro opuštěné pluginy.
12. **Cross-plugin permission „read other"** — vyžaduje souhlas druhého pluginu, mechanismus v plugin-spec.
13. **GitHub/GitLab integrace pro standalone editor** (mimo náš hosting) — fáze 7+.
14. **Vlastní akreditace registrátora u CZ.NIC** — fáze 8+.
15. **Antivirus na uploadech** — fáze 2 (zatím MIME validace).
16. **Vertikální balíčky** (např. „Restaurace Set" = menu + rezervace + komentáře + galerie + GEO) — marketing-friendly, fáze 7.
17. **Tax compliance partner program** (CZ DPH, EU OSS, ne-EU) — k právníkovi spolu s dev ToS.
18. **Federace komentářů** s Mastodon/Bluesky — fáze 8+.
19. **Public REST API spec** — fáze 7+ s OpenAPI.
20. **Audit log retention vs. GDPR** — anonymizace IP po N dnech.
21. **Plugin „AI Údržbář"** — měsíční automatická kontrola webu (broken links, SEO skóre, kontrola cen v ceníku oproti datům v CRM, kontrola dostupnosti). Výstupem je shrnující mail majiteli ve stylu „Udělal jsem 3 drobné opravy, tvůj web je v kondici. Fakan." Plánováno jako oficiální plugin ve fázi 7+, vyžaduje cross-plugin přístup k SEO, CRM, hosting eventům.
22. **Self-healing scope** — kde končí automatický zásah agenta a začíná povinná eskalace na člověka? Návrh: úspěšné self-healing akce nesmí měnit publikovaný obsah; obsahové změny vždy s confirm flow přes magic link. (Open, fáze 6 spolu s notifikační centrum dokončením.)

---

## 12. Roadmap

### Fáze 0 — kostra + plugin kernel (3–4 týdny)
Doména, infra, CI, base Worker, D1 schéma. Plugin registry + manifest engine. Plugin sandboxing. Landing s URL inputem, free analýza, Turnstile. Auth magic link, base velín. VOP/GDPR/dev ToS.

### Fáze 1 — MVP plateb + Cesta A + core pluginy (4–5 týdnů)
AI redesign, placené reporty, Comgate + Stripe, konfigurátor s ARES, upload podkladů. Core pluginy: forms, seo (basic), analytics-basic.

### Fáze 2 — Cesta B + domény + agenti (4–6 týdnů)
Subreg API, Cesta B end-to-end, Email Routing + inbound s HMAC, agenti Designer/SEO/Content/DomainBot, in-app komunikace.

### Fáze 3 — hosting (3–4 týdny)
Pages deploy automatizace, Custom Hostnames, tarify, recurring billing, HostBot, migrační asistent statiky.

### Fáze 4 — editor v0.1 + migrace + osobní kontakt + path routing (5–7 týdnů)
Editor core + manifest spec + Pages redeploy pipeline. Migrační audit + provider fingerprinting. Self-service migrace B1. Booking + CalDAV. DNS asistent.

### Fáze 5 — editor v0.2 + poradenství + analytics + fulltext + notifikace + velín + komentáře + PWA + plugin SDK alfa (7–9 týdnů)
Editor kolekce/assets/verze/rollback/conflict res, 2FA TOTP. Mini-kurzy, retainery. Oficiální pluginy: fulltext, comments, analytics-pro, newsletter. Notifikační centrum MVP. Velín UX testing se starší cílovkou. PWA wrapper. Plugin SDK alfa (interní).

### Fáze 6 — Capacitor + push + billing modul + BYO AI + dev program open (6–7 týdnů)
Capacitor (iOS, Android), nativní kamera, push, file system. Billing kompletní. BYO AI per-feature routing. Notifikace: Web Push, Mobile Push, SMS, quiet hours, daily digest, webhooky. **Dev program otevřen pro Hobby tier.** SDK 1.0, dokumentace, sandbox.

### Fáze 7 — marketing pluginy + verified partner tier (5–7 týdnů)
GEO, PPC-assist, social, directories, **AI Údržbář**. Verified Partner tier (KYC, smlouvy). Pro a Studio dev tiery. Marketplace artefakty (témata, komponenty, datasety). REST API spec. Aktivace `ui:editor:widget` pro Verified Partner po manual security review.

### Fáze 8+ — internacionalizace, sémantický search, vlastní akreditace u CZ.NIC, vertikální balíčky, e-shop základ, federované komentáře
Bez konkrétního termínu.

---

## 13. Doprovodná dokumentace

- **`brand-brief.md`** — tón, persona, vizuální směr, vzorové texty (v0.1 hotová).
- **`plugin-spec.md`** — detail manifestu, permissions, lifecycle, storage API, eventy, příklady (v0.7 hotová).
- **`manifest-spec.md`** — `fakan.json` per web, typy polí, kolekce, příklady pro 5 vertikál (fáze 4).
- **`dev-program.md`** — landing pro vývojáře, tier explain, FAQ (fáze 6).
- **`notification-types.md`** — kompletní katalog event typů s texty (fáze 5).
- **`agents.md`** — co dělá který agent, prompty, vstupy/výstupy (fáze 1).
- **`velin-ux.md`** — wireframes pro starší cílovku (fáze 5).
- **`mobile-app.md`** — UX detail (fáze 6).
- **VOP, GDPR, dev ToS, marketplace ToS, BYO AI ToS** — k právníkovi.
- Operations runbook, security playbook.

---

*Konec PRD v0.9.*
