-- Odběr novinek (double opt-in) — samostatná D1 databáze indigostudio-odber.
-- wrangler d1 execute indigostudio-odber --remote --file=migrations/odber/0001_subscribers.sql

CREATE TABLE IF NOT EXISTS subscribers (
  email              TEXT NOT NULL,
  topic              TEXT NOT NULL,            -- zatím jen 'skoleni'
  confirm_hash       TEXT,                     -- sha256 potvrzovacího tokenu; po potvrzení NULL
  confirm_expires_at TEXT,
  unsub_token        TEXT NOT NULL UNIQUE,     -- trvalý odkaz pro odhlášení
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  last_sent_at       TEXT,                     -- brzda proti opakovanému posílání
  confirmed_at       TEXT,                     -- teprve teď je adresa odběratel
  unsubscribed_at    TEXT,
  ip                 TEXT,                     -- poslední IP žádosti, jen kvůli brzdě proti zneužití
  PRIMARY KEY (email, topic)
);

CREATE INDEX IF NOT EXISTS idx_subscribers_confirm ON subscribers (confirm_hash);
CREATE INDEX IF NOT EXISTS idx_subscribers_ip ON subscribers (ip, last_sent_at);
