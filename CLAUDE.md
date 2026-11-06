# CLAUDE.md — indigostudio.cz

Statická vizitka studia **Indigo Studio s.r.o.** na jednom Cloudflare Workeru.
Jedna stránka, žádný build step, žádné frameworky.

## Co to je

`indigostudio.cz` — minimalistická one-page vizitka:
- střídmě, vycentrovaně, na jeden viewport, mobile-friendly
- dark/light přepínač (respektuje `prefers-color-scheme`, ukládá do localStorage)
- horní lišta s odkazem na `/projekty` (případové studie, ukázky a reference)
- OG/Twitter share preview (`/og.png`, anglicky `/og-en.png`, vietnamsky `/og-vi.png`)
- kontakty na tým + firemní údaje
- tři jazyky: čeština na kořeni, angličtina pod `/en/`, vietnamština pod `/vi/` (viz „Jazykové verze")

## Struktura

- `public/index.html` — celá stránka (inline CSS + JS)
- `public/projekty.html` — feed: aplikace, případové studie, reference, ukázky
  (položka = `<li class="item" data-kind="app|case|reference|sample">`, šablony v komentáři;
  filtr ukazuje jen neprázdné kategorie)
- `public/hosting.html` — nabídka hostingu statických webů (doména, migrace, firemní e-mail,
  konektor na Weed); poptávkový formulář posílá na `POST /api/poptavka` (stejný endpoint
  jako poptávka na úvodu) — pole se skládají do textu zprávy
- `public/skoleni.html` — školení: nahoře vždy jedno aktuální (stav v `.status`), pod ním
  „Proběhlá školení" (záznam za ½ ceny, účastníci zdarma + článek; šablona v komentáři)
  a odběr novinek → `src/odber.js` (double opt-in, D1 `indigostudio-odber`, schéma
  `migrations/odber/`, potvrzovací e-mail přes Resend)
- `public/doodles.js` — sdílené animované pozadí (malůvky), připojit `<script src="/doodles.js" defer>`;
  pro čtečky jeden statický popis motivů na konci `<body>` (bez aria-live)
- `public/nav.js` — rozbalovací nabídka „Naše služby" v horní liště (`<details class="nav-group">`,
  uvnitř Hosting a Školení); skript jen zavírá menu kliknutím mimo a Escapem, bez něj funguje dál
- `public/cursors.js` — kurzory jen nad kartami: klasická šipka / ruka s kulatým odznakem
  (značka podle typu karty), připojit hned za doodles.js; nová karta = řádek v `CARDS`
- `public/og.png` (zdroj `scripts/og.svg`), `favicon.svg`, `apple-touch-icon.png`
- `public/team/` — fotky (`info.jpg`/`veronika.jpg`/`daniel.jpg`); chybí-li, web zobrazí iniciály
- `public/en/`, `public/vi/` — anglická a vietnamská kopie každé stránky (i `404.html`)
- `src/worker.js` — servíruje `public/` + bezpečnostní hlavičky + `POST /api/poptavka`
  + přesměrování podle jazyka (`PAGES`, `languageRedirect`)
- Online nástroje (`nastroje.`, subdomény nástrojů, `ceska-republika.`) tady nejsou: žijí
  v repozitáři `IndigoStudioCZ/nastroje` (`~/nastroje.indigostudio.cz`) na vlastním Workeru
  `nastroje`. Jejich domény do `wrangler.toml` nepřidávat — nasazení vizitky by si je přetáhlo.
- `wrangler.toml` — Worker config (route `indigostudio.cz`, custom_domain, `send_email` binding)
- auto-deploy: Cloudflare Workers Builds (git push → CF nasadí, bez tokenu)

## Firemní údaje (zdroj pravdy pro texty na webu)

- Indigo Studio s.r.o., IČO 14389096, DIČ CZ14389096 (plátce DPH)
- Sídlo: Chudenická 1059/30, Hostivař, 102 00 Praha
- BÚ: 2802169026/2010 (Fio)
- Telefon (firemní, i WhatsApp): +420 777 407 690; Daniel +420 604 690 539,
  Veronika +420 737 176 622
- Kontakty: info@ / veronika@ / daniel@ — reálné schránky v Zoho Mail (EU DC, free).
  Webmail mail.zoho.eu, IMAP/SMTP smtp.zoho.eu. (Dřív forwarding přes CF Email
  Routing — nahrazeno, viz README „Email".)

## Jazykové verze

- Adresy: česká `/skoleni` ↔ `/en/training` ↔ `/vi/training` — en i vi mají stejné anglické
  slugy. Zdroj pravdy pro mapování je `PAGES` v `src/worker.js`.
- Přesměrování (Worker): jen **české** adresy a jen při vstupu zvenku (ne při prokliku uvnitř
  webu, ne pro roboty a náhledy odkazů). Přednost má cookie `lang` z přepínače, jinak
  `Accept-Language`: cs/sk → čeština, vi → vietnamština, en i jakýkoli jiný jazyk → angličtina,
  bez hlavičky čeština. `/en/…` a `/vi/…` se nepřesměrovávají nikdy. 302 + `Vary`.
- Přepínač jazyka = `<details class="nav-group nav-lang">` za hlavní navigací, CSS blok
  „přepínač jazyka" v každé stránce, cookie ukládá `public/nav.js` (technicky nezbytná, bez lišty).
- Každá stránka má v `<head>` `hreflang` cs/en/vi/x-default (x-default = česká adresa)
  a `og:locale` + `og:locale:alternate`; `sitemap.xml` má tytéž alternativy.
- Formuláře posílají `lang` (`/api/poptavka`, `/api/odber`): hlášky, potvrzovací e-mail
  odběru a návrat po potvrzení jsou v jazyce stránky; v poptávce je jazyk v předmětu.
- **Změna textu nebo vzhledu stránky = změna ve všech třech verzích.** Nová stránka =
  řádek v `PAGES`, tři soubory s `hreflang` a přepínačem, záznam v `sitemap.xml`.
- Vietnamština oslovuje formálně („Quý khách", my = „chúng tôi"), angličtina věcně, americký pravopis.

## Pravidla

- **Stack je striktní:** vanilla HTML/CSS/JS, žádný build, žádné frameworky, žádné npm
  závislosti mimo `wrangler` (dev). Komentáře česky, identifikátory anglicky.
- **Texty na klienta:** vykání, stručně, asertivně, bez emoji a vykřičníků, bez žargonu.
- Po změně smoke test: `npx wrangler deploy --dry-run`.
- Deploy: push do main (Cloudflare Workers Builds) nebo `npm run deploy`.
- OG po úpravě `scripts/og.svg` přegenerovat (návod v README) — i `og-en.svg` a `og-vi.svg`.

## TODO od zadavatele

- Dodat fotky do `public/team/` (info/veronika/daniel.jpg).
- Mail (Zoho + Resend) — runbook v README „Email (Zoho Mail + Resend)":
  1. Zoho Mail (EU DC, free): ověřit doménu, založit schránky info@/veronika@/daniel@.
  2. Vypnout CF Email Routing → nastavit MX na Zoho (mx*.zoho.eu) + SPF/DKIM/DMARC.
  3. Resend: ověřit doménu (DKIM CNAME na subdoméně) + `wrangler secret put RESEND_API_KEY`.
  Worker už je připraven: s RESEND_API_KEY posílá poptávku přes Resend, jinak
  fallback na CF send_email (bez výpadku během migrace).

## Záloha

Původní projekt **fakan** je v větvi `archive/fakan` a tagu `archive-fakan-2026-06-02`.
