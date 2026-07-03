import { getDatabase } from '../database/connection'
import crypto from 'crypto'

export interface IntegrityIssue {
  type: 'checksum_mismatch' | 'orphan_record' | 'broken_link'
  entityType: string
  entityId: string
  description: string
  severity: 'low' | 'medium' | 'high'
  payload?: any
}

/**
 * Computes a SHA-256 checksum for the given text content.
 */
export function computeChecksum(content: string): string {
  return crypto
    .createHash('sha256')
    .update(content || '')
    .digest('hex')
}

/**
 * Stores or updates a checksum in the database.
 */
export function storeChecksum(entityType: string, entityId: string, content: string): void {
  const db = getDatabase()
  const checksum = computeChecksum(content)
  const verifiedAt = new Date().toISOString().replace('T', ' ').substring(0, 19)

  db.prepare(
    `
    INSERT INTO data_checksums (entity_type, entity_id, checksum, verified_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(entity_type, entity_id) DO UPDATE SET
      checksum = excluded.checksum,
      verified_at = excluded.verified_at
  `
  ).run(entityType, entityId, checksum, verifiedAt)
}

/**
 * Verifies if the stored checksum matches the computed checksum.
 */
export function verifyChecksum(
  entityType: string,
  entityId: string,
  currentContent: string
): { valid: boolean; expected: string; actual: string } {
  const db = getDatabase()
  const actual = computeChecksum(currentContent)
  const row = db
    .prepare(
      `
    SELECT checksum FROM data_checksums 
    WHERE entity_type = ? AND entity_id = ?
  `
    )
    .get(entityType, entityId) as { checksum: string } | undefined

  if (!row) {
    // If no checksum is stored, store it and mark as valid
    storeChecksum(entityType, entityId, currentContent)
    return { valid: true, expected: actual, actual }
  }

  const expected = row.checksum
  return {
    valid: expected === actual,
    expected,
    actual
  }
}

/**
 * Scans all notes and files to verify their checksums.
 */
export function runIntegrityCheck(): {
  total: number
  valid: number
  mismatches: IntegrityIssue[]
} {
  const db = getDatabase()
  const mismatches: IntegrityIssue[] = []
  let total = 0
  let valid = 0

  // Check notes
  const notes = db.prepare('SELECT id, title, content FROM notes').all() as Array<{
    id: string
    title: string
    content: string | null
  }>

  for (const note of notes) {
    total++
    const check = verifyChecksum('note', note.id, note.content || '')
    if (check.valid) {
      valid++
    } else {
      mismatches.push({
        type: 'checksum_mismatch',
        entityType: 'note',
        entityId: note.id,
        description: `Checksum mismatch on note "${note.title}". Data may be corrupted or modified out-of-band.`,
        severity: 'high',
        payload: { expected: check.expected, actual: check.actual }
      })
    }
  }

  // Check files (raw text content)
  const files = db.prepare('SELECT id, name, raw_text FROM files').all() as Array<{
    id: string
    name: string
    raw_text: string | null
  }>

  for (const file of files) {
    total++
    const check = verifyChecksum('file', file.id, file.raw_text || '')
    if (check.valid) {
      valid++
    } else {
      mismatches.push({
        type: 'checksum_mismatch',
        entityType: 'file',
        entityId: file.id,
        description: `Checksum mismatch on imported file "${file.name}".`,
        severity: 'medium',
        payload: { expected: check.expected, actual: check.actual }
      })
    }
  }

  return { total, valid, mismatches }
}

/**
 * Validates database referential integrity and detects orphan/broken records.
 */
export function validateReferences(): { orphans: IntegrityIssue[]; brokenLinks: IntegrityIssue[] } {
  const db = getDatabase()
  const orphans: IntegrityIssue[] = []
  const brokenLinks: IntegrityIssue[] = []

  // 1. Check notes referencing non-existent projects
  const orphanNotes = db
    .prepare(
      `
    SELECT n.id, n.title, n.project_id 
    FROM notes n
    LEFT JOIN projects p ON n.project_id = p.id
    WHERE n.project_id IS NOT NULL AND p.id IS NULL
  `
    )
    .all() as Array<{ id: string; title: string; project_id: string }>

  for (const row of orphanNotes) {
    brokenLinks.push({
      type: 'broken_link',
      entityType: 'note',
      entityId: row.id,
      description: `Note "${row.title}" references a project (${row.project_id}) that does not exist.`,
      severity: 'medium',
      payload: { projectId: row.project_id }
    })
  }

  // 2. Check tasks referencing non-existent projects
  const orphanTasks = db
    .prepare(
      `
    SELECT t.id, t.title, t.project_id
    FROM tasks t
    LEFT JOIN projects p ON t.project_id = p.id
    WHERE t.project_id IS NOT NULL AND p.id IS NULL
  `
    )
    .all() as Array<{ id: string; title: string; project_id: string }>

  for (const row of orphanTasks) {
    brokenLinks.push({
      type: 'broken_link',
      entityType: 'task',
      entityId: row.id,
      description: `Task "${row.title}" references a project (${row.project_id}) that does not exist.`,
      severity: 'medium',
      payload: { projectId: row.project_id }
    })
  }

  // 3. Check item_tags pointing to non-existent tags
  const orphanItemTags = db
    .prepare(
      `
    SELECT it.tag_id, it.item_id, it.item_type
    FROM item_tags it
    LEFT JOIN tags t ON it.tag_id = t.id
    WHERE t.id IS NULL
  `
    )
    .all() as Array<{ tag_id: string; item_id: string; item_type: string }>

  for (const row of orphanItemTags) {
    orphans.push({
      type: 'orphan_record',
      entityType: 'item_tag',
      entityId: `${row.tag_id}:${row.item_id}`,
      description: `Tag mapping targets tag_id (${row.tag_id}) which does not exist.`,
      severity: 'low',
      payload: { tagId: row.tag_id, itemId: row.item_id, itemType: row.item_type }
    })
  }

  // 4. Check subtasks pointing to non-existent tasks
  const orphanSubtasks = db
    .prepare(
      `
    SELECT s.id, s.title, s.task_id
    FROM subtasks s
    LEFT JOIN tasks t ON s.task_id = t.id
    WHERE t.id IS NULL
  `
    )
    .all() as Array<{ id: string; title: string; task_id: string }>

  for (const row of orphanSubtasks) {
    orphans.push({
      type: 'orphan_record',
      entityType: 'subtask',
      entityId: row.id,
      description: `Subtask "${row.title}" refers to missing parent task (${row.task_id}).`,
      severity: 'high',
      payload: { taskId: row.task_id }
    })
  }

  return { orphans, brokenLinks }
}

/**
 * Attempts to repair detected database reference issues.
 */
export function autoRepair(issues: IntegrityIssue[]): { repaired: number; failed: number } {
  const db = getDatabase()
  let repaired = 0
  let failed = 0

  // Run in database transaction
  const transaction = db.transaction((items: IntegrityIssue[]) => {
    for (const issue of items) {
      try {
        if (issue.type === 'broken_link') {
          if (issue.entityType === 'note') {
            // Null out the project reference
            db.prepare('UPDATE notes SET project_id = NULL WHERE id = ?').run(issue.entityId)
            repaired++
          } else if (issue.entityType === 'task') {
            db.prepare('UPDATE tasks SET project_id = NULL WHERE id = ?').run(issue.entityId)
            repaired++
          } else {
            failed++
          }
        } else if (issue.type === 'orphan_record') {
          if (issue.entityType === 'item_tag') {
            const [tagId, itemId] = issue.entityId.split(':')
            db.prepare('DELETE FROM item_tags WHERE tag_id = ? AND item_id = ?').run(tagId, itemId)
            repaired++
          } else if (issue.entityType === 'subtask') {
            db.prepare('DELETE FROM subtasks WHERE id = ?').run(issue.entityId)
            repaired++
          } else {
            failed++
          }
        } else if (issue.type === 'checksum_mismatch') {
          // Fix checksum mismatch by re-computing and storing current state as the source of truth
          if (issue.entityType === 'note') {
            const note = db
              .prepare('SELECT content FROM notes WHERE id = ?')
              .get(issue.entityId) as { content: string | null } | undefined
            if (note) {
              storeChecksum('note', issue.entityId, note.content || '')
              repaired++
            } else {
              failed++
            }
          } else if (issue.entityType === 'file') {
            const file = db
              .prepare('SELECT raw_text FROM files WHERE id = ?')
              .get(issue.entityId) as { raw_text: string | null } | undefined
            if (file) {
              storeChecksum('file', issue.entityId, file.raw_text || '')
              repaired++
            } else {
              failed++
            }
          } else {
            failed++
          }
        } else {
          failed++
        }
      } catch (err) {
        console.error('Error repairing issue:', issue, err)
        failed++
      }
    }
  })

  transaction(issues)
  return { repaired, failed }
}
