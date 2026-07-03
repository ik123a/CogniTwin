import { getDatabase } from '../database/connection'
import * as llmService from './llm.service'
import crypto from 'crypto'

interface DatabaseClusterItem {
  id: string
  type: string
  title: string
  distance: number
}

interface TopicCluster {
  id: string
  name: string
  description: string | null
  keywords: string | null
  created_at: string
  items: DatabaseClusterItem[]
}

/**
 * Converts a Node.js Buffer back to a Float32Array.
 */
function bufferToFloat32Array(buffer: Buffer): Float32Array {
  return new Float32Array(
    buffer.buffer,
    buffer.byteOffset,
    buffer.byteLength / Float32Array.BYTES_PER_ELEMENT
  )
}

/**
 * Helper to fetch the human-readable title/name of a workbench item.
 */
function getItemTitle(db: any, id: string, type: string): string {
  try {
    if (type === 'note') {
      const row = db.prepare('SELECT title FROM notes WHERE id = ?').get(id) as
        { title: string } | undefined
      return row ? row.title : 'Untitled Note'
    } else if (type === 'task') {
      const row = db.prepare('SELECT title FROM tasks WHERE id = ?').get(id) as
        { title: string } | undefined
      return row ? row.title : 'Untitled Task'
    } else if (type === 'file') {
      const row = db.prepare('SELECT name FROM files WHERE id = ?').get(id) as
        { name: string } | undefined
      return row ? row.name : 'Unnamed File'
    } else if (type === 'inbox_item') {
      const row = db.prepare('SELECT title FROM inbox_items WHERE id = ?').get(id) as
        { title: string } | undefined
      return row ? row.title : 'Untitled Inbox Item'
    }
  } catch (err) {
    console.warn(`Failed to fetch title for item ${type} ${id}:`, err)
  }
  return 'Unknown'
}

/**
 * Runs K-Means clustering on the averaged embeddings of items in the database.
 * Saves the resulting topic and item mappings to topic_clusters and item_clusters.
 */
export async function runClustering(customK?: number): Promise<void> {
  const db = getDatabase()

  // 1. Fetch all embeddings mapping and their vector row IDs
  const rows = db
    .prepare(
      `
    SELECT e.source_id, e.source_type, v.embedding 
    FROM embeddings e 
    JOIN vec_embeddings v ON e.vec_rowid = v.rowid
  `
    )
    .all() as Array<{ source_id: string; source_type: string; embedding: Buffer }>

  if (rows.length === 0) {
    console.log('No embeddings in the database to perform clustering.')
    return
  }

  // 2. Group chunk embeddings and compute average embedding per unique item
  const itemVectorsMap = new Map<
    string,
    { id: string; type: string; vectors: Float32Array[]; title: string }
  >()

  for (const row of rows) {
    const key = `${row.source_type}:${row.source_id}`
    const vec = bufferToFloat32Array(row.embedding)
    if (!itemVectorsMap.has(key)) {
      itemVectorsMap.set(key, {
        id: row.source_id,
        type: row.source_type,
        vectors: [],
        title: getItemTitle(db, row.source_id, row.source_type)
      })
    }
    itemVectorsMap.get(key)!.vectors.push(vec)
  }

  const items = Array.from(itemVectorsMap.values()).map((item) => {
    // Average vectors
    const avgVec = new Float32Array(384)
    for (const vec of item.vectors) {
      for (let i = 0; i < 384; i++) {
        avgVec[i] += vec[i]
      }
    }
    for (let i = 0; i < 384; i++) {
      avgVec[i] /= item.vectors.length
    }
    return {
      id: item.id,
      type: item.type,
      title: item.title,
      embedding: avgVec
    }
  })

  if (items.length < 2) {
    console.log('Fewer than 2 items with embeddings. Skipping clustering.')
    return
  }

  // 3. Determine number of clusters K
  const k = customK || Math.max(2, Math.min(8, Math.floor(Math.sqrt(items.length))))

  // 4. Initialize centroids randomly from items
  const centroids: Float32Array[] = []
  const selectedIndices = new Set<number>()
  while (centroids.length < k && selectedIndices.size < items.length) {
    const idx = Math.floor(Math.random() * items.length)
    if (!selectedIndices.has(idx)) {
      selectedIndices.add(idx)
      centroids.push(new Float32Array(items[idx].embedding))
    }
  }

  let assignments = new Array(items.length).fill(-1)
  let changed = true
  let iteration = 0
  const maxIterations = 30

  // 5. K-Means Optimization loop
  while (changed && iteration < maxIterations) {
    changed = false
    iteration++

    // Assignment Step
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      let minDistance = Infinity
      let closestCluster = -1

      for (let c = 0; c < centroids.length; c++) {
        let distSum = 0
        for (let d = 0; d < 384; d++) {
          const diff = item.embedding[d] - centroids[c][d]
          distSum += diff * diff
        }
        const dist = Math.sqrt(distSum)

        if (dist < minDistance) {
          minDistance = dist
          closestCluster = c
        }
      }

      if (assignments[i] !== closestCluster) {
        assignments[i] = closestCluster
        changed = true
      }
    }

    // Update Step
    const newCentroids = Array.from({ length: centroids.length }, () => new Float32Array(384))
    const counts = new Array(centroids.length).fill(0)

    for (let i = 0; i < items.length; i++) {
      const clusterIdx = assignments[i]
      if (clusterIdx !== -1) {
        counts[clusterIdx]++
        for (let d = 0; d < 384; d++) {
          newCentroids[clusterIdx][d] += items[i].embedding[d]
        }
      }
    }

    for (let c = 0; c < centroids.length; c++) {
      if (counts[c] > 0) {
        for (let d = 0; d < 384; d++) {
          newCentroids[c][d] /= counts[c]
        }
        centroids[c] = newCentroids[c]
      }
    }
  }

  // 6. Group items and compute distances to centroids
  const clusters = Array.from({ length: centroids.length }, (_, idx) => {
    const clusterItemsList: Array<{
      id: string
      type: string
      title: string
      distance: number
      embedding: Float32Array
    }> = []
    for (let i = 0; i < items.length; i++) {
      if (assignments[i] === idx) {
        let distSum = 0
        for (let d = 0; d < 384; d++) {
          const diff = items[i].embedding[d] - centroids[idx][d]
          distSum += diff * diff
        }
        const distance = Math.sqrt(distSum)
        clusterItemsList.push({
          id: items[i].id,
          type: items[i].type,
          title: items[i].title,
          distance,
          embedding: items[i].embedding
        })
      }
    }
    return {
      centroid: centroids[idx],
      items: clusterItemsList
    }
  }).filter((c) => c.items.length > 0)

  // 7. Store clusters in database with transaction safety
  db.transaction(() => {
    db.prepare('DELETE FROM item_clusters').run()
    db.prepare('DELETE FROM topic_clusters').run()
  })()

  for (let c = 0; c < clusters.length; c++) {
    const cluster = clusters[c]
    const clusterId = crypto.randomUUID()

    let clusterName = `Topic Cluster ${c + 1}`
    let clusterDesc = 'Semantic cluster of related documents and tasks'
    let keywords = ''

    const validTitles = cluster.items.map((i) => i.title).filter((t) => t && t.trim().length > 0)

    if (validTitles.length > 0) {
      try {
        const itemTitles = validTitles.map((t) => `- ${t}`).join('\n')
        const prompt = `Here is a list of item titles that are semantically related:\n${itemTitles}\n\nPlease generate:\n1. A clean, professional topic category name (2 to 4 words max)\n2. A one-sentence description summarizing their common theme\n3. 3 to 5 comma-separated keyword tags`
        const systemPrompt = `You are a document classifier. Return ONLY a valid JSON object matching this schema:
{
  "name": "Category Name",
  "description": "Short theme summary",
  "keywords": "word1, word2, word3"
}
Do not write any introductory or explanatory text, and do not use markdown code block formatting.`

        const rawJson = await llmService.generateCompletion(prompt, systemPrompt)
        let cleanJson = rawJson.trim()
        if (cleanJson.startsWith('```')) {
          cleanJson = cleanJson
            .replace(/^```(json)?/i, '')
            .replace(/```$/, '')
            .trim()
        }
        const meta = JSON.parse(cleanJson)
        if (meta.name) clusterName = meta.name.trim()
        if (meta.description) clusterDesc = meta.description.trim()
        if (meta.keywords) keywords = meta.keywords.trim()
      } catch (err) {
        console.warn(
          `Failed LLM summarization for cluster ${c + 1}, using fallback keyword parsing:`,
          err
        )
        // Fallback: extract most common words
        const stopWords = new Set([
          'and',
          'the',
          'for',
          'with',
          'a',
          'of',
          'in',
          'on',
          'at',
          'to',
          'is',
          'it',
          'or',
          'an'
        ])
        const wordFrequencies = new Map<string, number>()

        for (const title of validTitles) {
          const words = title
            .toLowerCase()
            .split(/[^a-zA-Z0-9]+/)
            .filter((w) => w.length > 2 && !stopWords.has(w))
          for (const w of words) {
            wordFrequencies.set(w, (wordFrequencies.get(w) || 0) + 1)
          }
        }

        const sorted = Array.from(wordFrequencies.entries()).sort((a, b) => b[1] - a[1])
        if (sorted.length > 0) {
          clusterName =
            sorted
              .slice(0, 2)
              .map((x) => x[0].charAt(0).toUpperCase() + x[0].slice(1))
              .join(' & ') + ' Cluster'
          keywords = sorted
            .slice(0, 5)
            .map((x) => x[0])
            .join(', ')
          clusterDesc = `Group containing keywords: ${keywords}`
        }
      }
    }

    db.transaction(() => {
      db.prepare(
        `
        INSERT INTO topic_clusters (id, name, description, keywords)
        VALUES (?, ?, ?, ?)
      `
      ).run(clusterId, clusterName, clusterDesc, keywords)

      for (const item of cluster.items) {
        db.prepare(
          `
          INSERT INTO item_clusters (cluster_id, item_id, item_type, distance)
          VALUES (?, ?, ?, ?)
        `
        ).run(clusterId, item.id, item.type, item.distance)
      }
    })()
  }
}

/**
 * Retrieves all calculated clusters from the database, populated with their assigned items.
 */
export function getClusters(): TopicCluster[] {
  const db = getDatabase()
  const topics = db.prepare('SELECT * FROM topic_clusters ORDER BY created_at DESC').all() as any[]

  const result: TopicCluster[] = []

  for (const topic of topics) {
    const items = db
      .prepare(
        `
      SELECT item_id, item_type, distance 
      FROM item_clusters 
      WHERE cluster_id = ?
      ORDER BY distance ASC
    `
      )
      .all(topic.id) as any[]

    // Hydrate each item with title
    const hydratedItems: DatabaseClusterItem[] = items.map((item) => {
      const title = getItemTitle(db, item.item_id, item.item_type)
      return {
        id: item.item_id,
        type: item.item_type,
        title,
        distance: item.distance
      }
    })

    result.push({
      id: topic.id,
      name: topic.name,
      description: topic.description,
      keywords: topic.keywords,
      created_at: topic.created_at,
      items: hydratedItems
    })
  }

  return result
}
