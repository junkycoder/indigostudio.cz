# indigostudio.cz

Statická vizitka studia **Indigo Studio s.r.o.** — jedna stránka, dark/light,
mobile-friendly, OG share preview. Servíruje ji jeden Cloudflare Worker.

## Struktura

```
public/            statika (servíruje asset binding)
  index.html       vizitka — celá stránka (inline CSS + JS, žádný build)
  og.png           share preview 1200×630
  favicon.svg      ikona
  apple-touch-icon.png
  robots.txt, sitemap.xml
  team/            fotky týmu (info.jpg / veronika.jpg / daniel.jpg) — viz team/README.txt
src/worker.js      Worker: servíruje public/ + bezpečnostní hlavičky
scripts/og.svg     zdroj pro og.png (regenerace viz níž)
wrangler.toml      Worker config
.github/workflows/deploy.yml   auto-deploy na push do main
```

Stack: vanilla HTML/CSS/JS, žádný build step, žádné frameworky.

## Vývoj

```bash
npm install
npm run dev        # wrangler dev — lokální náhled
```

## Deploy

**Automaticky:** push do `main` → GitHub Action nasadí (potřebuje secret
`CLOUDFLARE_API_TOKEN`, viz `.github/workflows/deploy.yml`).

**Ručně:**
```bash
npm run deploy     # wrangler deploy
```

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

## Email forwarding (Cloudflare Email Routing)

Cíl: `info@`, `veronika@`, `daniel@` přeposílat na gmaily. Odpovídá se z gmailu.

Cloudflare dashboard → zóna `indigostudio.cz` → **Email** → **Email Routing**:

1. **Enable Email Routing** — CF samo přidá MX + TXT (SPF) záznamy do DNS.
2. **Destination addresses** — přidat a ověřit (CF pošle ověřovací mail):
   - `indigostudio.cz@gmail.com`
   - `veronika.hallerova@gmail.com`
   - `hromada.dan@gmail.com`
3. **Routing rules** — custom addresses:
   | Adresa                     | Přeposlat na                  |
   |----------------------------|-------------------------------|
   | `info@indigostudio.cz`     | `indigostudio.cz@gmail.com`   |
   | `veronika@indigostudio.cz` | `veronika.hallerova@gmail.com`|
   | `daniel@indigostudio.cz`   | `hromada.dan@gmail.com`       |
4. (Volitelně) **Catch-all** → `indigostudio.cz@gmail.com`, ať nic nezapadne.

**Odpovídání z gmailu vlastní adresou** (volitelné, aby odpověď chodila z `@indigostudio.cz`):
Gmail → Nastavení → Účty → „Odeslat e-mail jako" → přidat adresu →
SMTP `smtp.gmail.com` nepůjde (forwarding není mailbox). Pro odesílání z
`@indigostudio.cz` je potřeba reálná SMTP schránka (např. přes poskytovatele),
nebo se odpovídá z gmailu napřímo. Pro vizitku stačí příjem přes forwarding.

## Záloha původního projektu

Repo dřív obsahovalo projekt **fakan**. Je zazálohovaný:
- větev `archive/fakan`
- tag `archive-fakan-2026-06-02`
