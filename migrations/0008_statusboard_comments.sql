-- Jednoduchá týmová diskuse k položkám statusboardu. Komentáře jsou
-- append-only: autor a čas zůstávají součástí záznamu.
CREATE TABLE IF NOT EXISTS sb_comments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id    TEXT NOT NULL,
  email      TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sb_comments_item ON sb_comments (item_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_sb_comments_email ON sb_comments (email, created_at DESC);
