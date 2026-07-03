import { getDatabase } from '../database/connection'
import crypto from 'crypto'

/**
 * Automatically creates semantic relationship links in the knowledge graph
 * based on shared named entities.
 */
export async function enrichGraphFromEntities(sourceId: string, sourceType: string): Promise<void> {
  const db = getDatabase()

  try {
    // 1. Get all entities associated with this source item
    const entities = db
      .prepare(
        `
      SELECT entity_id FROM entity_mentions WHERE source_id = ? AND source_type = ?
    `
      )
      .all(sourceId, sourceType) as Array<{ entity_id: string }>

    if (entities.length === 0) return

    db.transaction(() => {
      // Clean old auto-generated shared-entity relationships for this item
      db.prepare(
        `
        DELETE FROM relationships 
        WHERE (source_id = ? AND type = 'shared_entity') 
           OR (target_id = ? AND type = 'shared_entity')
      `
      ).run(sourceId, sourceId)

      for (const ent of entities) {
        // Find other source items sharing this entity
        const matches = db
          .prepare(
            `
          SELECT source_id, source_type 
          FROM entity_mentions 
          WHERE entity_id = ? AND source_id != ?
        `
          )
          .all(ent.entity_id, sourceId) as Array<{ source_id: string; source_type: string }>

        for (const match of matches) {
          const relId = crypto.randomUUID()

          // To prevent duplicate bi-directional edges, order source and target alphabetically
          const [firstId, secondId] = [sourceId, match.source_id].sort()
          const [firstType, secondType] =
            sourceId === firstId ? [sourceType, match.source_type] : [match.source_type, sourceType]

          db.prepare(
            `
            INSERT OR IGNORE INTO relationships (id, source_id, source_type, target_id, target_type, type, weight)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `
          ).run(relId, firstId, firstType, secondId, secondType, 'shared_entity', 1.0)
        }
      }
    })()

    console.log(`Knowledge graph enriched successfully for item: ${sourceId}`)
  } catch (error) {
    console.error('Failed to run entity graph enrichment:', error)
  }
}

/**
 * Batch enrich the entire knowledge graph for all existing entities.
 */
export async function batchEnrichGraph(): Promise<void> {
  const db = getDatabase()
  try {
    const items = db
      .prepare(
        `
      SELECT DISTINCT source_id, source_type FROM entity_mentions
    `
      )
      .all() as Array<{ source_id: string; source_type: string }>

    for (const item of items) {
      await enrichGraphFromEntities(item.source_id, item.source_type)
    }
    console.log('Batch knowledge graph enrichment completed successfully.')
  } catch (e) {
    console.error('Batch graph enrichment failed:', e)
  }
}
