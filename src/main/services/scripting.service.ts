import vm from 'vm'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import { app } from 'electron'
import { getDatabase } from '../database/connection'
import { logAction } from './audit.service'

export interface ScriptDbRow {
  id: string
  name: string
  language: string
  code_content: string
  description: string | null
  last_run: string | null
  created_at: string
}

/**
 * Executes JavaScript code in an isolated VM sandbox with database helper functions.
 */
export async function executeJavaScript(
  code: string
): Promise<{ success: boolean; result?: string; error?: string; logs: string[] }> {
  const logs: string[] = []
  const db = getDatabase()

  // Helper function to query the database from within the script
  const dbQuery = (sql: string, ...params: any[]) => {
    try {
      const stmt = db.prepare(sql)
      if (
        sql.trim().toLowerCase().startsWith('select') ||
        sql.trim().toLowerCase().startsWith('pragma')
      ) {
        return stmt.all(...params)
      } else {
        const info = stmt.run(...params)
        return { changes: info.changes, lastInsertRowid: info.lastInsertRowid }
      }
    } catch (err: any) {
      logs.push(`[DB ERROR] ${err.message}`)
      throw err
    }
  }

  const sandbox = {
    console: {
      log: (...args: any[]) => {
        const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')
        logs.push(`[LOG] ${msg}`)
      },
      error: (...args: any[]) => {
        const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')
        logs.push(`[ERROR] ${msg}`)
      }
    },
    dbQuery,
    setTimeout,
    Promise
  }

  const context = vm.createContext(sandbox)

  try {
    const script = new vm.Script(code)
    const result = script.runInContext(context, { timeout: 5000 }) // 5s timeout safety
    logAction('system', 'EXECUTE_JS_SCRIPT', 'system', null, { codeLength: code.length })

    return {
      success: true,
      result: typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result),
      logs
    }
  } catch (err: any) {
    logs.push(`[CRASH] ${err.message}`)
    return {
      success: false,
      error: err.message,
      logs
    }
  }
}

/**
 * Executes Python code by spawning a python child process.
 */
export async function executePython(
  code: string
): Promise<{ success: boolean; result?: string; error?: string; logs: string[] }> {
  const logs: string[] = []
  const tempDir = app.getPath('temp')
  const tempFile = path.join(tempDir, `ct_script_${crypto.randomUUID()}.py`)

  try {
    fs.writeFileSync(tempFile, code, 'utf8')

    return new Promise((resolve) => {
      // Look for python, python3 or the workspace pyenv
      const pyCmd = process.platform === 'win32' ? 'python' : 'python3'

      exec(`"${pyCmd}" "${tempFile}"`, (error, stdout, stderr) => {
        // Cleanup temp file
        try {
          if (fs.existsSync(tempFile)) {
            fs.unlinkSync(tempFile)
          }
        } catch (e) {
          console.error('Failed to cleanup temp python file:', e)
        }

        if (stdout) {
          logs.push(
            ...stdout
              .trim()
              .split('\n')
              .map((l) => `[STDOUT] ${l}`)
          )
        }
        if (stderr) {
          logs.push(
            ...stderr
              .trim()
              .split('\n')
              .map((l) => `[STDERR] ${l}`)
          )
        }

        logAction('system', 'EXECUTE_PYTHON_SCRIPT', 'system', null, { codeLength: code.length })

        if (error) {
          resolve({
            success: false,
            error: error.message,
            logs
          })
        } else {
          resolve({
            success: true,
            result: stdout.trim(),
            logs
          })
        }
      })
    })
  } catch (err: any) {
    return {
      success: false,
      error: err.message,
      logs: [`[FATAL] ${err.message}`]
    }
  }
}

/**
 * Saves a new script or updates an existing one in the SQLite database.
 */
export function saveScript(
  name: string,
  language: string,
  codeContent: string,
  description?: string
): { success: boolean; id: string } {
  const db = getDatabase()
  const id = crypto.randomUUID()
  const createdAt = new Date().toISOString()

  // Check if name already exists to update instead of insert
  const existing = db
    .prepare('SELECT id FROM scripts WHERE name = ? AND language = ?')
    .get(name, language) as { id: string } | undefined

  if (existing) {
    db.prepare(
      `
      UPDATE scripts
      SET code_content = ?, description = ?
      WHERE id = ?
    `
    ).run(codeContent, description || null, existing.id)
    logAction('system', 'SCRIPT_UPDATED', 'script', existing.id, { name })
    return { success: true, id: existing.id }
  } else {
    db.prepare(
      `
      INSERT INTO scripts (id, name, language, code_content, description, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    ).run(id, name, language, codeContent, description || null, createdAt)
    logAction('system', 'SCRIPT_CREATED', 'script', id, { name })
    return { success: true, id }
  }
}

/**
 * Fetches all saved scripts from the database.
 */
export function getScripts(): ScriptDbRow[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM scripts ORDER BY created_at DESC').all() as ScriptDbRow[]
}

/**
 * Deletes a script from the database.
 */
export function deleteScript(id: string): { success: boolean } {
  const db = getDatabase()
  db.prepare('DELETE FROM scripts WHERE id = ?').run(id)
  logAction('system', 'SCRIPT_DELETED', 'script', id)
  return { success: true }
}
