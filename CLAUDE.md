# CLAUDE.md — indigostudio.cz

Statická vizitka studia **Indigo Studio s.r.o.** na jednom Cloudflare Workeru.
Jedna stránka, žádný build step, žádné frameworky.

## Co to je

`indigostudio.cz` — minimalistická one-page vizitka:
- střídmě, vycentrovaně, na jeden viewport, mobile-friendly
- dark/light přepínač (respektuje `prefers-color-scheme`, ukládá do localStorage)
- jemný interaktivní glow za kurzorem
- OG/Twitter share preview (`/og.png`)
- kontakty na tým + firemní údaje

## Struktura

- `public/index.html` — celá stránka (inline CSS + JS)
- `public/og.png` (zdroj `scripts/og.svg`), `favicon.svg`, `apple-touch-icon.png`
- `public/team/` — fotky (`info.jpg`/`veronika.jpg`/`daniel.jpg`); chybí-li, web zobrazí iniciály
- `src/worker.js` — servíruje `public/` + bezpečnostní hlavičky
- `wrangler.toml` — Worker config (route `indigostudio.cz`, custom_domain)
- `.github/workflows/deploy.yml` — auto-deploy na push do main

## Firemní údaje (zdroj pravdy pro texty na webu)

- Indigo Studio s.r.o., IČO 14389096
- Sídlo: Chudenická 1059/30, Hostivař, 102 00 Praha
- BÚ: 2802169026/2010 (Fio)
- Kontakty: info@ → indigostudio.cz@gmail.com, veronika@ → veronika.hallerova@gmail.com,
  daniel@ → hromada.dan@gmail.com (přes Cloudflare Email Routing)

## Pravidla

- **Stack je striktní:** vanilla HTML/CSS/JS, žádný build, žádné frameworky, žádné npm
  závislosti mimo `wrangler` (dev). Komentáře česky, identifikátory anglicky.
- **Texty na klienta:** vykání, stručně, asertivně, bez emoji a vykřičníků, bez žargonu.
- Po změně smoke test: `npx wrangler deploy --dry-run`.
- Deploy: push do main (Action) nebo `npm run deploy`.
- OG po úpravě `scripts/og.svg` přegenerovat (návod v README).

## TODO od zadavatele

- Dodat fotky do `public/team/` (info/veronika/daniel.jpg).
- Doplnit telefon na info (v `index.html` připravený zakomentovaný `.phone` řádek).
- V Cloudflare nastavit Email Routing a DNS (návod v README).
- V GitHubu přidat secret `CLOUDFLARE_API_TOKEN` pro auto-deploy.

## Záloha

Původní projekt **fakan** je v větvi `archive/fakan` a tagu `archive-fakan-2026-06-02`.
