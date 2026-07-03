-- Migration: 007_knowledge_maturation

CREATE TABLE IF NOT EXISTS flashcards (
    id TEXT PRIMARY KEY,
    note_id TEXT,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    ease_factor REAL DEFAULT 2.5,
    interval INTEGER DEFAULT 0,
    repetitions INTEGER DEFAULT 0,
    next_review TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS idea_states (
    id TEXT PRIMARY KEY,
    note_id TEXT NOT NULL,
    state TEXT NOT NULL, -- 'seed', 'draft', 'active', 'mature'
    character_length INTEGER NOT NULL DEFAULT 0,
    edit_count INTEGER NOT NULL DEFAULT 0,
    tag_count INTEGER NOT NULL DEFAULT 0,
    transitioned_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS learning_goals (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,
    status TEXT DEFAULT 'Active', -- 'Active', 'Completed'
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS learning_path_steps (
    id TEXT PRIMARY KEY,
    goal_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    estimated_duration TEXT,
    order_index INTEGER NOT NULL,
    note_id TEXT,
    status TEXT DEFAULT 'Pending', -- 'Pending', 'Completed'
    recommendations TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (goal_id) REFERENCES learning_goals(id) ON DELETE CASCADE,
    FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_flashcards_note ON flashcards(note_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_next_review ON flashcards(next_review);
CREATE INDEX IF NOT EXISTS idx_idea_states_note ON idea_states(note_id);
CREATE INDEX IF NOT EXISTS idx_learning_path_steps_goal ON learning_path_steps(goal_id);
CREATE INDEX IF NOT EXISTS idx_learning_path_steps_note ON learning_path_steps(note_id);
