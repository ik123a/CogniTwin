import { getDatabase } from '../database/connection'
import crypto from 'crypto'

export interface DuplicateGroup {
  id: string
  entityType: string
  similarityScore: number
  members: Array<{
    id: string
    title: string
    details: string
    isPrimary: number
  }>
}

/**
 * Calculates Levenshtein distance between two strings.
 */
function getLevenshteinDistance(a: string, b: string): number {
  const tmp: number[][] = []
  for (let i = 0; i <= a.length; i++) {
    tmp[i] = [i]
  }
  for (let j = 0; j <= b.length; j++) {
    tmp[0][j] = j
  }
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      tmp[i][j] = Math.min(
        tmp[i - 1][j] + 1,
        tmp[i][j - 1] + 1,
        tmp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
    }
  }
  return tmp[a.length][b.length]
}

/**
 * Calculates a similarity score between 0 and 1.
 */
function getStringSimilarity(s1: string, s2: string): number {
  const clean1 = s1.toLowerCase().trim()
  const clean2 = s2.toLowerCase().trim()
  if (clean1 === clean2) return 1.0
  if (clean1.length === 0 || clean2.length === 0) return 0.0

  const dist = getLevenshteinDistance(clean1, clean2)
  const maxLen = Math.max(clean1.length, clean2.length)
  return 1.0 - dist / maxLen
}

/**
 * Scans notes and tasks for duplicates.
 */
export function scanForDuplicates(entityType?: 'note' | 'task'): { groupsFound: number } {
  const db = getDatabase()
  let groupsFound = 0

  // Clear previous duplicate groups that are pending
  db.prepare(
    `
    DELETE FROM duplicate_groups 
    WHERE id IN (SELECT id FROM duplicate_groups WHERE status = 'pending')
  `
  ).run()

  const typesToScan = entityType ? [entityType] : ['note', 'task']

  for (const type of typesToScan) {
    let items: Array<{ id: string; title: string; content?: string }> = []

    if (type === 'note') {
      items = db.prepare('SELECT id, title, content FROM notes').all() as any[]
    } else {
      items = db.prepare('SELECT id, title, description as content FROM tasks').all() as any[]
    }

    const matchedPairs = new Set<string>()

    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const item1 = items[i]
        const item2 = items[j]

        // Skip if already processed in this scan session
        if (matchedPairs.has(item1.id) || matchedPairs.has(item2.id)) continue

        const similarity = getStringSimilarity(item1.title, item2.title)

        // Similarity threshold >= 0.8
        if (similarity >= 0.8) {
          groupsFound++
          const groupId = crypto.randomUUID()

          db.prepare(
            `
            INSERT INTO duplicate_groups (id, entity_type, similarity_score, status)
            VALUES (?, ?, ?, 'pending')
          `
          ).run(groupId, type, similarity)

          // Insert member records. Mark the first one as primary by default
          db.prepare(
            `
            INSERT INTO duplicate_group_members (group_id, entity_id, is_primary)
            VALUES (?, ?, 1)
          `
          ).run(groupId, item1.id)

          db.prepare(
            `
            INSERT INTO duplicate_group_members (group_id, entity_id, is_primary)
            VALUES (?, ?, 0)
          `
          ).run(groupId, item2.id)

          matchedPairs.add(item1.id)
          matchedPairs.add(item2.id)
        }
      }
    }
  }

  return { groupsFound }
}

/**
 * Returns duplicate groups currently pending review.
 */
export function getDuplicateGroups(): DuplicateGroup[] {
  const db = getDatabase()
  const groups = db
    .prepare(
      `
    SELECT id, entity_type as entityType, similarity_score as similarityScore
    FROM duplicate_groups
    WHERE status = 'pending'
  `
    )
    .all() as Array<{ id: string; entityType: string; similarityScore: number }>

  const result: DuplicateGroup[] = []

  for (const group of groups) {
    const members = db
      .prepare(
        `
      SELECT m.entity_id as id, m.is_primary as isPrimary
      FROM duplicate_group_members m
      WHERE m.group_id = ?
    `
      )
      .all(group.id) as Array<{ id: string; isPrimary: number }>

    const memberDetails: any[] = []
    for (const member of members) {
      let details = ''
      let title = ''

      if (group.entityType === 'note') {
        const note = db
          .prepare('SELECT title, content FROM notes WHERE id = ?')
          .get(member.id) as any
        if (note) {
          title = note.title
          details = (note.content || '').substring(0, 100)
        }
      } else {
        const task = db
          .prepare('SELECT title, description FROM tasks WHERE id = ?')
          .get(member.id) as any
        if (task) {
          title = task.title
          details = (task.description || '').substring(0, 100)
        }
      }

      if (title) {
        memberDetails.push({
          id: member.id,
          title,
          details,
          isPrimary: member.isPrimary
        })
      }
    }

    if (memberDetails.length > 0) {
      result.push({
        id: group.id,
        entityType: group.entityType,
        similarityScore: group.similarityScore,
        members: memberDetails
      })
    }
  }

  return result
}

/**
 * Merges duplicates by deleting the non-primary duplicates and transferring tags/relations to primary.
 */
export function mergeDuplicates(groupId: string, primaryId: string): { success: boolean } {
  const db = getDatabase()

  const group = db.prepare('SELECT entity_type FROM duplicate_groups WHERE id = ?').get(groupId) as
    { entity_type: string } | undefined
  if (!group) return { success: false }

  const members = db
    .prepare('SELECT entity_id FROM duplicate_group_members WHERE group_id = ?')
    .all(groupId) as Array<{ entity_id: string }>
  const secondaryIds = members.map((m) => m.entity_id).filter((id) => id !== primaryId)

  const transaction = db.transaction(() => {
    // 1. Transfer tags and relationships from secondaries to primary
    for (const secId of secondaryIds) {
      db.prepare(
        `
        UPDATE OR IGNORE item_tags 
        SET item_id = ? 
        WHERE item_id = ?
      `
      ).run(primaryId, secId)

      // Clean up orphaned tag relationships that couldn't be transferred (due to unique constraints)
      db.prepare('DELETE FROM item_tags WHERE item_id = ?').run(secId)

      // Re-map relationships
      db.prepare('UPDATE OR IGNORE relationships SET source_id = ? WHERE source_id = ?').run(
        primaryId,
        secId
      )
      db.prepare('UPDATE OR IGNORE relationships SET target_id = ? WHERE target_id = ?').run(
        primaryId,
        secId
      )

      // Delete secondary entities
      if (group.entity_type === 'note') {
        db.prepare('DELETE FROM notes WHERE id = ?').run(secId)
      } else {
        db.prepare('DELETE FROM tasks WHERE id = ?').run(secId)
      }
    }

    // 2. Mark duplicate group as merged
    db.prepare("UPDATE duplicate_groups SET status = 'merged' WHERE id = ?").run(groupId)
  })

  try {
    transaction()
    return { success: true }
  } catch (error) {
    console.error('Merge duplicates failed:', error)
    return { success: false }
  }
}

/**
 * Dismisses a duplicate match suggestion.
 */
export function dismissGroup(groupId: string): { success: boolean } {
  const db = getDatabase()
  const result = db
    .prepare("UPDATE duplicate_groups SET status = 'dismissed' WHERE id = ?")
    .run(groupId)
  return { success: result.changes > 0 }
}
