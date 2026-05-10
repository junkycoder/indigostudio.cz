# roadmap fakan-auditor

Fáze 1–5 jsou MVP (viz `PROMPT.md` / `CLAUDE.md`). Fáze 6+ jsou post-MVP, otevírat až
po prvních 20–50 reálných auditech, kdy budou data na rozhodnutí o prioritě.

---

## Fáze 6 — Autonomní zpracování odpovědí (Email Worker + Claude)

**Cíl:** Když klient odpoví na mail #1/#2/#3, Worker odpověď zachytí, klasifikuje
přes Claude API a podle bucketu buď automaticky odpoví, nebo eskaluje do Fakanovy
schránky s návrhem odpovědi.

**Tři buckety klasifikace:**

1. **Hot lead** ("zajímá mě varianta X", "kdy můžeme začít", "pošlete smlouvu")
   → Claude vyrobí draft odpovědi → email do `jsem@fakan.cz` s předmětem
   `[hot] {domain} — odpověď klienta`. Fakan jen schválí a odešle.
2. **Jednoduchý případ** (díky / odhlášení / "kdy se ozvete znovu")
   → automatický template, žádný human-in-the-loop. Templates: `thanks`,
   `unsubscribed_confirm`, `next_step_eta`.
3. **Vše ostatní** (rozčilení, dotazy mimo scope, spam, prázdné odpovědi)
   → eskalace do Fakanovy schránky bez auto-reply. Důvod: na rozčíleného klienta
   robotická odpověď spálí značku rychleji než žádná odpověď.

**Stack:**
- Cloudflare Email Routing → směruje `*@fakan.cz` na Email Worker (existuje
  `[[send_email]]` v `wrangler.toml` pro outbound, pro inbound přidat Email Routing
  v dashboardu).
- Email Worker volá Claude API s `claude-sonnet-4-5` na klasifikaci + případný draft.
- D1 tabulka `email_replies` (lead_id, message_id, raw, classification, action_taken).
- Resend pro outbound auto-reply (existuje).

**Pasti:**
- Falešné hot-lead klasifikace: každý draft do schránky má označení
  `confidence: 0.0–1.0` a Fakan vidí důvod klasifikace.
- Smyčky auto-reply na auto-reply (out-of-office, mailer-daemon): ignoruj
  `Auto-Submitted`, `Precedence: bulk`, `X-Autoreply` headery.
- Vlákna ne každá odpověď je k konkrétnímu auditu — Worker musí najít
  `lead_id` přes `In-Reply-To` / `References` header nebo přes match na
  `from` adresu + nedávný audit.

---

## Fáze 7 — Legální B2B profilování pro sales pipeline

**Cíl:** Z domény + IČO + veřejných zdrojů složit profil leada, který sedne
do `lead_profiles` tabulky a Fakan ho vidí v admin UI seřazený podle hodnoty.

**Co sbírat (vše legální bez extra souhlasu, oprávněný zájem + veřejné rejstříky):**

- **ARES** (z IČO nebo z domény přes WHOIS lookup): segment (osvc/sro/spolek),
  obrat, počet zaměstnanců, NACE kód, datum vzniku.
- **DNS / hosting**: hosting provider (Wedos / Forpsi / Hetzner / CF…),
  věk domény, počet poddomén, MX provider (Gmail / Microsoft / vlastní).
- **Web tonality match**: ze stažené stránky během auditu rozeznat odvětví
  (řemeslník / e-shop / spolek / služba) a jazyk (česky / anglicky / víc verzí).
- **Audit telemetrie** (vlastní data): score, kategorie nejhoršího nálezu, CMS,
  délka domény (proxy pro stáří firmy).

**Co se sbírat NESMÍ bez explicitního souhlasu (a teď ho v opt-inu nemáme):**

- Retargeting přes 3rd-party cookies (Facebook Pixel, Google Ads).
- Cross-site tracking návštěvníků audit-page mimo vlastní doménu.
- Prodej / sdílení dat třetím stranám.
- Spojování s nelegálně získanými daty (kradené databáze, scraping privátních zdrojů).

**Tabulka:**

```sql
CREATE TABLE lead_profiles (
  lead_id        TEXT PRIMARY KEY,
  ares_subject   TEXT,        -- JSON: {nazev, ico, dic, sidlo, datum_vzniku, …}
  ares_segment   TEXT,        -- osvc | sro_small | sro_medium | sro_large | spolek
  ares_revenue   INTEGER,     -- v Kč, last known
  ares_nace      TEXT,
  hosting        TEXT,        -- hostname A-record provider
  domain_age_y   INTEGER,
  mx_provider    TEXT,
  industry       TEXT,        -- z tonality match
  language       TEXT,         -- cs | en | multi
  enriched_at    INTEGER NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);
```

**Pipeline:**
- Spouštět ARES enrichment v queue jako samostatný `kind: 'enrich'` job
  hned po `kind: 'audit'` skončení. ARES API je veřejné, žádný klíč nepotřeba.
- Cache enrichment v KV per IČO 30 dní (ARES data se mění málo).
- Privacy policy aktualizovat o "obohacujeme leady veřejnými daty z ARES,
  WHOIS a vlastním auditem za účelem nabídky služby" (oprávněný zájem dle
  čl. 6 odst. 1 písm. f GDPR).

---

## Fáze 8 — Developer účet + vlastní browser extension

**Cíl:** Placený developer účet s vlastním buildem web-extension. V extension
sedí konfig + jednodenní refresh token, takže developer po instalaci nemusí
nikam psát login.

**Flow:**
- Developer si v `fakan.cz` koupí účet → vygeneruje se mu vlastní build extension
  (CRX/ZIP) s předpečeným configem + krátkým refresh tokenem (24 h).
- Po instalaci extension buď:
  a) automaticky otevře `fakan.cz` s rozkliknutým modálem "Developer extension
     připojena" → web přes postMessage / cookie zpáruje extension s účtem,
  b) nebo modál spustí ručně user, výsledek stejný.
- Token rotace: extension si refreshuje token, expiruje za 24 h pokud user
  není aktivní (security default).
- **Návod na instalaci přes Developer mode v Chrome** (chrome://extensions →
  Load unpacked) — jednoduchý krok-za-krokem screenshot guide, protože
  Chrome Web Store schvalování nechceme řešit dokud není stable.

**Otevřené otázky:**
- Firefox / Edge / Safari build? Manifest V3 napříč nemusí být přímočarý.
- Sideload v Chrome ukazuje warning "Disable developer mode extensions" každý
  restart — pro paying customera otravné, ale alternativa = Chrome Web Store
  review (~2 týdny + ongoing compliance).
- Co extension reálně dělá? (TBD — předpoklad: in-page debug overlay nad
  audit findings, případně injektor pro marketplace komponenty z Fáze 10.)

---

## Fáze 9 — Native apps (web / iOS / Android)

**Cíl:** Vlastní aplikace pro dvě persony:
- **Developer** — správa zakázek, klientů, marketplace produktů, výplat.
- **Majitel webu** — přehled vlastních webů, audit historie, správa
  marketplace komponent na webu, fakturace.

**Stack open question:**
- Web app: pravděpodobně rozšíření `fakan.cz` (vanilla JS / SPA per route,
  drží se stack pravidla z CLAUDE.md).
- Mobile: PWA jako MVP (nepřidává build step, instaluje se z webu),
  nebo Capacitor / React Native pokud bude potřeba native API
  (push notifikace, biometrie, NFC platby).
- Auth: jednotný session backend ve Workeru (existuje pro free audit token,
  rozšířit o login/refresh).

**Pasti:**
- Rozhodnout per-persona feature scope dřív než se začne kódit — jinak
  jedna app dělá všechno špatně.
- Apple App Store + Google Play review = další compliance overhead;
  PWA nedává placenou distribuci přes store, ale ušetří review cyklus.

---

## Fáze 10 — Marketplace komponent pro weby

**Cíl:** Katalog hotových funkcionalit, které si majitel webu instaluje
do svého webu jedním kliknutím — formuláře, košík, rezervace, chatbot,
analytics widget, atd. Mix vlastních (od fakan.cz) a third-party (od
ověřených developerů z Fáze 8). Free i placené.

**Otevřené otázky:**
- Distribuce: snippet kódu (script tag / iframe), npm package, nebo
  injection přes developer extension z Fáze 8?
- Hosting: my hostujeme runtime na Workeru, developer dodá jen kód +
  config schema?
- Revenue split: kolik si bere fakan.cz z placených komponent
  (typický marketplace 15–30 %).
- QA / bezpečnost: každá komponenta musí projít sandboxem (iframe origin
  isolation, CSP whitelist) jinak XSS na klientském webu = naše blame.
- Verzování + breaking changes: developer pushne v2 — jak migrovat
  existující instalace bez rozbitých webů?

**Závislosti:**
- Fáze 8 (developer účet) musí existovat dřív, jinak nemáme kdo komponenty
  dodává mimo nás.
- Fáze 9 (app pro majitele webu) je ideální UI pro instalaci komponent,
  ale marketplace lze startovat i z `fakan.cz` web admin.

---

## Pořadí

1. Dokončit MVP (Fáze 1–5).
2. Po **20 reálných** auditech: review výstupů Strategist promptu, ladění tonality.
3. Po **50 reálných** auditech rozhodnout, jestli začít s Fází 6 nebo 7.
   - Pokud >40 % leadů odpoví: Fáze 6 (auto-reply šetří hodně práce).
   - Pokud Fakan rozhoduje sales priority "od oka": Fáze 7 (priority list ze zdat).
4. Fáze 8–10 jsou samostatný produktový směr (developer ekosystém + marketplace),
   nezávislý na Fázi 6/7. Otevřít až po revenue validaci MVP — vyžaduje řádově
   víc engineering času a nový business model (revenue share).
