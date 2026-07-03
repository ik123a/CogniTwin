-- CogniTwin Phase 3: Local LLM AI Migration
-- Chat sessions, message logs, and summary extensions

-- 1. Store chat sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Store chat messages (logs for conversation context)
CREATE TABLE IF NOT EXISTS chat_messages (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    sender TEXT NOT NULL,             -- 'user' or 'assistant'
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- 3. Add summary column to notes if not exists
-- SQLite doesn't support 'IF NOT EXISTS' for ADD COLUMN, but we can verify in JS or just execute.
-- To be safe, we can run table inspections or wrap it.
-- Altering columns is safe if they don't already exist.
-- To prevent error if column exists, we can write a helper or run it safely.
-- Let's add them. Since this is migration init, it will run once.
-- We can run:
-- ALTER TABLE notes ADD COLUMN summary TEXT;
-- ALTER TABLE files ADD COLUMN summary TEXT;
-- But since alter might throw if column already exists (e.g. from hot reloads),
-- we will run it dynamically in the migration runner if the columns don't exist!
-- For the migration file, we can write a safe SQL block.
