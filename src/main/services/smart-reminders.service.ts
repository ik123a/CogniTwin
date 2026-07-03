import { getDatabase } from '../database/connection'
import crypto from 'crypto'

interface DatabaseTask {
  id: string
  title: string
  due_date: string | null
  status: string
  created_at: string
  updated_at: string
}

interface SmartReminder {
  id: string
  item_id: string | null
  item_type: string | null
  trigger_type: string
  message: string
  is_dismissed: number
  created_at: string
  dismissed_at: string | null
}

/**
 * Parses date string safely.
 */
function parseDate(dateStr: any): Date | null {
  if (!dateStr) return null
  const parsed = Date.parse(dateStr)
  if (isNaN(parsed)) return null
  return new Date(parsed)
}

/**
 * Scans tasks to generate, update, or resolve reminders, and saves them to `smart_reminders`.
 */
export async function generateSmartReminders(): Promise<void> {
  const db = getDatabase()
  const now = new Date()
  const fortyEightHours = 48 * 60 * 60 * 1000
  const sevenDays = 7 * 24 * 60 * 60 * 1000

  // 1. Fetch all tasks that are NOT completed/Done
  const activeTasks = db
    .prepare(
      `
    SELECT id, title, due_date, status, created_at, updated_at 
    FROM tasks 
    WHERE status != 'Done' AND status != 'Completed'
  `
    )
    .all() as DatabaseTask[]

  // 2. Fetch completed/Done tasks so we can auto-resolve/dismiss reminders for them
  const completedTasks = db
    .prepare(
      `
    SELECT id 
    FROM tasks 
    WHERE status = 'Done' OR status = 'Completed'
  `
    )
    .all() as Array<{ id: string }>

  // Keep track of which reminder (item_id + trigger_type) we hit during this scan
  const processedReminderKeys = new Set<string>()

  db.transaction(() => {
    // Auto-dismiss reminders for tasks that are now Done/Completed
    for (const task of completedTasks) {
      db.prepare(
        `
        UPDATE smart_reminders 
        SET is_dismissed = 1, dismissed_at = datetime('now') 
        WHERE item_id = ? AND item_type = 'task' AND is_dismissed = 0
      `
      ).run(task.id)
    }

    // Process active tasks
    for (const task of activeTasks) {
      // RULE A: Deadlines approaching in 48 hours (or overdue)
      if (task.due_date) {
        const dueDate = parseDate(task.due_date)
        if (dueDate) {
          const diff = dueDate.getTime() - now.getTime()
          let triggerReminder = false
          let message = ''
          let triggerType = ''

          if (diff > 0 && diff <= fortyEightHours) {
            triggerReminder = true
            triggerType = 'deadline_approaching'
            const hoursLeft = Math.round(diff / (60 * 60 * 1000))
            message = `Deadline approaching: Task "${task.title}" is due in ${hoursLeft} hours.`
          } else if (diff <= 0) {
            triggerReminder = true
            triggerType = 'deadline_overdue'
            message = `Overdue task: "${task.title}" was due on ${dueDate.toLocaleDateString()}.`
          }

          if (triggerReminder) {
            const key = `${task.id}:${triggerType}`
            processedReminderKeys.add(key)

            // Check if active reminder already exists
            const existing = db
              .prepare(
                `
              SELECT id FROM smart_reminders 
              WHERE item_id = ? AND trigger_type = ? AND is_dismissed = 0
            `
              )
              .get(task.id, triggerType)

            if (!existing) {
              const id = crypto.randomUUID()
              db.prepare(
                `
                INSERT INTO smart_reminders (id, item_id, item_type, trigger_type, message, is_dismissed)
                VALUES (?, ?, 'task', ?, ?, 0)
              `
              ).run(id, task.id, triggerType, message)
            }
          }
        }
      }

      // RULE B: Tasks in progress for 7+ days without updates
      if (task.status === 'In Progress' || task.status === 'Progress') {
        const lastUpdate = parseDate(task.updated_at || task.created_at)
        if (lastUpdate) {
          const age = now.getTime() - lastUpdate.getTime()
          if (age >= sevenDays) {
            const triggerType = 'stale_in_progress'
            const key = `${task.id}:${triggerType}`
            processedReminderKeys.add(key)

            const daysStale = Math.floor(age / (24 * 60 * 60 * 1000))
            const message = `Stale work: Task "${task.title}" has been In Progress for ${daysStale} days without any updates.`

            // Check if active reminder already exists
            const existing = db
              .prepare(
                `
              SELECT id FROM smart_reminders 
              WHERE item_id = ? AND trigger_type = ? AND is_dismissed = 0
            `
              )
              .get(task.id, triggerType)

            if (!existing) {
              const id = crypto.randomUUID()
              db.prepare(
                `
                INSERT INTO smart_reminders (id, item_id, item_type, trigger_type, message, is_dismissed)
                VALUES (?, ?, 'task', ?, ?, 0)
              `
              ).run(id, task.id, triggerType, message)
            }
          }
        }
      }
    }

    // Dismiss active task reminders that are no longer applicable (e.g. due date moved out, status changed from In Progress)
    const activeTaskReminders = db
      .prepare(
        `
      SELECT id, item_id, trigger_type FROM smart_reminders 
      WHERE item_type = 'task' AND is_dismissed = 0
    `
      )
      .all() as Array<{ id: string; item_id: string; trigger_type: string }>

    for (const rem of activeTaskReminders) {
      const key = `${rem.item_id}:${rem.trigger_type}`
      if (!processedReminderKeys.has(key)) {
        // This reminder is no longer valid, auto-dismiss it
        db.prepare(
          `
          UPDATE smart_reminders 
          SET is_dismissed = 1, dismissed_at = datetime('now') 
          WHERE id = ?
        `
        ).run(rem.id)
      }
    }
  })()
}

/**
 * Gets all active reminders.
 */
export function getActiveReminders(): SmartReminder[] {
  const db = getDatabase()
  return db
    .prepare(
      `
    SELECT id, item_id, item_type, trigger_type, message, is_dismissed, created_at, dismissed_at 
    FROM smart_reminders 
    WHERE is_dismissed = 0
    ORDER BY created_at DESC
  `
    )
    .all() as SmartReminder[]
}

/**
 * Dismisses a reminder by setting is_dismissed = 1.
 */
export function dismissReminder(reminderId: string): void {
  const db = getDatabase()
  db.prepare(
    `
    UPDATE smart_reminders 
    SET is_dismissed = 1, dismissed_at = datetime('now') 
    WHERE id = ?
  `
  ).run(reminderId)
}
