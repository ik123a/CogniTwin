import { getDatabase } from '../database/connection'
import crypto from 'crypto'

export interface PrivacyRule {
  id: string
  pattern: string
  replacement: string
  is_active: number
  created_at: string
}

/**
 * Lists all redaction rules.
 */
export function getRules(): PrivacyRule[] {
  const db = getDatabase()
  return db
    .prepare('SELECT id, pattern, replacement, is_active, created_at FROM privacy_rules')
    .all() as PrivacyRule[]
}

/**
 * Creates a new redaction rule.
 */
export function createRule(pattern: string, replacement: string = '███'): PrivacyRule {
  const db = getDatabase()
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 19)

  db.prepare(
    `
    INSERT INTO privacy_rules (id, pattern, replacement, is_active, created_at)
    VALUES (?, ?, ?, 1, ?)
  `
  ).run(id, pattern, replacement, createdAt)

  return { id, pattern, replacement, is_active: 1, created_at: createdAt }
}

/**
 * Deletes a redaction rule.
 */
export function deleteRule(ruleId: string): { success: boolean } {
  const db = getDatabase()
  const result = db.prepare('DELETE FROM privacy_rules WHERE id = ?').run(ruleId)
  return { success: result.changes > 0 }
}

/**
 * Redacts matches of active rules in the given text content.
 */
export function redactContent(text: string): string {
  if (!text) return ''
  const rules = getRules().filter((r) => r.is_active === 1)
  let redacted = text

  for (const rule of rules) {
    try {
      // Try treating rule pattern as regex first; if it fails, treat as literal replacement
      const regex = new RegExp(rule.pattern, 'gi')
      redacted = redacted.replace(regex, rule.replacement)
    } catch {
      // Fallback to literal global replace
      const literalPattern = rule.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(literalPattern, 'gi')
      redacted = redacted.replace(regex, rule.replacement)
    }
  }

  return redacted
}

/**
 * Securely deletes an entity (3-pass overwrite pattern followed by deletion)
 * to comply with secure deletion (spec feature 68).
 */
export function secureDelete(entityType: string, entityId: string): { success: boolean } {
  const db = getDatabase()

  try {
    if (entityType === 'note') {
      const note = db.prepare('SELECT title, content FROM notes WHERE id = ?').get(entityId) as
        { title: string; content: string | null } | undefined
      if (note) {
        // Multi-pass overwrite
        const titleLen = note.title.length
        const contentLen = (note.content || '').length

        const overwritePasses = 3
        for (let i = 0; i < overwritePasses; i++) {
          const randTitle = crypto.randomBytes(titleLen).toString('base64').substring(0, titleLen)
          const randContent = crypto
            .randomBytes(contentLen)
            .toString('base64')
            .substring(0, contentLen)
          db.prepare('UPDATE notes SET title = ?, content = ?, raw_text = ? WHERE id = ?').run(
            randTitle,
            randContent,
            randContent,
            entityId
          )
        }

        // Delete from notes, which cascades or removes tags/embeddings/checksums
        db.prepare('DELETE FROM notes WHERE id = ?').run(entityId)
        db.prepare('DELETE FROM data_checksums WHERE entity_type = "note" AND entity_id = ?').run(
          entityId
        )
        db.prepare('DELETE FROM note_versions WHERE note_id = ?').run(entityId)
        db.prepare('DELETE FROM note_drafts WHERE note_id = ?').run(entityId)
      }
    } else if (entityType === 'task') {
      const task = db.prepare('SELECT title, description FROM tasks WHERE id = ?').get(entityId) as
        { title: string; description: string | null } | undefined
      if (task) {
        const titleLen = task.title.length
        const descLen = (task.description || '').length

        for (let i = 0; i < 3; i++) {
          const randTitle = crypto.randomBytes(titleLen).toString('base64').substring(0, titleLen)
          const randDesc = crypto.randomBytes(descLen).toString('base64').substring(0, descLen)
          db.prepare('UPDATE tasks SET title = ?, description = ? WHERE id = ?').run(
            randTitle,
            randDesc,
            entityId
          )
        }
        db.prepare('DELETE FROM tasks WHERE id = ?').run(entityId)
        db.prepare('DELETE FROM data_checksums WHERE entity_type = "task" AND entity_id = ?').run(
          entityId
        )
      }
    } else if (entityType === 'file') {
      const file = db.prepare('SELECT name, raw_text FROM files WHERE id = ?').get(entityId) as
        { name: string; raw_text: string | null } | undefined
      if (file) {
        const nameLen = file.name.length
        const textLen = (file.raw_text || '').length

        for (let i = 0; i < 3; i++) {
          const randName = crypto.randomBytes(nameLen).toString('base64').substring(0, nameLen)
          const randText = crypto.randomBytes(textLen).toString('base64').substring(0, textLen)
          db.prepare('UPDATE files SET name = ?, raw_text = ? WHERE id = ?').run(
            randName,
            randText,
            entityId
          )
        }
        db.prepare('DELETE FROM files WHERE id = ?').run(entityId)
        db.prepare('DELETE FROM data_checksums WHERE entity_type = "file" AND entity_id = ?').run(
          entityId
        )
      }
    } else {
      return { success: false }
    }

    // Force SQLite database VACUUM to reclaim space and ensure overwritten bytes are expunged from memory/disk
    try {
      db.exec('VACUUM;')
    } catch (e) {
      console.warn('Auto-VACUUM after secure deletion failed (usually safe to ignore):', e)
    }

    return { success: true }
  } catch (error) {
    console.error(`Secure delete failed for ${entityType} ${entityId}:`, error)
    return { success: false }
  }
}
