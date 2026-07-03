-- Migration: 009_user_experience

CREATE TABLE IF NOT EXISTS workspace_contexts (
    project_id TEXT PRIMARY KEY,
    context_data TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS note_drafts (
    note_id TEXT PRIMARY KEY,
    title TEXT,
    content TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS command_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    command TEXT NOT NULL,
    executed_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_workspace_contexts_project ON workspace_contexts(project_id);
CREATE INDEX IF NOT EXISTS idx_note_drafts_updated ON note_drafts(updated_at);
