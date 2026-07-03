import { getDatabase } from '../database/connection'
import * as llmService from './llm.service'

export interface Category {
  id: string
  name: string
  description: string | null
  created_at: string
}

export interface ItemClassification {
  itemId: string
  itemType: string
  categoryId: string
  categoryName: string
  confidence: number
  createdAt: string
}

const DEFAULT_CATEGORIES = [
  {
    id: 'research',
    name: 'Research',
    description: 'Academic and scientific research notes and documents'
  },
  {
    id: 'engineering',
    name: 'Engineering',
    description: 'Technical design, coding, engineering specs, and architecture'
  },
  {
    id: 'finance',
    name: 'Finance',
    description: 'Financial statements, budgets, investment planning, and invoices'
  },
  {
    id: 'personal',
    name: 'Personal',
    description: 'Journal entries, habits, plans, and private documents'
  },
  {
    id: 'health',
    name: 'Health',
    description: 'Medical records, fitness, nutrition, and wellness'
  },
  {
    id: 'creative',
    name: 'Creative',
    description: 'Fiction, art projects, brainstorming, and design ideas'
  }
]

let isInitialized = false

export function ensureTaxonomyInitialized(): void {
  if (isInitialized) return
  const db = getDatabase()
  try {
    const countRow = db.prepare('SELECT COUNT(*) as count FROM taxonomy_categories').get() as
      { count: number } | undefined
    const count = countRow ? countRow.count : 0
    if (count === 0) {
      const stmt = db.prepare(`
        INSERT INTO taxonomy_categories (id, name, description)
        VALUES (?, ?, ?)
      `)
      db.transaction(() => {
        for (const cat of DEFAULT_CATEGORIES) {
          stmt.run(cat.id, cat.name, cat.description)
        }
      })()
      console.log('Taxonomy initialized with default categories.')
    }
    isInitialized = true
  } catch (err) {
    console.error('Failed to initialize taxonomy default categories:', err)
  }
}

/**
 * Classifies a document item (note, file) using local Qwen LLM.
 */
export async function classifyItem(
  itemId: string,
  itemType: string,
  content: string
): Promise<ItemClassification[]> {
  ensureTaxonomyInitialized()
  const db = getDatabase()

  const categories = await getCategories()
  const categoryNamesList = categories.map((c) => `"${c.name}"`).join(', ')

  const systemPrompt = `You are a taxonomy classification AI assistant.
Your task is to classify the provided document content into 1 to 3 matching categories from this exact list: [${categoryNamesList}].
You must output a JSON object containing a "categories" array of matching category names.
Do not output categories that are not in the list.
Example output format:
{
  "categories": ["Research", "Engineering"]
}
Do not return any explanation, markdown blocks, code blocks, or introduction. Return only the raw JSON.`

  const prompt = `Document Content:
${content.substring(0, 4000)}

Classify this content.`

  let matchedNames: string[] = []
  try {
    const response = await llmService.generateCompletion(prompt, systemPrompt)
    console.log(`LLM Classification Response for ${itemId}:`, response)

    try {
      let cleaned = response.trim()
      if (cleaned.startsWith('```')) {
        cleaned = cleaned
          .replace(/^```[a-zA-Z]*\n/, '')
          .replace(/\n```$/, '')
          .trim()
      }
      const parsed = JSON.parse(cleaned)
      if (parsed && Array.isArray(parsed.categories)) {
        matchedNames = parsed.categories
      }
    } catch (parseErr) {
      console.warn(
        'Failed to parse LLM JSON response. Falling back to simple keyword matching on response:',
        parseErr
      )
      // Fallback: search for category names directly in raw response string
      for (const cat of categories) {
        if (response.toLowerCase().includes(cat.name.toLowerCase())) {
          matchedNames.push(cat.name)
        }
      }
    }
  } catch (llmErr) {
    console.error('LLM classification call failed:', llmErr)
  }

  // Filter matchedNames to only valid categories
  const validMatchedNames = matchedNames.filter((name) =>
    categories.some((c) => c.name.toLowerCase() === name.toLowerCase())
  )

  // If no category matched, assign default 'Personal'
  if (validMatchedNames.length === 0) {
    validMatchedNames.push('Personal')
  }

  // Save to database
  const classifications: ItemClassification[] = []
  db.transaction(() => {
    // Clear old classifications
    db.prepare('DELETE FROM item_classifications WHERE item_id = ? AND item_type = ?').run(
      itemId,
      itemType
    )

    const insertStmt = db.prepare(`
      INSERT INTO item_classifications (item_id, item_type, category_id, confidence)
      VALUES (?, ?, ?, ?)
    `)

    for (const name of validMatchedNames) {
      const cat = categories.find((c) => c.name.toLowerCase() === name.toLowerCase())
      if (cat) {
        insertStmt.run(itemId, itemType, cat.id, 0.9)
        classifications.push({
          itemId,
          itemType,
          categoryId: cat.id,
          categoryName: cat.name,
          confidence: 0.9,
          createdAt: new Date().toISOString()
        })
      }
    }
  })()

  return classifications
}

/**
 * Gets classifications for a specific item.
 */
export async function getClassifications(
  itemId: string,
  itemType: string
): Promise<ItemClassification[]> {
  ensureTaxonomyInitialized()
  const db = getDatabase()
  const rows = db
    .prepare(
      `
    SELECT ic.item_id as itemId, ic.item_type as itemType, ic.category_id as categoryId, 
           tc.name as categoryName, ic.confidence, ic.created_at as createdAt
    FROM item_classifications ic
    JOIN taxonomy_categories tc ON ic.category_id = tc.id
    WHERE ic.item_id = ? AND ic.item_type = ?
  `
    )
    .all(itemId, itemType) as ItemClassification[]
  return rows
}

/**
 * Gets items classified under a category.
 */
export async function getItemsByCategory(
  categoryId: string
): Promise<Array<{ itemId: string; itemType: string }>> {
  ensureTaxonomyInitialized()
  const db = getDatabase()
  const rows = db
    .prepare(
      `
    SELECT item_id as itemId, item_type as itemType 
    FROM item_classifications 
    WHERE category_id = ?
  `
    )
    .all(categoryId) as Array<{ itemId: string; itemType: string }>
  return rows
}

/**
 * Gets all available categories.
 */
export async function getCategories(): Promise<Category[]> {
  ensureTaxonomyInitialized()
  const db = getDatabase()
  const rows = db
    .prepare('SELECT id, name, description, created_at FROM taxonomy_categories ORDER BY name ASC')
    .all() as Category[]
  return rows
}

/**
 * Creates a custom category.
 */
export async function createCategory(name: string, description: string | null): Promise<Category> {
  ensureTaxonomyInitialized()
  const db = getDatabase()
  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_')

  db.prepare(
    `
    INSERT INTO taxonomy_categories (id, name, description)
    VALUES (?, ?, ?)
  `
  ).run(id, name, description)

  return {
    id,
    name,
    description,
    created_at: new Date().toISOString()
  }
}
