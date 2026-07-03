import { getDatabase } from '../database/connection'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'
import * as indexingService from './indexing.service'

interface WatchedFolder {
  path: string
  workspaceId: string
  projectId: string
  watcher: fs.FSWatcher
}

const activeWatchers = new Map<string, WatchedFolder>()

/**
 * Starts watching a folder for file additions
 */
export function startWatchingFolder(
  folderPath: string,
  workspaceId: string,
  projectId: string
): void {
  if (!fs.existsSync(folderPath)) {
    console.warn(`Watch folder path does not exist: ${folderPath}`)
    return
  }

  if (activeWatchers.has(folderPath)) {
    console.log(`Already watching folder: ${folderPath}`)
    return
  }

  try {
    const watcher = fs.watch(folderPath, (eventType, filename) => {
      if (eventType === 'rename' && filename) {
        const filePath = path.join(folderPath, filename)

        // Wait a short time for file writing to complete before reading
        setTimeout(() => {
          if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath)
            if (stats.isFile()) {
              console.log(`Detected new/updated file: ${filename} in watched folder`)
              ingestFile(filePath, filename, stats, workspaceId, projectId)
            }
          }
        }, 500)
      }
    })

    activeWatchers.set(folderPath, {
      path: folderPath,
      workspaceId,
      projectId,
      watcher
    })

    console.log(`Started watching folder: ${folderPath} for project: ${projectId}`)
  } catch (error) {
    console.error(`Failed to start watch on folder: ${folderPath}`, error)
  }
}

/**
 * Stops watching a specific folder
 */
export function stopWatchingFolder(folderPath: string): void {
  const watched = activeWatchers.get(folderPath)
  if (watched) {
    watched.watcher.close()
    activeWatchers.delete(folderPath)
    console.log(`Stopped watching folder: ${folderPath}`)
  }
}

/**
 * Stops all active folders watchers
 */
export function stopAllWatchers(): void {
  for (const watched of activeWatchers.values()) {
    watched.watcher.close()
  }
  activeWatchers.clear()
  console.log('Stopped all folder watchers')
}

/**
 * Ingests a file, inserts metadata into the database, and triggers an inbox notification
 */
function ingestFile(
  filePath: string,
  filename: string,
  stats: fs.Stats,
  workspaceId: string,
  projectId: string
): void {
  const db = getDatabase()
  const fileId = crypto.randomUUID()
  const fileType = path.extname(filename).substring(1).toUpperCase() || 'UNKNOWN'

  // Read first 1000 characters for raw text preview in Phase 1
  let rawText = ''
  try {
    if (stats.size < 5 * 1024 * 1024) {
      // Only read text files < 5MB
      const buffer = fs.readFileSync(filePath)
      rawText = buffer.toString('utf8', 0, Math.min(buffer.length, 10000))
    }
  } catch (e) {
    console.warn(`Could not read text content of ${filename}:`, e)
  }

  try {
    // Insert into files table
    db.prepare(
      `
      INSERT INTO files (id, project_id, name, path, type, size_bytes, raw_text, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      fileId,
      projectId,
      filename,
      filePath,
      fileType,
      stats.size,
      rawText,
      JSON.stringify({
        createdAt: stats.birthtime.toISOString(),
        modifiedAt: stats.mtime.toISOString(),
        workspaceId
      })
    )

    // Insert into inbox_items table for Smart Inbox notifications
    const inboxId = crypto.randomUUID()
    db.prepare(
      `
      INSERT INTO inbox_items (id, type, source, title, content, priority, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(
      inboxId,
      'file',
      'File Watcher',
      `Ingested: ${filename}`,
      `A new file was detected in your watched directory and imported into your workspace database: ${filePath} (${(stats.size / 1024).toFixed(1)} KB)`,
      'Blue', // Informational priority
      JSON.stringify({ fileId, projectId, filePath })
    )

    // Write audit log
    db.prepare('INSERT INTO audit_log (id, user_id, action, details_json) VALUES (?, ?, ?, ?)').run(
      crypto.randomUUID(),
      'system',
      'FILE_INGESTED',
      JSON.stringify({ filename, projectId })
    )

    console.log(`Successfully ingested file: ${filename} (ID: ${fileId})`)

    // Automatically trigger Phase 2 intelligence indexing for the new file
    indexingService.indexItem(fileId, 'file', filename, rawText).catch((err) => {
      console.error(`Failed to auto-index ingested file ${filename}:`, err)
    })
  } catch (error) {
    console.error(`Database ingestion failed for file ${filename}:`, error)
  }
}
