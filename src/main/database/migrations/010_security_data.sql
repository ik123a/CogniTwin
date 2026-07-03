-- Migration: 010_security_data

-- Audit log table (immutable append-only)
DROP TABLE IF EXISTS audit_log;
CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,          -- 'CREATE_NOTE', 'DELETE_TASK', 'LOGIN', 'EXPORT', etc.
    entity_type TEXT,              -- 'note', 'task', 'project', 'file', 'system'
    entity_id TEXT,
    details_json TEXT,             -- JSON metadata about the action
    ip_address TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Data integrity checksums
CREATE TABLE IF NOT EXISTS data_checksums (
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    checksum TEXT NOT NULL,        -- SHA-256 hash
    verified_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (entity_type, entity_id)
);

-- Privacy mode redaction rules
CREATE TABLE IF NOT EXISTS privacy_rules (
    id TEXT PRIMARY KEY,
    pattern TEXT NOT NULL,          -- regex or keyword to match
    replacement TEXT DEFAULT '███',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Export/import history
CREATE TABLE IF NOT EXISTS data_transfers (
    id TEXT PRIMARY KEY,
    direction TEXT NOT NULL,        -- 'export' or 'import'
    format TEXT NOT NULL,           -- 'json', 'csv', 'markdown', 'pdf'
    item_count INTEGER DEFAULT 0,
    file_path TEXT,
    status TEXT DEFAULT 'pending',  -- 'pending', 'complete', 'failed'
    error_message TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Duplicate detection results
CREATE TABLE IF NOT EXISTS duplicate_groups (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    similarity_score REAL NOT NULL,
    status TEXT DEFAULT 'pending',  -- 'pending', 'merged', 'dismissed'
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS duplicate_group_members (
    group_id TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    is_primary INTEGER DEFAULT 0,
    PRIMARY KEY (group_id, entity_id),
    FOREIGN KEY (group_id) REFERENCES duplicate_groups(id) ON DELETE CASCADE
);

-- Backup metadata (for incremental backups)
CREATE TABLE IF NOT EXISTS backup_metadata (
    id TEXT PRIMARY KEY,
    backup_type TEXT NOT NULL,      -- 'full', 'incremental'
    file_path TEXT NOT NULL,
    encrypted INTEGER DEFAULT 0,
    record_count INTEGER DEFAULT 0,
    size_bytes INTEGER DEFAULT 0,
    parent_backup_id TEXT,          -- null for full, references parent for incremental
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (parent_backup_id) REFERENCES backup_metadata(id)
);

-- Extended versioning for tasks and files (notes already have versioning)
CREATE TABLE IF NOT EXISTS item_versions (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,      -- 'task', 'file', 'project'
    entity_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    snapshot_json TEXT NOT NULL,     -- full JSON snapshot of the item
    diff_text TEXT,                 -- human-readable diff
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_item_versions_entity ON item_versions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_data_transfers_direction ON data_transfers(direction);
