-- Statusboard mBlue — hodnocení rozsahu projektu ve více lidech.
-- Každý člen týmu má vlastní verzi hodnocení, všichni vidí všechny.

CREATE TABLE IF NOT EXISTS sb_members (
  email      TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL DEFAULT 'member', -- member | admin
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Jednorázový přihlašovací odkaz. Platí hodinu, po použití se orazítkuje.
CREATE TABLE IF NOT EXISTS sb_magic (
  token      TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL,
  used_at    TEXT
);

-- Přihlášení drží cookie s tímhle tokenem.
CREATE TABLE IF NOT EXISTS sb_sessions (
  token      TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Hodnocení jedné položky jedním člověkem. `scope` = 1 znamená „nad rámec zadání“.
CREATE TABLE IF NOT EXISTS sb_ratings (
  email      TEXT NOT NULL,
  item_id    TEXT NOT NULL,
  phase      TEXT,
  weight     INTEGER,
  scope      INTEGER,
  note       TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (email, item_id)
);

CREATE INDEX IF NOT EXISTS idx_sb_ratings_item ON sb_ratings (item_id);
CREATE INDEX IF NOT EXISTS idx_sb_sessions_email ON sb_sessions (email);
