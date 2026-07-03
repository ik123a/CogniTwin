import { getDatabase } from '../database/connection'
import crypto from 'crypto'

export interface Flashcard {
  id: string
  note_id: string | null
  front: string
  back: string
  ease_factor: number
  interval: number
  repetitions: number
  next_review: string
  created_at: string
}

/**
 * Gets all due flashcards from SQLite where next_review is past or due.
 */
export async function getDueCards(): Promise<Flashcard[]> {
  const db = getDatabase()
  const cards = db
    .prepare(
      `
    SELECT id, note_id, front, back, ease_factor, interval, repetitions, next_review, created_at
    FROM flashcards
    WHERE next_review <= datetime('now')
    ORDER BY next_review ASC
  `
    )
    .all() as Flashcard[]
  return cards
}

/**
 * Creates a new flashcard for a specific note or general workbench study.
 */
export async function createCard(
  noteId: string | null,
  front: string,
  back: string
): Promise<Flashcard> {
  const db = getDatabase()
  const id = crypto.randomUUID()
  const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19)

  db.prepare(
    `
    INSERT INTO flashcards (id, note_id, front, back, ease_factor, interval, repetitions, next_review, created_at)
    VALUES (?, ?, ?, ?, 2.5, 0, 0, ?, ?)
  `
  ).run(id, noteId, front, back, nowStr, nowStr)

  const card = db
    .prepare(
      `
    SELECT id, note_id, front, back, ease_factor, interval, repetitions, next_review, created_at
    FROM flashcards WHERE id = ?
  `
    )
    .get(id) as Flashcard

  return card
}

/**
 * Performs a review of a flashcard and updates review scheduling parameters using the SM-2 algorithm.
 */
export async function reviewCard(cardId: string, grade: number): Promise<Flashcard> {
  const db = getDatabase()
  const card = db
    .prepare(
      `
    SELECT id, note_id, front, back, ease_factor, interval, repetitions, next_review, created_at
    FROM flashcards WHERE id = ?
  `
    )
    .get(cardId) as Flashcard | undefined

  if (!card) {
    throw new Error(`Flashcard not found: ${cardId}`)
  }

  if (grade < 0 || grade > 5) {
    throw new Error('Grade must be between 0 and 5')
  }

  let interval = card.interval
  let repetitions = card.repetitions
  let easeFactor = card.ease_factor

  // SM-2 Algorithm implementation
  if (grade < 3) {
    interval = 1
    repetitions = 0
  } else {
    if (repetitions === 0) {
      interval = 1
    } else if (repetitions === 1) {
      interval = 6
    } else {
      interval = Math.round(card.interval * easeFactor)
    }
    repetitions = repetitions + 1
  }

  easeFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02))
  if (easeFactor < 1.3) {
    easeFactor = 1.3
  }

  const nextReviewDate = new Date()
  nextReviewDate.setDate(nextReviewDate.getDate() + interval)
  const nextReviewStr = nextReviewDate.toISOString().replace('T', ' ').substring(0, 19)

  db.prepare(
    `
    UPDATE flashcards
    SET ease_factor = ?, interval = ?, repetitions = ?, next_review = ?
    WHERE id = ?
  `
  ).run(easeFactor, interval, repetitions, nextReviewStr, cardId)

  try {
    db.prepare('INSERT INTO audit_log (id, user_id, action, details_json) VALUES (?, ?, ?, ?)').run(
      crypto.randomUUID(),
      'system',
      'FLASHCARD_REVIEW',
      JSON.stringify({ cardId, grade, nextReview: nextReviewStr })
    )
  } catch (err) {
    console.error('Failed to log flashcard review to audit log:', err)
  }

  const updatedCard = db
    .prepare(
      `
    SELECT id, note_id, front, back, ease_factor, interval, repetitions, next_review, created_at
    FROM flashcards WHERE id = ?
  `
    )
    .get(cardId) as Flashcard

  return updatedCard
}
