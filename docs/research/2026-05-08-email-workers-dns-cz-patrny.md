# Research: Cloudflare Email Workers + DNS fakan.cz + CZ patička obchodního mailu

**Datum:** 2026-05-08
**Pro:** architect, junior-developer (iterace landing-v2)
**Stav:** podklady, ne rozhodnutí

---

## 0. CRITICAL FLAG — dvě různé Cloudflare služby, snadno se zamění

V Cloudflare ekosystému dnes (2026-05-08) existují **dvě překrývající se cesty**, jak poslat mail z Workeru. Architect by měl explicitně zvolit kterou:

| | **Email Routing — `send_email` binding** (legacy) | **Email Service — Email Sending** (nová) |
|---|---|---|
| Docs | `developers.cloudflare.com/email-routing/email-workers/send-email-workers/` | `developers.cloudflare.com/email-service/` |
| Status | Stabilní, produkční | **Beta** od 2025-11 (oznámeno Birthday Week 09/2025) |
| Cena | Zdarma | 3 000 mailů/měsíc free, dál **$0.35 / 1 000 mailů** |
| Plán | Funguje na Workers Free i Paid | **Workers Paid only** |
| Příjemci | Pouze **verified addresses** v Email Routing daného účtu | Verified při setupu, na paid plánu pak libovolný příjemce |
| Daily limit | „per-account, may vary" — bez konkrétního čísla v docs | „per-account, may vary" — bez konkrétního čísla v docs |

**ADR-001 v repu rozhoduje pro „Cloudflare Email Workers" generikou — neřeší tento split.** Junior bez ujasnění může lehko zvolit špatnou variantu. Otevřená otázka pro architecta.

---

## 1. Cloudflare Email Workers `send_email` binding — současná specifikace

### 1.1 wrangler.toml — přesný snippet

Z `developers.cloudflare.com/email-routing/email-workers/send-email-workers/`:

```toml
[[send_email]]
name = "<NAME_FOR_BINDING>"
destination_address = "<YOUR_EMAIL>@example.com"
```

Atributy (volitelné):
- bez atributu = unrestricted sending (jen na verified)
- `destination_address = "..."` — vázáno na konkrétní adresu
- `allowed_destination_addresses = [...]` — allowlist

Pro lokální vývoj (Email Service): `remote = true` pošle skutečně, jinak emulace do konzole.

### 1.2 API call — env.SEB.send()

```javascript
import { EmailMessage } from "cloudflare:email";
import { createMimeMessage } from "mimetext";

const msg = createMimeMessage();
msg.setSender({ name: "Sender", addr: "<SENDER>@example.com" });
msg.setRecipient("<RECIPIENT>@example.com");
msg.setSubject("An email generated in a worker");
msg.addMessage({
  contentType: "text/plain",
  data: `Congratulations, you just sent an email from a worker.`,
});

var message = new EmailMessage(
  "<SENDER>@example.com",
  "<RECIPIENT>@example.com",
  msg.asRaw(),
);
await env.SEB.send(message);
```

- `EmailMessage` z `cloudflare:email` (built-in, ne npm)
- `mimetext` je npm balíček pro MIME — `mimetext` je doporučovaná knihovna (~5 kB, MIT, údržba aktivní — last commit nedohledáno)
- Třetí parametr je raw RFC 5322 string

### 1.3 Verifikace odesílací domény

- **SPF** (povinné pro doručitelnost): `v=spf1 include:_spf.mx.cloudflare.net ~all` — toto je aktuální forma podle `email-routing/postmaster/`
- **DKIM** — Cloudflare podepisuje **automaticky**, selektor `cf2024-1`. Veřejný klíč queryje DNS na `cf2024-1._domainkey.<domain>`. Cloudflare ho přidá při zapnutí Email Routing.
- **DMARC** — volitelné, doporučené. Restriktivní DMARC může komplikovat forwarding; pro odchozí je v pohodě.
- **MX** — Cloudflare automaticky přidá tři MX (`route1/2/3.mx.cloudflare.net`) když zapneš Email Routing.
- **Verifikační proces** — v Cloudflare dashboard → Email → Email Routing → enable. Pak je třeba přidat alespoň jednu verified destination address (přijde verification mail s linkem). Bez toho `send_email` binding nefunguje.

### 1.4 Quota / rate limit

Cloudflare docs (`email-service/platform/limits/`) říkají doslova:

> „Daily sending limits are applied on a per-account basis, may vary, and may be adjusted over time based on your sending behavior."

**Žádné konkrétní číslo není v docs.** Pro increase je „Limit Increase Request Form".

### 1.5 Cena

- **Email Routing send_email binding** — zdarma (legacy, na free i paid plánu)
- **Email Service Email Sending** — 3 000/měsíc free, dál **$0.35 / 1 000 mailů**, jen na Workers Paid

### 1.6 Tvrdá omezení (z `email-service/platform/limits/`)

| Parametr | Limit |
|---|---|
| Velikost zprávy (standard) | **5 MiB** |
| Velikost zprávy (verified addresses) | **25 MiB** |
| Příjemci na 1 send (to+cc+bcc dohromady) | **50** |
| Délka subjectu | **998 znaků** |
| Custom hlavičky (součet) | **16 KB** |
| Worker CPU per request | **50 ms** |
| Subrequests per request | **50** |

Email Routing samostatně: zpráva max **25 MiB**, max **200 routing rules**, max **200 routing addresses**.

### 1.7 Fallback / error handling

Cloudflare docs **nedokumentují konkrétní chybové kódy** pro:
- unverified domain
- quota exceeded
- recipient bounce

→ Junior bude muset chyby logovat a empiricky zmapovat. **Zbylá otevřená otázka.**

### 1.8 Plain-text twin v multipart

Docs explicitně **nepředepisují**, ale příklad používá `text/plain`. `mimetext` umí oboje — junior by měl posílat multipart (text + html), je to standardní best practice pro deliverability (viz Postmaster guidelines obecně, ne specificky Cloudflare).

---

## 2. Stav DNS fakan.cz (live lookup přes Google DoH, 2026-05-08)

**Pozn.:** WebFetch neumí nastavit `accept: application/dns-json` pro Cloudflare DoH (vrací 400). Použit Google DoH (`dns.google/resolve`).

### 2.1 MX records

```
fakan.cz. 300 IN MX 31 route3.mx.cloudflare.net.
fakan.cz. 300 IN MX 50 route2.mx.cloudflare.net.
fakan.cz. 300 IN MX 76 route1.mx.cloudflare.net.
```

→ **Email Routing je už zapnuté** na fakan.cz. Tři standardní MX záznamy Cloudflare.

### 2.2 TXT records (root)

```
fakan.cz. 300 IN TXT "v=spf1 include:_spf.mx.cloudflare.net ~all"
fakan.cz. 300 IN TXT "YOU FOUND THE SECRET! Congrats, you curious nerd :) -> https://youtu.be/dQw4w9WgXcQ"
```

→ **SPF v aktuální Cloudflare formě je nastavené.** ✓
→ Druhý TXT je rickroll (link na YouTube) — Fakanův easter egg. Není škodlivý, ale stojí za zmínku, ať to nikdo zbytečně neuklízí.

### 2.3 DMARC (`_dmarc.fakan.cz`)

```
NXDOMAIN / NoData — žádný TXT záznam, jen SOA pro fakan.cz
```

→ **DMARC chybí.** Doporučení Cloudflare: implementovat. Junior to může (po schválení architectem) přidat, např. `v=DMARC1; p=none; rua=mailto:...` jako start.

### 2.4 DKIM `cf2024-1._domainkey.fakan.cz`

```
v=DKIM1; h=sha256; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA
iweykoi+o48IOGuP7GR3X0MOExCUDY/BCRHoWBnh3rChl7WhdyCxW3jgq1daEjPPqoi7sJv
dg5hEQVsgVRQP4DcnQDVjGMbASQtrY4WmB1VebF+RPJB2ECPsEDTpeiI5ZyUAwJaVX7r6bz
nU67g7LvFq35yIo4sdlmtZGV+i0H4cpYH9+3JJ78km4KXwaf9xUJCWF6nxeD+qG6Fyruw1Q
lbds2r85U9dkNDVAS3gioCvELryh1TxKGiVTkg4wqHTyHfWsp7KD3WQHYJn0RyfJJu6YEmL
77zonn7p2SRMvTMP3ZEXibnC9gz3nnhR6wcYL8Q7zXypKTMD58bTixDSJwIDAQAB
```

→ **DKIM je aktivní**, public key je v DNS, RSA 2048bit, sha256. ✓

### 2.5 DKIM `default._domainkey.fakan.cz`

```
NoData — žádný záznam
```

→ Cloudflare nepoužívá selektor `default`, používá `cf2024-1`. Tohle je očekávané chování.

### 2.6 Souhrn DNS

| Záznam | Stav | Poznámka |
|---|---|---|
| MX | ✓ | Email Routing aktivní |
| SPF | ✓ | aktuální Cloudflare forma |
| DKIM (`cf2024-1`) | ✓ | autopodpis aktivní |
| DMARC | ✗ | chybí, k doplnění |
| Easter egg TXT | i | rickroll, nešahat |

**Junior nemusí nic přidávat pro ZÁKLADNÍ outbound** — SPF + DKIM + MX jsou už v pořádku. DMARC je „nice to have", architect rozhodne, jestli teď nebo později.

---

## 3. CZ patička obchodního mailu — minima

**Právní základ:** § 435 zákona č. 89/2012 Sb. (NOZ) + § 7 zákona č. 90/2012 Sb. (ZOK) pro korporace.

**Co § 435 NOZ vyžaduje na obchodních listinách (e-mail je obchodní listina):**

| Subjekt | Povinné minimum |
|---|---|
| **s.r.o. / a.s. (zápis v OR)** | jméno (název firmy), sídlo, IČO, **údaj o zápisu v OR včetně spisové značky (oddíl a vložka)** |
| **OSVČ zapsaná v ŽR** | jméno a příjmení, sídlo / místo podnikání, IČO, **údaj o zápisu v živnostenském rejstříku** |
| **OSVČ nezapsaná v žádném veřejném rejstříku** | jméno a příjmení, sídlo, IČO (pokud přiděleno), údaj o zápisu „v jiné evidenci" |

- **DIČ** — § 435 NOZ ho jako povinný **nejmenuje**. Plátce DPH ho ale vede ve faktuře (§ 29 ZDPH). V mailu je „dobré mít", ne přísně povinné.
- **Sankce za chybějící údaje:** přestupek až **50 000 Kč** + zákaz činnosti do 1 roku, rejstříkový soud navíc až **100 000 Kč**.
- **Zákon č. 480/2004 Sb.** (komerční komunikace) — pokud jde o newsletter / nevyžádané obchodní sdělení, přidává se identifikace odesílatele a možnost odhlášení. Pro reaktivní mail (potvrzení poptávky atd.) tohle neplatí, ale dobré mít to v hlavě pro budoucí broadcast.

**Vzorová formulace pro Fakanovu pravděpodobnou situaci** (Daniel Hromada — OSVČ, IČO 00000000, ŽR):

```
Daniel Hromada (Fakan), [adresa sídla], IČO: 00000000.
Zapsáno v živnostenském rejstříku.
```

→ Konkrétní IČO a sídlo si Fakan musí doplnit sám — nebylo dohledáno (research nemá ARES query).

---

## 4. Reference

- [Cloudflare — Send emails from Workers](https://developers.cloudflare.com/email-routing/email-workers/send-email-workers/) — primární dokumentace `send_email` bindingu
- [Cloudflare — Email Routing Postmaster](https://developers.cloudflare.com/email-routing/postmaster/) — SPF/DKIM/DMARC, infra
- [Cloudflare — Email Routing Limits](https://developers.cloudflare.com/email-routing/limits/) — 25 MiB, 200 rules
- [Cloudflare — Email Service Limits](https://developers.cloudflare.com/email-service/platform/limits/) — 5/25 MiB, 50 příjemců, 998 chars subject
- [Cloudflare — Email Service Pricing](https://developers.cloudflare.com/email-service/platform/pricing/) — 3 000 free, $0.35/1k
- [Cloudflare blog — Email Service private beta announcement](https://blog.cloudflare.com/email-service/) — Birthday Week 09/2025
- [InfoQ — Cloudflare Email Service vs SES/Resend/SendGrid](https://www.infoq.com/news/2025/10/cloudflare-email-service/) — kontext, 2025-10
- [HSP & Partners — povinnosti na obchodních listinách](https://www.akhsp.cz/novinky/povinnosti-souvisejici-s-podnikanim-informace-uvadene-na-obchodnich-listinach) — § 435 NOZ
- [Holec, Dudák, Bartůňková — povinné údaje s.r.o.](https://www.holec-advokati.cz/cs/povinnosti-ve-vztahu-k-obchodnim-listinam-a-internetovym-strankam-spolecnosti-2/) — sankce

---

## 5. Zbylé otevřené otázky

1. **Email Routing `send_email` vs. Email Service Email Sending** — ADR-001 to neřeší, architect musí vybrat. Pro 100–500 leadů/měsíc je legacy varianta (free, stabilní) levnější; pro broadcast nebo škálu je nová Email Service vhodnější (placená, ale produkčně designovaná).
2. **Konkrétní daily quota Cloudflare** — docs neuvádí číslo. Mám flag, že Cloudflare to dynamicky upravuje per-account; pro produkční launch by se mělo empiricky otestovat nebo poslat Limit Increase Request preventivně.
3. **Konkrétní error kódy** ze `send_email` API (unverified, quota, bounce) — docs nemají, junior by měl logovat a zmapovat.
4. **`mimetext` last commit a údržba** — nedohledal jsem (potřeboval bych přístup na npmjs.com / GitHub). Architect před schválením dependence nechť ověří.
5. **Konkrétní IČO a adresa Fakana** — pro patičku — z research není přístupné, doplní owner.
6. **Easter egg TXT na fakan.cz** (rickroll) — informativní, není to bezpečnostní problém, ale architect ať ví.
