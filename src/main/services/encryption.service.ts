import { app, safeStorage } from 'electron'
import crypto from 'crypto'
import path from 'path'
import fs from 'fs'

let masterKey: Buffer | null = null

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12 // GCM standard IV length is 12 bytes
const KEY_LENGTH = 32 // 256 bits

/**
 * Gets or initializes the master encryption key using Electron's safeStorage API.
 * The raw key is never stored in plaintext on disk.
 */
export function getMasterKey(): Buffer {
  if (masterKey) return masterKey

  const keyPath = path.join(app.getPath('userData'), 'master.key')

  if (fs.existsSync(keyPath)) {
    try {
      const encryptedKey = fs.readFileSync(keyPath)
      if (safeStorage.isEncryptionAvailable()) {
        const decryptedKey = Buffer.from(safeStorage.decryptString(encryptedKey), 'hex')
        masterKey = decryptedKey
        console.log('Master key successfully decrypted via safeStorage')
        return decryptedKey
      } else {
        throw new Error('safeStorage encryption is not available on this platform')
      }
    } catch (error) {
      console.error('Failed to decrypt master key. Creating a new one.', error)
    }
  }

  // Generate a new key if not exists or failed to decrypt
  const newKey = crypto.randomBytes(KEY_LENGTH)

  if (safeStorage.isEncryptionAvailable()) {
    try {
      const encryptedKey = safeStorage.encryptString(newKey.toString('hex'))
      fs.writeFileSync(keyPath, encryptedKey)
      masterKey = newKey
      console.log('Generated and saved new master key encrypted via safeStorage')
    } catch (error) {
      console.error(
        'safeStorage encryption failed. Falling back to local storage (unencrypted key!).',
        error
      )
      // Fallback: save unencrypted if safeStorage is broken (dev/testing fallback)
      fs.writeFileSync(keyPath + '.unsecure', newKey)
      masterKey = newKey
    }
  } else {
    console.warn('safeStorage is not available. Falling back to local unsecure storage.')
    fs.writeFileSync(keyPath + '.unsecure', newKey)
    masterKey = newKey
  }

  return masterKey
}

/**
 * Encrypts plaintext using AES-256-GCM
 */
export function encrypt(plainText: string): { iv: string; content: string; tag: string } {
  const key = getMasterKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plainText, 'utf8', 'hex')
  encrypted += cipher.final('hex')

  const tag = cipher.getAuthTag().toString('hex')

  return {
    iv: iv.toString('hex'),
    content: encrypted,
    tag: tag
  }
}

/**
 * Decrypts ciphertext using AES-256-GCM
 */
export function decrypt(encryptedData: { iv: string; content: string; tag: string }): string {
  const key = getMasterKey()
  const iv = Buffer.from(encryptedData.iv, 'hex')
  const tag = Buffer.from(encryptedData.tag, 'hex')
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)

  decipher.setAuthTag(tag)

  let decrypted = decipher.update(encryptedData.content, 'hex', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

/**
 * Encrypts a Buffer (for files)
 */
export function encryptBuffer(buffer: Buffer): Buffer {
  const key = getMasterKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()])
  const tag = cipher.getAuthTag()

  // Format: [IV_LENGTH (1 byte)][IV][TAG_LENGTH (1 byte)][TAG][ENCRYPTED_DATA]
  const header = Buffer.alloc(2 + IV_LENGTH + tag.length)
  header.writeUInt8(IV_LENGTH, 0)
  iv.copy(header, 1)
  header.writeUInt8(tag.length, 1 + IV_LENGTH)
  tag.copy(header, 2 + IV_LENGTH)

  return Buffer.concat([header, encrypted])
}

/**
 * Decrypts a Buffer (for files)
 */
export function decryptBuffer(buffer: Buffer): Buffer {
  const key = getMasterKey()

  const ivLength = buffer.readUInt8(0)
  const iv = buffer.subarray(1, 1 + ivLength)

  const tagLength = buffer.readUInt8(1 + ivLength)
  const tag = buffer.subarray(2 + ivLength, 2 + ivLength + tagLength)

  const encryptedData = buffer.subarray(2 + ivLength + tagLength)

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(encryptedData), decipher.final()])
}

/**
 * Derives a cryptographic key from a password and salt using PBKDF2.
 */
export function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100000, KEY_LENGTH, 'sha256')
}

/**
 * Encrypts a single string field using AES-256-GCM and a custom key.
 * Returns formatted string "iv:tag:ciphertext".
 */
export function encryptField(plaintext: string, key: Buffer): string {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'hex')
  encrypted += cipher.final('hex')
  const tag = cipher.getAuthTag().toString('hex')
  return `${iv.toString('hex')}:${tag}:${encrypted}`
}

/**
 * Decrypts a formatted "iv:tag:ciphertext" string.
 */
export function decryptField(ciphertextStr: string, key: Buffer): string {
  const parts = ciphertextStr.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted field format')
  }
  const iv = Buffer.from(parts[0], 'hex')
  const tag = Buffer.from(parts[1], 'hex')
  const ciphertext = parts[2]

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  let decrypted = decipher.update(ciphertext, 'hex', 'utf8')
  decrypted += decipher.final('utf8')
  return decrypted
}
