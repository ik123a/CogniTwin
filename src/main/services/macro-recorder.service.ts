import { getDatabase } from '../database/connection'
import crypto from 'crypto'

let activeRecordingMacroName: string | null = null
let recordedSteps: Array<{ action: string; payload: any }> = []

export interface MacroStep {
  action: 'CREATE_NOTE' | 'CREATE_TASK' | 'TAG_ITEM'
  payload: Record<string, any>
}

/**
 * Returns whether macro recording is currently running.
 */
export function isRecording(): boolean {
  return activeRecordingMacroName !== null
}

/**
 * Starts macro recording.
 */
export function startRecording(name: string): void {
  activeRecordingMacroName = name
  recordedSteps = []
  console.log(`[MacroRecorder] Recording started for: "${name}"`)
}

/**
 * Records an active workbench event if recording is enabled.
 */
export function recordAction(action: string, payload: any): void {
  if (!activeRecordingMacroName) return
  recordedSteps.push({ action, payload })
  console.log(`[MacroRecorder] Logged step: ${action}`)
}

/**
 * Saves and stops macro recording.
 */
export function stopRecording(): { id: string; name: string; stepCount: number } {
  if (!activeRecordingMacroName) {
    throw new Error('No active macro recording session')
  }

  const db = getDatabase()
  const id = crypto.randomUUID()
  const name = activeRecordingMacroName

  db.prepare(
    `
    INSERT INTO macros (id, name, steps_json)
    VALUES (?, ?, ?)
  `
  ).run(id, name, JSON.stringify(recordedSteps))

  const stepCount = recordedSteps.length
  activeRecordingMacroName = null
  recordedSteps = []

  console.log(`[MacroRecorder] Saved macro "${name}" with ${stepCount} steps.`)
  return { id, name, stepCount }
}

/**
 * Plays a saved macro sequence.
 */
export async function playMacro(macroId: string): Promise<void> {
  const db = getDatabase()

  try {
    const macro = db.prepare('SELECT * FROM macros WHERE id = ?').get(macroId) as {
      name: string
      steps_json: string
    }

    if (!macro) {
      throw new Error(`Macro ${macroId} not found`)
    }

    console.log(`[MacroRecorder] Replaying macro "${macro.name}"...`)
    const steps: MacroStep[] = JSON.parse(macro.steps_json)

    for (const step of steps) {
      await executeStep(step)
    }
  } catch (error) {
    console.error(`[MacroRecorder] Failed to execute macro ${macroId}:`, error)
    throw error
  }
}

/**
 * Replays a specific step.
 */
async function executeStep(step: MacroStep): Promise<void> {
  const db = getDatabase()
  console.log(`[MacroRecorder] Replaying: ${step.action}`)

  try {
    switch (step.action) {
      case 'CREATE_NOTE': {
        const id = crypto.randomUUID()
        const { project_id, title, content, raw_text } = step.payload
        db.prepare(
          `
          INSERT INTO notes (id, project_id, title, content, raw_text)
          VALUES (?, ?, ?, ?, ?)
        `
        ).run(id, project_id || null, title || 'Automated Note', content || '', raw_text || '')
        break
      }

      case 'CREATE_TASK': {
        const id = crypto.randomUUID()
        const { project_id, title, description, priority } = step.payload
        db.prepare(
          `
          INSERT INTO tasks (id, project_id, title, description, priority, status)
          VALUES (?, ?, ?, ?, ?, ?)
        `
        ).run(
          id,
          project_id || null,
          title || 'Automated Task',
          description || '',
          priority || 'Medium',
          'Todo'
        )
        break
      }

      case 'TAG_ITEM': {
        const { tag_id, item_id, item_type } = step.payload
        if (tag_id && item_id && item_type) {
          db.prepare(
            `
            INSERT OR IGNORE INTO item_tags (tag_id, item_id, item_type)
            VALUES (?, ?, ?)
          `
          ).run(tag_id, item_id, item_type)
        }
        break
      }

      default:
        console.warn(`[MacroRecorder] Unsupported macro action: ${step.action}`)
    }
  } catch (err) {
    console.error(`[MacroRecorder] Replay action ${step.action} failed:`, err)
  }
}
