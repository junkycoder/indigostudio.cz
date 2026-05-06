# Plugin Spec — fakan.cz

**Detailní specifikace plugin systému**
Verze 0.8 · doplněk PRD v0.9 · vlastník: Fakan

> Změny od v0.7 (zapracovaný feedback v0.2):
> - **Cross-plugin events finalizovány** — povinný namespace `plugin-id:event-name`. Subscriber musí mít deklarováno `required_events` v `plugin.json`. (řeší open question 13.3)
> - **Storage migrace breaking changes** — kernel snapshot → migrace → rollback při selhání. (řeší open question 13.4)
> - **`ui:editor:widget` finalizováno** — fáze 1–6 jen System Plugins (od nás). Externí partneři až ve fázi 7+ a pouze po **manual security review** (Verified Partner tier). (řeší open question 13.2)
> - Doplněn `required_events` field v manifest příkladu.
> - Sekce 4.4 (Update lifecycle) rozšířena o snapshot/rollback flow.

> Tento dokument popisuje, jak se píše plugin pro fakan.cz, co všechno musí obsahovat, jak komunikuje s kernelem, jak je sandboxován, jak prochází review.
> Pro vývojáře externí (fáze 6+) bude zveřejněn jako součást dev portalu na `fakan.cz/dev/docs`.

---

## 1. Co je plugin

Plugin je **samostatná instalovatelná jednotka funkce**, která rozšiřuje schopnosti webu zákazníka nebo Velínu. Příklady: SEO audit, fulltext search, komentáře, GEO optimalizace, integrace s Mailchimp.

Plugin **běží v izolovaném Worker isolate**, má scoped přístup ke storage, deklarované permissions a definovaný lifecycle.

**Pluginy nejsou témata, komponenty ani šablony.** Ty jsou **artefakty** v marketplace s vlastním (jednodušším) formátem.

---

## 2. Plugin manifest — `plugin.json`

Povinný soubor v rootu plugin repa. Validovaný kernelem při submission, instalaci, update.

### 2.1 Kompletní příklad

```json
{
  "id": "fakan-plugin-comments",
  "version": "1.4.2",
  "name": "Komentáře",
  "name_en": "Comments",
  "description": "Komentáře a recenze přímo na webu, bez cookies, s moderací.",
  "description_long_md": "docs/description.md",
  "icon": "assets/icon.svg",
  "screenshots": [
    "assets/screenshot-1.png",
    "assets/screenshot-2.png"
  ],

  "author": {
    "name": "fakan.cz",
    "type": "official",
    "contact": "fakan@fakan.cz",
    "url": "https://fakan.cz",
    "dev_account_id": null
  },

  "license": "proprietary",
  "license_url": "https://fakan.cz/legal/plugin-license-official",

  "kernel_version": "^1.0",
  "category": "interaction",
  "tags": ["komentáře", "moderace", "recenze", "interakce"],
  "vertical_hints": ["blog", "restaurace", "ordinace", "ecommerce"],

  "permissions": [
    "storage:read:comments",
    "storage:write:comments",
    "events:emit:comment.new",
    "events:emit:comment.approved",
    "events:emit:comment.spam",
    "events:subscribe:form.submit",
    "ui:velin:section",
    "ui:web:component:fakan-comments",
    "ai:moderate"
  ],

  "dependencies": {
    "fakan-plugin-forms": "^1.0",
    "fakan-plugin-notifications": "^1.0"
  },

  "required_events": [
    "fakan-plugin-forms:form.submit"
  ],

  "storage": {
    "tables": [
      { "name": "comments", "schema": "schemas/comments.sql" },
      { "name": "reactions", "schema": "schemas/reactions.sql" }
    ],
    "kv_namespaces": ["comment_cache"],
    "r2_buckets": []
  },

  "ui": {
    "velin_sections": [
      {
        "id": "moderation",
        "title": "Moderace komentářů",
        "icon": "💬",
        "route": "/comments/moderation",
        "permissions": ["editor", "owner"],
        "bundle": "dist/velin-moderation.js"
      },
      {
        "id": "settings",
        "title": "Nastavení komentářů",
        "icon": "⚙️",
        "route": "/comments/settings",
        "permissions": ["owner"],
        "bundle": "dist/velin-settings.js"
      }
    ],
    "web_components": [
      {
        "tag": "fakan-comments",
        "bundle": "dist/fakan-comments.js",
        "size_gzip_max_bytes": 5120,
        "props": [
          { "name": "page-id", "type": "string", "required": true },
          { "name": "moderation", "type": "string", "default": "pre", "enum": ["pre", "post", "auto"] },
          { "name": "anonymous", "type": "boolean", "default": false }
        ]
      }
    ],
    "editor_widgets": []
  },

  "api": {
    "endpoints": [
      {
        "method": "POST",
        "path": "/api/plugin-comments/submit",
        "handler": "src/api/submit.ts",
        "rate_limit": "10/min/ip",
        "auth": "anon"
      },
      {
        "method": "GET",
        "path": "/api/plugin-comments/list",
        "handler": "src/api/list.ts",
        "rate_limit": "60/min/ip",
        "auth": "anon"
      },
      {
        "method": "POST",
        "path": "/api/plugin-comments/moderate",
        "handler": "src/api/moderate.ts",
        "rate_limit": "100/min/user",
        "auth": "owner|editor"
      }
    ]
  },

  "events": {
    "emit": [
      { "name": "comment.new", "schema": "schemas/event-comment-new.json" },
      { "name": "comment.approved", "schema": "schemas/event-comment-approved.json" },
      { "name": "comment.spam", "schema": "schemas/event-comment-spam.json" }
    ],
    "subscribe": [
      { "name": "form.submit", "handler": "src/events/on-form-submit.ts" }
    ]
  },

  "cron": [
    { "schedule": "0 3 * * *", "handler": "src/cron/cleanup-spam.ts" }
  ],

  "i18n": {
    "default_locale": "cs",
    "available_locales": ["cs", "en", "sk"],
    "files": {
      "cs": "i18n/cs.json",
      "en": "i18n/en.json",
      "sk": "i18n/sk.json"
    }
  },

  "config_schema": "schemas/config.json",

  "pricing": {
    "model": "subscription",
    "monthly_czk": 49,
    "yearly_czk": 490,
    "free_in_tiers": ["standard", "pro"],
    "free_trial_days": 14
  },

  "compatibility": {
    "min_kernel": "1.0",
    "max_kernel": null,
    "platforms": ["web", "chrome_ext", "pwa", "mobile"]
  },

  "support": {
    "url": "https://fakan.cz/dev/comments",
    "issue_tracker": "https://fakan.cz/dev/comments/issues",
    "email": "fakan@fakan.cz",
    "sla_response_hours": 24
  }
}
```

### 2.2 Povinná pole

`id`, `version`, `name`, `description`, `author`, `license`, `kernel_version`, `category`, `permissions`, `compatibility`.

Vše ostatní je volitelné, ale chybějící pole snižují trust score a kvalitu listing.

### 2.3 ID konvence

- Formát: `fakan-plugin-{slug}` pro oficiální, `{author-slug}-plugin-{slug}` pro partnerské.
- Lowercase, ASCII, dash-separated, max 60 znaků.
- Globálně unikátní v marketplace.

### 2.4 Verzování

- **Semver striktně.** `major.minor.patch`.
- Major bump = breaking change → vyžaduje **explicit confirm zákazníka** při update.
- Minor = new feature, backward compat.
- Patch = bugfix, auto-update povolen (zákazník může v Velíně vypnout).

---

## 3. Permissions katalog

### 3.1 Storage

| Permission | Co povoluje |
|-----------|-------------|
| `storage:read:{table}` | Čtení vlastní D1 tabulky |
| `storage:write:{table}` | Zápis vlastní D1 tabulky |
| `storage:read:other:{plugin}:{table}` | Čtení tabulky jiného pluginu (vyžaduje `storage:share:read` u druhého pluginu) |
| `storage:share:read:{table}:to:{plugin}` | Sdílení vlastní tabulky pro čtení jinému pluginu |
| `kv:{namespace}` | Plný přístup k vlastnímu KV namespace |
| `r2:{bucket}` | Plný přístup k vlastnímu R2 bucketu |

Cross-plugin storage access vyžaduje **deklarovaný handshake** v obou manifestech. Žádný plugin nemůže číst data jiného pluginu bez jeho souhlasu.

### 3.2 Eventy

| Permission | Co povoluje |
|-----------|-------------|
| `events:emit:{event}` | Publikování eventu (musí být deklarovaný v `events.emit`) |
| `events:subscribe:{plugin-id}:{event}` | Odběr eventu konkrétního pluginu |

Eventy jsou per-tenant (zákazník), nikoli globální.

**Namespace** — každý event je identifikován dvojicí `{plugin-id}:{event-name}`. Plugin ID v manifestu (`fakan-plugin-comments`) tvoří první část, samotné jméno eventu druhou (`comment.new`). Plný identifikátor: `fakan-plugin-comments:comment.new`.

**Filtrování subscriberů** — kernel kontroluje při registraci subscriberu, že subscribující plugin má v `plugin.json` deklarováno odebíraný event v poli `required_events`:

```json
"required_events": [
  "fakan-plugin-comments:comment.new",
  "fakan-plugin-forms:*"
]
```

- Konkrétní událost: `plugin-id:event-name`.
- Wildcard pro všechny eventy daného pluginu: `plugin-id:*`.
- Globální wildcard zakázán.

Pokud subscriber nemá deklarovaný event v `required_events`, kernel registraci odmítne při instalaci a plugin se nenainstaluje.

### 3.3 UI

| Permission | Co povoluje |
|-----------|-------------|
| `ui:velin:section` | Vlastní sekce ve Velíně (max 3 per plugin) |
| `ui:web:component:{tag}` | Web component pro web zákazníka |
| `ui:editor:widget` | Field editor v editoru — viz pravidla níže |
| `ui:notification:custom_action` | Vlastní action button v notifikaci |

UI permissions jsou striktně reviewed kvůli XSS a UX impact.

**`ui:editor:widget` — tier pravidla** (finalizováno feedbackem v0.2):

| Fáze | Komu povoleno | Podmínky |
|------|----------------|----------|
| Fáze 1–6 | **Pouze System Plugins** (oficiální, od nás) | Standardní review |
| Fáze 7+ | Verified Partner | Vyžaduje **manual security review** nad rámec běžné review (samostatný XSS/sandbox audit, payload fuzzing) |
| Fáze 7+ | Hobby / Community | **Zakázáno.** Pluginy bez verified KYC nemají přístup do editoru. |

**Důvod:** Editor widget běží přímo v inspector pipeline a má potenciálně přístup k DOM struktuře editovaného webu — XSS riziko je vysoké. Sandbox přes Shadow DOM stačí pro Velín sekce, ale ne pro editor field interakce.

### 3.4 AI

| Permission | Co povoluje |
|-----------|-------------|
| `ai:generate` | Generování textu (kernel routing dle BYO AI nebo naše API) |
| `ai:embed` | Embeddings |
| `ai:moderate` | Moderace obsahu (toxicity, spam) |
| `ai:vision` | Image-to-text (alt text, OCR) |

Plugin nemá vlastní AI klíče. Vše routuje kernel — zákazníkův BYO klíč nebo naše defaultní s kvótou. Plugin platí AI cost ze svého „revenue share" pro placené pluginy, nebo ze zákazníkovy AI kvóty.

### 3.5 External

| Permission | Co povoluje |
|-----------|-------------|
| `external:fetch:{domain}` | Fetch konkrétního externího domain (whitelist v manifestu) |
| `external:webhook:incoming` | Příjem webhooků z externí služby |

Žádný plugin nemůže fetchovat libovolnou URL. Whitelist domain v manifestu, kernel enforce-uje.

### 3.6 Payment

| Permission | Co povoluje |
|-----------|-------------|
| `payment:create_charge` | Vytvořit platbu (jen pluginy provozující e-commerce funkce) |

Striktně reviewed, jen Verified Partner+.

### 3.7 Notifications

| Permission | Co povoluje |
|-----------|-------------|
| `notifications:emit:{type}` | Publikovat notifikaci do notifikačního centra |

Plugin musí registrovat své notification types v manifestu, aby zákazník měl per-typ preference.

---

## 4. Lifecycle

### 4.1 Install

```
[zákazník klikne „Instalovat" v marketplace]
        │
        ▼
[kernel: validate manifest verze + dependencies]
        │
        ▼
[kernel: check kompatibilita s existujícími pluginy]
        │
        ▼
[kernel: vytvořit storage schémata per web (D1 migration)]
        │
        ▼
[plugin lifecycle hook: onInstall(context)]
        │
        ▼
[kernel: zapsat do plugin_installations]
        │
        ▼
[stav: INSTALLED, ne-aktivní]
```

`onInstall(context)` může:
- Inicializovat default config.
- Vytvořit seed data (např. default kategorie pro komentáře).
- Volat external API pro pre-flight check (např. „máš platný Mailchimp API klíč?").

### 4.2 Configure

Zákazník v Velíně vyplní plugin-specifická pole. Forma definovaná `config_schema`.

```json
{
  "type": "object",
  "properties": {
    "moderator_email": { "type": "string", "format": "email", "title": "E-mail moderátora" },
    "moderation_mode": { "type": "string", "enum": ["pre", "post", "auto"], "default": "pre", "title": "Mód moderace" },
    "allow_anonymous": { "type": "boolean", "default": false, "title": "Povolit anonymní komentáře (jen jméno)" },
    "min_length": { "type": "integer", "minimum": 5, "default": 10, "title": "Minimální délka komentáře" }
  },
  "required": ["moderator_email"]
}
```

Velín vygeneruje formulář automaticky podle JSON Schema. Žádné manuální UI pro configure-only obrazovky.

### 4.3 Activate

```
[zákazník klikne „Aktivovat"]
        │
        ▼
[plugin: onActivate(context)]
        │
        ▼
[kernel: deploy plugin Worker isolate]
        │
        ▼
[kernel: register API endpointy v routeru]
        │
        ▼
[kernel: register event subscribers]
        │
        ▼
[kernel: register cron triggery]
        │
        ▼
[kernel: register Velín sekce a web komponenty]
        │
        ▼
[stav: ACTIVE]
```

### 4.4 Update

Major bump → notifikace zákazníkovi s changelogem → zákazník schválí / odloží. Patch a minor → auto-update default ON, lze v Velíně vypnout.

`onUpdate(context, fromVersion, toVersion)` může:
- Migrovat storage schéma.
- Notifikovat zákazníka o nových features.

#### 4.4.1 Storage migrace breaking changes

Pokud nová verze pluginu mění schéma D1 (přidává/odebírá sloupce, mění typy, mění indexy), kernel orchestruje **transakční migraci se snapshotem a automatickým rollbackem**:

```
[update spuštěn]
        │
        ▼
[1. kernel: snapshot aktuálních dat pluginu do R2 cold storage]
        │   (snapshot ID = sha256(plugin_id + site_id + timestamp))
        ▼
[2. kernel: deploy nový plugin Worker isolate (staging)]
        │
        ▼
[3. plugin: onUpdate() → spustí migrační skript ze schemas/migrations/{from}-{to}.sql]
        │
        ▼
[4. kernel: validace integrity (foreign keys, schema check, post-migration assertions)]
        │
        ▼
   ┌────┴────┐
   │ úspěch  │ selhání
   ▼         ▼
[5a. ACTIVE] [5b. ROLLBACK]
              │
              ▼
        [restore snapshotu z R2]
        [revert plugin Worker isolate na předchozí verzi]
        [zákazníkova notifikace „update se nepodařil, vrátili jsme to"]
        [autor pluginu dostane crash report]
```

**Pravidla:**
- Snapshot je povinný pro každý update s `migrations/` složkou v bundle.
- Snapshot retention: 14 dní v R2 cold storage.
- Plugin musí dodávat **idempotentní** migrační skripty — kernel je smí pustit opakovaně bez efektu.
- Kernel testuje migraci nejdřív na **shadow kopii** (staging tabulka). Až po úspěchu commit na produkci.
- Jakákoli neošetřená výjimka v `onUpdate` = automatický rollback.

**Co se považuje za breaking change** (vyžaduje major bump + tento flow):
- DROP COLUMN, ALTER COLUMN TYPE, drop INDEX nad pojmenovaným indexem.
- Změna `NOT NULL` constraint (přidání).
- Rename table / column.
- Změna primary key.

**Bezpečné změny** (minor/patch, lehčí flow bez snapshotu):
- ADD COLUMN s DEFAULT.
- Nový INDEX.
- Nová tabulka.

### 4.5 Deactivate

Plugin se zmrazí — endpointy 503, UI sekce zmizí, eventy ignorovány. **Data zůstávají.** Zákazník může reaktivovat kdykoli.

### 4.6 Uninstall

```
[zákazník klikne „Odinstalovat"]
        │
        ▼
[kernel: warning „data zmizí za 30 dní, exportovat?"]
        │
        ▼
[plugin: onUninstall(context)]
        │
        ▼
[kernel: zrušit subscriptions a billing]
        │
        ▼
[kernel: archive data do R2 cold storage (30 dní)]
        │
        ▼
[stav: UNINSTALLED]
        │
        ▼
[+30 dní: kernel: hard delete]
```

---

## 5. Plugin runtime API (kernel SDK)

Co plugin volá z kernelu (přes `@fakan/sdk`).

### 5.1 Storage

```typescript
import { storage } from '@fakan/sdk';

// D1 typed query builder
const comments = await storage.db('comments')
  .where({ site_id, status: 'approved' })
  .orderBy('created_at', 'desc')
  .limit(50);

await storage.db('comments').insert({
  id: crypto.randomUUID(),
  site_id,
  page_id,
  author_name,
  body,
  status: 'pending',
  created_at: Date.now()
});

// KV
await storage.kv('comment_cache').put(key, JSON.stringify(value), { expirationTtl: 300 });
const cached = await storage.kv('comment_cache').get(key);

// R2
await storage.r2('attachments').put(key, file);
```

### 5.2 Events

```typescript
import { events } from '@fakan/sdk';

// emit
await events.emit('comment.new', {
  comment_id: '...',
  site_id: '...',
  page_id: '...',
  author: '...'
});

// subscribe (v handleru)
events.on('form.submit', async (event) => {
  // ...
});
```

### 5.3 Notifikace

```typescript
import { notifications } from '@fakan/sdk';

await notifications.send({
  customer_id,
  type: 'comment.new',
  severity: 'important',
  title: 'Nový komentář k moderaci',
  body: `${author} napsal komentář k článku „${page_title}".`,
  action_url: `/comments/moderation/${comment_id}`,
  action_label: 'Schválit nebo smazat',
  context: { comment_id, page_id }
});
```

### 5.4 AI

```typescript
import { ai } from '@fakan/sdk';

// Kernel routuje na zákazníkův BYO klíč nebo náš default.
const moderation = await ai.moderate({
  text: comment.body,
  categories: ['spam', 'toxic', 'sexual'],
  threshold: 0.8
});

const summary = await ai.generate({
  prompt: `Shrň komentář v jedné větě: ${comment.body}`,
  model: 'claude-haiku-4-5',
  max_tokens: 100
});
```

### 5.5 i18n

```typescript
import { i18n } from '@fakan/sdk';

const t = i18n.t(context.locale);
const message = t('comment.new_pending', { author: 'Pavel' });
// → "Pavel napsal komentář, čeká na schválení."
```

### 5.6 Velín UI helpers

```typescript
import { velin } from '@fakan/sdk';

// Volá se v Velín sekce bundle (dist/velin-moderation.js)
velin.registerSection({
  id: 'moderation',
  render(container, context) {
    // Vanilla JS / web components.
    // container je Shadow DOM root.
  }
});
```

---

## 6. Sandboxing a izolace

### 6.1 Worker isolate per plugin

Každý plugin běží v separátním Cloudflare Workers isolate. Kernel orchestruje requests:

```
[request: fakan.cz/{host}/api/plugin-comments/submit]
        │
        ▼
[kernel router: identify plugin + permission check]
        │
        ▼
[kernel: invoke plugin Worker s scoped context]
        │
        ▼
[plugin Worker: zpracovat]
        │
        ▼
[plugin Worker: response → kernel → klient]
```

### 6.2 Storage isolation

D1 tabulky pluginu jsou ve **vlastním schémátu** (prefixované `plugin_{slug}_`). Kernel zajišťuje, že plugin Worker nemůže dotázat tabulky mimo svůj scope.

### 6.3 UI isolation

- Velín sekce běží v **Shadow DOM** — žádný cross-plugin styling/JS.
- Web komponenty na zákaznickém webu mají scoped CSS přes Custom Elements + Shadow DOM.
- CSP pro pluginy: `script-src 'self' 'nonce-{nonce}'`, `style-src 'self' 'unsafe-inline'`. Žádné inline scripty.

### 6.4 Resource limity

| Resource | Free tier (Hobby autor) | Pro tier autor | Studio+ |
|----------|-------------------------|----------------|---------|
| CPU ms/request | 50 | 100 | 200 |
| Memory MB/isolate | 128 | 128 | 256 |
| Requests/min/zákazník | 60 | 600 | 6000 |
| Storage MB/zákazník | 100 | 500 | 5000 |
| External fetch/min | 30 | 100 | 300 |

Kernel monitoruje, při překročení throttluje a notifikuje autora.

### 6.5 Anti-abuse

- Statická analýza submisí (semgrep + custom rules).
- Sandbox testy s networkem disabled na první run.
- Anomaly detection v runtime (sudden CPU spike, unusual fetch patterns).
- Při zjištění: auto-suspend pluginu, manuální triage, refund zákazníkům, dispute s autorem.

---

## 7. Submission flow

### 7.1 Příprava

Vývojář:
1. `fakan init my-plugin` — scaffolded template.
2. Vyvíjí lokálně (`fakan dev`).
3. Otestuje v sandboxu.
4. `fakan validate` — manifest + lint + permissions match.
5. `fakan submit` — upload bundle + manifest.

### 7.2 Automatický check (do 5 minut)

- Manifest valid (JSON Schema).
- Permissions deklarované odpovídají kódu (statická analýza).
- JS bundle velikost pod limitem.
- Žádné non-whitelist external fetches.
- Lint (no eval, no document.write, no innerHTML s nesanitized).
- Security scan (semgrep + custom rules pro Worker idiomy).
- License a description present.
- Screenshots v requested rozměrech.

Selhání → autor dostane report, fix, resubmit.

### 7.3 Lidská review

SLA podle dev tieru autora (Hobby 14 / Pro 7 / Studio 5 / Enterprise 3 dny).

Reviewer kontroluje:
- **Funkce** — odpovídá popisu? Funguje to, co tvrdí?
- **UX** — Velín sekce přehledná, web component konzistentní?
- **Bezpečnost** — XSS, data leaks, permission abuse?
- **Obchodní** — duplikuje něco existujícího? Cena přiměřená? Podvodný marketing?
- **Standardy** — splňuje sekci 6 PRD (cookies, mobile, a11y, …)?

Výsledek:
- ✅ **Schváleno** → marketplace listing (pro placené první 30 dní jako Beta).
- ✏️ **Změny vyžadovány** → konkrétní zpětná vazba, autor opraví.
- ❌ **Odmítnuto** → s důvodem. Autor může apelovat.

### 7.4 Beta období

Placené pluginy první 30 dní automaticky Beta tag → omezený rollout (max 50 instalací), sběr feedbacku, autor reaguje na issues. Po 30 dnech bez vážných problémů → standard listing.

### 7.5 Updates

- Patch verze (1.4.2 → 1.4.3) → automatický check, bez lidské review.
- Minor verze (1.4.x → 1.5.0) → automatický check, light review (1–2 dny).
- Major verze (1.x → 2.0) → full review jako nové submission.

---

## 8. Pricing modely

| Model | Popis | Příklad |
|-------|-------|---------|
| `free` | Zdarma, bez fee | Calc DPH |
| `one_time` | Jednorázová platba per instalace per web | Téma 990 Kč |
| `subscription` | Recurring monthly/yearly | Komentáře 49 Kč/měs |
| `usage` | Per-event nebo per-token | „Generátor menu" 5 Kč/vygenerování |
| `freemium` | Zdarma s limity, paid tier nad rámec | Analytics free 10k events, paid 99 Kč/měs nad |
| `bundled` | Zdarma v určitém hosting tieru | Search free v Standard/Pro, 49 Kč v Lite |

Plugin manifest musí přesně specifikovat. Změna pricing modelu = major version bump + zákazník musí confirm.

**Free trial** povolen do 30 dní. Po skončení automatický billing nebo deaktivace (autor volí).

---

## 9. Plugin templates a SDK CLI

### 9.1 Scaffolded templates

```bash
fakan init my-plugin --template=minimal
fakan init my-plugin --template=velin-section
fakan init my-plugin --template=web-component
fakan init my-plugin --template=integration  # external API
fakan init my-plugin --template=ai-agent
fakan init my-plugin --template=full         # vše dohromady
```

### 9.2 CLI příkazy

| Příkaz | Co dělá |
|--------|---------|
| `fakan init` | Scaffold |
| `fakan dev` | Lokální runtime + sandbox |
| `fakan validate` | Manifest + lint + permissions |
| `fakan test` | Run unit testů |
| `fakan build` | Production bundle |
| `fakan submit` | Upload + start review |
| `fakan release {version}` | Tag + submit nová verze |
| `fakan logs` | Production logs (po publish) |
| `fakan analytics` | Instalace, churn, revenue |

### 9.3 Sandbox specifika

- Mock D1 (SQLite lokálně).
- Mock KV / R2 (filesystem).
- Mock AI (předdefinované odpovědi pro test, nebo volá náš proxy s omezenou kvótou).
- Mock zákazníci, weby, manifesty pro test.
- Velín sekce + web komponenty renderované v `localhost:8787`.

---

## 10. Příklady pluginů (skeleton)

### 10.1 Minimal — „Hello world plugin"

```typescript
// src/index.ts
import { defineLifecycle } from '@fakan/sdk';

export default defineLifecycle({
  async onInstall(ctx) {
    ctx.log('Hello plugin installed for site', ctx.site_id);
  },
  async onActivate(ctx) {
    ctx.log('Activated');
  },
  async onUninstall(ctx) {
    ctx.log('Goodbye');
  }
});
```

### 10.2 API endpoint — „Newsletter signup"

```typescript
// src/api/signup.ts
import { defineEndpoint } from '@fakan/sdk';

export default defineEndpoint({
  method: 'POST',
  rateLimit: '5/min/ip',
  async handler(req, ctx) {
    const { email } = await req.json();
    if (!email || !email.includes('@')) {
      return new Response('Invalid email', { status: 400 });
    }

    await ctx.storage.db('subscribers').insert({
      id: crypto.randomUUID(),
      site_id: ctx.site_id,
      email,
      created_at: Date.now()
    });

    await ctx.events.emit('newsletter.signup', { email });
    await ctx.notifications.send({
      type: 'newsletter.new_subscriber',
      severity: 'info',
      title: 'Nový odběratel newsletteru',
      body: email
    });

    return new Response('OK', { status: 200 });
  }
});
```

### 10.3 Web component — „FAQ akordeon"

```typescript
// src/components/fakan-faq.ts
class FakanFAQ extends HTMLElement {
  connectedCallback() {
    const shadow = this.attachShadow({ mode: 'open' });
    const items = JSON.parse(this.getAttribute('items') || '[]');
    shadow.innerHTML = `
      <style>
        :host { display: block; font-family: var(--font-sans); }
        details { border-bottom: 1px solid var(--color-border); padding: 1rem 0; }
        summary { cursor: pointer; font-weight: 600; }
        summary:focus-visible { outline: 2px solid var(--color-accent); }
      </style>
      ${items.map(item => `
        <details>
          <summary>${item.q}</summary>
          <p>${item.a}</p>
        </details>
      `).join('')}
    `;
  }
}
customElements.define('fakan-faq', FakanFAQ);
```

---

## 11. Best practices

- **Minimalistický bundle.** Plugin za 5 kB lepší než za 50 kB.
- **Žádné third-party scripty.** Vše self-host.
- **A11y first.** Klávesnice, ARIA jen kde sémantika nestačí, focus states.
- **i18n od začátku.** Nehardcoduj texty, používej `i18n.t()`.
- **Idempotent migrace.** Storage schema migrace jdou opakovaně bez efektu.
- **Graceful degradation.** Když AI selže, plugin nesmí spadnout.
- **Žádný spam notifikací.** Coalescing, throttling.
- **Dokumentace.** README, examples, troubleshooting.

---

## 12. Anti-patterns (ZAKÁZANO)

- ❌ Cookies (jakékoli — auth, tracking, preference).
- ❌ Third-party tracking (GA4, Meta Pixel, Hotjar, …).
- ❌ Inline scripts bez nonce.
- ❌ `eval`, `Function()` constructor, `document.write`.
- ❌ Cross-plugin storage bez deklarovaných permissions.
- ❌ Bypass kernel API (přímý přístup do D1 mimo SDK).
- ❌ Notifikační spam (víc než 1 notifikace per event per minutu per zákazník bez coalescing).
- ❌ Dark patterns v pricing (skrytá obnovení, neviditelný cancel).
- ❌ Tracking developer/zákazníkových akcí mimo deklarované analytics.

Porušení = takedown + případná penalizace v rámci dev programu.

---

## 13. Otevřené body

1. SDK detail — TS types, error handling, debug mode (do fáze 5 alfa).
2. ~~Kdy povolit `ui:editor:widget` partnerům~~ → **vyřešeno v0.8 (sekce 3.3):** fáze 1–6 jen System Plugins, fáze 7+ jen Verified Partner po manual security review.
3. ~~Cross-plugin events — namespace per plugin nebo globální?~~ → **vyřešeno v0.8 (sekce 3.2):** namespace `plugin-id:event-name`, kernel filtruje podle `required_events` v manifestu.
4. ~~Sémantická verzovací pravidla pro storage schémata~~ → **vyřešeno v0.8 (sekce 4.4.1):** snapshot → migrace → rollback. Breaking change katalog tamtéž.
5. Plugin marketplace tagging a discoverability — vertikální taxonomy (open, fáze 7).
6. Open source plugins — povoleno, ale jak handle commercial use? Open question pro VOP.
7. Snapshot retention — 14 dní v R2 cold storage potvrzeno, ale je třeba ověřit, jestli to nezasáhne hosting kvótu zákazníka. (open, fáze 5)
8. Migration runtime budget — kolik CPU ms má `onUpdate` na velkém datasetu? Default 5 s, custom limit pro Studio+ tier? (open, fáze 5)

---

*Konec plugin spec v0.8.*
