-- Migration: 006_knowledge_ux

CREATE TABLE IF NOT EXISTS topic_clusters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    keywords TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS item_clusters (
    cluster_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    distance REAL,
    PRIMARY KEY (cluster_id, item_id, item_type),
    FOREIGN KEY (cluster_id) REFERENCES topic_clusters(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS smart_reminders (
    id TEXT PRIMARY KEY,
    item_id TEXT,
    item_type TEXT,
    trigger_type TEXT NOT NULL,
    message TEXT NOT NULL,
    is_dismissed INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    dismissed_at TEXT
);

CREATE TABLE IF NOT EXISTS keyboard_shortcuts (
    id TEXT PRIMARY KEY,
    action TEXT NOT NULL UNIQUE,
    accelerator TEXT NOT NULL,
    description TEXT,
    is_enabled INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_item_clusters_item ON item_clusters(item_id, item_type);
CREATE INDEX IF NOT EXISTS idx_smart_reminders_dismissed ON smart_reminders(is_dismissed);
CREATE INDEX IF NOT EXISTS idx_smart_reminders_item ON smart_reminders(item_id, item_type);
