import { app } from 'electron'
import Database from 'better-sqlite3'
import * as sqliteVec from 'sqlite-vec'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

let db: Database.Database | null = null

export function getDatabasePath(): string {
  const userDataPath = app.getPath('userData')
  return path.join(userDataPath, 'cognitwin.db')
}

export function initDatabase(): Database.Database {
  if (db) return db

  const dbPath = getDatabasePath()
  const dbDir = path.dirname(dbPath)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  db = new Database(dbPath)

  // Enable Write-Ahead Logging (WAL) for better concurrent performance
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  // Load sqlite-vec extension
  try {
    sqliteVec.load(db)
    console.log('sqlite-vec extension loaded successfully')

    // Create virtual table for embeddings (384 dimensions for all-MiniLM-L6-v2)
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS vec_embeddings USING vec0(
        rowid INTEGER PRIMARY KEY,
        embedding float[384]
      );
    `)
  } catch (error) {
    console.error('Failed to load sqlite-vec extension:', error)
  }

  // Load schema
  try {
    // Read schema.sql from the build directory or source directory
    // electron-vite bundles resources, but since we are running in main process,
    // we can locate it or load it directly.
    // For safety, we can embed the schema SQL or read it. Let's read it relative to app path,
    // or look it up. Alternatively, we can define the schema inline or import it.
    // Let's load it from the expected path.
    const schemaPath = app.isPackaged
      ? path.join(process.resourcesPath, 'schema.sql')
      : path.join(__dirname, '../../src/main/database/schema.sql')

    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8')
      db.exec(schemaSql)
      console.log('Database schema applied successfully from:', schemaPath)
    } else {
      // Fallback: Inline basic schema if file is not found
      console.warn('Schema file not found at:', schemaPath, '- Applying fallback schema')
      applyFallbackSchema(db)
    }

    // Load Phase 2 Intelligence migration
    const migrationPath = app.isPackaged
      ? path.join(process.resourcesPath, '002_intelligence.sql')
      : path.join(__dirname, '../../src/main/database/migrations/002_intelligence.sql')

    if (fs.existsSync(migrationPath)) {
      const migrationSql = fs.readFileSync(migrationPath, 'utf8')
      db.exec(migrationSql)
      console.log('Phase 2 intelligence migration applied successfully from:', migrationPath)
    } else {
      console.warn(
        'Migration file not found at:',
        migrationPath,
        '- Applying fallback intelligence migration'
      )
      applyFallbackMigration(db)
    }

    // Load Phase 3 LLM migration
    const migrationPath003 = app.isPackaged
      ? path.join(process.resourcesPath, '003_llm.sql')
      : path.join(__dirname, '../../src/main/database/migrations/003_llm.sql')

    if (fs.existsSync(migrationPath003)) {
      const migrationSql = fs.readFileSync(migrationPath003, 'utf8')
      db.exec(migrationSql)
      console.log('Phase 3 LLM migration applied successfully from:', migrationPath003)
    } else {
      console.warn(
        'Migration file not found at:',
        migrationPath003,
        '- Applying fallback LLM migration'
      )
      applyFallbackMigration003(db)
    }

    // Safely add summary columns
    safelyAddSummaryColumns(db)

    // Load Phase 4 Automation migration
    const migrationPath004 = app.isPackaged
      ? path.join(process.resourcesPath, '004_automation.sql')
      : path.join(__dirname, '../../src/main/database/migrations/004_automation.sql')

    if (fs.existsSync(migrationPath004)) {
      const migrationSql = fs.readFileSync(migrationPath004, 'utf8')
      db.exec(migrationSql)
      console.log('Phase 4 automation migration applied successfully from:', migrationPath004)
    } else {
      console.warn(
        'Migration file not found at:',
        migrationPath004,
        '- Applying fallback automation migration'
      )
      applyFallbackMigration004(db)
    }

    // Load Phase 6 Integrations migration
    const migrationPath005 = app.isPackaged
      ? path.join(process.resourcesPath, '005_integrations.sql')
      : path.join(__dirname, '../../src/main/database/migrations/005_integrations.sql')

    if (fs.existsSync(migrationPath005)) {
      const migrationSql = fs.readFileSync(migrationPath005, 'utf8')
      db.exec(migrationSql)
      console.log('Phase 6 integrations migration applied successfully from:', migrationPath005)
    } else {
      console.warn(
        'Migration file not found at:',
        migrationPath005,
        '- Applying fallback integrations migration'
      )
      applyFallbackMigration005(db)
    }

    // Load Phase 7A Knowledge UX migration
    const migrationPath006 = app.isPackaged
      ? path.join(process.resourcesPath, '006_knowledge_ux.sql')
      : path.join(__dirname, '../../src/main/database/migrations/006_knowledge_ux.sql')

    if (fs.existsSync(migrationPath006)) {
      const migrationSql = fs.readFileSync(migrationPath006, 'utf8')
      db.exec(migrationSql)
      console.log('Phase 7A knowledge UX migration applied successfully from:', migrationPath006)
    } else {
      console.warn(
        'Migration file not found at:',
        migrationPath006,
        '- Applying fallback knowledge UX migration'
      )
      applyFallbackMigration006(db)
    }

    // Load Phase 7B Knowledge Maturation migration
    const migrationPath007 = app.isPackaged
      ? path.join(process.resourcesPath, '007_knowledge_maturation.sql')
      : path.join(__dirname, '../../src/main/database/migrations/007_knowledge_maturation.sql')

    if (fs.existsSync(migrationPath007)) {
      const migrationSql = fs.readFileSync(migrationPath007, 'utf8')
      db.exec(migrationSql)
      console.log(
        'Phase 7B knowledge maturation migration applied successfully from:',
        migrationPath007
      )
    } else {
      console.warn(
        'Migration file not found at:',
        migrationPath007,
        '- Applying fallback knowledge maturation migration'
      )
      applyFallbackMigration007(db)
    }

    // Load Phase 7C Knowledge Intelligence migration
    const migrationPath008 = app.isPackaged
      ? path.join(process.resourcesPath, '008_knowledge_intelligence.sql')
      : path.join(__dirname, '../../src/main/database/migrations/008_knowledge_intelligence.sql')

    if (fs.existsSync(migrationPath008)) {
      const migrationSql = fs.readFileSync(migrationPath008, 'utf8')
      db.exec(migrationSql)
      console.log(
        'Phase 7C knowledge intelligence migration applied successfully from:',
        migrationPath008
      )
    } else {
      console.warn(
        'Migration file not found at:',
        migrationPath008,
        '- Applying fallback knowledge intelligence migration'
      )
      applyFallbackMigration008(db)
    }

    // Load Phase 8 User Experience migration
    const migrationPath009 = app.isPackaged
      ? path.join(process.resourcesPath, '009_user_experience.sql')
      : path.join(__dirname, '../../src/main/database/migrations/009_user_experience.sql')

    if (fs.existsSync(migrationPath009)) {
      const migrationSql = fs.readFileSync(migrationPath009, 'utf8')
      db.exec(migrationSql)
      console.log('Phase 8 user experience migration applied successfully from:', migrationPath009)
    } else {
      console.warn(
        'Migration file not found at:',
        migrationPath009,
        '- Applying fallback user experience migration'
      )
      applyFallbackMigration009(db)
    }

    // Load Phase 9 Security and Data Management migration
    const migrationPath010 = app.isPackaged
      ? path.join(process.resourcesPath, '010_security_data.sql')
      : path.join(__dirname, '../../src/main/database/migrations/010_security_data.sql')

    if (fs.existsSync(migrationPath010)) {
      const migrationSql = fs.readFileSync(migrationPath010, 'utf8')
      db.exec(migrationSql)
      console.log(
        'Phase 9 security and data migration applied successfully from:',
        migrationPath010
      )
    } else {
      console.warn(
        'Migration file not found at:',
        migrationPath010,
        '- Applying fallback security and data migration'
      )
      applyFallbackMigration010(db)
    }

    // Load Phase 10 Plugins and Scripting migration
    const migrationPath011 = app.isPackaged
      ? path.join(process.resourcesPath, '011_plugins_scripting.sql')
      : path.join(__dirname, '../../src/main/database/migrations/011_plugins_scripting.sql')

    if (fs.existsSync(migrationPath011)) {
      const migrationSql = fs.readFileSync(migrationPath011, 'utf8')
      db.exec(migrationSql)
      console.log(
        'Phase 10 plugins and scripting migration applied successfully from:',
        migrationPath011
      )
    } else {
      console.warn(
        'Migration file not found at:',
        migrationPath011,
        '- Applying fallback plugins and scripting migration'
      )
      applyFallbackMigration011(db)
    }

    // Load Phase 11 Simulations migration
    const migrationPath012 = app.isPackaged
      ? path.join(process.resourcesPath, '012_simulations.sql')
      : path.join(__dirname, '../../src/main/database/migrations/012_simulations.sql')

    if (fs.existsSync(migrationPath012)) {
      const migrationSql = fs.readFileSync(migrationPath012, 'utf8')
      db.exec(migrationSql)
      console.log('Phase 11 simulations migration applied successfully from:', migrationPath012)
    } else {
      console.warn(
        'Migration file not found at:',
        migrationPath012,
        '- Applying fallback simulations migration'
      )
      applyFallbackMigration012(db)
    }
  } catch (error) {
    console.error('Error initializing database schema/migrations:', error)
  }

  // Log audit action
  try {
    const insertAudit = db.prepare(`
      INSERT INTO audit_log (id, user_id, action, details_json) 
      VALUES (?, ?, ?, ?)
    `);
    insertAudit.run(
      crypto.randomUUID(),
      'system',
      'DATABASE_INIT',
      JSON.stringify({ path: dbPath })
    );
  } catch (err) {
    console.error('Failed to write initial audit log:', err)
  }

  return db
}

export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase()
  }
  return db
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
    console.log('Database connection closed')
  }
}

function applyFallbackSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      salt TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT,
      settings TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      color TEXT DEFAULT '#3498db',
      icon TEXT DEFAULT 'folder',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS notes (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      title TEXT NOT NULL,
      content TEXT,
      raw_text TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      due_date DATETIME,
      priority TEXT DEFAULT 'Medium',
      status TEXT DEFAULT 'Todo',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      title TEXT NOT NULL,
      completed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      title TEXT NOT NULL,
      description TEXT,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      location TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      raw_text TEXT,
      metadata TEXT DEFAULT '{}',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
    );
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '#7f8c8d'
    );
    CREATE TABLE IF NOT EXISTS item_tags (
      tag_id TEXT NOT NULL,
      item_id TEXT NOT NULL,
      item_type TEXT NOT NULL,
      PRIMARY KEY (tag_id, item_id),
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS relationships (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      source_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      type TEXT NOT NULL,
      weight REAL DEFAULT 1.0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS inbox_items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      source TEXT,
      title TEXT NOT NULL,
      content TEXT,
      priority TEXT DEFAULT 'Yellow',
      date_received DATETIME DEFAULT CURRENT_TIMESTAMP,
      is_read INTEGER DEFAULT 0,
      is_archived INTEGER DEFAULT 0,
      metadata TEXT DEFAULT '{}'
    );
    CREATE TABLE IF NOT EXISTS automations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      conditions TEXT DEFAULT '[]',
      actions TEXT DEFAULT '[]',
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

function applyFallbackMigration(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS embeddings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        chunk_index INTEGER DEFAULT 0,
        chunk_text TEXT NOT NULL,
        vec_rowid INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS entities (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        mention_count INTEGER DEFAULT 1,
        first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS entity_mentions (
        entity_id TEXT NOT NULL,
        source_id TEXT NOT NULL,
        source_type TEXT NOT NULL,
        context_snippet TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (entity_id, source_id),
        FOREIGN KEY (entity_id) REFERENCES entities(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS topics (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        keywords TEXT NOT NULL,
        document_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS item_topics (
        item_id TEXT NOT NULL,
        item_type TEXT NOT NULL,
        topic_id TEXT NOT NULL,
        confidence REAL DEFAULT 0.0,
        PRIMARY KEY (item_id, topic_id),
        FOREIGN KEY (topic_id) REFERENCES topics(id) ON DELETE CASCADE
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS fts_content USING fts5(
        source_id,
        source_type,
        title,
        content,
        tokenize='porter unicode61'
    );
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_embeddings_source ON embeddings(source_id, source_type);
    CREATE INDEX IF NOT EXISTS idx_entities_normalized ON entities(normalized_name);
    CREATE INDEX IF NOT EXISTS idx_entities_type ON entities(type);
    CREATE INDEX IF NOT EXISTS idx_entity_mentions_source ON entity_mentions(source_id);
    CREATE INDEX IF NOT EXISTS idx_item_topics_item ON item_topics(item_id);
    CREATE INDEX IF NOT EXISTS idx_item_topics_topic ON item_topics(topic_id);
  `)
}

function applyFallbackMigration003(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
    );
  `)
}

function safelyAddSummaryColumns(database: Database.Database): void {
  try {
    const notesCols = database.pragma('table_info(notes)') as Array<{ name: string }>
    if (!notesCols.some((col) => col.name === 'summary')) {
      database.exec('ALTER TABLE notes ADD COLUMN summary TEXT;')
      console.log('Added summary column to notes table')
    }

    const filesCols = database.pragma('table_info(files)') as Array<{ name: string }>
    if (!filesCols.some((col) => col.name === 'summary')) {
      database.exec('ALTER TABLE files ADD COLUMN summary TEXT;')
      console.log('Added summary column to files table')
    }
  } catch (err) {
    console.error('Failed to safely alter summary columns:', err)
  }
}

function applyFallbackMigration004(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS rules (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        trigger_event TEXT NOT NULL,
        conditions_json TEXT NOT NULL,
        actions_json TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        nodes_json TEXT NOT NULL,
        edges_json TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS scheduled_actions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        cron_expr TEXT NOT NULL,
        workflow_id TEXT,
        rule_id TEXT,
        next_run_at DATETIME,
        last_run_at DATETIME,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE,
        FOREIGN KEY (rule_id) REFERENCES rules(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS macros (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        steps_json TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)
}

function applyFallbackMigration005(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS integration_accounts (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        config_json TEXT NOT NULL,
        last_synced_at TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
    );
  `)
}

function applyFallbackMigration006(database: Database.Database): void {
  database.exec(`
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
  `)
}

function applyFallbackMigration007(database: Database.Database): void {
  database.exec(`
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
        state TEXT NOT NULL,
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
        status TEXT DEFAULT 'Active',
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
        status TEXT DEFAULT 'Pending',
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
  `)
}

function applyFallbackMigration008(database: Database.Database): void {
  database.exec(`
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
        item_type TEXT NOT NULL,
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
        item_type TEXT NOT NULL,
        completeness_score REAL DEFAULT 0.0,
        structure_score REAL DEFAULT 0.0,
        depth_score REAL DEFAULT 0.0,
        overall_score REAL DEFAULT 0.0,
        details TEXT,
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
  `)
}

function applyFallbackMigration009(database: Database.Database): void {
  database.exec(`
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
  `)
}

function applyFallbackMigration010(database: Database.Database): void {
  database.exec(`
    DROP TABLE IF EXISTS audit_log;
    CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT,
        entity_id TEXT,
        details_json TEXT,
        ip_address TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS data_checksums (
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        checksum TEXT NOT NULL,
        verified_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (entity_type, entity_id)
    );
    CREATE TABLE IF NOT EXISTS privacy_rules (
        id TEXT PRIMARY KEY,
        pattern TEXT NOT NULL,
        replacement TEXT DEFAULT '███',
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS data_transfers (
        id TEXT PRIMARY KEY,
        direction TEXT NOT NULL,
        format TEXT NOT NULL,
        item_count INTEGER DEFAULT 0,
        file_path TEXT,
        status TEXT DEFAULT 'pending',
        error_message TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS duplicate_groups (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        similarity_score REAL NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS duplicate_group_members (
        group_id TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        is_primary INTEGER DEFAULT 0,
        PRIMARY KEY (group_id, entity_id),
        FOREIGN KEY (group_id) REFERENCES duplicate_groups(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS backup_metadata (
        id TEXT PRIMARY KEY,
        backup_type TEXT NOT NULL,
        file_path TEXT NOT NULL,
        encrypted INTEGER DEFAULT 0,
        record_count INTEGER DEFAULT 0,
        size_bytes INTEGER DEFAULT 0,
        parent_backup_id TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (parent_backup_id) REFERENCES backup_metadata(id)
    );
    CREATE TABLE IF NOT EXISTS item_versions (
        id TEXT PRIMARY KEY,
        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        snapshot_json TEXT NOT NULL,
        diff_text TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
    CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_item_versions_entity ON item_versions(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_data_transfers_direction ON data_transfers(direction);
  `)
}

function applyFallbackMigration011(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS plugins (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        version TEXT NOT NULL,
        description TEXT,
        author TEXT,
        entry_point TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        permissions_json TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS scripts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        language TEXT NOT NULL,
        code_content TEXT NOT NULL,
        description TEXT,
        last_run TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
  `)
}

function applyFallbackMigration012(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS saved_decisions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        options_json TEXT NOT NULL,
        factors_json TEXT NOT NULL,
        recommended_option TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS simulation_runs (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        input_parameters_json TEXT,
        output_results_json TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    );
  `)
}
