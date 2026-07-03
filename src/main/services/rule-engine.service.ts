import { getDatabase } from '../database/connection'
import * as llmService from './llm.service'
import crypto from 'crypto'

export interface Condition {
  field: string
  operator: 'contains' | 'equals' | 'starts_with' | 'ends_with'
  value: string
}

export interface RuleAction {
  type: 'TAG_ITEM' | 'GENERATE_SUMMARY' | 'MOVE_TO_PROJECT' | 'CREATE_TASK' | 'CREATE_REMINDER'
  params: Record<string, any>
}

export interface Rule {
  id: string
  name: string
  trigger_event: string
  conditions_json: string
  actions_json: string
  is_active: number
}

/**
 * Publishes an event to the rule engine.
 * Matches active rules and executes their actions.
 */
export async function publishEvent(event: string, payload: any): Promise<void> {
  try {
    const db = getDatabase()

    // Fetch all active rules for this trigger event
    const activeRules = db
      .prepare(
        `
      SELECT * FROM rules 
      WHERE trigger_event = ? AND is_active = 1
    `
      )
      .all(event) as Rule[]

    console.log(
      `[RuleEngine] Processing event "${event}" against ${activeRules.length} active rules.`
    )

    for (const rule of activeRules) {
      let conditions: Condition[] = []
      let actions: RuleAction[] = []

      try {
        conditions = JSON.parse(rule.conditions_json)
        actions = JSON.parse(rule.actions_json)
      } catch (e) {
        console.error(`[RuleEngine] Failed to parse JSON configuration for rule "${rule.name}":`, e)
        continue
      }

      const match = evaluateConditions(payload, conditions)
      if (match) {
        console.log(`[RuleEngine] Rule "${rule.name}" conditions matched! Triggering actions...`)
        for (const action of actions) {
          await executeAction(action, payload)
        }
      }
    }
  } catch (err) {
    console.error('[RuleEngine] Error publishing event:', err)
  }
}

/**
 * Evaluates event payload against rule filters.
 */
function evaluateConditions(payload: any, conditions: Condition[]): boolean {
  if (conditions.length === 0) return true

  for (const cond of conditions) {
    const fieldValue = payload[cond.field]
    if (fieldValue === undefined || fieldValue === null) {
      return false
    }

    const strVal = String(fieldValue).toLowerCase()
    const targetVal = String(cond.value).toLowerCase()

    switch (cond.operator) {
      case 'contains':
        if (!strVal.includes(targetVal)) return false
        break
      case 'equals':
        if (strVal !== targetVal) return false
        break
      case 'starts_with':
        if (!strVal.startsWith(targetVal)) return false
        break
      case 'ends_with':
        if (!strVal.endsWith(targetVal)) return false
        break
      default:
        return false
    }
  }
  return true
}

/**
 * Executes a specific action.
 */
async function executeAction(action: RuleAction, payload: any): Promise<void> {
  const db = getDatabase()
  console.log(`[RuleEngine] Executing action type: ${action.type}`)

  try {
    switch (action.type) {
      case 'TAG_ITEM': {
        const { tag } = action.params
        if (!tag || !payload.id || !payload.type) return

        // Ensure tag exists
        const tagId = crypto.randomUUID()
        db.prepare('INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)').run(tagId, tag)

        // Find existing tag by name to match ID
        const tagRow = db.prepare('SELECT id FROM tags WHERE name = ?').get(tag) as { id: string }

        // Map item to tag
        db.prepare(
          `
          INSERT OR IGNORE INTO item_tags (tag_id, item_id, item_type)
          VALUES (?, ?, ?)
        `
        ).run(tagRow.id, payload.id, payload.type)
        console.log(`[RuleEngine] Tagged item ${payload.id} with tag "${tag}"`)
        break
      }

      case 'GENERATE_SUMMARY': {
        if (!payload.id || !payload.type || !payload.description) return

        console.log(`[RuleEngine] Auto-generating summary for item ${payload.id}`)
        const summary = await llmService.summarizeText(payload.description)

        const table = payload.type === 'note' ? 'notes' : 'files'
        db.prepare(`UPDATE ${table} SET summary = ? WHERE id = ?`).run(summary, payload.id)
        break
      }

      case 'MOVE_TO_PROJECT': {
        const { projectId } = action.params
        if (!projectId || !payload.id || !payload.type) return

        const table =
          payload.type === 'note' ? 'notes' : payload.type === 'file' ? 'files' : 'tasks'
        db.prepare(`UPDATE ${table} SET project_id = ? WHERE id = ?`).run(projectId, payload.id)
        console.log(`[RuleEngine] Moved item ${payload.id} to project "${projectId}"`)
        break
      }

      case 'CREATE_TASK': {
        const { title, priority } = action.params
        if (!title) return

        const taskId = crypto.randomUUID()
        db.prepare(
          `
          INSERT INTO tasks (id, project_id, title, priority, status)
          VALUES (?, ?, ?, ?, ?)
        `
        ).run(taskId, payload.project_id || null, title, priority || 'Medium', 'Todo')
        console.log(`[RuleEngine] Created automated task: "${title}"`)
        break
      }

      case 'CREATE_REMINDER': {
        const { message } = action.params
        if (!message) return

        const inboxId = crypto.randomUUID()
        db.prepare(
          `
          INSERT INTO inbox_items (id, type, source, title, content, priority)
          VALUES (?, ?, ?, ?, ?, ?)
        `
        ).run(inboxId, 'reminder', 'System Rule', 'Smart Alert', message, 'Orange')
        console.log(`[RuleEngine] Created smart alert reminder: "${message}"`)
        break
      }

      default:
        console.warn(`[RuleEngine] Unsupported action type: ${action.type}`)
    }
  } catch (err) {
    console.error(`[RuleEngine] Failed to execute action ${action.type}:`, err)
  }
}
