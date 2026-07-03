import { getDatabase } from '../database/connection'
import { generateEmbedding } from './embedding.service'
import { chunkText, prepareTextForEmbedding } from './text-chunker.service'
import { extractEntities } from './nlp.service'
import crypto from 'crypto'

export interface SearchResult {
  id: string
  type: 'note' | 'task' | 'file' | 'inbox_item'
  title: string
  snippet: string
  score: number
  scoreType: 'semantic' | 'keyword' | 'hybrid'
}

export interface IndexStatus {
  isIndexing: boolean
  totalItems: number
  processedItems: number
  queueSize: number
}

let isIndexingAll = false
let processedCount = 0
let totalToProcess = 0

/**
 * Indexes a single item: chunks text, embeds chunks, runs NLP, and populates FTS5 index.
 */
export async function indexItem(
  id: string,
  type: 'note' | 'task' | 'file' | 'inbox_item',
  title: string,
  content: string | null
): Promise<void> {
  const db = getDatabase()
  const fullText = prepareTextForEmbedding(title, content)

  // Run transactions inside a database lock wrapper
  db.transaction(() => {
    // 1. Remove existing indexing data for this item
    removeExistingIndex(db, id, type)

    // 2. Insert into FTS5 keyword search virtual table
    db.prepare(
      `
      INSERT INTO fts_content (source_id, source_type, title, content)
      VALUES (?, ?, ?, ?)
    `
    ).run(id, type, title, content || '')
  })()

  // 3. Generate embeddings & entities asynchronously (outside main DB lock to avoid blocking WAL)
  const chunks = chunkText(fullText)
  if (chunks.length > 0) {
    try {
      const dbInstance = getDatabase()
      for (const chunk of chunks) {
        const embedding = await generateEmbedding(chunk.text)
        const vectorBuffer = Buffer.from(embedding.buffer)

        dbInstance.transaction(() => {
          // Insert vector into vec_embeddings virtual table
          // Get next rowid or insert and get rowid
          const vecRes = dbInstance
            .prepare(
              `
            INSERT INTO vec_embeddings (embedding) VALUES (?)
          `
            )
            .run(vectorBuffer)
          const vecRowid = vecRes.lastInsertRowid

          // Insert metadata mapping
          dbInstance
            .prepare(
              `
            INSERT INTO embeddings (source_id, source_type, chunk_index, chunk_text, vec_rowid)
            VALUES (?, ?, ?, ?, ?)
          `
            )
            .run(id, type, chunk.index, chunk.text, vecRowid)
        })()
      }
    } catch (e) {
      console.error(`Failed to generate embeddings for ${type} ${id}:`, e)
    }
  }

  // 4. NLP entity extraction
  const entities = extractEntities(fullText)
  if (entities.length > 0) {
    const dbInstance = getDatabase()
    dbInstance.transaction(() => {
      for (const ent of entities) {
        const entityId = crypto
          .createHash('md5')
          .update(`${ent.type}:${ent.normalizedName}`)
          .digest('hex')

        // Insert or update entity
        dbInstance
          .prepare(
            `
          INSERT INTO entities (id, name, type, normalized_name, mention_count)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            mention_count = mention_count + EXCLUDED.mention_count,
            last_seen = CURRENT_TIMESTAMP
        `
          )
          .run(entityId, ent.name, ent.type, ent.normalizedName, ent.mentionCount)

        // Record document link mention
        dbInstance
          .prepare(
            `
          INSERT OR IGNORE INTO entity_mentions (entity_id, source_id, source_type, context_snippet)
          VALUES (?, ?, ?, ?)
        `
          )
          .run(entityId, id, type, title)
      }
    })()
  }
}

/**
 * Removes index mappings for an item.
 */
function removeExistingIndex(db: any, id: string, type: string): void {
  // Get all associated vec_rowid items to clear them from vec_embeddings
  const embeds = db
    .prepare(
      `
    SELECT vec_rowid FROM embeddings WHERE source_id = ? AND source_type = ?
  `
    )
    .all(id, type)

  for (const emb of embeds) {
    db.prepare('DELETE FROM vec_embeddings WHERE rowid = ?').run(emb.vec_rowid)
  }

  // Clear embeddings metadata
  db.prepare('DELETE FROM embeddings WHERE source_id = ? AND source_type = ?').run(id, type)

  // Clear entity mentions
  db.prepare('DELETE FROM entity_mentions WHERE source_id = ? AND source_type = ?').run(id, type)

  // Clear FTS5 index
  db.prepare('DELETE FROM fts_content WHERE source_id = ? AND source_type = ?').run(id, type)
}

/**
 * Public trigger to clean indexing from main handlers.
 */
export async function removeIndex(id: string, type: string): Promise<void> {
  const db = getDatabase()
  db.transaction(() => {
    removeExistingIndex(db, id, type)
  })()
}

/**
 * Performs semantic vector search on the database.
 */
export async function semanticSearch(query: string, limit: number = 20): Promise<SearchResult[]> {
  const db = getDatabase()
  const queryVector = await generateEmbedding(query)
  const vectorBuffer = Buffer.from(queryVector.buffer)

  // Query KNN virtual table
  const matches = db
    .prepare(
      `
    SELECT rowid, distance
    FROM vec_embeddings
    WHERE embedding MATCH ? AND k = ?
  `
    )
    .all(vectorBuffer, limit) as Array<{ rowid: number; distance: number }>

  const results: SearchResult[] = []

  for (const match of matches) {
    const meta = db
      .prepare(
        `
      SELECT source_id, source_type, chunk_text FROM embeddings WHERE vec_rowid = ?
    `
      )
      .get(match.rowid) as
      { source_id: string; source_type: string; chunk_text: string } | undefined

    if (!meta) continue

    // Hydrate item details
    const details = hydrateItemMetadata(db, meta.source_id, meta.source_type)
    if (!details) continue

    results.push({
      id: meta.source_id,
      type: meta.source_type as any,
      title: details.title,
      snippet: meta.chunk_text,
      // Convert distance to similarity score (1 - cosine_distance)
      score: Math.max(0, 1 - match.distance),
      scoreType: 'semantic'
    })
  }

  return results
}

/**
 * Performs traditional keyword match using SQLite FTS5.
 */
export async function keywordSearch(query: string, limit: number = 20): Promise<SearchResult[]> {
  const db = getDatabase()
  const ftsMatches = db
    .prepare(
      `
    SELECT source_id, source_type, title, content, rank
    FROM fts_content
    WHERE fts_content MATCH ?
    ORDER BY rank
    LIMIT ?
  `
    )
    .all(query, limit) as Array<{
    source_id: string
    source_type: string
    title: string
    content: string
    rank: number
  }>

  return ftsMatches.map((match) => ({
    id: match.source_id,
    type: match.source_type as any,
    title: match.title,
    snippet: match.content.substring(0, 150),
    // Convert FTS5 BM25 rank score (lower is better, typically negative) to a 0-1 scale
    score: Math.max(0, Math.min(1, -match.rank / 10)),
    scoreType: 'keyword'
  }))
}

/**
 * Hybrid Search combining keyword ranking + semantic similarity scores.
 */
export async function hybridSearch(query: string, limit: number = 20): Promise<SearchResult[]> {
  const [semanticRes, keywordRes] = await Promise.all([
    semanticSearch(query, limit * 2),
    keywordSearch(query, limit * 2)
  ])

  const map = new Map<string, SearchResult>()

  // Add semantic matches
  semanticRes.forEach((res) => {
    map.set(`${res.type}:${res.id}`, { ...res, score: res.score * 0.7, scoreType: 'hybrid' })
  })

  // Blend keyword matches
  keywordRes.forEach((res) => {
    const key = `${res.type}:${res.id}`
    const existing = map.get(key)
    if (existing) {
      existing.score = existing.score + res.score * 0.3 // Weighted hybrid blend
    } else {
      map.set(key, { ...res, score: res.score * 0.3, scoreType: 'hybrid' })
    }
  })

  return Array.from(map.values())
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/**
 * Helper to retrieve basic info about a note, task, file, or inbox item.
 */
function hydrateItemMetadata(
  db: any,
  sourceId: string,
  sourceType: string
): { title: string } | null {
  try {
    if (sourceType === 'note') {
      const item = db.prepare('SELECT title FROM notes WHERE id = ?').get(sourceId)
      return item ? { title: item.title } : null
    } else if (sourceType === 'task') {
      const item = db.prepare('SELECT title FROM tasks WHERE id = ?').get(sourceId)
      return item ? { title: item.title } : null
    } else if (sourceType === 'file') {
      const item = db.prepare('SELECT name FROM files WHERE id = ?').get(sourceId)
      return item ? { title: item.name } : null
    } else if (sourceType === 'inbox_item') {
      const item = db.prepare('SELECT title FROM inbox_items WHERE id = ?').get(sourceId)
      return item ? { title: item.title } : null
    }
  } catch (err) {
    console.warn(`Failed to hydrate item ${sourceType} ${sourceId}:`, err)
  }
  return null
}

/**
 * Re-indexes all existing entities in the database.
 */
export async function reindexAll(
  onProgress?: (processed: number, total: number) => void
): Promise<void> {
  if (isIndexingAll) return
  isIndexingAll = true

  const db = getDatabase()

  // Fetch all notes, tasks, files, and inbox items
  const notes = db.prepare('SELECT id, title, raw_text FROM notes').all() as Array<{
    id: string
    title: string
    raw_text: string
  }>
  const tasks = db.prepare('SELECT id, title, description FROM tasks').all() as Array<{
    id: string
    title: string
    description: string
  }>
  const files = db.prepare('SELECT id, name, raw_text FROM files').all() as Array<{
    id: string
    name: string
    raw_text: string
  }>
  const inbox = db
    .prepare('SELECT id, title, content FROM inbox_items WHERE is_archived = 0')
    .all() as Array<{ id: string; title: string; content: string }>

  const total = notes.length + tasks.length + files.length + inbox.length
  totalToProcess = total
  processedCount = 0

  if (total === 0) {
    isIndexingAll = false
    return
  }

  const items: Array<{ id: string; type: any; title: string; content: string }> = [
    ...notes.map((n) => ({ id: n.id, type: 'note' as const, title: n.title, content: n.raw_text })),
    ...tasks.map((t) => ({
      id: t.id,
      type: 'task' as const,
      title: t.title,
      content: t.description
    })),
    ...files.map((f) => ({ id: f.id, type: 'file' as const, title: f.name, content: f.raw_text })),
    ...inbox.map((i) => ({
      id: i.id,
      type: 'inbox_item' as const,
      title: i.title,
      content: i.content
    }))
  ]

  for (const item of items) {
    try {
      await indexItem(item.id, item.type, item.title, item.content)
    } catch (e) {
      console.error(`Error background indexing ${item.type} ${item.id}:`, e)
    }
    processedCount++
    if (onProgress) {
      onProgress(processedCount, total)
    }
  }

  isIndexingAll = false
}

/**
 * Returns current status of background indexing.
 */
export function getIndexStatus(): IndexStatus {
  return {
    isIndexing: isIndexingAll,
    totalItems: totalToProcess,
    processedItems: processedCount,
    queueSize: isIndexingAll ? totalToProcess - processedCount : 0
  }
}
