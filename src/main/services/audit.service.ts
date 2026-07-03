import { getDatabase } from '../database/connection'
import crypto from 'crypto'

export interface AuditEntry {
  id: string
  user_id: string
  action: string
  entity_type: string | null
  entity_id: string | null
  details_json: string | null
  ip_address: string | null
  created_at: string
}

/**
 * Inserts an audit trail event.
 */
export function logAction(
  userId: string,
  action: string,
  entityType?: string | null,
  entityId?: string | null,
  details?: any
): void {
  const db = getDatabase()
  const id = crypto.randomUUID()
  const detailsJson = details ? JSON.stringify(details) : null
  const createdAt = new Date().toISOString().replace('T', ' ').substring(0, 19)

  try {
    db.prepare(
      `
      INSERT INTO audit_log (id, user_id, action, entity_type, entity_id, details_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
    ).run(id, userId, action, entityType || null, entityId || null, detailsJson, createdAt)
  } catch (error) {
    console.error('Failed to insert audit log entry:', error)
  }
}

/**
 * Fetches the audit log list based on filters.
 */
export function getAuditLog(filters?: {
  action?: string
  entityType?: string
  from?: string
  to?: string
  limit?: number
}): AuditEntry[] {
  const db = getDatabase()
  let sql = `
    SELECT id, user_id, action, entity_type, entity_id, details_json, ip_address, created_at
    FROM audit_log
    WHERE 1=1
  `
  const params: any[] = []

  if (filters?.action) {
    sql += ' AND action = ?'
    params.push(filters.action)
  }
  if (filters?.entityType) {
    sql += ' AND entity_type = ?'
    params.push(filters.entityType)
  }
  if (filters?.from) {
    sql += ' AND created_at >= ?'
    params.push(filters.from)
  }
  if (filters?.to) {
    sql += ' AND created_at <= ?'
    params.push(filters.to)
  }

  sql += ' ORDER BY created_at DESC'

  const limit = filters?.limit || 100
  sql += ' LIMIT ?'
  params.push(limit)

  return db.prepare(sql).all(...params) as AuditEntry[]
}

/**
 * Gets audit trail entries associated with a specific entity.
 */
export function getAuditLogForEntity(entityType: string, entityId: string): AuditEntry[] {
  const db = getDatabase()
  return db
    .prepare(
      `
    SELECT id, user_id, action, entity_type, entity_id, details_json, ip_address, created_at
    FROM audit_log
    WHERE entity_type = ? AND entity_id = ?
    ORDER BY created_at DESC
  `
    )
    .all(entityType, entityId) as AuditEntry[]
}

/**
 * Gets recent activities for the user dashboard.
 */
export function getRecentActivity(userId: string, limit: number = 10): AuditEntry[] {
  const db = getDatabase()
  return db
    .prepare(
      `
    SELECT id, user_id, action, entity_type, entity_id, details_json, ip_address, created_at
    FROM audit_log
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `
    )
    .all(userId, limit) as AuditEntry[]
}
