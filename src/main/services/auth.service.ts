import crypto from 'crypto'
import { getDatabase } from '../database/connection'

interface User {
  id: string
  name: string
  created_at: string
}

const ITERATIONS = 10000
const KEY_LENGTH = 64
const DIGEST = 'sha512'

/**
 * Hash password using PBKDF2
 */
function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, KEY_LENGTH, DIGEST).toString('hex')
}

/**
 * Check if any users are registered in the local database
 */
export function hasUsers(): boolean {
  const db = getDatabase()
  try {
    const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }
    return row.count > 0
  } catch (error) {
    console.error('Failed to check for existing users:', error)
    return false
  }
}

/**
 * Register a new local user
 */
export function registerUser(name: string, pass: string): User {
  const db = getDatabase()
  const id = crypto.randomUUID()
  const salt = crypto.randomBytes(16).toString('hex')
  const passwordHash = hashPassword(pass, salt)

  try {
    db.prepare('INSERT INTO users (id, name, password_hash, salt) VALUES (?, ?, ?, ?)').run(
      id,
      name,
      passwordHash,
      salt
    )

    // Log audit
    db.prepare('INSERT INTO audit_log (id, user_id, action, details_json) VALUES (?, ?, ?, ?)').run(
      crypto.randomUUID(),
      id,
      'USER_REGISTERED',
      JSON.stringify({ name })
    )

    return {
      id,
      name,
      created_at: new Date().toISOString()
    }
  } catch (error) {
    console.error('Failed to register user:', error)
    throw new Error('Registration failed')
  }
}

/**
 * Login the user by verifying their password
 */
export function loginUser(pass: string): User {
  const db = getDatabase()

  try {
    // Since there's typically one user for a local-first twin, get the first user
    const userRow = db.prepare('SELECT * FROM users LIMIT 1').get() as
      | {
          id: string
          name: string
          password_hash: string
          salt: string
          created_at: string
        }
      | undefined

    if (!userRow) {
      throw new Error('No registered users found')
    }

    const calculatedHash = hashPassword(pass, userRow.salt)

    if (calculatedHash === userRow.password_hash) {
      // Log audit
      db.prepare('INSERT INTO audit_log (id, user_id, action, details_json) VALUES (?, ?, ?, ?)').run(
        crypto.randomUUID(),
        userRow.id,
        'USER_LOGIN',
        JSON.stringify({ name: userRow.name })
      )

      return {
        id: userRow.id,
        name: userRow.name,
        created_at: userRow.created_at
      }
    } else {
      throw new Error('Invalid password')
    }
  } catch (error) {
    console.error('Login failed:', error)
    throw new Error(error instanceof Error ? error.message : 'Login failed')
  }
}
