-- CogniTwin Phase 4: Automation & Workflows Migration
-- Rules, workflows, scheduled actions, and macros schema definitions

-- 1. Automation rules (Event-Condition-Action)
CREATE TABLE IF NOT EXISTS rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    trigger_event TEXT NOT NULL,        -- 'NOTE_CREATED', 'FILE_WATCHED', 'TASK_DONE', 'CRON_TRIGGER'
    conditions_json TEXT NOT NULL,       -- JSON definition of filters
    actions_json TEXT NOT NULL,          -- JSON array of action structures
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. DAG-based workflows
CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nodes_json TEXT NOT NULL,            -- JSON array of graph node blocks
    edges_json TEXT NOT NULL,            -- JSON array of node connection lines
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. Scheduled actions
CREATE TABLE IF NOT EXISTS scheduled_actions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cron_expr TEXT NOT NULL,             -- Standard crontab notation
    workflow_id TEXT,                    -- Linked workflow to trigger
    rule_id TEXT,                        -- Linked rule to trigger
    next_run_at DATETIME,
    last_run_at DATETIME,
    is_active INTEGER DEFAULT 1,
    FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
    FOREIGN KEY (rule_id) REFERENCES rules(id) ON DELETE CASCADE
);

-- 4. Recorded UI macros
CREATE TABLE IF NOT EXISTS macros (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    steps_json TEXT NOT NULL,            -- JSON array of replayed UI operations
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
