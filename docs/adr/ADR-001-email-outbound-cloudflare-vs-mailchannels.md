# ADR-001: Outbound mail přes Cloudflare Email Workers (ne MailChannels)

**Status:** accepted
**Datum:** 2026-05-08
**Kontext iterace:** [`projects/landing-v2/`](../../projects/landing-v2/)
**Rozhodli:** owner (Fakan) + legal-advisor + senior-architect, Gate 1 iterace `landing-v2`

---

## Kontext

Landing v2 přidává lead capture flow. Po dokončení free analýzy se má uživateli odeslat follow-up mail s výsledky a nabídkou. K tomu potřebujeme outbound SMTP / API z Workeru.

Stack mantinely (CLAUDE.md sekce 2): Cloudflare end-to-end, žádný third-party SaaS, kde to umí Cloudflare nativně.

V scope je minimálně:
- `lead-followup` (lead capture, transactional)
- `optout-confirmation` (po kliku na opt-out)
- `magic-link-auth` (na sklad pro budoucí auth flow)
- volitelně `soft-doi` (DOI šablona na sklad)

Provoz odhad: 5–20 mailů/den v MVP, růst po launch. Žádný bulk newsletter v scope.

---

## Možnosti

### A) MailChannels

- **Plus:** historicky free pro Cloudflare Workers, hodně dokumentace, široké nasazení v komunitě.
- **Minus:** MailChannels v 2024 změnil politiku — pro non-Cloudflare zákazníky placený plán, pro CF zákazníky stále free, ale pravidla se mohou kdykoliv změnit znovu. Druhý procesor v DPA řetězci.

### B) Cloudflare Email Workers (binding `send_email`)

- **Plus:** nativní binding, jeden procesor (Cloudflare), součást Cloudflare DPA. Nulová cena pro běžný objem. Žádný extra DNS setup nad rámec Email Routing, který Cloudflare už spravuje pro inbound `jsem@fakan.cz`.
- **Minus:** méně public dokumentace a community příkladů než MailChannels. Bez fallbacku — když Cloudflare výpadek, nic neodejde.

### C) Resend / Postmark / Mailgun (placené API)

- **Plus:** profesionální deliverability, dashboardy, bounce handling, šablonový engine.
- **Minus:** placené (~20 USD/měs base i pro nízký objem), další vendor v DPA, port mimo Cloudflare ekosystém. Pro MVP overkill.

---

## Rozhodnutí

**Cloudflare Email Workers** (option B).

---

## Důvody

1. **Compliance — menší DPA povrch.** legal-advisor v risk-checku § 2.5 explicitně preferuje jeden procesor místo dvou. Privacy Policy se zjednodušuje (Cloudflare jako jediný subdodavatel).
2. **Cost — runtime ≈ 0 USD.** Forecast iterace stojí na nule. MailChannels by taky nestál nic, ale Resend/Postmark by stál ~20 USD/měs base.
3. **Stack alignment.** CLAUDE.md sekce 2: „Cloudflare end-to-end". Email Workers binding je nativní cesta, ne vendor lock na 3rd party.
4. **Risk MailChannels policy change.** Druhá změna politiky během 18 měsíců je možná, lock-in na tuhle závislost je nepříjemný.
5. **Owner potvrdil v Gate 1** (decisions.md, 2026-05-08).

---

## Trade-offy a risky

- **Méně dokumentace.** Potřebujeme vlastní mini-MIME builder místo `mimetext` npm balíku (CLAUDE.md zakazuje npm závislosti bez schválení senior-architecta). Researcher má za úkol ověřit aktuální syntaxi `[[send_email]]` v `wrangler.toml`.
- **Žádný fallback.** Pokud Email Workers chcípne při velkém Cloudflare výpadku, mail neodejde. Pro MVP akceptováno (5–20 mailů/den, ztráta = manuální follow-up Fakanem). Backlog: alerting na bounce rate.
- **Quota neznámá.** Cloudflare neuvádí přesný rate limit pro outbound. Pokud někdy překročíme, fallback na placený provider (option C) je nutná samostatná iterace.
- **Cold start latence při prvním sendu.** Worker `waitUntil` má 30s strop, mělo by stačit.

---

## Důsledky pro implementaci

- `wrangler.toml`: nový `[[send_email]]` binding s názvem `EMAIL`.
- DNS verifikace `fakan.cz` (SPF, DKIM, DMARC) — pravděpodobně už nastaveno z inbound Email Routing, researcher potvrdí.
- `src/lib/mime.js`: vlastní mini-MIME builder, ne npm balík.
- `src/lib/mail.js`: wrapper s retry policy (1× retry, pak `status='bounced'`).
- `src/email/templates/*.js`: 4 šablony (HTML + ručně psaný plain-text twin per šablona).
- Adresy odesílatele: `nabidky@fakan.cz` (transactional + marketing), `prihlaseni@fakan.cz` (login, transactional), `Reply-To: jsem@fakan.cz`.

---

## Alternativy do budoucna

- Pokud objem stoupne nad 100 mailů/den nebo dorazí newsletter feature, znovu zhodnotit option C (Resend).
- Pokud Cloudflare Email Workers omezí free tier nebo zavede placený plán nad nízký objem, vrátit se k MailChannels nebo přejít přímo na Resend.

Tohle ADR znovu otevřeme, pokud:
- bounce rate dlouhodobě > 5 %,
- Cloudflare quota nás blokuje,
- legal změní pohled na DPA řetězec.
