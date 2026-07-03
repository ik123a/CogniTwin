import { getDatabase } from '../database/connection'
import fs from 'fs'
import path from 'path'
import os from 'os'
import crypto from 'crypto'

export interface TransferHistory {
  id: string
  direction: 'export' | 'import'
  format: string
  item_count: number
  file_path: string
  status: string
  error_message: string | null
  created_at: string
}

function getExportDirectory(): string {
  const dir = path.join(os.homedir(), 'CogniTwin-Exports')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

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
 * Exports data to a structured JSON file.
 */
export function exportToJSON(projectId?: string): { filePath: string; itemCount: number } {
  const db = getDatabase()
  let notes: any[] = []
  let tasks: any[] = []
  let projects: any[] = []

  if (projectId) {
    notes = db.prepare('SELECT * FROM notes WHERE project_id = ?').all(projectId)
    tasks = db.prepare('SELECT * FROM tasks WHERE project_id = ?').all(projectId)
    projects = db.prepare('SELECT * FROM projects WHERE id = ?').all(projectId)
  } else {
    notes = db.prepare('SELECT * FROM notes').all()
    tasks = db.prepare('SELECT * FROM tasks').all()
    projects = db.prepare('SELECT * FROM projects').all()
  }

  const exportData = {
    version: '1.0.0',
    exportedAt: new Date().toISOString(),
    projects,
    notes,
    tasks
  }

  const filename = `cognitwin_export_${projectId || 'all'}_${Date.now()}.json`
  const filePath = path.join(getExportDirectory(), filename)
  const itemCount = notes.length + tasks.length + projects.length

  try {
    fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2), 'utf8')
    logTransfer('export', 'json', itemCount, filePath, 'complete')
    return { filePath, itemCount }
  } catch (error: any) {
    logTransfer('export', 'json', itemCount, filePath, 'failed', error.message)
    throw error
  }
}

/**
 * Exports flat tables to CSV.
 */
export function exportToCSV(
  entityType: 'note' | 'task' | 'project',
  projectId?: string
): { filePath: string; rowCount: number } {
  const db = getDatabase()
  let rows: any[] = []

  if (entityType === 'note') {
    rows = projectId
      ? db
          .prepare(
            'SELECT id, project_id, title, content, created_at, updated_at FROM notes WHERE project_id = ?'
          )
          .all(projectId)
      : db.prepare('SELECT id, project_id, title, content, created_at, updated_at FROM notes').all()
  } else if (entityType === 'task') {
    rows = projectId
      ? db
          .prepare(
            'SELECT id, project_id, title, description, due_date, priority, status, created_at FROM tasks WHERE project_id = ?'
          )
          .all(projectId)
      : db
          .prepare(
            'SELECT id, project_id, title, description, due_date, priority, status, created_at FROM tasks'
          )
          .all()
  } else if (entityType === 'project') {
    rows = db
      .prepare('SELECT id, workspace_id, name, description, color, created_at FROM projects')
      .all()
  }

  if (rows.length === 0) {
    const filename = `cognitwin_${entityType}_export_${Date.now()}.csv`
    const filePath = path.join(getExportDirectory(), filename)
    fs.writeFileSync(filePath, '', 'utf8')
    return { filePath, rowCount: 0 }
  }

  const headers = Object.keys(rows[0])
  const csvLines = [headers.join(',')]

  for (const row of rows) {
    const values = headers.map((header) => {
      const val = row[header]
      if (val === null || val === undefined) return '""'
      // Escape double quotes and wrap in quotes
      const escaped = String(val).replace(/"/g, '""')
      return `"${escaped}"`
    })
    csvLines.push(values.join(','))
  }

  const filename = `cognitwin_${entityType}_export_${Date.now()}.csv`
  const filePath = path.join(getExportDirectory(), filename)

  try {
    fs.writeFileSync(filePath, csvLines.join('\n'), 'utf8')
    logTransfer('export', 'csv', rows.length, filePath, 'complete')
    return { filePath, rowCount: rows.length }
  } catch (error: any) {
    logTransfer('export', 'csv', rows.length, filePath, 'failed', error.message)
    throw error
  }
}

/**
 * Exports notes as raw markdown files.
 */
export function exportToMarkdown(noteIds?: string[]): { filePath: string; fileCount: number } {
  const db = getDatabase()
  let notes: any[] = []

  if (noteIds && noteIds.length > 0) {
    const placeholders = noteIds.map(() => '?').join(',')
    notes = db
      .prepare(`SELECT title, content, created_at FROM notes WHERE id IN (${placeholders})`)
      .all(...noteIds)
  } else {
    notes = db.prepare('SELECT title, content, created_at FROM notes').all()
  }

  const folderName = `cognitwin_markdown_export_${Date.now()}`
  const folderPath = path.join(getExportDirectory(), folderName)
  fs.mkdirSync(folderPath, { recursive: true })

  let fileCount = 0
  try {
    for (const note of notes) {
      const cleanTitle = (note.title || 'Untitled').replace(/[/\\?%*:|"<>. ]/g, '_')
      const filename = `${cleanTitle}.md`
      const filePath = path.join(folderPath, filename)

      const markdownContent = `---
title: "${note.title || 'Untitled'}"
created_at: "${note.created_at}"
---

${note.content || ''}
`
      fs.writeFileSync(filePath, markdownContent, 'utf8')
      fileCount++
    }

    logTransfer('export', 'markdown', fileCount, folderPath, 'complete')
    return { filePath: folderPath, fileCount }
  } catch (error: any) {
    logTransfer('export', 'markdown', fileCount, folderPath, 'failed', error.message)
    throw error
  }
}

/**
 * Returns past import/export transfer runs.
 */
export function getExportHistory(): TransferHistory[] {
  const db = getDatabase()
  return db
    .prepare(
      `
    SELECT id, direction, format, item_count, file_path, status, error_message, created_at
    FROM data_transfers
    ORDER BY created_at DESC
  `
    )
    .all() as TransferHistory[]
}
