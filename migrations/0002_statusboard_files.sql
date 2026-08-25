-- Podklady nahrané na statusboardu. Soubor leží v R2, tady je metadata a
-- vytěžený text (pokud jde o textový formát) — z toho čte bot.
CREATE TABLE IF NOT EXISTS sb_files (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  mime        TEXT,
  size        INTEGER,
  r2_key      TEXT NOT NULL,
  text        TEXT,
  uploaded_by TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Odůvodnění bota k jednotlivým položkám — proč zařadil tak, jak zařadil.
CREATE TABLE IF NOT EXISTS sb_ai_notes (
  item_id    TEXT PRIMARY KEY,
  reason     TEXT NOT NULL,
  model      TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
