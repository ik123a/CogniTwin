import { getDatabase } from '../database/connection'
import { logAction } from './audit.service'
import crypto from 'crypto'

export interface DecisionOption {
  name: string
  factorRatings: Record<string, number> // Factor name -> score from 1-10 (e.g. Technical difficulty, ROI)
}

export interface DecisionFactor {
  name: string
  weight: number // Importance weight (positive or negative)
  description?: string
}

export interface SavedDecisionRow {
  id: string
  title: string
  description: string | null
  options_json: string
  factors_json: string
  recommended_option: string | null
  created_at: string
}

// 5 Markov States
export type MarkovState =
  'Focus Working' | 'Resting/Break' | 'Communications Triage' | 'Meetings' | 'Idle'

const MARKOV_STATES: MarkovState[] = [
  'Focus Working',
  'Resting/Break',
  'Communications Triage',
  'Meetings',
  'Idle'
]

/**
 * Maps audit log action types to one of the 5 Markov states.
 */
function mapActionToState(action: string): MarkovState {
  const act = action.toUpperCase()
  if (
    act.includes('FOCUS_MODE_ACTIVE') ||
    act.includes('CREATE_NOTE') ||
    act.includes('UPDATE_NOTE') ||
    act.includes('CREATE_TASK') ||
    act.includes('SAVE_SCRIPT') ||
    act.includes('EXECUTE_JS_SCRIPT') ||
    act.includes('RUN_JS') ||
    act.includes('RUN_PYTHON')
  ) {
    return 'Focus Working'
  }
  if (
    act.includes('FOCUS_MODE_DEACTIVATED') ||
    act.includes('STUDY_CARDS') ||
    act.includes('SNOOZE')
  ) {
    return 'Resting/Break'
  }
  if (
    act.includes('SYNC_EMAIL') ||
    act.includes('EMAIL_TRIAGE') ||
    act.includes('INBOX') ||
    act.includes('NAVIGATION')
  ) {
    return 'Communications Triage'
  }
  if (act.includes('MEETING') || act.includes('CALENDAR_SYNC')) {
    return 'Meetings'
  }
  return 'Idle'
}

/**
 * Builds the empirical transition matrix from the audit log.
 * Bootstraps with synthetic data if the audit log has few records.
 */
export async function getMarkovForecast(): Promise<{
  matrix: Record<MarkovState, Record<MarkovState, number>>
  forecast: Array<{ hour: number; state: MarkovState }>
}> {
  const db = getDatabase()
  let auditLogs: Array<{ action: string }> = []

  try {
    auditLogs = db.prepare('SELECT action FROM audit_log ORDER BY created_at ASC').all() as any[]
  } catch (err) {
    console.error('Failed to read audit logs for Markov forecasting:', err)
  }

  // Initialize transition counts matrix
  const counts: Record<MarkovState, Record<MarkovState, number>> = {} as any
  const matrix: Record<MarkovState, Record<MarkovState, number>> = {} as any

  MARKOV_STATES.forEach((s1) => {
    counts[s1] = {} as any
    matrix[s1] = {} as any
    MARKOV_STATES.forEach((s2) => {
      counts[s1][s2] = 0
      matrix[s1][s2] = 0
    })
  })

  // Default bootstrapping weights to ensure sensible transitions
  const defaults: Record<MarkovState, Record<MarkovState, number>> = {
    'Focus Working': {
      'Focus Working': 0.6,
      'Resting/Break': 0.2,
      'Communications Triage': 0.1,
      Meetings: 0.05,
      Idle: 0.05
    },
    'Resting/Break': {
      'Focus Working': 0.3,
      'Resting/Break': 0.4,
      'Communications Triage': 0.1,
      Meetings: 0.05,
      Idle: 0.15
    },
    'Communications Triage': {
      'Focus Working': 0.2,
      'Resting/Break': 0.1,
      'Communications Triage': 0.5,
      Meetings: 0.1,
      Idle: 0.1
    },
    Meetings: {
      'Focus Working': 0.1,
      'Resting/Break': 0.1,
      'Communications Triage': 0.2,
      Meetings: 0.4,
      Idle: 0.2
    },
    Idle: {
      'Focus Working': 0.2,
      'Resting/Break': 0.1,
      'Communications Triage': 0.2,
      Meetings: 0.1,
      Idle: 0.4
    }
  }

  // Convert audit logs to sequence of states
  const sequence = auditLogs.map((log) => mapActionToState(log.action))

  // Count transitions
  let transitionsCount = 0
  for (let i = 0; i < sequence.length - 1; i++) {
    counts[sequence[i]][sequence[i + 1]]++
    transitionsCount++
  }

  // Normalize counts to get probabilities, blend with defaults if sample size is small
  MARKOV_STATES.forEach((s1) => {
    let sum = 0
    MARKOV_STATES.forEach((s2) => {
      sum += counts[s1][s2]
    })

    MARKOV_STATES.forEach((s2) => {
      if (sum > 5) {
        // Blend empirical probabilities (80%) with fallback defaults (20%)
        matrix[s1][s2] = (counts[s1][s2] / sum) * 0.8 + defaults[s1][s2] * 0.2
      } else {
        // Pure bootstrap default
        matrix[s1][s2] = defaults[s1][s2]
      }
    })

    // Re-normalize row just to ensure strict sum = 1.0
    let rowSum = 0
    MARKOV_STATES.forEach((s2) => {
      rowSum += matrix[s1][s2]
    })
    MARKOV_STATES.forEach((s2) => {
      matrix[s1][s2] /= rowSum
    })
  })

  // Determine current state (last logged state, defaulting to Focus Working)
  let currentState: MarkovState = 'Focus Working'
  if (sequence.length > 0) {
    currentState = sequence[sequence.length - 1]
  }

  // Simulate 24 hours path (24 steps)
  const forecast: Array<{ hour: number; state: MarkovState }> = []
  let tempState = currentState
  const startHour = new Date().getHours()

  for (let step = 0; step < 24; step++) {
    forecast.push({
      hour: (startHour + step) % 24,
      state: tempState
    })

    // Transition to next state
    const probs = matrix[tempState]
    const rand = Math.random()
    let cumulative = 0
    let nextState = tempState

    for (const state of MARKOV_STATES) {
      cumulative += probs[state]
      if (rand <= cumulative) {
        nextState = state
        break
      }
    }
    tempState = nextState
  }

  return { matrix, forecast }
}

/**
 * Monte Carlo simulator for project completion.
 * Given a project, runs 1000 trials to estimate calendar days.
 */
export async function runMonteCarlo(
  projectId: string | null,
  runs = 1000
): Promise<{
  meanDays: number
  confidence90: number
  riskFactor: 'Low' | 'Medium' | 'High'
  chartData: Array<{ days: number; probability: number; cumulative: number }>
}> {
  const db = getDatabase()
  let tasks: Array<{ id: string; priority: string; title: string }> = []

  try {
    if (projectId) {
      tasks = db
        .prepare(
          "SELECT id, priority, title FROM tasks WHERE project_id = ? AND status != 'Completed'"
        )
        .all(projectId) as any[]
    } else {
      tasks = db
        .prepare("SELECT id, priority, title FROM tasks WHERE status != 'Completed'")
        .all() as any[]
    }
  } catch (e) {
    console.error('Failed to get tasks for Monte Carlo simulation:', e)
  }

  // Base tasks count
  if (tasks.length === 0) {
    // Return empty model fallback
    return {
      meanDays: 0,
      confidence90: 0,
      riskFactor: 'Low',
      chartData: []
    }
  }

  // Assign durations in hours based on priority with random variance
  // High = 8h, Medium = 4h, Low = 2h
  const trials: number[] = []

  for (let run = 0; run < runs; run++) {
    let totalHours = 0

    tasks.forEach((t) => {
      let base = 4
      if (t.priority === 'High') base = 8
      else if (t.priority === 'Low') base = 2

      // Add task-specific complexity variance (exponential or lognormal noise)
      // Representing developer underestimations!
      const noise = -Math.log(Math.random()) * (base * 0.5) // Mean error of 50%
      totalHours += base + noise
    })

    // Daily focus capacity: 4 focus hours/day, with Gaussian interruption noise
    // capacity ~ Normal(4.0, 0.8) capped at minimum 1 hour
    const u1 = Math.random()
    const u2 = Math.random()
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2) // Box-Muller transform
    const capacity = Math.max(1, 4.0 + z * 0.8)

    const calendarDays = totalHours / capacity
    trials.push(calendarDays)
  }

  // Sort trials to calculate percentiles
  trials.sort((a, b) => a - b)

  const sum = trials.reduce((acc, v) => acc + v, 0)
  const meanDays = Math.round((sum / runs) * 10) / 10
  const confidence90 = Math.round(trials[Math.floor(runs * 0.9)] * 10) / 10

  // Determine risk factor based on standard deviation / variance
  const mean = sum / runs
  const variance = trials.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / runs
  const stdDev = Math.sqrt(variance)
  const cv = stdDev / mean // Coefficient of variation

  let riskFactor: 'Low' | 'Medium' | 'High' = 'Low'
  if (cv > 0.4 || tasks.length > 10) {
    riskFactor = 'High'
  } else if (cv > 0.25 || tasks.length > 5) {
    riskFactor = 'Medium'
  }

  // Generate probability curve charts
  // Find min and max bounds for bucketing
  const minVal = Math.floor(trials[0])
  const maxVal = Math.ceil(trials[trials.length - 1])
  const bucketSize = Math.max(1, Math.round((maxVal - minVal) / 20))

  const chartData: Array<{ days: number; probability: number; cumulative: number }> = []

  for (let d = minVal; d <= maxVal; d += bucketSize) {
    // Count how many trials fall below or equal to d
    const countLE = trials.filter((t) => t <= d).length
    // Count how many fall in this specific bucket
    const countInBucket = trials.filter((t) => t > d - bucketSize && t <= d).length

    chartData.push({
      days: d,
      probability: Math.round((countInBucket / runs) * 1000) / 10,
      cumulative: Math.round((countLE / runs) * 1000) / 10
    })
  }

  // Save run meta to DB
  try {
    const dbRun = getDatabase()
    dbRun
      .prepare(
        `
      INSERT INTO simulation_runs (id, type, input_parameters_json, output_results_json)
      VALUES (?, ?, ?, ?)
    `
      )
      .run(
        crypto.randomUUID(),
        'monte_carlo',
        JSON.stringify({ projectId, tasksCount: tasks.length }),
        JSON.stringify({ meanDays, confidence90, riskFactor })
      )
  } catch (err) {
    console.error('Failed to log Monte Carlo simulation run:', err)
  }

  return { meanDays, confidence90, riskFactor, chartData }
}

/**
 * Computes decision support rankings using Bayesian expected utilities.
 */
export async function solveDecision(
  title: string,
  description: string | null,
  options: DecisionOption[],
  factors: DecisionFactor[]
): Promise<{
  id: string
  recommendedOption: string
  rankings: Array<{ name: string; score: number; confidence: number }>
}> {
  const db = getDatabase()
  const id = crypto.randomUUID()

  // Normalize factor weights so their absolute sum equals 1
  const totalWeight = factors.reduce((acc, f) => acc + Math.abs(f.weight), 0) || 1

  const rankings = options.map((opt) => {
    let utility = 0
    let confidenceSum = 0

    factors.forEach((fact) => {
      const rating = opt.factorRatings[fact.name] || 5 // Default rating of 5
      // Expected utility = rating (1-10) scaled by factor weight importance
      const scaleFactor = fact.weight / totalWeight
      utility += rating * scaleFactor
      confidenceSum += Math.abs(scaleFactor)
    })

    // Convert utility back to a 0-100 score index
    // Utility ranges from -10 to +10 (depending on weights). We scale it to 0-100
    // If weights are positive, max utility is 10.
    const score = Math.round((utility / 10) * 100)
    // Confidence is derived from factor ratings variance (more consistent ratings = higher confidence)
    const ratingsArray = Object.values(opt.factorRatings)
    const meanRating = ratingsArray.reduce((s, r) => s + r, 0) / (ratingsArray.length || 1)
    const ratingVariance =
      ratingsArray.reduce((s, r) => s + Math.pow(r - meanRating, 2), 0) / (ratingsArray.length || 1)
    const confidence = Math.round(Math.max(40, 100 - ratingVariance * 8))

    return {
      name: opt.name,
      score: Math.min(100, Math.max(0, score)),
      confidence
    }
  })

  // Sort rankings by highest score
  rankings.sort((a, b) => b.score - a.score)
  const recommendedOption = rankings[0]?.name || 'None'

  // Save to DB
  try {
    db.prepare(
      `
      INSERT INTO saved_decisions (id, title, description, options_json, factors_json, recommended_option)
      VALUES (?, ?, ?, ?, ?, ?)
    `
    ).run(
      id,
      title,
      description,
      JSON.stringify(options),
      JSON.stringify(factors),
      recommendedOption
    )
    logAction('system', 'SOLVE_DECISION', 'decision', id, { title })
  } catch (err) {
    console.error('Failed to save decision matrix:', err)
  }

  return { id, recommendedOption, rankings }
}

/**
 * Gets all saved decisions from the DB.
 */
export function getSavedDecisions(): SavedDecisionRow[] {
  const db = getDatabase()
  try {
    return db
      .prepare('SELECT * FROM saved_decisions ORDER BY created_at DESC')
      .all() as SavedDecisionRow[]
  } catch (err) {
    console.error('Failed to list saved decisions:', err)
    return []
  }
}

/**
 * Deletes a saved decision from the DB.
 */
export function deleteDecision(id: string): { success: boolean } {
  const db = getDatabase()
  try {
    db.prepare('DELETE FROM saved_decisions WHERE id = ?').run(id)
    return { success: true }
  } catch (err) {
    console.error('Failed to delete saved decision:', err)
    return { success: false }
  }
}
