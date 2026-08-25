-- Bot a nahrávání podkladů zrušeny (25. 8. 2026) — místo nich historie změn.
DROP TABLE IF EXISTS sb_ai_notes;
DROP TABLE IF EXISTS sb_files;

-- Kdo kdy jak přehodnotil položku. Append-only: řádek nese stav PŘED i PO,
-- takže výpis nemusí dopočítávat rozdíl proti sousednímu záznamu.
CREATE TABLE IF NOT EXISTS sb_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  email        TEXT NOT NULL,
  item_id      TEXT NOT NULL,
  phase_from   TEXT,
  phase_to     TEXT,
  weight_from  INTEGER,
  weight_to    INTEGER,
  scope_from   INTEGER,
  scope_to     INTEGER,
  changed_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sb_history_time ON sb_history (changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sb_history_item ON sb_history (item_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_sb_history_email ON sb_history (email, changed_at DESC);
