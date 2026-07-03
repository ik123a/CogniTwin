-- Migration: 005_integrations
CREATE TABLE IF NOT EXISTS integration_accounts (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,                -- 'imap', 'caldav', 'chrome_history'
    name TEXT NOT NULL,
    config_json TEXT NOT NULL,          -- Host, port, folder pathways
    last_synced_at TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);
