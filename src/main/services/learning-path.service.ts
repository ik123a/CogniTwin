import { getDatabase } from '../database/connection'
import * as llmService from './llm.service'
import * as indexingService from './indexing.service'
import crypto from 'crypto'

export interface LearningGoal {
  id: string
  title: string
  topic: string
  status: string
  created_at: string
  updated_at: string
}

export interface LearningPathStep {
  id: string
  goal_id: string
  title: string
  description: string | null
  estimated_duration: string | null
  order_index: number
  note_id: string | null
  status: string
  recommendations: string | null
  created_at: string
  updated_at: string
}

/**
 * Safely parses JSON output from LLM response.
 */
function cleanAndParseJSON(text: string): any[] {
  let cleaned = text.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(json)?/, '')
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.substring(0, cleaned.length - 3)
    }
    cleaned = cleaned.trim()
  }
  try {
    return JSON.parse(cleaned)
  } catch (e) {
    console.warn('JSON parsing failed, attempting regex extraction...', e)
    const match = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/)
    if (match) {
      try {
        return JSON.parse(match[0])
      } catch (innerE) {
        console.error('Regex extraction failed:', innerE)
      }
    }
    throw e
  }
}

/**
 * Gets all learning goals.
 */
export async function getGoals(): Promise<LearningGoal[]> {
  const db = getDatabase()
  return db
    .prepare(
      `
    SELECT id, title, topic, status, created_at, updated_at
    FROM learning_goals
    ORDER BY created_at DESC
  `
    )
    .all() as LearningGoal[]
}

/**
 * Creates a learning goal and triggers learning path step generation.
 */
export async function createGoal(title: string, topic: string): Promise<LearningGoal> {
  const db = getDatabase()
  const id = crypto.randomUUID()
  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19)

  db.prepare(
    `
    INSERT INTO learning_goals (id, title, topic, status, created_at, updated_at)
    VALUES (?, ?, ?, 'Active', ?, ?)
  `
  ).run(id, title, topic, nowStr, nowStr)

  try {
    await generateLearningPath(id, topic)
  } catch (err) {
    console.error('Failed to generate learning path steps for new goal:', err)
  }

  const goal = db
    .prepare(
      `
    SELECT id, title, topic, status, created_at, updated_at
    FROM learning_goals WHERE id = ?
  `
    )
    .get(id) as LearningGoal

  return goal
}

/**
 * Returns learning steps for a specific goal.
 */
export async function getSteps(goalId: string): Promise<LearningPathStep[]> {
  const db = getDatabase()
  return db
    .prepare(
      `
    SELECT id, goal_id, title, description, estimated_duration, order_index, note_id, status, recommendations, created_at, updated_at
    FROM learning_path_steps
    WHERE goal_id = ?
    ORDER BY order_index ASC
  `
    )
    .all(goalId) as LearningPathStep[]
}

/**
 * Generates the learning path steps using local Qwen LLM.
 */
export async function generateLearningPath(goalId: string, topic: string): Promise<void> {
  const db = getDatabase()

  const systemPrompt = `You are a professional curriculum designer. Your goal is to break down the given learning topic into 5 structured, sequential steps.
You MUST output ONLY a valid JSON array of objects representing these steps.
Each object must have the exact properties:
- "title": string (the focus of this step)
- "description": string (explanation of what to learn)
- "estimated_duration": string (duration, e.g. "45 mins", "2 hours")

Do NOT include any introduction, formatting backticks, markdown, or other commentary. Output ONLY the JSON array.`

  const prompt = `Generate a sequential learning path for the topic: "${topic}".`

  try {
    const rawResult = await llmService.generateCompletion(prompt, systemPrompt)
    console.log('LLM Raw learning path result:', rawResult)

    const steps = cleanAndParseJSON(rawResult)
    if (!Array.isArray(steps)) {
      throw new Error('LLM output is not a JSON array')
    }

    db.transaction(() => {
      db.prepare('DELETE FROM learning_path_steps WHERE goal_id = ?').run(goalId)

      steps.forEach((step: any, index: number) => {
        const id = crypto.randomUUID()
        const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19)
        db.prepare(
          `
          INSERT INTO learning_path_steps (id, goal_id, title, description, estimated_duration, order_index, note_id, status, recommendations, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, NULL, 'Pending', NULL, ?, ?)
        `
        ).run(
          id,
          goalId,
          step.title || `Step ${index + 1}`,
          step.description || '',
          step.estimated_duration || '1 hour',
          index,
          nowStr,
          nowStr
        )
      })

      db.prepare("UPDATE learning_goals SET updated_at = datetime('now') WHERE id = ?").run(goalId)
    })()
  } catch (error) {
    console.error('Failed to generate learning path steps using LLM, using fallbacks:', error)

    const fallbackSteps = [
      {
        title: `Introduction to ${topic}`,
        description: `Learn the fundamentals and core concepts of ${topic}.`,
        estimated_duration: '1 hour'
      },
      {
        title: `Intermediate Concepts in ${topic}`,
        description: `Understand intermediate techniques, patterns, and workflows.`,
        estimated_duration: '2 hours'
      },
      {
        title: `Practical Application of ${topic}`,
        description: `Build a small hands-on project or complete exercises.`,
        estimated_duration: '3 hours'
      }
    ]

    db.transaction(() => {
      db.prepare('DELETE FROM learning_path_steps WHERE goal_id = ?').run(goalId)
      fallbackSteps.forEach((step, index) => {
        const id = crypto.randomUUID()
        const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19)
        db.prepare(
          `
          INSERT INTO learning_path_steps (id, goal_id, title, description, estimated_duration, order_index, note_id, status, recommendations, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, NULL, 'Pending', NULL, ?, ?)
        `
        ).run(
          id,
          goalId,
          step.title,
          step.description,
          step.estimated_duration,
          index,
          nowStr,
          nowStr
        )
      })
      db.prepare("UPDATE learning_goals SET updated_at = datetime('now') WHERE id = ?").run(goalId)
    })()
  }
}

/**
 * Scans notes in the workspace to spot content gaps and update linkages/online recommendations.
 */
export async function performGapAnalysis(goalId: string): Promise<void> {
  const db = getDatabase()

  const steps = db
    .prepare(
      `
    SELECT id, title FROM learning_path_steps WHERE goal_id = ? ORDER BY order_index ASC
  `
    )
    .all() as Array<{ id: string; title: string }>

  for (const step of steps) {
    const results = await indexingService.hybridSearch(step.title, 5)
    const noteMatches = results.filter((r) => r.type === 'note')
    const bestMatch = noteMatches.length > 0 ? noteMatches[0] : null

    if (bestMatch && bestMatch.score >= 0.4) {
      db.prepare(
        `
        UPDATE learning_path_steps
        SET note_id = ?, recommendations = NULL, updated_at = datetime('now')
        WHERE id = ?
      `
      ).run(bestMatch.id, step.id)
    } else {
      let recommendations = ''
      try {
        const recPrompt = `Provide 2-3 specific online learning resources, official documentation links, or search queries for the topic: "${step.title}". Keep the answer highly focused and concise, in bullet points.`
        const recSystemPrompt = `You are a helpful learning assistant. Recommend online tutorials, books, or documentation for learning a topic. Output ONLY the bulleted list.`
        recommendations = await llmService.generateCompletion(recPrompt, recSystemPrompt)
      } catch (err) {
        console.warn(`Failed to generate LLM recommendations for step: ${step.title}`, err)
        recommendations = `Search online for official documentation or tutorials on "${step.title}".`
      }

      db.prepare(
        `
        UPDATE learning_path_steps
        SET note_id = NULL, recommendations = ?, updated_at = datetime('now')
        WHERE id = ?
      `
      ).run(recommendations, step.id)
    }
  }

  db.prepare("UPDATE learning_goals SET updated_at = datetime('now') WHERE id = ?").run(goalId)
}

/**
 * Marks a step as complete, logging it and checking if the entire goal is completed.
 */
export async function completeStep(stepId: string): Promise<void> {
  const db = getDatabase()

  db.transaction(() => {
    db.prepare(
      `
      UPDATE learning_path_steps
      SET status = 'Completed', updated_at = datetime('now')
      WHERE id = ?
    `
    ).run(stepId)

    db.prepare('INSERT INTO audit_log (id, user_id, action, details_json) VALUES (?, ?, ?, ?)').run(
      crypto.randomUUID(),
      'system',
      'LEARNING_STEP_COMPLETED',
      JSON.stringify({ stepId })
    )

    const step = db.prepare('SELECT goal_id FROM learning_path_steps WHERE id = ?').get(stepId) as
      { goal_id: string } | undefined
    if (step) {
      const totalSteps = db
        .prepare('SELECT COUNT(*) as count FROM learning_path_steps WHERE goal_id = ?')
        .get(step.goal_id) as { count: number }
      const completedSteps = db
        .prepare(
          "SELECT COUNT(*) as count FROM learning_path_steps WHERE goal_id = ? AND status = 'Completed'"
        )
        .get(step.goal_id) as { count: number }

      if (totalSteps.count > 0 && totalSteps.count === completedSteps.count) {
        db.prepare(
          `
          UPDATE learning_goals
          SET status = 'Completed', updated_at = datetime('now')
          WHERE id = ?
        `
        ).run(step.goal_id)

        db.prepare('INSERT INTO audit_log (id, user_id, action, details_json) VALUES (?, ?, ?, ?)').run(
          crypto.randomUUID(),
          'system',
          'LEARNING_GOAL_COMPLETED',
          JSON.stringify({ goalId: step.goal_id })
        )
      }
    }
  })()
}
