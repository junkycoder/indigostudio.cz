-- fakan auditor DB schema

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

-- Detail AI suggestion orderu. R2 keys odkazují na fakan-reports bucket.
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
  ns_records_json     TEXT,                 -- po dokončení: ["ns1.fakan.cz", …]
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
