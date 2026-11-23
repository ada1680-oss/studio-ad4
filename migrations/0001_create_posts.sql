CREATE TABLE IF NOT EXISTS posts (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 work TEXT NOT NULL,
 name TEXT NOT NULL,
 category TEXT NOT NULL,
 body TEXT NOT NULL,
 reply TEXT,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 ip_hash TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS posts_public ON posts(work,status,id DESC);
CREATE INDEX IF NOT EXISTS posts_rate ON posts(ip_hash,created_at);

