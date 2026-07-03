import { getDatabase } from '../database/connection'
import * as ruleEngine from './rule-engine.service'
import * as workflowExecutor from './workflow-executor.service'

let schedulerInterval: NodeJS.Timeout | null = null

export interface ScheduledAction {
  id: string
  name: string
  cron_expr: string
  workflow_id: string | null
  rule_id: string | null
  next_run_at: string | null
  last_run_at: string | null
  is_active: number
}

/**
 * Starts the background scheduler loop.
 */
export function startScheduler(): void {
  if (schedulerInterval) return

  console.log('[Scheduler] Starting local automation scheduler (60s tick)...')

  // Run check immediately on startup
  checkAndRunScheduledActions().catch(console.error)

  schedulerInterval = setInterval(() => {
    checkAndRunScheduledActions().catch(console.error)
  }, 60000)
}

/**
 * Stops the background scheduler loop.
 */
export function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval)
    schedulerInterval = null
    console.log('[Scheduler] Stopped scheduler.')
  }
}

/**
 * Iterates through active schedules and executes due actions.
 */
async function checkAndRunScheduledActions(): Promise<void> {
  try {
    const db = getDatabase()
    const now = new Date()

    const dueTasks = db
      .prepare(
        `
      SELECT * FROM scheduled_actions 
      WHERE is_active = 1 AND (next_run_at <= ? OR next_run_at IS NULL)
    `
      )
      .all(now.toISOString()) as ScheduledAction[]

    if (dueTasks.length > 0) {
      console.log(`[Scheduler] Found ${dueTasks.length} automation schedules due.`)
    }

    for (const task of dueTasks) {
      console.log(`[Scheduler] Running scheduled task: "${task.name}"`)

      // 1. Calculate next execution date
      const nextRunDate = calculateNextRun(task.cron_expr, now)

      // 2. Update execution timestamps in SQLite
      db.prepare(
        `
        UPDATE scheduled_actions 
        SET last_run_at = ?, next_run_at = ? 
        WHERE id = ?
      `
      ).run(now.toISOString(), nextRunDate.toISOString(), task.id)

      // 3. Execute target rule or workflow
      if (task.rule_id) {
        await ruleEngine.publishEvent('CRON_TRIGGER', {
          id: task.id,
          name: task.name,
          triggered_by: 'scheduler'
        })
      }

      if (task.workflow_id) {
        await workflowExecutor.executeWorkflow(task.workflow_id, {
          triggered_by: 'scheduler',
          timestamp: now.toISOString()
        })
      }
    }
  } catch (error) {
    console.error('[Scheduler] Error running scheduled actions check:', error)
  }
}

/**
 * Lightweight cron resolver. Computes next run interval dates.
 */
export function calculateNextRun(cronExpr: string, fromDate: Date): Date {
  const next = new Date(fromDate.getTime())

  // Simple patterns:
  // "*/5 * * * *" -> every 5 minutes
  // "0 * * * *" -> hourly (next hour, 0 minutes)
  // "0 0 * * *" -> daily (next day, 0 hours, 0 minutes)

  if (cronExpr.startsWith('*/')) {
    const minutes = parseInt(cronExpr.split(' ')[0].replace('*/', ''), 10) || 5
    next.setMinutes(next.getMinutes() + minutes)
  } else if (cronExpr.startsWith('0 *')) {
    next.setHours(next.getHours() + 1)
    next.setMinutes(0)
    next.setSeconds(0)
  } else if (cronExpr.startsWith('0 0')) {
    next.setDate(next.getDate() + 1)
    next.setHours(0)
    next.setMinutes(0)
    next.setSeconds(0)
  } else {
    // Default fallback: 10 minutes
    next.setMinutes(next.getMinutes() + 10)
  }

  return next
}
