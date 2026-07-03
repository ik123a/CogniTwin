import { getDatabase } from '../database/connection'
import crypto from 'crypto'

export interface NoteVersion {
  id: string
  noteId: string
  version: number
  title: string
  content: string
  patch: string | null
  createdAt: string
}

/**
 * Computes a simple line-by-line diff between two strings.
 * Returns a patch description format.
 */
export function computeLineDiff(text1: string, text2: string): string {
  const lines1 = text1.split(/\r?\n/)
  const lines2 = text2.split(/\r?\n/)

  const n = lines1.length
  const m = lines2.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0))

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (lines1[i - 1] === lines2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
      }
    }
  }

  const diff: string[] = []
  let i = n
  let j = m

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && lines1[i - 1] === lines2[j - 1]) {
      diff.unshift(`  ${lines1[i - 1]}`)
      i--
      j--
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift(`+ ${lines2[j - 1]}`)
      j--
    } else if (i > 0 && (j === 0 || dp[i - 1][j] > dp[i][j - 1])) {
      diff.unshift(`- ${lines1[i - 1]}`)
      i--
    }
  }

  return diff.join('\n')
}

/**
 * Creates a version snapshot for a note, computing the diff against the previous snapshot.
 */
export async function createSnapshot(noteId: string): Promise<NoteVersion> {
  const db = getDatabase()

  // 1. Fetch current note
  const note = db.prepare('SELECT title, content FROM notes WHERE id = ?').get(noteId) as
    { title: string; content: string | null } | undefined
  if (!note) {
    throw new Error(`Note not found: ${noteId}`)
  }

  const currentTitle = note.title
  const currentContent = note.content || ''

  // 2. Fetch previous version
  const previous = db
    .prepare(
      `
    SELECT version, title, content FROM note_versions 
    WHERE note_id = ? 
    ORDER BY version DESC LIMIT 1
  `
    )
    .get(noteId) as { version: number; title: string; content: string } | undefined

  let newVersionNumber = 1
  let patch: string | null = null

  if (previous) {
    // If no changes, return the previous version record to prevent duplicates
    if (previous.title === currentTitle && previous.content === currentContent) {
      const existing = db
        .prepare(
          `
        SELECT id, note_id as noteId, version, title, content, patch, created_at as createdAt
        FROM note_versions WHERE note_id = ? ORDER BY version DESC LIMIT 1
      `
        )
        .get(noteId) as NoteVersion
      return existing
    }
    newVersionNumber = previous.version + 1
    patch = computeLineDiff(previous.content, currentContent)
  } else {
    // First snapshot
    patch = computeLineDiff('', currentContent)
  }

  const versionId = crypto.randomUUID()
  const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 19)

  db.prepare(
    `
    INSERT INTO note_versions (id, note_id, version, title, content, patch, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `
  ).run(versionId, noteId, newVersionNumber, currentTitle, currentContent, patch, createdAt)

  db.prepare('INSERT INTO audit_log (id, user_id, action, details_json) VALUES (?, ?, ?, ?)').run(
    crypto.randomUUID(),
    'system',
    'NOTE_SNAPSHOT_CREATED',
    JSON.stringify({ noteId, version: newVersionNumber })
  )

  return {
    id: versionId,
    noteId,
    version: newVersionNumber,
    title: currentTitle,
    content: currentContent,
    patch,
    createdAt
  }
}

/**
 * Lists the version history for a note.
 */
export async function getHistory(noteId: string): Promise<NoteVersion[]> {
  const db = getDatabase()
  const rows = db
    .prepare(
      `
    SELECT id, note_id as noteId, version, title, content, patch, created_at as createdAt
    FROM note_versions
    WHERE note_id = ?
    ORDER BY version DESC
  `
    )
    .all(noteId) as NoteVersion[]
  return rows
}

/**
 * Gets a specific version's patch/diff.
 */
export async function getDiff(versionId: string): Promise<string | null> {
  const db = getDatabase()
  const row = db.prepare('SELECT patch FROM note_versions WHERE id = ?').get(versionId) as
    { patch: string | null } | undefined
  return row ? row.patch : null
}

/**
 * Restores a note to a specific version.
 * Creates a new snapshot recording the rollback.
 */
export async function rollbackToVersion(noteId: string, versionId: string): Promise<any> {
  const db = getDatabase()

  // Fetch targeted version
  const targetVersion = db
    .prepare('SELECT title, content FROM note_versions WHERE id = ? AND note_id = ?')
    .get(versionId, noteId) as { title: string; content: string } | undefined
  if (!targetVersion) {
    throw new Error(`Version ${versionId} not found for note ${noteId}`)
  }

  // Update note content in notes table
  db.prepare(
    `
    UPDATE notes 
    SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `
  ).run(targetVersion.title, targetVersion.content, noteId)

  db.prepare('INSERT INTO audit_log (id, user_id, action, details_json) VALUES (?, ?, ?, ?)').run(
    crypto.randomUUID(),
    'system',
    'NOTE_ROLLBACK',
    JSON.stringify({ noteId, versionId })
  )

  // Create new snapshot showing the rollback change
  const newSnapshot = await createSnapshot(noteId)

  return {
    success: true,
    noteId,
    title: targetVersion.title,
    content: targetVersion.content,
    newVersion: newSnapshot.version
  }
}

/**
 * Creates a version snapshot for any item (task, project, file).
 */
export async function snapshotItem(
  entityType: string,
  entityId: string,
  snapshotData: any
): Promise<any> {
  const db = getDatabase()

  // Get max version number
  const prev = db
    .prepare(
      `
    SELECT version_number FROM item_versions 
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY version_number DESC LIMIT 1
  `
    )
    .get(entityType, entityId) as { version_number: number } | undefined

  const versionNumber = prev ? prev.version_number + 1 : 1
  const id = crypto.randomUUID()
  const snapshotJson = JSON.stringify(snapshotData)
  const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 19)

  db.prepare(
    `
    INSERT INTO item_versions (id, entity_type, entity_id, version_number, snapshot_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `
  ).run(id, entityType, entityId, versionNumber, snapshotJson, createdAt)

  db.prepare('INSERT INTO audit_log (id, user_id, action, details_json) VALUES (?, ?, ?, ?)').run(
    crypto.randomUUID(),
    'system',
    'ITEM_SNAPSHOT_CREATED',
    JSON.stringify({ entityType, entityId, version: versionNumber })
  )

  return { id, versionNumber, entityType, entityId }
}

/**
 * Returns version snapshot list for any item.
 */
export function getItemHistory(entityType: string, entityId: string): any[] {
  const db = getDatabase()
  return db
    .prepare(
      `
    SELECT id, entity_type as entityType, entity_id as entityId, version_number as versionNumber, snapshot_json as snapshotJson, diff_text as diffText, created_at as createdAt
    FROM item_versions
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY version_number DESC
  `
    )
    .all(entityType, entityId)
}

/**
 * Rolls back a task or project to a previous snapshot state.
 */
export function rollbackItem(entityType: string, entityId: string, versionId: string): any {
  const db = getDatabase()

  const target = db
    .prepare(
      `
    SELECT snapshot_json FROM item_versions 
    WHERE id = ? AND entity_type = ? AND entity_id = ?
  `
    )
    .get(versionId, entityType, entityId) as { snapshot_json: string } | undefined

  if (!target) {
    throw new Error(`Snapshot ${versionId} not found`)
  }

  const data = JSON.parse(target.snapshot_json)

  if (entityType === 'task') {
    db.prepare(
      `
      UPDATE tasks 
      SET title = ?, description = ?, due_date = ?, priority = ?, status = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `
    ).run(
      data.title,
      data.description || '',
      data.due_date || null,
      data.priority || 'Medium',
      data.status || 'Todo',
      entityId
    )
  } else if (entityType === 'project') {
    db.prepare(
      `
      UPDATE projects 
      SET name = ?, description = ?, color = ?, icon = ?
      WHERE id = ?
    `
    ).run(
      data.name,
      data.description || '',
      data.color || '#3498db',
      data.icon || 'folder',
      entityId
    )
  } else if (entityType === 'file') {
    db.prepare(
      `
      UPDATE files 
      SET name = ?, path = ?, type = ?, size_bytes = ?, raw_text = ?, metadata = ?
      WHERE id = ?
    `
    ).run(
      data.name,
      data.path,
      data.type,
      data.size_bytes,
      data.raw_text || null,
      JSON.stringify(data.metadata || {}),
      entityId
    )
  } else {
    throw new Error(`Unsupported rollback entity type: ${entityType}`)
  }

  db.prepare('INSERT INTO audit_log (id, user_id, action, details_json) VALUES (?, ?, ?, ?)').run(
    crypto.randomUUID(),
    'system',
    'ITEM_ROLLBACK',
    JSON.stringify({ entityType, entityId, versionId })
  )

  return { success: true, entityType, entityId, data }
}
