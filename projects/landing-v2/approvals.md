# Approvals — landing-v2

Záznam schvalovacích rozhodnutí ownera. Jeden řádek = jeden milník.

Formát: **`[YYYY-MM-DD] [milník] [verdikt] důvod / poznámka`**

Verdikty:
- `OK, beru.` — schváleno, fakturujte
- `Tohle ne, protože X.` — vrácení s odůvodněním
- `Co tohle?` — dotaz, čeká na odpověď

---

## Záznam

- [2026-05-08] [delivery] OK, beru. Detail v sekci níže.

---

## Delivery approval — 2026-05-08

**Owner:** AI agent (owner virtuální)
**Verdikt:** OK, beru. Jdeme do produkce po dodání 4 hodnot z dashboardu.

Přečetl jsem delivery, decisions log i původní brief. Tým dodal to, co jsem chtěl: vykání všude, čitelný copy pro instalatéra z Klatov, lead capture funguje end-to-end, mailové texty existují, Privacy Policy je hotová. Zelená.

### Tagline
- Schvaluji „Váš web. Bez starostí." (varianta A) — důvod: sedí cílovce 40+, kde „starosti" je slovo, které ten člověk fakt používá u kafe. „Bez výmluv." byl můj vzor pro mladší pivní cílovku, ale tu nemám — tu si vymyslel marketér v hlavě. Varianty B a C nejsou špatné, ale A je nejmíň vykutálená a nejvíc důvěryhodná. Nehraju si na slogany — drží to týden, půjde to ven.

### Retence 12 měsíců
- Schvaluji s retro 6m gate — důvod: 12 měsíců je dost na to, abych viděl, jestli mi z lead capture něco vyleze. Když se v retru ukáže, že nákupní cyklus je 9–12 měsíců a lidi dozrávají později, prodloužíme na 24m. Datová minimalizace dnes = žádná páka pro ÚOOÚ a žádná zbytečná díra při ransomwaru. Legal+marketer to mají dobře.

### Email Workers (legacy)
- Schvaluji — důvod: free, stabilní, ADR-001 to dokumentuje. Kdy bych šel na Email Service paid beta: až budeme posílat víc než 100 mailů/den a budeme potřebovat víc procesorů (např. transakční mail z plateb). Teď to není. Bootstrap fáze = co je zdarma a funguje, vyhrává.

### Patička obchodního mailu
- Schvaluji — důvod: Indigo Studio s.r.o., IČO 14389096, MSPH C 364981, Chudenická 1059/30 Praha — to je má firma, čísla jsou správná, researcher to vytáhl z ARESu. § 435 NOZ chce identifikaci a tady je. Já se v paragrafech neorientuju, ale legal i marketer kývli a researcher dohledal aktuální zápis (po přesunu z Plzně zpět). Beru.

### Scope changes vs. brief
- **Souhlasím s kompletním redesignem copy.** V Gate 1 jsem řekl „kompletní redesign" — drží se slovo. „Tvůj web. Bez výmluv." byl můj sentimentální vzor, ale 40+ instalatér ho nečte. Konec sentimentu.
- **Souhlasím s odložením DMARC + UTM whitelist + magic-link auth do retra** — důvod: deliverability funguje bez DMARC (Gmail/Outlook to projde), magic link auth je samostatná zakázka co ještě nezačala, UTM whitelist není launch blokátor (referrer si vystačí pro první měsíc). Nechci přebabrat scope kvůli „když už děláme tohle, tak ještě tohle". To je cesta do pekel přes 3 týdny zpoždění.
- **Akceptuji přestřel agent-času 19 % (~56 h vs. 36–47 h)** — důvod: runtime je nula, externí cash neteče, jen agenti si tikali víc. Bylo to z opravných kruhů (6 fix commitů po review/testu) — to chci. Lepší 6 oprav před launchem než 6 reklamací po launchi. Pro příští iteraci ať PM počítá s bufferem +20 %, jak finance navrhuje.
- **`scripts/audit-url.sh`** — junior si udělal Lighthouse helper. Nevadí mi, že vznikl. Commitněte ho do repa s krátkým README řádkem („lokální helper, není v deploy pipeline"). Ať to ostatní agenti vidí a používají, ne aby si každý psal vlastní. Smazat by byla škoda.

### Deploy
- Já dodám 4 hodnoty (D1 ID, KV ID, CONSENT_SALT, CF Web Analytics token) — kdy: **D-1, tedy 2026-05-14 dopoledne**. Termín 2026-05-15 drží, proběhne to v půl hodinky v dashboardu. Pošlu PM zprávu, až bude všechno nastaveno.
- Po dodání týmu dám pokyn `git commit -am "chore: produkční ID + secrets nasazené" && wrangler deploy`. Migrace D1 (`wrangler d1 execute fakan_leads --file=./migrations/0001_leads.sql --remote`) běží hned po deployi.
- Smoke test si pojedu sám: poptávka přes formulář z `jsem@fakan.cz` na `https://fakan.cz`, zkontroluju D1 řádek a inbox follow-up. Pokud něco nesedí, vracím PM.

### Otázky orchestrátorovi (eskalace na živého Fakana)
- **Žádná blokující otázka.** Všech 6 bodů z delivery reportu jsem schválil výše bez výhrad.
- Jediná věc, kterou bych dal živému Fakanovi na vědomí (ne jako otázku, jen jako info): **Cloudflare Web Analytics zapínáme** — drží to mantinely (cookieless), ale pokud by Fakan reálně řekl „nechci ani tohle, chci jen Worker logs", tak to vypneme. Default ano.

---

**Status iterace landing-v2:** SCHVÁLENO. Postupuje do Fáze 6 — retro (finance skutečný cost report + product-manager learnings + standardy update).
