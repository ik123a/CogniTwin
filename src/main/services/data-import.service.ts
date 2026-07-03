import { getDatabase } from '../database/connection'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

function logTransfer(
  direction: 'export' | 'import',
  format: string,
  itemCount: number,
  filePath: string,
  status: string,
  errorMessage: string | null = null
): void {
  const db = getDatabase()
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 19)

  db.prepare(
    `
    INSERT INTO data_transfers (id, direction, format, item_count, file_path, status, error_message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `
  ).run(id, direction, format, itemCount, filePath, status, errorMessage, createdAt)
}

/**
 * Auto-detects the format of the file to import.
 */
export function detectFormat(filePath: string): { format: string; confidence: number } {
  const ext = path.extname(filePath).toLowerCase()

  if (ext === '.json') {
    try {
      const content = fs.readFileSync(filePath, 'utf8')
      const parsed = JSON.parse(content)
      if (parsed.projects || parsed.notes || parsed.tasks) {
        return { format: 'json', confidence: 1.0 }
      }
      return { format: 'json_generic', confidence: 0.8 }
    } catch {
      return { format: 'unknown', confidence: 0.0 }
    }
  }

  if (ext === '.csv') {
    return { format: 'csv', confidence: 0.9 }
  }

  if (ext === '.md' || ext === '.markdown') {
    return { format: 'markdown', confidence: 0.9 }
  }

  // Check if directory
  try {
    const stats = fs.statSync(filePath)
    if (stats.isDirectory()) {
      return { format: 'markdown_folder', confidence: 0.8 }
    }
  } catch {}

  return { format: 'unknown', confidence: 0.0 }
}

/**
 * Previews the contents of the import file.
 */
export function previewImport(filePath: string): { items: any[]; fieldMapping: any } {
  const format = detectFormat(filePath).format
  const items: any[] = []
  let fieldMapping: any = {}

  if (format === 'json' || format === 'json_generic') {
    const raw = fs.readFileSync(filePath, 'utf8')
    const data = JSON.parse(raw)

    if (data.notes) {
      items.push(...data.notes.map((n: any) => ({ type: 'note', title: n.title || 'Untitled' })))
    }
    if (data.tasks) {
      items.push(...data.tasks.map((t: any) => ({ type: 'task', title: t.title || 'Untitled' })))
    }
    if (data.projects) {
      items.push(
        ...data.projects.map((p: any) => ({ type: 'project', title: p.name || 'Untitled' }))
      )
    }

    if (items.length === 0 && Array.isArray(data)) {
      items.push(
        ...data
          .slice(0, 10)
          .map((x: any) => ({ type: 'generic', title: x.title || x.name || 'Unnamed Record' }))
      )
    }
  } else if (format === 'csv') {
    const raw = fs.readFileSync(filePath, 'utf8')
    const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0)
    if (lines.length > 0) {
      const headers = lines[0].split(',').map((h) => h.replace(/^"(.*)"$/, '$1').trim())
      fieldMapping = { headers }

      const sampleLines = lines.slice(1, 11)
      for (const line of sampleLines) {
        const parts = line.split(',').map((p) => p.replace(/^"(.*)"$/, '$1').trim())
        items.push({ type: 'csv_row', title: parts[0] || 'Empty' })
      }
    }
  } else if (format === 'markdown') {
    const title = path.basename(filePath, path.extname(filePath))
    items.push({ type: 'note', title })
  } else if (format === 'markdown_folder') {
    const files = fs
      .readdirSync(filePath)
      .filter((f) => f.endsWith('.md') || f.endsWith('.markdown'))
    items.push(
      ...files.slice(0, 10).map((f) => ({ type: 'note', title: path.basename(f, path.extname(f)) }))
    )
  }

  return { items, fieldMapping }
}

/**
 * Imports from a structured CogniTwin JSON format.
 */
export function importFromJSON(filePath: string, projectId?: string): { imported: number } {
  const db = getDatabase()
  const raw = fs.readFileSync(filePath, 'utf8')
  const data = JSON.parse(raw)
  let imported = 0

  // Transaction import
  const transaction = db.transaction(() => {
    // If specific project is provided, import notes/tasks to that project.
    // Otherwise, create imported projects too.
    const projectMap = new Map<string, string>()

    if (data.projects) {
      for (const proj of data.projects) {
        const newId = crypto.randomUUID()
        projectMap.set(proj.id, newId)

        db.prepare(
          `
          INSERT INTO projects (id, workspace_id, name, description, color, icon)
          VALUES (?, ?, ?, ?, ?, ?)
        `
        ).run(
          newId,
          proj.workspace_id,
          proj.name,
          proj.description,
          proj.color || '#3498db',
          proj.icon || 'folder'
        )
        imported++
      }
    }

    if (data.notes) {
      for (const note of data.notes) {
        const noteId = crypto.randomUUID()
        const targetProjId = projectId || projectMap.get(note.project_id) || null

        db.prepare(
          `
          INSERT INTO notes (id, project_id, title, content, raw_text, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `
        ).run(
          noteId,
          targetProjId,
          note.title || 'Untitled',
          note.content || '',
          note.raw_text || note.content || '',
          note.created_at || new Date().toISOString(),
          note.updated_at || new Date().toISOString()
        )
        imported++
      }
    }

    if (data.tasks) {
      for (const task of data.tasks) {
        const taskId = crypto.randomUUID()
        const targetProjId = projectId || projectMap.get(task.project_id) || null

        db.prepare(
          `
          INSERT INTO tasks (id, project_id, title, description, due_date, priority, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        ).run(
          taskId,
          targetProjId,
          task.title || 'Untitled',
          task.description || '',
          task.due_date || null,
          task.priority || 'Medium',
          task.status || 'Todo',
          task.created_at || new Date().toISOString(),
          task.updated_at || new Date().toISOString()
        )
        imported++
      }
    }
  })

  try {
    transaction()
    logTransfer('import', 'json', imported, filePath, 'complete')
    return { imported }
  } catch (error: any) {
    logTransfer('import', 'json', imported, filePath, 'failed', error.message)
    throw error
  }
}

/**
 * Imports entries from CSV with custom column mapping.
 */
export function importFromCSV(
  filePath: string,
  entityType: 'note' | 'task',
  mapping: {
    title: string
    content?: string
    description?: string
    status?: string
    priority?: string
  }
): { imported: number } {
  const db = getDatabase()
  const raw = fs.readFileSync(filePath, 'utf8')
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0)
  if (lines.length <= 1) return { imported: 0 }

  const headers = lines[0].split(',').map((h) => h.replace(/^"(.*)"$/, '$1').trim())
  const titleIdx = headers.indexOf(mapping.title)
  const contentIdx = mapping.content ? headers.indexOf(mapping.content) : -1
  const descIdx = mapping.description ? headers.indexOf(mapping.description) : -1
  const statusIdx = mapping.status ? headers.indexOf(mapping.status) : -1
  const priorityIdx = mapping.priority ? headers.indexOf(mapping.priority) : -1

  if (titleIdx === -1) {
    throw new Error(`CSV Mapping Error: Title column "${mapping.title}" not found.`)
  }

  let imported = 0

  const transaction = db.transaction(() => {
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',').map((p) => p.replace(/^"(.*)"$/, '$1').trim())
      const title = parts[titleIdx] || 'Untitled'

      if (entityType === 'note') {
        const content = contentIdx !== -1 ? parts[contentIdx] || '' : ''
        const id = crypto.randomUUID()
        db.prepare(
          `
          INSERT INTO notes (id, project_id, title, content, raw_text)
          VALUES (?, NULL, ?, ?, ?)
        `
        ).run(id, title, content, content)
        imported++
      } else if (entityType === 'task') {
        const desc = descIdx !== -1 ? parts[descIdx] || '' : ''
        const status = statusIdx !== -1 ? parts[statusIdx] || 'Todo' : 'Todo'
        const priority = priorityIdx !== -1 ? parts[priorityIdx] || 'Medium' : 'Medium'
        const id = crypto.randomUUID()

        db.prepare(
          `
          INSERT INTO tasks (id, project_id, title, description, status, priority)
          VALUES (?, NULL, ?, ?, ?, ?)
        `
        ).run(id, title, desc, status, priority)
        imported++
      }
    }
  })

  try {
    transaction()
    logTransfer('import', 'csv', imported, filePath, 'complete')
    return { imported }
  } catch (error: any) {
    logTransfer('import', 'csv', imported, filePath, 'failed', error.message)
    throw error
  }
}

/**
 * Imports all `.md` files in a folder path as new notes.
 */
export function importFromMarkdown(folderPath: string, projectId?: string): { imported: number } {
  const db = getDatabase()
  let imported = 0

  const stats = fs.statSync(folderPath)
  if (!stats.isDirectory()) {
    throw new Error('Provided path is not a directory folder.')
  }

  const files = fs
    .readdirSync(folderPath)
    .filter((f) => f.endsWith('.md') || f.endsWith('.markdown'))

  const transaction = db.transaction(() => {
    for (const file of files) {
      const filePath = path.join(folderPath, file)
      let content = fs.readFileSync(filePath, 'utf8')
      let title = path.basename(file, path.extname(file))

      // Check for frontmatter blocks
      const frontmatterMatch = content.match(
        /^---\r?\ntitle:\s*"(.*?)"\r?\ncreated_at:\s*"(.*?)"\r?\n---\r?\n([\s\S]*)$/
      )
      if (frontmatterMatch) {
        title = frontmatterMatch[1] || title
        content = frontmatterMatch[3] || content
      }

      const noteId = crypto.randomUUID()
      db.prepare(
        `
        INSERT INTO notes (id, project_id, title, content, raw_text)
        VALUES (?, ?, ?, ?, ?)
      `
      ).run(noteId, projectId || null, title, content, content)

      imported++
    }
  })

  try {
    transaction()
    logTransfer('import', 'markdown', imported, folderPath, 'complete')
    return { imported }
  } catch (error: any) {
    logTransfer('import', 'markdown', imported, folderPath, 'failed', error.message)
    throw error
  }
}

/**
 * Returns past import/export transfers history logs.
 */
export function getImportHistory(): any[] {
  const db = getDatabase()
  return db
    .prepare(
      `
    SELECT id, direction, format, item_count, file_path, status, error_message, created_at
    FROM data_transfers
    ORDER BY created_at DESC
  `
    )
    .all()
}
