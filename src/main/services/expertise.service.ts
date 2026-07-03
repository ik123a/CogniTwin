import { getDatabase } from '../database/connection'
import * as llmService from './llm.service'
import crypto from 'crypto'

export interface ExpertiseProfile {
  id: string
  domain: string
  score: number
  characterVolume: number
  lastUpdatedAt: string
}

export interface KnowledgeQuality {
  itemId: string
  itemType: string
  completenessScore: number
  structureScore: number
  depthScore: number
  overallScore: number
  details: string // JSON string
  lastEvaluatedAt: string
}

export interface CrossDomainLink {
  id: string
  sourceItemId: string
  sourceItemType: string
  sourceDomain: string
  targetItemId: string
  targetItemType: string
  targetDomain: string
  similarityScore: number
  analogyExplanation: string | null
  createdAt: string
}

/**
 * Scans notes in the workspace to evaluate domain expertise profiles.
 * Calculates score based on character volume and updated recency.
 */
export async function detectExpertise(): Promise<ExpertiseProfile[]> {
  const db = getDatabase()

  // Get all active categories
  const categories = db.prepare('SELECT id, name FROM taxonomy_categories').all() as Array<{
    id: string
    name: string
  }>

  const profiles: ExpertiseProfile[] = []

  for (const cat of categories) {
    // Fetch notes classified under this category
    const notes = db
      .prepare(
        `
      SELECT n.id, n.content, n.updated_at
      FROM notes n
      JOIN item_classifications ic ON n.id = ic.item_id AND ic.item_type = 'note'
      WHERE ic.category_id = ?
    `
      )
      .all(cat.id) as Array<{ id: string; content: string | null; updated_at: string }>

    let totalChars = 0
    let weightedVolume = 0

    for (const note of notes) {
      const content = note.content || ''
      const charLen = content.length
      totalChars += charLen

      // Recency factor calculation
      let daysElapsed = 30 // default fallback
      try {
        const updateTime = Date.parse(note.updated_at)
        if (!isNaN(updateTime)) {
          daysElapsed = (Date.now() - updateTime) / (1000 * 60 * 60 * 24)
        }
      } catch (e) {
        console.warn(`Failed to parse updated_at for note ${note.id}:`, e)
      }

      // Activity decay factor (1.0 for brand new notes, decaying to 0.2 for notes older than 90 days)
      const recencyScore = Math.max(0.2, 1 - daysElapsed / 90)
      weightedVolume += charLen * recencyScore
    }

    // Baseline: 15,000 active/weighted characters represents 100% (1.0) expertise in a category
    const score = Math.min(1.0, weightedVolume / 15000)
    const id = crypto.randomUUID()
    const nowStr = new Date().toISOString()

    db.prepare(
      `
      INSERT INTO expertise_profiles (id, domain, score, character_volume, last_updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(domain) DO UPDATE SET
        score = EXCLUDED.score,
        character_volume = EXCLUDED.character_volume,
        last_updated_at = EXCLUDED.last_updated_at
    `
    ).run(id, cat.name, score, totalChars, nowStr)

    profiles.push({
      id,
      domain: cat.name,
      score,
      characterVolume: totalChars,
      lastUpdatedAt: nowStr
    })
  }

  return profiles
}

/**
 * Fetches all expertise profiles.
 */
export async function getExpertiseProfiles(): Promise<ExpertiseProfile[]> {
  const db = getDatabase()
  const rows = db
    .prepare(
      `
    SELECT id, domain, score, character_volume as characterVolume, last_updated_at as lastUpdatedAt
    FROM expertise_profiles
    ORDER BY score DESC
  `
    )
    .all() as ExpertiseProfile[]
  return rows
}

/**
 * Scores note quality: completeness (length), structure (headings), and depth (links).
 */
export async function scoreNoteQuality(noteId: string): Promise<KnowledgeQuality> {
  const db = getDatabase()

  const note = db.prepare('SELECT title, content FROM notes WHERE id = ?').get(noteId) as
    { title: string; content: string | null } | undefined
  if (!note) {
    throw new Error(`Note not found: ${noteId}`)
  }

  const content = note.content || ''
  const charLen = content.length
  const wordCount = content.split(/\s+/).filter(Boolean).length

  // 1. Completeness: 1500 characters baseline
  const completenessScore = Math.min(1.0, charLen / 1500)

  // 2. Structure: Markdown headings (# structure)
  const headings = content.split(/\r?\n/).filter((line) => /^#+\s/.test(line.trim()))
  const headingCount = headings.length
  let structureScore = 0.2
  if (headingCount >= 4) structureScore = 1.0
  else if (headingCount >= 2) structureScore = 0.7
  else if (headingCount >= 1) structureScore = 0.5

  // 3. Depth: Wiki links [[Note]] and Markdown links [Title](URL)
  const wikiLinkMatches = content.match(/\[\[.*?\]\]/g) || []
  const mdLinkMatches = content.match(/\[.*?\]\(.*?\)/g) || []
  const linkCount = wikiLinkMatches.length + mdLinkMatches.length
  let depthScore = 0.1
  if (linkCount >= 4) depthScore = 1.0
  else if (linkCount >= 2) depthScore = 0.7
  else if (linkCount >= 1) depthScore = 0.4

  const overallScore = (completenessScore + structureScore + depthScore) / 3
  const detailsObj = {
    wordCount,
    characterCount: charLen,
    headingCount,
    linkCount
  }
  const details = JSON.stringify(detailsObj)
  const nowStr = new Date().toISOString()

  db.prepare(
    `
    INSERT INTO knowledge_quality (item_id, item_type, completeness_score, structure_score, depth_score, overall_score, details, last_evaluated_at)
    VALUES (?, 'note', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(item_id, item_type) DO UPDATE SET
      completeness_score = EXCLUDED.completeness_score,
      structure_score = EXCLUDED.structure_score,
      depth_score = EXCLUDED.depth_score,
      overall_score = EXCLUDED.overall_score,
      details = EXCLUDED.details,
      last_evaluated_at = EXCLUDED.last_evaluated_at
  `
  ).run(noteId, completenessScore, structureScore, depthScore, overallScore, details, nowStr)

  return {
    itemId: noteId,
    itemType: 'note',
    completenessScore,
    structureScore,
    depthScore,
    overallScore,
    details,
    lastEvaluatedAt: nowStr
  }
}

/**
 * Gets a note's quality score.
 */
export async function getNoteQuality(noteId: string): Promise<KnowledgeQuality | null> {
  const db = getDatabase()
  const row = db
    .prepare(
      `
    SELECT item_id as itemId, item_type as itemType, completeness_score as completenessScore, 
           structure_score as structureScore, depth_score as depthScore, overall_score as overallScore, 
           details, last_evaluated_at as lastEvaluatedAt
    FROM knowledge_quality
    WHERE item_id = ? AND item_type = 'note'
  `
    )
    .get(noteId) as KnowledgeQuality | undefined
  return row || null
}

/**
 * Scans embedding vectors for notes in different categories, calculates similarity,
 * and queries Qwen LLM to extract creative cross-domain analogies.
 */
export async function discoverCrossDomainLinks(): Promise<CrossDomainLink[]> {
  const db = getDatabase()

  // 1. Fetch notes that have categories and have chunk_index = 0 embedding
  const candidateNotes = db
    .prepare(
      `
    SELECT DISTINCT n.id, n.title, n.content, tc.name as categoryName, e.vec_rowid
    FROM notes n
    JOIN item_classifications ic ON n.id = ic.item_id AND ic.item_type = 'note'
    JOIN taxonomy_categories tc ON ic.category_id = tc.id
    JOIN embeddings e ON n.id = e.source_id AND e.source_type = 'note' AND e.chunk_index = 0
  `
    )
    .all() as Array<{
    id: string
    title: string
    content: string | null
    categoryName: string
    vec_rowid: number
  }>

  console.log(
    `Discovered ${candidateNotes.length} notes with embeddings for cross-domain link analysis`
  )

  const newlyDiscovered: CrossDomainLink[] = []
  let linksCount = 0

  for (const noteA of candidateNotes) {
    // Stop after finding 5 new links to avoid LLM timeouts/overload
    if (linksCount >= 5) break

    // Fetch Note A's embedding vector buffer
    const embeddingRow = db
      .prepare('SELECT embedding FROM vec_embeddings WHERE rowid = ?')
      .get(noteA.vec_rowid) as { embedding: Buffer } | undefined
    if (!embeddingRow) continue

    const vectorBuffer = embeddingRow.embedding

    // Run semantic similarity search using Match
    const matches = db
      .prepare(
        `
      SELECT rowid, distance
      FROM vec_embeddings
      WHERE embedding MATCH ? AND k = 10
    `
      )
      .all(vectorBuffer) as Array<{ rowid: number; distance: number }>

    for (const match of matches) {
      if (linksCount >= 5) break

      const score = Math.max(0, 1 - match.distance)
      // We look for moderately high to high similarity (>= 0.5)
      if (score < 0.5) continue

      // Fetch Note B details
      const noteB = db
        .prepare(
          `
        SELECT DISTINCT n.id, n.title, n.content, tc.name as categoryName
        FROM embeddings e
        JOIN notes n ON e.source_id = n.id AND e.source_type = 'note'
        JOIN item_classifications ic ON n.id = ic.item_id AND ic.item_type = 'note'
        JOIN taxonomy_categories tc ON ic.category_id = tc.id
        WHERE e.vec_rowid = ?
      `
        )
        .get(match.rowid) as
        { id: string; title: string; content: string | null; categoryName: string } | undefined

      if (!noteB) continue

      // Skip self match
      if (noteA.id === noteB.id) continue

      // Skip same domain/category (we want cross-domain!)
      if (noteA.categoryName === noteB.categoryName) continue

      // Check if they are already linked in the DB (any direction)
      const existing = db
        .prepare(
          `
        SELECT id FROM cross_domain_links
        WHERE (source_item_id = ? AND target_item_id = ?)
           OR (source_item_id = ? AND target_item_id = ?)
      `
        )
        .get(noteA.id, noteB.id, noteB.id, noteA.id)

      if (existing) continue

      // We found a new cross-domain link! Request Qwen LLM for cross-domain analogy explanation
      console.log(
        `Analyzing cross-domain link between [${noteA.categoryName}] ${noteA.title} and [${noteB.categoryName}] ${noteB.title}`
      )

      const systemPrompt = `You are a creative thinking AI. 
Your task is to analyze two texts from different domains and write a short, insightful analogy or explanation of the shared core principle or concept linking them.
Keep the output extremely brief (1-3 sentences). Do not use introduction or formatting.`

      const prompt = `Document A (Domain: ${noteA.categoryName}, Title: ${noteA.title}):
${(noteA.content || '').substring(0, 800)}

Document B (Domain: ${noteB.categoryName}, Title: ${noteB.title}):
${(noteB.content || '').substring(0, 800)}

Explain the underlying conceptual link:`

      let analogy = ''
      try {
        analogy = await llmService.generateCompletion(prompt, systemPrompt)
      } catch (err) {
        console.error('Failed to generate cross-domain analogy:', err)
        analogy = 'Discovered high semantic relationship between different domains.'
      }

      const linkId = crypto.randomUUID()
      const nowStr = new Date().toISOString()

      db.prepare(
        `
        INSERT INTO cross_domain_links (id, source_item_id, source_item_type, source_domain, target_item_id, target_item_type, target_domain, similarity_score, analogy_explanation, created_at)
        VALUES (?, ?, 'note', ?, ?, 'note', ?, ?, ?, ?)
      `
      ).run(
        linkId,
        noteA.id,
        noteA.categoryName,
        noteB.id,
        noteB.categoryName,
        score,
        analogy,
        nowStr
      )

      newlyDiscovered.push({
        id: linkId,
        sourceItemId: noteA.id,
        sourceItemType: 'note',
        sourceDomain: noteA.categoryName,
        targetItemId: noteB.id,
        targetItemType: 'note',
        targetDomain: noteB.categoryName,
        similarityScore: score,
        analogyExplanation: analogy,
        createdAt: nowStr
      })

      linksCount++
    }
  }

  return newlyDiscovered
}

/**
 * Gets all cross-domain links.
 */
export async function getCrossDomainLinks(): Promise<CrossDomainLink[]> {
  const db = getDatabase()
  const rows = db
    .prepare(
      `
    SELECT id, source_item_id as sourceItemId, source_item_type as sourceItemType, 
           source_domain as sourceDomain, target_item_id as targetItemId, 
           target_item_type as targetItemType, target_domain as targetDomain, 
           similarity_score as similarityScore, analogy_explanation as analogyExplanation, 
           created_at as createdAt
    FROM cross_domain_links
    ORDER BY similarity_score DESC
  `
    )
    .all() as CrossDomainLink[]
  return rows
}
