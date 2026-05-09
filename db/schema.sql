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
