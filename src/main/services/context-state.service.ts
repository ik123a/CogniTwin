import { getDatabase } from '../database/connection'

export interface NoteDraft {
  noteId: string
  title: string
  content: string
  updatedAt: string
}

export interface CommandHistoryItem {
  id: number
  command: string
  executedAt: string
}

/**
 * Saves the workspace state profile for a given project context.
 * @param projectId The project ID
 * @param contextData The workspace context data (state object)
 */
export async function saveWorkspaceContext(projectId: string, contextData: any): Promise<void> {
  const db = getDatabase()
  const dataStr = typeof contextData === 'string' ? contextData : JSON.stringify(contextData)
  db.prepare(
    `
    INSERT OR REPLACE INTO workspace_contexts (project_id, context_data, updated_at)
    VALUES (?, ?, datetime('now'))
  `
  ).run(projectId, dataStr)
}

/**
 * Loads the workspace state profile for a given project context.
 * @param projectId The project ID
 * @returns The parsed context state object or null
 */
export async function loadWorkspaceContext(projectId: string): Promise<any | null> {
  const db = getDatabase()
  const row = db
    .prepare(
      `
    SELECT context_data FROM workspace_contexts WHERE project_id = ?
  `
    )
    .get(projectId) as { context_data: string } | undefined

  if (!row) return null
  try {
    return JSON.parse(row.context_data)
  } catch (error) {
    return row.context_data
  }
}

/**
 * Saves a note draft state.
 * @param noteId The note ID
 * @param title The draft title
 * @param content The draft content
 */
export async function saveDraft(noteId: string, title: string, content: string): Promise<void> {
  const db = getDatabase()
  db.prepare(
    `
    INSERT OR REPLACE INTO note_drafts (note_id, title, content, updated_at)
    VALUES (?, ?, ?, datetime('now'))
  `
  ).run(noteId, title, content)
}

/**
 * Discards/deletes a note draft.
 * @param noteId The note ID
 */
export async function discardDraft(noteId: string): Promise<void> {
  const db = getDatabase()
  db.prepare(
    `
    DELETE FROM note_drafts WHERE note_id = ?
  `
  ).run(noteId)
}

/**
 * Recovers all saved note drafts.
 * @returns A list of recovered drafts
 */
export async function recoverDrafts(): Promise<NoteDraft[]> {
  const db = getDatabase()
  const rows = db
    .prepare(
      `
    SELECT note_id, title, content, updated_at 
    FROM note_drafts 
    ORDER BY updated_at DESC
  `
    )
    .all() as Array<{ note_id: string; title: string; content: string; updated_at: string }>

  return rows.map((r) => ({
    noteId: r.note_id,
    title: r.title,
    content: r.content,
    updatedAt: r.updated_at
  }))
}

/**
 * Logs a command execution to the command history.
 * @param command The command name/string
 */
export async function logCommandExecution(command: string): Promise<void> {
  const db = getDatabase()
  db.prepare(
    `
    INSERT INTO command_history (command, executed_at)
    VALUES (?, datetime('now'))
  `
  ).run(command)
}

/**
 * Fetches command history items.
 * @param limit Maximum history items to retrieve
 */
export async function getCommandHistory(limit: number = 50): Promise<CommandHistoryItem[]> {
  const db = getDatabase()
  const rows = db
    .prepare(
      `
    SELECT id, command, executed_at 
    FROM command_history 
    ORDER BY id DESC 
    LIMIT ?
  `
    )
    .all(limit) as Array<{ id: number; command: string; executed_at: string }>

  return rows.map((r) => ({
    id: r.id,
    command: r.command,
    executedAt: r.executed_at
  }))
}
