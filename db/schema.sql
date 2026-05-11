-- Indigo Studio auditor DB schema

CREATE TABLE IF NOT EXISTS leads (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  domain      TEXT NOT NULL,
  consent_at  INTEGER NOT NULL,
  ip          TEXT,
  source      TEXT,             -- 'form' | 'cold' | 'referral'
  segment     TEXT,             -- 'osvc' | 'sro' | 'spolek' | 'unknown'  (z ARES)
  ico         TEXT,
  status      TEXT NOT NULL DEFAULT 'new',
  unsub_token TEXT NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_email  ON leads(email);
CREATE INDEX IF NOT EXISTS idx_leads_domain ON leads(domain);

CREATE TABLE IF NOT EXISTS audits (
  id              TEXT PRIMARY KEY,
  lead_id         TEXT NOT NULL,
  domain          TEXT NOT NULL,
  url             TEXT NOT NULL,
  status          TEXT NOT NULL,    -- queued | running | done | failed
  score           INTEGER,
  perf_score      INTEGER,
  a11y_score      INTEGER,
  seo_score       INTEGER,
  cookie_score    INTEGER,
  sec_score       INTEGER,
  cms             TEXT,
  ssl_expires_at  INTEGER,
  report_token    TEXT NOT NULL,    -- veřejná URL: /audit/{token}
  json_summary    TEXT,             -- denormalizovaný snapshot
  error           TEXT,
  started_at      INTEGER,
  finished_at     INTEGER,
  created_at      INTEGER NOT NULL,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE INDEX IF NOT EXISTS idx_audits_lead   ON audits(lead_id);
CREATE INDEX IF NOT EXISTS idx_audits_token  ON audits(report_token);
CREATE INDEX IF NOT EXISTS idx_audits_domain ON audits(domain);

CREATE TABLE IF NOT EXISTS findings (
  id        TEXT PRIMARY KEY,
  audit_id  TEXT NOT NULL,
  category  TEXT NOT NULL,    -- perf | a11y | seo | cookie | sec | cms
  severity  TEXT NOT NULL,    -- critical | high | medium | low | info
  title     TEXT NOT NULL,
  detail    TEXT,
  fix_hint  TEXT,
  weight    INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (audit_id) REFERENCES audits(id)
);

CREATE INDEX IF NOT EXISTS idx_findings_audit ON findings(audit_id);

CREATE TABLE IF NOT EXISTS strategist_outputs (
  audit_id        TEXT PRIMARY KEY,
  headline        TEXT,
  variant_fix     TEXT,        -- JSON
  variant_redesign TEXT,
  variant_new     TEXT,
  risks           TEXT,
  created_at      INTEGER NOT NULL,
  FOREIGN KEY (audit_id) REFERENCES audits(id)
);

CREATE TABLE IF NOT EXISTS email_events (
  id         TEXT PRIMARY KEY,
  lead_id    TEXT NOT NULL,
  audit_id   TEXT,
  template   TEXT NOT NULL,    -- audit_done | strategist | offer | reaudit_30d
  resend_id  TEXT,
  status     TEXT NOT NULL,    -- queued | sent | opened | clicked | bounced | unsubscribed
  send_at    INTEGER NOT NULL, -- naplánováno na
  sent_at    INTEGER,
  FOREIGN KEY (lead_id)  REFERENCES leads(id),
  FOREIGN KEY (audit_id) REFERENCES audits(id)
);

CREATE INDEX IF NOT EXISTS idx_emails_pending ON email_events(status, send_at);

-- =============================================================================
-- Placené flow: AI návrhy + nákup / převod domény
-- =============================================================================
-- Sjednocená tabulka `orders` drží stav peněz pro všechny tři produkty.
-- Detail (brief / files / fqdn / registrant…) je v `suggestions` resp.
-- `domain_orders`. Když přibude další produkt, přidá se nová detail tabulka,
-- `orders.kind` dostane novou hodnotu, a flow ve workeru ji pozná.
--
-- D1 sice umí FK constraints, ale runtime je vynucuje jen s PRAGMA foreign_keys=ON,
-- který Workers default nezapíná. FK definice tu jsou jako dokumentace záměru,
-- ne pojistka. Pojistka je v aplikační vrstvě.
-- =============================================================================

CREATE TABLE IF NOT EXISTS orders (
  id                       TEXT PRIMARY KEY,
  kind                     TEXT NOT NULL,   -- 'suggestion' | 'domain_register' | 'domain_transfer'
  lead_id                  TEXT,            -- FK leads, NULL u domain orderu bez auditu
  email                    TEXT NOT NULL,   -- denormalizovaně i tady (admin dotazy bez joinu)
  amount_cents             INTEGER NOT NULL,
  currency                 TEXT NOT NULL DEFAULT 'czk',
  status                   TEXT NOT NULL,
                                            -- 'created' | 'awaiting_payment' | 'paid'
                                            -- | 'processing' | 'done' | 'failed'
                                            -- | 'refunded' | 'canceled'
  stripe_payment_intent_id TEXT,
  stripe_customer_id       TEXT,
  error_message            TEXT,
  metadata_json            TEXT,            -- volné JSON pro UTM, user-agent, IP …
  created_at               INTEGER NOT NULL,
  updated_at               INTEGER NOT NULL,
  paid_at                  INTEGER,
  completed_at             INTEGER,
  FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE INDEX IF NOT EXISTS idx_orders_email          ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_pi             ON orders(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_orders_kind_status    ON orders(kind, status);

-- Detail AI suggestion orderu. R2 keys odkazují na REPORTS R2 bucket.
CREATE TABLE IF NOT EXISTS suggestions (
  order_id              TEXT PRIMARY KEY,
  audit_id              TEXT,              -- z čeho bereme baseline screenshot
  url                   TEXT NOT NULL,
  brief                 TEXT NOT NULL,
  files_json            TEXT,              -- [{r2_key, original_name, mime, bytes}]
  html_output_key       TEXT,              -- R2 path k vygenerovanému HTML/CSS
  preview_image_key     TEXT,              -- R2 path k PNG screenshotu výsledku
  claude_request_id     TEXT,
  claude_input_tokens   INTEGER,
  claude_output_tokens  INTEGER,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (audit_id) REFERENCES audits(id)
);

CREATE INDEX IF NOT EXISTS idx_suggestions_audit ON suggestions(audit_id);

-- Detail domain orderu (registrace nebo převod).
CREATE TABLE IF NOT EXISTS domain_orders (
  order_id            TEXT PRIMARY KEY,
  fqdn                TEXT NOT NULL,        -- punycode lowercase
  tld                 TEXT NOT NULL,
  op_kind             TEXT NOT NULL,        -- 'register' | 'transfer'
  registrar           TEXT NOT NULL,        -- 'subreg' | 'cf_registrar'
  auth_info           TEXT,                 -- jen u 'transfer'
  registrant_name     TEXT NOT NULL,
  registrant_email    TEXT NOT NULL,
  registrant_phone    TEXT,
  registrant_street   TEXT,
  registrant_city     TEXT,
  registrant_zip      TEXT,
  registrant_country  TEXT NOT NULL,        -- ISO-3166 2-letter
  registrant_ico      TEXT,                 -- jen CZ subjekty
  registrant_dic      TEXT,
  registrar_order_id  TEXT,                 -- ID vrácené registrátorem
  registrar_status    TEXT,                 -- raw status z registrátora
  ns_records_json     TEXT,                 -- po dokončení: ["ns1.<host>", …]
  period_years        INTEGER NOT NULL DEFAULT 1,
  expires_at          INTEGER,              -- unix epoch, doplněno po registraci
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX IF NOT EXISTS idx_domain_orders_fqdn       ON domain_orders(fqdn);
CREATE INDEX IF NOT EXISTS idx_domain_orders_registrar  ON domain_orders(registrar_order_id);

-- Audit log Stripe webhook eventů. PK = Stripe event.id zaručuje idempotenci
-- (INSERT s konflikt = víme, že už jsme event zpracovali).
CREATE TABLE IF NOT EXISTS payments (
  id            TEXT PRIMARY KEY,           -- Stripe event.id, např. evt_1Xyz…
  order_id      TEXT,                       -- náš order, NULL u eventů co se nás netýkají
  event_type    TEXT NOT NULL,              -- payment_intent.succeeded, charge.refunded, …
  payload_json  TEXT NOT NULL,              -- raw event body (pro debug a re-processing)
  received_at   INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_type  ON payments(event_type);

-- Idempotency klíče pro klientské POSTy (suggestion submit, domain order create…).
-- Klient pošle Idempotency-Key v hlavičce; server uloží odpověď a při opakování
-- s totožným klíčem + body hashem vrátí cached response. Při neshodě bodyHashe
-- odpovídáme 409, abychom vyloučili replay s pozměněnými daty.
-- Cleanup řeší cron (24h TTL).
CREATE TABLE IF NOT EXISTS idempotency_keys (
  key              TEXT PRIMARY KEY,
  request_hash     TEXT NOT NULL,           -- SHA-256 z request body
  response_status  INTEGER NOT NULL,
  response_body    TEXT NOT NULL,
  created_at       INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_idempotency_created ON idempotency_keys(created_at);

-- =============================================================================
-- Identita: anonymní zařízení + ověřené účty
-- =============================================================================
-- Anonymní klient dostane `device_token` v cookie (httpOnly, SameSite=Lax, 12 m).
-- Server ho zná v `account_devices` s account_id = NULL. Token sám o sobě stačí
-- pro plný UX — klient vidí svoje audity, návrhy, domény, faktury.
--
-- Ověření emailu (magic link) je opt-in: vyrobí se accounts row a stávající
-- device se k němu připojí (account_devices.account_id = accounts.id).
-- Z jiného zařízení / prohlížeče klient klikne "Přihlásit emailem", magic
-- link sváže nový device se stejným accountem, journeys vidí všechny.
--
-- Žádná hesla, žádný registrační formulář.
-- =============================================================================

CREATE TABLE IF NOT EXISTS accounts (
  id                 TEXT PRIMARY KEY,
  email              TEXT NOT NULL UNIQUE,
  email_verified_at  INTEGER,                  -- NULL = přednahraný (pre-claim) účet
  created_at         INTEGER NOT NULL,
  last_login_at      INTEGER
);

CREATE INDEX IF NOT EXISTS idx_accounts_email ON accounts(email);

-- Anonymní device má account_id = NULL. Při ověření emailu se naváže.
-- `device_token` je 32-byte random hex — neukládat plain do logů.
CREATE TABLE IF NOT EXISTS account_devices (
  id            TEXT PRIMARY KEY,
  account_id    TEXT,
  device_token  TEXT NOT NULL UNIQUE,
  user_agent    TEXT,
  ip            TEXT,
  created_at    INTEGER NOT NULL,
  last_seen_at  INTEGER NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_devices_token   ON account_devices(device_token);
CREATE INDEX IF NOT EXISTS idx_devices_account ON account_devices(account_id);

-- Magic link tokeny pro ověření emailu. TTL 30 minut, single-use, opaque random.
-- Po `used_at` se token nedá použít znovu (replay protection).
CREATE TABLE IF NOT EXISTS magic_links (
  token       TEXT PRIMARY KEY,
  email       TEXT NOT NULL,
  device_id   TEXT NOT NULL,                   -- který device se přihlašuje
  expires_at  INTEGER NOT NULL,
  used_at     INTEGER,
  created_at  INTEGER NOT NULL,
  FOREIGN KEY (device_id) REFERENCES account_devices(id)
);

CREATE INDEX IF NOT EXISTS idx_magic_email   ON magic_links(email);
CREATE INDEX IF NOT EXISTS idx_magic_expires ON magic_links(expires_at);

-- =============================================================================
-- Journey: sjednocená cesta zákazníka napříč moduly
-- =============================================================================
-- Jedna `journeys` row = jeden checkout. Klient si v UI naskládá moduly
-- (audit + suggestion + domain_redirect + …), zaplatí jedním Stripe PI,
-- worker zpracuje moduly podle kind. Stejný klient se může vrátit za měsíc
-- a založit novou journey — každý audit / nákup je samostatná journey.
--
-- `device_id` drží i u přihlášených (víme, ze kterého prohlížeče vznikl).
-- `account_id` = NULL u anonymního flow (klient se neověřil emailem).
-- `lead_id` = NULL dokud klient nezadá email u prvního modulu (typicky audit).
--
-- Detail modulu je v dedikované tabulce, journey_items.ref_id na ni odkazuje:
--   kind = 'audit'             → audits.id
--   kind = 'suggestion'        → orders.id (a přes ně suggestions.order_id)
--   kind = 'domain_register'   → orders.id (a přes ně domain_orders.order_id)
--   kind = 'domain_transfer'   → orders.id (a přes ně domain_orders.order_id)
--   kind = 'domain_redirect'   → domain_redirects.id
--   kind = 'extraction'        → extractions.id (BUDOUCNOST, fáze G)
-- =============================================================================

CREATE TABLE IF NOT EXISTS journeys (
  id                       TEXT PRIMARY KEY,
  device_id                TEXT NOT NULL,
  account_id               TEXT,
  lead_id                  TEXT,
  status                   TEXT NOT NULL,
                                                -- 'open' | 'awaiting_payment' | 'paid'
                                                -- | 'completed' | 'abandoned'
  total_amount_cents       INTEGER NOT NULL DEFAULT 0,
  currency                 TEXT NOT NULL DEFAULT 'czk',
  stripe_payment_intent_id TEXT,                -- sjednocený PI pro multi-item checkout
  stripe_customer_id       TEXT,
  created_at               INTEGER NOT NULL,
  updated_at               INTEGER NOT NULL,
  FOREIGN KEY (device_id)  REFERENCES account_devices(id),
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (lead_id)    REFERENCES leads(id)
);

CREATE INDEX IF NOT EXISTS idx_journeys_device  ON journeys(device_id);
CREATE INDEX IF NOT EXISTS idx_journeys_account ON journeys(account_id);
CREATE INDEX IF NOT EXISTS idx_journeys_lead    ON journeys(lead_id);
CREATE INDEX IF NOT EXISTS idx_journeys_pi      ON journeys(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_journeys_status  ON journeys(status, updated_at);

CREATE TABLE IF NOT EXISTS journey_items (
  id           TEXT PRIMARY KEY,
  journey_id   TEXT NOT NULL,
  kind         TEXT NOT NULL,
                                                -- 'audit' | 'suggestion'
                                                -- | 'domain_register' | 'domain_transfer'
                                                -- | 'domain_redirect' | 'extraction'
  ref_id       TEXT,
  status       TEXT NOT NULL,
                                                -- 'configured' | 'awaiting_payment'
                                                -- | 'paid' | 'in_progress' | 'done'
                                                -- | 'failed' | 'canceled'
  price_cents  INTEGER NOT NULL DEFAULT 0,
  position     INTEGER NOT NULL DEFAULT 0,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  FOREIGN KEY (journey_id) REFERENCES journeys(id)
);

CREATE INDEX IF NOT EXISTS idx_items_journey      ON journey_items(journey_id, position);
CREATE INDEX IF NOT EXISTS idx_items_kind_status  ON journey_items(kind, status);
CREATE INDEX IF NOT EXISTS idx_items_ref          ON journey_items(ref_id);

-- =============================================================================
-- Detail modulu "Doména přes nás" (Cloudflare proxy bez transferu registrace)
-- =============================================================================
-- Klient nemění registrátora, jen přepne NSSET u svého stávajícího registrátora
-- na NS, které mu dáme z naší CF zóny. My držíme zone, klient může DNS spravovat
-- přes nás (později UI), případně mu necháme proxy aktivní pro CF výhody:
-- HTTPS zdarma, CDN, DDoS, Always Online.
--
-- Před přepnutím NSSET vyrobíme snapshot stávajících DNS záznamů (DoH dotazy
-- + volitelný upload zone exportu od klienta) a uložíme do R2 jako BIND zone
-- soubor. V profilu má klient tlačítko "Vrátit původní nastavení" — ukáže
-- snapshot a původní NS, klient u svého registrátora přepne zpátky.
--
-- `setup_status` přechody:
--   configured        — klient zvolil modul v pipeline, ještě nezaplatil
--   zone_created      — po platbě jsme v CF vytvořili zone, máme přiřazené NS
--   awaiting_ns_change— čekáme, až klient u svého registrátora přepne NS
--   active            — CF detekuje provoz přes naše NS, vše běží
--   reverted          — klient klikl "vrátit zpět", zone smazaná, NS zpět
--   failed            — chyba (CF API / klient nepřepnul / zone konflikt)
-- =============================================================================

CREATE TABLE IF NOT EXISTS domain_redirects (
  id                          TEXT PRIMARY KEY,
  order_id                    TEXT,             -- NULL dokud nezaplatil
  fqdn                        TEXT NOT NULL,    -- punycode lowercase (apex doména)
  cf_zone_id                  TEXT,             -- ID v Cloudflare API
  cf_assigned_ns_json         TEXT,             -- ["lia.ns.cloudflare.com", …]
  original_ns_json            TEXT,             -- původní NS klienta (před změnou)
  original_dns_snapshot_key   TEXT,             -- R2 path na BIND zone export
  setup_status                TEXT NOT NULL,
  nameservers_changed_at      INTEGER,          -- detekce: NS klienta = naše NS
  activated_at                INTEGER,          -- CF zone status = active
  reverted_at                 INTEGER,
  error_message               TEXT,
  created_at                  INTEGER NOT NULL,
  updated_at                  INTEGER NOT NULL,
  FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX IF NOT EXISTS idx_redirects_fqdn   ON domain_redirects(fqdn);
CREATE INDEX IF NOT EXISTS idx_redirects_status ON domain_redirects(setup_status);
CREATE INDEX IF NOT EXISTS idx_redirects_zone   ON domain_redirects(cf_zone_id);
CREATE INDEX IF NOT EXISTS idx_redirects_order  ON domain_redirects(order_id);
