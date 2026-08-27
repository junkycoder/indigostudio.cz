# indigostudio.cz

Statická vizitka studia **Indigo Studio s.r.o.** — jedna stránka, dark/light
(podle systému), mobile-friendly, OG share preview, poptávkový formulář.
Servíruje ji jeden Cloudflare Worker.

## Struktura

```
public/            statika (servíruje asset binding)
  index.html       vizitka — celá stránka (inline CSS + JS, žádný build)
  og.png           share preview 1200×630
  favicon.svg      ikona
  apple-touch-icon.png
  robots.txt, sitemap.xml
  team/            fotky týmu (info.jpg / veronika.jpg / daniel.jpg) — viz team/README.txt
src/worker.js      Worker: servíruje public/ + bezpečnostní hlavičky + POST /api/poptavka
scripts/og.svg     zdroj pro og.png (regenerace viz níž)
wrangler.toml      Worker config (route, send_email binding)
```

Stack: vanilla HTML/CSS/JS, žádný build step, žádné frameworky.

## Vývoj

```bash
npm install
npm run dev        # wrangler dev — lokální náhled
```

## Deploy

**Automaticky (Cloudflare Workers Builds):** push do `main` → Cloudflare sám
nasadí. Bez tokenu a bez secretů. Jednorázové propojení v dashboardu:

1. CF dashboard → **Workers & Pages** → Worker `indigostudio` → **Settings** → **Builds**.
2. **Connect** → GitHub → repo `junkycoder/indigostudio.cz`, branch `main`.
3. Deploy command: `npx wrangler deploy` (build command nech prázdný, root `/`).
4. Save. Každý push do `main` se od teď nasadí automaticky.

**Ručně:**
```bash
npm run deploy     # wrangler deploy
```

## Poptávkový formulář

`POST /api/poptavka` ({name, email, message}) → Worker pošle e-mail přes
**Resend** (HTTP API) na `info@indigostudio.cz`. Bez nastaveného `RESEND_API_KEY`
spadne na Cloudflare `send_email` fallback (`hromada.dan@gmail.com`). Honeypot
pole `company` + validace proti spamu. Adresy se mění v `src/worker.js`
(`MAIL_FROM` / `MAIL_TO` / `MAIL_TO_FALLBACK`). Nastavení mailu viz níž.

### Regenerace OG obrázku

Po úpravě `scripts/og.svg`:
```bash
node -e "const s=require('sharp');s(require('fs').readFileSync('scripts/og.svg')).png().toFile('public/og.png')"
```

## Doména + DNS (Cloudflare)

1. Doménu `indigostudio.cz` přidat do Cloudflare účtu (Add site) a u registrátora
   přepsat nameservery na Cloudflare. Web naběhne, až se DNS rozšíří (typicky do hodin).
2. Route na Worker drží `wrangler.toml` (`custom_domain = true`) — po prvním
   `wrangler deploy` se v zóně vytvoří automaticky.

## Email (Zoho Mail + Resend)

Cíl: reálné schránky `info@` / `veronika@` / `daniel@` s webmailem, příjmem
i **odesíláním z pravé adresy** (IMAP/SMTP). Poštu drží **Zoho Mail (EU DC,
free tier)**, poptávkový formulář posílá přes **Resend** (HTTP API, zdarma).

> **Důležité:** Cloudflare Email Routing a Zoho si nemůžou vládnout MX zároveň.
> Zapnutí Email Routingu přepíše MX na Cloudflare; pro Zoho je nutné Email
> Routing **vypnout** a nastavit MX na Zoho. Proto poptávka už nejede přes
> CF `send_email` (závisí na Email Routingu), ale přes Resend — nezávislé na MX.

### 1) Zoho Mail — schránky a webmail

1. Registrace na **zoho.com/mail** → Mail Free Plan → **EU data center**
   (DC se po registraci nemění; EU kvůli GDPR).
2. Add domain `indigostudio.cz` → ověření domény (TXT `zoho-verification=…`,
   přesnou hodnotu dá Zoho admin) v Cloudflare DNS.
3. Vytvořit schránky: `info@`, `veronika@`, `daniel@` (free tier: až 5 schránek).
4. Webmail: **mail.zoho.eu**. IMAP/SMTP (`imap.zoho.eu` / `smtp.zoho.eu`,
   port 465 SSL) pro připojení do Gmailu/Apple Mail/Outlooku přes app-specific
   heslo.

### 2) DNS v Cloudflare (po vypnutí Email Routingu)

Nejdřív v dashboardu → **Email** → **Email Routing** → **Disable** (uvolní MX).
Pak v **DNS** přidat (přesné hodnoty vždy ověř v Zoho adminu → *Tools & Config*):

| Typ | Name | Hodnota | Pozn. |
|-----|------|---------|-------|
| MX  | `@`  | `mx.zoho.eu`  | priorita 10 |
| MX  | `@`  | `mx2.zoho.eu` | priorita 20 |
| MX  | `@`  | `mx3.zoho.eu` | priorita 50 |
| TXT | `@`  | `v=spf1 include:zoho.eu ~all` | SPF |
| TXT | `zmail._domainkey` | (DKIM klíč z Zoho adminu) | DKIM |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@indigostudio.cz` | DMARC |

MX nech **DNS only** (šedý mráček). Pozor: pokud v zóně zůstaly staré MX od
Email Routingu (`*.mx.cloudflare.net`), smazat je.

### 3) Resend — poptávkový formulář

1. Účet na **resend.com** → **Domains** → add `indigostudio.cz`.
2. Resend dá DKIM/SPF záznamy (typicky na subdoménu `send.` / `resend._domainkey`)
   — přidat do Cloudflare DNS. **Nekoliduje** se Zoho DKIM (jiné selektory).
3. API klíč → uložit jako secret Workeru:
   ```bash
   npx wrangler secret put RESEND_API_KEY
   ```
   (V Cloudflare Workers Builds nastavit tentýž secret v dashboardu Workeru.)
4. Hotovo: `src/worker.js` pošle poptávku přes Resend na `info@indigostudio.cz`.
   Bez nastaveného `RESEND_API_KEY` spadne na CF `send_email` fallback
   (`hromada.dan@gmail.com`) — žádný výpadek během migrace.

## Statusboard mBlue (mblue.indigostudio.cz)

Neveřejná ministránka pro tým projektu mBlue: seznam funkcí aplikace se zjištěným
stavem, ke kterému každý přiřazuje fázi, váhu 0–9 a příznak „nad rámec". Všichni
vidí hlasy všech a stránka počítá míru shody — cíl je dostat ji nad 90 %.

- `src/statusboard.js` — routing, přihlášení, API, bot
- `src/statusboard.page.html` — stránka; **schválně není v `public/`**, aby se
  nedala stáhnout mimo přihlášení (assets se servírují bez kontroly session)
- `migrations/` — schéma D1 (`wrangler d1 execute mblue-statusboard --remote --file=…`)

**Přihlášení** je magic link. Člověk zadá e-mail na `/statusboard`, a když je
v `sb_members`, přijde mu jednorázový odkaz (platnost hodina). Odpověď formuláře
je vždy stejná, aby se z ní nedalo vyčíst, kdo v týmu je.

Doručení pošty: s `RESEND_API_KEY` chodí odkaz komukoli z týmu, bez něj jen na
adresy ověřené v Email Routingu. Zbytku vygeneruje odkazy admin:

```
curl -H "X-Admin-Token: $STATUSBOARD_ADMIN_TOKEN" \
     https://mblue.indigostudio.cz/api/statusboard/admin/invite
```

**Členy** přidává tentýž token:

```
curl -X POST -H "X-Admin-Token: $STATUSBOARD_ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"email":"eva@…","name":"Eva"}' \
     https://mblue.indigostudio.cz/api/statusboard/admin/members
```

**Hotovost** je na chipu stavu jako procento se sliderem. Výchozí hodnota se odvodí
z kódu (100 / 50 / 0 podle zjištěného stavu) a je bledší; jakmile ji člověk posune,
je to jeho odhad a nálepka se překlopí sama (100 % hotovo, 1–99 % rozdělané, 0 % chybí).
Rozdíl větší než dvacet bodů mezi dvěma lidmi dělá z položky spornou, stejně jako
rozdílná fáze.

**Náročnost** je druhý chip vedle hotovosti (stejně široký, taky se sliderem) a drží
odhad ZBÝVAJÍCÍ práce v hodinách. Výchozí číslo si stránka spočítá: rozpočet bloku
(`hours` u modulu — z Přemkovy tabulky odhadů tam, kde ji jde namapovat, jinde odhad)
rozpustí mezi jeho položky a vynásobí zbývajícími procenty, takže hotová položka vyjde
na nulu sama. Součet přes všechny položky je v hlavičce („Zbývá práce") a červená,
když přeleze 300 h zbývajícího rozpočtu.

**Nice to have** je samostatná osa mezi rozsahem a vahou: „nad rámec" říká, ODKUD
položka je, tohle jestli ji vůbec chceme.

**Otazník** za vahou znamená „nevím jistě, co to je a k čemu" — tedy že hodnotám
vedle nemá cenu věřit. Má vlastní filtr, počítadlo v hlavičce a fialový proužek
u řádku (sporné položky mají oranžový; když platí obojí, jsou vidět oba).

**Historie změn** se píše při každé skutečné změně hodnocení (zápis, který nic
nemění, se ignoruje) do `sb_history` — řádek nese stav před i po. Změny téže položky
od téhož člověka se **do minuty slévají do jednoho záznamu** (`MERGE_WINDOW_SECONDS`);
kdo se proklikáním vrátí na výchozí hodnotu, nezanechá záznam žádný. Panel je sbalený,
seznam má strop výšky a scrolluje v sobě; tlačítko `⟲ N` v řádku rozbalí historii
jedné položky.

**Komentáře** jsou týmová diskuse k jedné položce (`sb_comments`, migrace `0008`).
Otevírá je tlačítko „Komentáře N" v řádku, počet visí přímo na něm a chodí ve
`state` jako `commentCounts`, aby se kvůli číslu nemusela tahat těla. Zápis je
**append-only** — komentář nejde upravit ani smazat z UI, autor a čas jsou součástí
záznamu. Strop je 2 000 znaků; cesta `/api/statusboard/comments` je za session jako
zbytek API a POST navíc za kontrolou `Origin`.

Komentář slouží k tomu, na co hodnocení nestačí: proč je u položky otazník, co
přesně v zadání chybí, co se ověřilo v kódu. Agenti mají vlastní členství
(`codex@`, `claude@indigostudio.cz`) — jejich příspěvky se tedy podepisují samy
a nemíchají se s hlasy týmu.

⚠️ Vlastní hodnocení (`mine`) se ze serveru přebírá **jen při prvním načtení**.
Periodický refresh tahá cizí hlasy — kdyby přepisoval i vlastní, sebral by rozdělanou
změnu: klik doběhne dřív než odpověď a další zápis by poslal starou hodnotu zpátky.

> Bot přes Anthropic API a nahrávání podkladů tu byly 25. 8. 2026 pár hodin a Dan
> je tentýž den zrušil ve prospěch téhle historie. Tabulky `sb_files` / `sb_ai_notes`
> i R2 bucket `mblue-statusboard-files` padly s nimi (migrace `0003`).

## Záloha původního projektu

Repo dřív obsahovalo projekt **fakan**. Je zazálohovaný:
- větev `archive/fakan`
- tag `archive-fakan-2026-06-02`
