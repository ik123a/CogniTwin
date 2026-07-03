import { getDatabasePath, closeDatabase, getDatabase } from '../database/connection'
import { encryptBuffer, decryptBuffer } from './encryption.service'
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

/**
 * Creates an encrypted backup of the SQLite database
 */
export function createBackup(destinationDirectory: string): string {
  const dbPath = getDatabasePath()

  if (!fs.existsSync(dbPath)) {
    throw new Error('Database file does not exist. Cannot create backup.')
  }

  if (!fs.existsSync(destinationDirectory)) {
    fs.mkdirSync(destinationDirectory, { recursive: true })
  }

  const now = new Date()
  const timestamp = now.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '')
  const backupFileName = `cognitwin_backup_${timestamp}.enc`
  const backupPath = path.join(destinationDirectory, backupFileName)

  const dbBuffer = fs.readFileSync(dbPath)
  const encryptedBuffer = encryptBuffer(dbBuffer)
  fs.writeFileSync(backupPath, encryptedBuffer)

  try {
    const db = getDatabase()
    const id = crypto.randomUUID()
    const createdAt = now.toISOString().replace('T', ' ').substring(0, 19)

    // Log to backup_metadata
    db.prepare(
      `
      INSERT INTO backup_metadata (id, backup_type, file_path, encrypted, record_count, size_bytes, created_at)
      VALUES (?, 'full', ?, 0, 0, ?, ?)
    `
    ).run(id, backupPath, encryptedBuffer.length, createdAt)

    db.prepare('INSERT INTO audit_log (id, user_id, action, details_json) VALUES (?, ?, ?, ?)').run(
      crypto.randomUUID(),
      'system',
      'BACKUP_CREATED',
      JSON.stringify({ path: backupPath, type: 'full' })
    )
  } catch (err) {
    console.error('Failed to log backup audit:', err)
  }

  return backupPath
}

/**
 * Restores the database from an encrypted backup
 */
export function restoreBackup(backupFilePath: string): void {
  const dbPath = getDatabasePath()

  if (!fs.existsSync(backupFilePath)) {
    throw new Error('Backup file does not exist')
  }

  const encryptedBuffer = fs.readFileSync(backupFilePath)
  const dbBuffer = decryptBuffer(encryptedBuffer)

  closeDatabase()

  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, dbPath + '.bak')
  }

  try {
    fs.writeFileSync(dbPath, dbBuffer)

    if (fs.existsSync(dbPath + '-wal')) {
      fs.unlinkSync(dbPath + '-wal')
    }
    if (fs.existsSync(dbPath + '-shm')) {
      fs.unlinkSync(dbPath + '-shm')
    }

    console.log('Database restored successfully from backup:', backupFilePath)

    const db = getDatabase()
    db.prepare('INSERT INTO audit_log (id, user_id, action, details_json) VALUES (?, ?, ?, ?)').run(
      crypto.randomUUID(),
      'system',
      'BACKUP_RESTORED',
      JSON.stringify({ path: backupFilePath })
    )
  } catch (error) {
    console.error('Failed to restore backup, rolling back to previous state:', error)
    if (fs.existsSync(dbPath + '.bak')) {
      fs.copyFileSync(dbPath + '.bak', dbPath)
    }
    throw error
  } finally {
    if (fs.existsSync(dbPath + '.bak')) {
      fs.unlinkSync(dbPath + '.bak')
    }
  }
}

/**
 * Helper to encrypt a buffer with a password derived key.
 */
function encryptBufferWithPassword(buffer: Buffer, password: string): Buffer {
  const salt = crypto.randomBytes(16)
  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])
  const tag = cipher.getAuthTag()

  const header = Buffer.alloc(3 + salt.length + iv.length + tag.length)
  let offset = 0

  header.writeUInt8(salt.length, offset)
  offset += 1
  salt.copy(header, offset)
  offset += salt.length

  header.writeUInt8(iv.length, offset)
  offset += 1
  iv.copy(header, offset)
  offset += iv.length

  header.writeUInt8(tag.length, offset)
  offset += 1
  tag.copy(header, offset)

  return Buffer.concat([header, encrypted])
}

/**
 * Helper to decrypt a buffer with a password derived key.
 */
function decryptBufferWithPassword(buffer: Buffer, password: string): Buffer {
  let offset = 0

  const saltLength = buffer.readUInt8(offset)
  offset += 1
  const salt = buffer.subarray(offset, offset + saltLength)
  offset += saltLength

  const ivLength = buffer.readUInt8(offset)
  offset += 1
  const iv = buffer.subarray(offset, offset + ivLength)
  offset += ivLength

  const tagLength = buffer.readUInt8(offset)
  offset += 1
  const tag = buffer.subarray(offset, offset + tagLength)
  offset += tagLength

  const encryptedData = buffer.subarray(offset)

  const key = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(encryptedData), decipher.final()])
}

/**
 * Creates a password-encrypted backup of the database.
 */
export function createEncryptedBackup(destinationDirectory: string, password: string): string {
  const dbPath = getDatabasePath()

  if (!fs.existsSync(dbPath)) {
    throw new Error('Database file does not exist')
  }

  if (!fs.existsSync(destinationDirectory)) {
    fs.mkdirSync(destinationDirectory, { recursive: true })
  }

  const now = new Date()
  const timestamp = now.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '')
  const backupFileName = `cognitwin_secure_backup_${timestamp}.enc`
  const backupPath = path.join(destinationDirectory, backupFileName)

  const dbBuffer = fs.readFileSync(dbPath)
  const encryptedBuffer = encryptBufferWithPassword(dbBuffer, password)
  fs.writeFileSync(backupPath, encryptedBuffer)

  try {
    const db = getDatabase()
    const id = crypto.randomUUID()
    const createdAt = now.toISOString().replace('T', ' ').substring(0, 19)

    db.prepare(
      `
      INSERT INTO backup_metadata (id, backup_type, file_path, encrypted, record_count, size_bytes, created_at)
      VALUES (?, 'full', ?, 1, 0, ?, ?)
    `
    ).run(id, backupPath, encryptedBuffer.length, createdAt)

    db.prepare('INSERT INTO audit_log (id, user_id, action, details_json) VALUES (?, ?, ?, ?)').run(
      crypto.randomUUID(),
      'system',
      'BACKUP_SECURE_CREATED',
      JSON.stringify({ path: backupPath })
    )
  } catch (err) {
    console.error('Failed to log secure backup:', err)
  }

  return backupPath
}

/**
 * Restores the database from a password-encrypted backup.
 */
export function restoreEncryptedBackup(
  backupFilePath: string,
  password: string
): { success: boolean } {
  const dbPath = getDatabasePath()

  if (!fs.existsSync(backupFilePath)) {
    throw new Error('Backup file does not exist')
  }

  const encryptedBuffer = fs.readFileSync(backupFilePath)
  const dbBuffer = decryptBufferWithPassword(encryptedBuffer, password)

  closeDatabase()

  if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, dbPath + '.bak')
  }

  try {
    fs.writeFileSync(dbPath, dbBuffer)
    if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal')
    if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm')

    const db = getDatabase()
    db.prepare('INSERT INTO audit_log (id, user_id, action, details_json) VALUES (?, ?, ?, ?)').run(
      crypto.randomUUID(),
      'system',
      'BACKUP_SECURE_RESTORED',
      JSON.stringify({ path: backupFilePath })
    )
    return { success: true }
  } catch (error) {
    console.error('Failed to restore secure backup:', error)
    if (fs.existsSync(dbPath + '.bak')) {
      fs.copyFileSync(dbPath + '.bak', dbPath)
    }
    throw error
  } finally {
    if (fs.existsSync(dbPath + '.bak')) {
      fs.unlinkSync(dbPath + '.bak')
    }
  }
}

/**
 * Creates an incremental (differential) backup of only records modified since the last backup.
 */
export function createIncrementalBackup(destinationDirectory: string): string {
  const db = getDatabase()

  // Find date of last backup
  const lastBackup = db
    .prepare(
      `
    SELECT created_at, id FROM backup_metadata 
    ORDER BY created_at DESC LIMIT 1
  `
    )
    .get() as { created_at: string; id: string } | undefined

  const lastBackupDate = lastBackup ? lastBackup.created_at : '1970-01-01 00:00:00'
  const parentId = lastBackup ? lastBackup.id : null

  // Query changed records from tables
  const tables = ['notes', 'tasks', 'projects', 'files', 'events', 'subtasks']
  const incrementalData: Record<string, any[]> = {}
  let recordCount = 0

  for (const table of tables) {
    try {
      const rows = db
        .prepare(
          `
        SELECT * FROM ${table} 
        WHERE updated_at >= ? OR created_at >= ?
      `
        )
        .all(lastBackupDate, lastBackupDate)

      if (rows.length > 0) {
        incrementalData[table] = rows
        recordCount += rows.length
      }
    } catch {
      // Fallback for tables that might not have updated_at
      try {
        const rows = db
          .prepare(
            `
          SELECT * FROM ${table} 
          WHERE created_at >= ?
        `
          )
          .all(lastBackupDate)
        if (rows.length > 0) {
          incrementalData[table] = rows
          recordCount += rows.length
        }
      } catch (e) {
        console.warn(`Could not read incremental records for table ${table}:`, e)
      }
    }
  }

  if (!fs.existsSync(destinationDirectory)) {
    fs.mkdirSync(destinationDirectory, { recursive: true })
  }

  const now = new Date()
  const timestamp = now.toISOString().replace(/T/, '_').replace(/\..+/, '').replace(/:/g, '')
  const filename = `cognitwin_diff_backup_${timestamp}.json`
  const backupPath = path.join(destinationDirectory, filename)

  const payload = JSON.stringify(
    {
      backupType: 'incremental',
      parentBackupId: parentId,
      since: lastBackupDate,
      timestamp: now.toISOString(),
      data: incrementalData
    },
    null,
    2
  )

  fs.writeFileSync(backupPath, payload, 'utf8')

  // Insert metadata record
  const id = crypto.randomUUID()
  const createdAt = now.toISOString().replace('T', ' ').substring(0, 19)

  db.prepare(
    `
    INSERT INTO backup_metadata (id, backup_type, file_path, encrypted, record_count, size_bytes, parent_backup_id, created_at)
    VALUES (?, 'incremental', ?, 0, ?, ?, ?, ?)
  `
  ).run(id, backupPath, recordCount, Buffer.byteLength(payload), parentId, createdAt)

  db.prepare('INSERT INTO audit_log (id, user_id, action, details_json) VALUES (?, ?, ?, ?)').run(
    crypto.randomUUID(),
    'system',
    'BACKUP_INCREMENTAL_CREATED',
    JSON.stringify({ path: backupPath, parentId, recordCount })
  )

  return backupPath
}

/**
 * Returns historical backup actions and details.
 */
export function getBackupHistory(): any[] {
  const db = getDatabase()
  return db
    .prepare(
      `
    SELECT id, backup_type as backupType, file_path as filePath, encrypted, record_count as recordCount, size_bytes as sizeBytes, parent_backup_id as parentBackupId, created_at as createdAt
    FROM backup_metadata
    ORDER BY created_at DESC
  `
    )
    .all()
}
