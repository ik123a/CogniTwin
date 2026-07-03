import { getDatabase } from '../database/connection'
import crypto from 'crypto'

export interface MaturationStats {
  noteId: string
  characterLength: number
  editCount: number
  tagCount: number
  relationshipCount: number
  state: string
  transitionedAt: string
}

export interface Milestone {
  id: string
  type: 'note' | 'task' | 'event' | 'idea_state'
  title: string
  timestamp: string
  details: {
    noteId?: string
    taskId?: string
    eventId?: string
    state?: string
    status?: string
    startTime?: string
  }
}

/**
 * Computes maturity stats and updates the state transitions for a note.
 */
export async function getMaturationStats(noteId: string): Promise<MaturationStats> {
  const db = getDatabase()

  const note = db.prepare('SELECT raw_text FROM notes WHERE id = ?').get(noteId) as
    { raw_text: string | null } | undefined
  if (!note) {
    throw new Error(`Note not found: ${noteId}`)
  }

  const rawText = note.raw_text || ''
  const characterLength = rawText.length

  const tagCountResult = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM item_tags WHERE item_id = ? AND item_type = 'note'
  `
    )
    .get(noteId) as { count: number }
  const tagCount = tagCountResult.count

  const relCountResult = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM relationships WHERE source_id = ? OR target_id = ?
  `
    )
    .get(noteId, noteId) as { count: number }
  const relationshipCount = relCountResult.count

  // Determine maturity stage:
  // seed (under 200 chars), draft (200-1000 chars), active (1000-3000 chars), mature (3000+ chars or has many relationships [>= 5])
  let state = 'seed'
  if (characterLength >= 3000 || relationshipCount >= 5) {
    state = 'mature'
  } else if (characterLength >= 1000) {
    state = 'active'
  } else if (characterLength >= 200) {
    state = 'draft'
  }

  // Fetch previous state from DB
  const previousState = db
    .prepare(
      `
    SELECT id, state, edit_count FROM idea_states 
    WHERE note_id = ? 
    ORDER BY transitioned_at DESC LIMIT 1
  `
    )
    .get(noteId) as { id: string; state: string; edit_count: number } | undefined

  let transitionedAt = new Date().toISOString().replace('T', ' ').substring(0, 19)
  let editCount = 1

  db.transaction(() => {
    if (!previousState) {
      // First state entry
      const newStateId = crypto.randomUUID()
      db.prepare(
        `
        INSERT INTO idea_states (id, note_id, state, character_length, edit_count, tag_count, transitioned_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      ).run(newStateId, noteId, state, characterLength, 1, tagCount, transitionedAt)
    } else if (previousState.state !== state) {
      // Log new transition state
      const newStateId = crypto.randomUUID()
      editCount = previousState.edit_count + 1
      db.prepare(
        `
        INSERT INTO idea_states (id, note_id, state, character_length, edit_count, tag_count, transitioned_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      ).run(newStateId, noteId, state, characterLength, editCount, tagCount, transitionedAt)

      db.prepare('INSERT INTO audit_log (id, user_id, action, details_json) VALUES (?, ?, ?, ?)').run(
        crypto.randomUUID(),
        'system',
        'IDEA_STATE_TRANSITION',
        JSON.stringify({ noteId, from: previousState.state, to: state })
      )
    } else {
      // Update existing record
      editCount = previousState.edit_count + 1
      db.prepare(
        `
        UPDATE idea_states
        SET character_length = ?, edit_count = edit_count + 1, tag_count = ?, transitioned_at = ?
        WHERE id = ?
      `
      ).run(characterLength, tagCount, transitionedAt, previousState.id)
    }
  })()

  return {
    noteId,
    characterLength,
    editCount,
    tagCount,
    relationshipCount,
    state,
    transitionedAt
  }
}

/**
 * Manually transition a note to a specific state (logs in idea_states).
 */
export async function transitionState(noteId: string, newState: string): Promise<void> {
  const db = getDatabase()

  const note = db.prepare('SELECT raw_text FROM notes WHERE id = ?').get(noteId) as
    { raw_text: string | null } | undefined
  if (!note) {
    throw new Error(`Note not found: ${noteId}`)
  }

  const rawText = note.raw_text || ''
  const characterLength = rawText.length

  const tagCountResult = db
    .prepare(
      `
    SELECT COUNT(*) as count FROM item_tags WHERE item_id = ? AND item_type = 'note'
  `
    )
    .get(noteId) as { count: number }
  const tagCount = tagCountResult.count

  const previousState = db
    .prepare(
      `
    SELECT id, state, edit_count FROM idea_states 
    WHERE note_id = ? 
    ORDER BY transitioned_at DESC LIMIT 1
  `
    )
    .get(noteId) as { id: string; state: string; edit_count: number } | undefined

  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19)
  const editCount = previousState ? previousState.edit_count + 1 : 1

  db.transaction(() => {
    const stateId = crypto.randomUUID()
    db.prepare(
      `
      INSERT INTO idea_states (id, note_id, state, character_length, edit_count, tag_count, transitioned_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(stateId, noteId, newState, characterLength, editCount, tagCount, nowStr)

    db.prepare('INSERT INTO audit_log (id, user_id, action, details_json) VALUES (?, ?, ?, ?)').run(
      crypto.randomUUID(),
      'system',
      'IDEA_STATE_MANUAL_TRANSITION',
      JSON.stringify({ noteId, to: newState })
    )
  })()
}

/**
 * Compiles notes, tasks, events, and maturation logs into a chronological milestone timeline.
 */
export async function getKnowledgeTimeline(): Promise<Milestone[]> {
  const db = getDatabase()

  // Fetch all notes creation
  const notes = db.prepare('SELECT id, title, created_at FROM notes').all() as Array<{
    id: string
    title: string
    created_at: string
  }>
  const noteMilestones: Milestone[] = notes.map((n) => ({
    id: n.id,
    type: 'note',
    title: `Note Created: ${n.title}`,
    timestamp: n.created_at,
    details: { noteId: n.id }
  }))

  // Fetch all tasks creation
  const tasks = db.prepare('SELECT id, title, status, created_at FROM tasks').all() as Array<{
    id: string
    title: string
    status: string
    created_at: string
  }>
  const taskMilestones: Milestone[] = tasks.map((t) => ({
    id: t.id,
    type: 'task',
    title: `Task Created: ${t.title}`,
    timestamp: t.created_at,
    details: { taskId: t.id, status: t.status }
  }))

  // Fetch all events scheduled
  const events = db.prepare('SELECT id, title, start_time, created_at FROM events').all() as Array<{
    id: string
    title: string
    start_time: string
    created_at: string
  }>
  const eventMilestones: Milestone[] = events.map((e) => ({
    id: e.id,
    type: 'event',
    title: `Event Scheduled: ${e.title}`,
    timestamp: e.created_at || e.start_time,
    details: { eventId: e.id, startTime: e.start_time }
  }))

  // Fetch all state transitions
  const transitions = db
    .prepare(
      `
    SELECT is.id, is.note_id, is.state, is.transitioned_at, n.title
    FROM idea_states is
    JOIN notes n ON is.note_id = n.id
  `
    )
    .all() as Array<{
    id: string
    note_id: string
    state: string
    transitioned_at: string
    title: string
  }>
  const stateMilestones: Milestone[] = transitions.map((s) => ({
    id: s.id,
    type: 'idea_state',
    title: `Note "${s.title}" matured to state: ${s.state.toUpperCase()}`,
    timestamp: s.transitioned_at,
    details: { noteId: s.note_id, state: s.state }
  }))

  // Combine and sort chronologically (newest first)
  const timeline = [
    ...noteMilestones,
    ...taskMilestones,
    ...eventMilestones,
    ...stateMilestones
  ].sort((a, b) => {
    const dateA = new Date(a.timestamp).getTime()
    const dateB = new Date(b.timestamp).getTime()
    return dateB - dateA
  })

  return timeline
}
