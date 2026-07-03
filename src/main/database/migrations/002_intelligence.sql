-- CogniTwin Phase 2: Intelligence Engine Migration
-- Embeddings metadata, entities, topics, and full-text search

-- 1. Embeddings metadata (links items to vec_embeddings rows)
CREATE TABLE IF NOT EXISTS embeddings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL,
    source_type TEXT NOT NULL,        -- 'note', 'task', 'file', 'inbox_item'
    chunk_index INTEGER DEFAULT 0,
    chunk_text TEXT NOT NULL,
    vec_rowid INTEGER NOT NULL,       -- rowid in vec_embeddings virtual table
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Extracted named entities
CREATE TABLE IF NOT EXISTS entities (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,               -- 'person', 'organization', 'place', 'date', 'topic', 'concept'
    normalized_name TEXT NOT NULL,
    mention_count INTEGER DEFAULT 1,
    first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Links entities to source documents
CREATE TABLE IF NOT EXISTS entity_mentions (
    entity_id TEXT NOT NULL,
    source_id TEXT NOT NULL,
    source_type TEXT NOT NULL,
    context_snippet TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (entity_id, source_id),
    FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
);

-- 4. Discovered topics
CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    keywords TEXT NOT NULL,           -- JSON array of top keywords
    document_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Links items to topics
CREATE TABLE IF NOT EXISTS item_topics (
    item_id TEXT NOT NULL,
    item_type TEXT NOT NULL,
    topic_id TEXT NOT NULL,
    confidence REAL DEFAULT 0.0,
    PRIMARY KEY (item_id, topic_id),
    FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
);

-- 6. Full-text search index
CREATE VIRTUAL TABLE IF NOT EXISTS fts_content USING fts5(
    source_id,
    source_type,
    title,
    content,
    tokenize='porter unicode61'
);

-- 7. Settings table (was missing from Phase 1 schema)
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- Indexes for intelligence tables
CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings(source_id, source_type);
CREATE INDEX IF NOT EXISTS idx_entities_normalized ON entities(normalized_name);
CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
CREATE INDEX IF NOT EXISTS idx_entity_mentions_source ON entity_mentions(source_id);
CREATE INDEX IF NOT EXISTS idx_item_topics_item ON item_topics(item_id);
CREATE INDEX IF NOT EXISTS idx_item_topics_topic ON item_topics(topic_id);
