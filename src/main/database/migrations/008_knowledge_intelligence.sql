-- Migration: 008_knowledge_intelligence

CREATE TABLE IF NOT EXISTS note_versions (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    patch TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS taxonomy_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS item_classifications (
    item_id TEXT NOT NULL,
    item_type TEXT NOT NULL, -- 'note', 'file'
    category_id TEXT NOT NULL,
    confidence REAL DEFAULT 1.0,
    created_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (item_id, item_type, category_id),
    FOREIGN KEY (category_id) REFERENCES taxonomy_categories(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS expertise_profiles (
    id TEXT PRIMARY KEY,
    domain TEXT NOT NULL UNIQUE,
    score REAL DEFAULT 0.0,
    character_volume INTEGER DEFAULT 0,
    last_updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS knowledge_quality (
    item_id TEXT NOT NULL,
    item_type TEXT NOT NULL, -- 'note', 'file'
    completeness_score REAL DEFAULT 0.0,
    structure_score REAL DEFAULT 0.0,
    depth_score REAL DEFAULT 0.0,
    overall_score REAL DEFAULT 0.0,
    details TEXT, -- JSON structure listing specifics
    last_evaluated_at TEXT DEFAULT (datetime('now')),
    PRIMARY KEY (item_id, item_type)
);

CREATE TABLE IF NOT EXISTS cross_domain_links (
    id TEXT PRIMARY KEY,
    source_item_id TEXT NOT NULL,
    source_item_type TEXT NOT NULL,
    source_domain TEXT NOT NULL,
    target_item_id TEXT NOT NULL,
    target_item_type TEXT NOT NULL,
    target_domain TEXT NOT NULL,
    similarity_score REAL NOT NULL,
    analogy_explanation TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_note_versions_note ON note_versions(note_id);
CREATE INDEX IF NOT EXISTS idx_item_classifications_item ON item_classifications(item_id, item_type);
CREATE INDEX IF NOT EXISTS idx_item_classifications_category ON item_classifications(category_id);
CREATE INDEX IF NOT EXISTS idx_cross_domain_links_source ON cross_domain_links(source_item_id);
CREATE INDEX IF NOT EXISTS idx_cross_domain_links_target ON cross_domain_links(target_item_id);
