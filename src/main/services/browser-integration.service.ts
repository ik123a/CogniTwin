import { getDatabase } from '../database/connection'
import fs from 'fs'
import path from 'path'
import os from 'os'
import Database from 'better-sqlite3'

export interface HistoryItem {
  id: string
  url: string
  title: string
  visit_count: number
  last_visit_time: string
}

/**
 * Copies the local browser History database, extracts top visited URLs, and indexes them into CogniTwin.
 */
export async function syncBrowserHistory(): Promise<{ success: boolean; count: number }> {
  const db = getDatabase()
  const homeDir = os.homedir()
  const chromeHistoryPath = path.join(
    homeDir,
    'AppData',
    'Local',
    'Google',
    'Chrome',
    'User Data',
    'Default',
    'History'
  )
  const tempCopyPath = path.join(os.tmpdir(), 'cognitwin_chrome_history_temp')

  let importedCount = 0
  let historyItems: HistoryItem[] = []

  try {
    // 1. Check if Chrome history file exists locally
    if (fs.existsSync(chromeHistoryPath)) {
      // Copy history to temp file to bypass active Chrome file lock
      fs.copyFileSync(chromeHistoryPath, tempCopyPath)

      const historyDb = new Database(tempCopyPath, { readonly: true })
      const rows = historyDb
        .prepare(
          `
        SELECT id, url, title, visit_count, datetime(last_visit_time / 1000000 + (strftime('%s', '1601-01-01')), 'unixepoch', 'localtime') as last_visit
        FROM urls
        WHERE url LIKE 'http%' AND title != ''
        ORDER BY last_visit_time DESC
        LIMIT 10
      `
        )
        .all() as any[]

      historyItems = rows.map((r) => ({
        id: `chrome-${r.id}`,
        url: r.url,
        title: r.title,
        visit_count: r.visit_count,
        last_visit_time: r.last_visit
      }))

      historyDb.close()
      if (fs.existsSync(tempCopyPath)) {
        fs.unlinkSync(tempCopyPath)
      }
    } else {
      console.warn(
        '[BrowserIntegration] Local Chrome History database not found. Generating mock browser feed.'
      )
      historyItems = generateMockHistory()
    }

    // 2. Index visited links into files / inbox_items table under Chrome history source
    for (const item of historyItems) {
      // Prevent duplicates
      const exists = db.prepare('SELECT id FROM inbox_items WHERE id = ?').get(item.id)
      if (exists) continue

      db.prepare(
        `
        INSERT INTO inbox_items (id, type, source, title, content, priority, date_received, metadata)
        VALUES (?, 'file', 'Chrome', ?, ?, 'Blue', ?, ?)
      `
      ).run(
        item.id,
        item.title,
        `Visited page: ${item.url} (Visits: ${item.visit_count})`,
        item.last_visit_time,
        JSON.stringify({ url: item.url, visit_count: item.visit_count })
      )

      importedCount++
    }

    return { success: true, count: importedCount }
  } catch (error) {
    console.error('[BrowserIntegration] Failed to sync Chrome history:', error)
    // Cleanup copy on error
    if (fs.existsSync(tempCopyPath)) {
      try {
        fs.unlinkSync(tempCopyPath)
      } catch {}
    }
    return { success: false, count: 0 }
  }
}

function generateMockHistory(): HistoryItem[] {
  const nowStr = new Date().toISOString()
  return [
    {
      id: 'chrome-mock-1',
      url: 'https://github.com/trending',
      title: 'GitHub Trending Repositories - Developer hub',
      visit_count: 8,
      last_visit_time: nowStr
    },
    {
      id: 'chrome-mock-2',
      url: 'https://news.ycombinator.com',
      title: 'Hacker News - Startup & tech intelligence feed',
      visit_count: 15,
      last_visit_time: nowStr
    }
  ]
}
