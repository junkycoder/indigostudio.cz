-- migrations/0001_leads.sql
-- Tabulka `leads` pro lead capture nad free analýzou (fakan.cz/index.html → /api/analyze).
-- Iterace: landing-v2. Datum: 2026-05-08. Autor: junior-developer (TASK-02).
-- Reference:
--   * projects/landing-v2/design.md § 2 (datový model)
--   * projects/landing-v2/risk-check.md § 2.2 (povinná evidence souhlasu pro GDPR)
--
-- Klíčová rozhodnutí (proč jsou ty sloupce takhle):
--   * `consent_at`, `consent_text_version`, `consent_ip_hash` → bez nich neumíme
--     prokázat opt-in podle čl. 7 GDPR, když přijde stížnost na ÚOOÚ.
--   * `consent_ip_hash` je sha256(ip + CONSENT_SALT), plnou IP NEUKLÁDÁME
--     (recital 30 GDPR, risk-check § 1.2).
--   * `unsubscribe_token` UNIQUE 64 znaků hex (32 random bajtů), NESMÍ být
--     odvozen od emailu/ID (risk-check § 5.3).
--   * `url` je už stripnutá od senzitivních query parametrů (token, session,
--     auth, email, key, secret, code, password) — strip se děje v Workeru
--     před INSERT (risk-check § 1.3).

CREATE TABLE leads (
  id                    TEXT PRIMARY KEY,            -- UUIDv4 (crypto.randomUUID())
  created_at            TEXT NOT NULL,               -- ISO 8601 UTC, např. '2026-05-08T14:30:00.000Z'
  url                   TEXT NOT NULL,               -- stripnutá URL (origin + path)
  email                 TEXT NOT NULL,               -- validovaný formát (RFC 5322 subset)
  consent_at            TEXT NOT NULL,               -- ISO 8601 UTC, kdy uživatel kliknul souhlas
  consent_text_version  TEXT NOT NULL,               -- např. 'v1-2026-05-08' → legal/consent-versions/
  consent_ip_hash       TEXT NOT NULL,               -- sha256(ip + CONSENT_SALT), hex
  consent_ua_hash       TEXT,                        -- volitelně, sha256(ua + CONSENT_SALT); v MVP NULL
  source                TEXT NOT NULL,               -- 'landing-hero' | 'landing-cta' | 'vysledek-form' | 'manual'
  status                TEXT NOT NULL DEFAULT 'new', -- 'new' | 'mailed' | 'bounced' | 'opted_out' | 'converted'
  unsubscribe_token     TEXT NOT NULL UNIQUE,        -- 32 bajtů random hex (64 znaků)
  mail_sent_at          TEXT,                        -- ISO 8601 UTC, NULL dokud neodejde
  mail_attempts         INTEGER NOT NULL DEFAULT 0,  -- 0..2 (orig + 1 retry)
  mail_last_error       TEXT,                        -- poslední error message při send fail (truncate 500)
  opted_out_at          TEXT,                        -- ISO 8601 UTC, NULL dokud neodhlášen
  last_contact_at       TEXT NOT NULL,               -- pro retenci (24 měs od posledního kontaktu)
  notes                 TEXT                         -- volitelné, ruční poznámky
);

-- Idempotence: stejný email × stejná URL × stejný den = JEN jeden lead.
-- substr(created_at, 1, 10) bere prvních 10 znaků ISO 8601 timestampu = 'YYYY-MM-DD'
-- (tj. per-day granularita). Druhý INSERT s totožným (email, url, day) selže
-- na 'UNIQUE constraint failed', což se v captureLead() chytá a tiše ignoruje
-- (design.md § 2.3). Jiný den = nový lead (přijatelné — opětovný projev zájmu).
CREATE UNIQUE INDEX leads_idem
  ON leads (email, url, substr(created_at, 1, 10));

-- Lookup pro retro/admin queries: "kolik máme nových leadů za posledních X dní"
-- a "kteří jsou ve stavu 'bounced' / 'opted_out'".
CREATE INDEX leads_status_created
  ON leads (status, created_at);

-- Lookup pro retenci: cron job hledá `last_contact_at < now() - 24 měsíců`
-- a maže (risk-check § 2.3).
CREATE INDEX leads_last_contact
  ON leads (last_contact_at);
