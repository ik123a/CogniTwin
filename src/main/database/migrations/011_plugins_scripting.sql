-- Registered local plugins
CREATE TABLE IF NOT EXISTS plugins (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    version TEXT NOT NULL,
    description TEXT,
    author TEXT,
    entry_point TEXT NOT NULL, -- Path to javascript entry file
    is_active INTEGER DEFAULT 1,
    permissions_json TEXT,     -- Allowed IPC capabilities
    created_at TEXT DEFAULT (datetime('now'))
);

-- Scripting manager table
CREATE TABLE IF NOT EXISTS scripts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    language TEXT NOT NULL,    -- 'javascript' or 'python'
    code_content TEXT NOT NULL,
    description TEXT,
    last_run TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
