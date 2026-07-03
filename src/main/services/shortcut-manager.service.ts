import { globalShortcut, BrowserWindow } from 'electron'
import { getDatabase } from '../database/connection'
import crypto from 'crypto'

interface KeyboardShortcut {
  id: string
  action: string
  accelerator: string
  description: string | null
  is_enabled: number
}

/**
 * Inserts default system shortcuts if they do not already exist in the database.
 */
export function seedDefaultShortcuts(): void {
  const db = getDatabase()

  const defaults = [
    {
      id: crypto.randomUUID(),
      action: 'global:toggle-dashboard',
      accelerator: 'CommandOrControl+Shift+D',
      description: 'Toggle the main application dashboard window visibility',
      is_enabled: 1
    },
    {
      id: crypto.randomUUID(),
      action: 'global:quick-capture',
      accelerator: 'CommandOrControl+Shift+C',
      description: 'Open the quick-capture popover to capture notes or tasks',
      is_enabled: 1
    }
  ]

  db.transaction(() => {
    for (const s of defaults) {
      db.prepare(
        `
        INSERT OR IGNORE INTO keyboard_shortcuts (id, action, accelerator, description, is_enabled)
        VALUES (?, ?, ?, ?, ?)
      `
      ).run(s.id, s.action, s.accelerator, s.description, s.is_enabled)
    }
  })()
}

/**
 * Handle shortcut triggers.
 */
function handleShortcutTrigger(action: string): void {
  const windows = BrowserWindow.getAllWindows()
  const mainWin = windows[0]

  if (!mainWin) return

  if (action === 'global:toggle-dashboard') {
    if (mainWin.isVisible()) {
      if (mainWin.isFocused()) {
        mainWin.hide()
      } else {
        mainWin.focus()
      }
    } else {
      mainWin.show()
      mainWin.focus()
    }
  } else if (action === 'global:quick-capture') {
    mainWin.show()
    mainWin.focus()
    mainWin.webContents.send('shortcut:trigger', 'global:quick-capture')
  }
}

/**
 * Re-registers all enabled shortcuts from the database in Electron's globalShortcut registry.
 */
export function registerAllShortcuts(): void {
  // First, unregister everything to avoid duplicate registration errors
  globalShortcut.unregisterAll()

  // Seed first
  seedDefaultShortcuts()

  const db = getDatabase()
  const activeShortcuts = db
    .prepare(
      `
    SELECT * FROM keyboard_shortcuts WHERE is_enabled = 1
  `
    )
    .all() as KeyboardShortcut[]

  for (const shortcut of activeShortcuts) {
    try {
      const isRegistered = globalShortcut.register(shortcut.accelerator, () => {
        console.log(`Global Shortcut Triggered: ${shortcut.action} via ${shortcut.accelerator}`)
        handleShortcutTrigger(shortcut.action)
      })

      if (!isRegistered) {
        console.error(
          `Failed to register global shortcut: ${shortcut.accelerator} for ${shortcut.action}`
        )
      } else {
        console.log(
          `Successfully registered shortcut: ${shortcut.accelerator} -> ${shortcut.action}`
        )
      }
    } catch (err) {
      console.error(`Error registering shortcut ${shortcut.accelerator}:`, err)
    }
  }
}

/**
 * Retrieves all registered shortcuts from the database.
 */
export function getAllShortcuts(): KeyboardShortcut[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM keyboard_shortcuts').all() as KeyboardShortcut[]
}

/**
 * Updates a shortcut configuration in the database and re-registers the shortcuts.
 */
export function updateShortcut(action: string, accelerator: string, isEnabled: number): boolean {
  const db = getDatabase()

  const result = db
    .prepare(
      `
    UPDATE keyboard_shortcuts 
    SET accelerator = ?, is_enabled = ?
    WHERE action = ?
  `
    )
    .run(accelerator, isEnabled, action)

  if (result.changes > 0) {
    // Re-apply the global shortcut registrations
    registerAllShortcuts()
    return true
  }
  return false
}
