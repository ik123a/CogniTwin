import { getDatabase } from '../database/connection'
import * as llmService from './llm.service'
import crypto from 'crypto'

/**
 * Retrieves the text content of a specified item from the database.
 */
function getItemContent(
  db: any,
  itemId: string,
  itemType: string
): { title: string; content: string } | null {
  if (itemType === 'note') {
    const row = db.prepare('SELECT title, content FROM notes WHERE id = ?').get(itemId)
    return row ? { title: row.title, content: row.content || '' } : null
  } else if (itemType === 'task') {
    const row = db.prepare('SELECT title, description FROM tasks WHERE id = ?').get(itemId)
    return row ? { title: row.title, content: row.description || '' } : null
  } else if (itemType === 'file') {
    const row = db.prepare('SELECT name, raw_text FROM files WHERE id = ?').get(itemId)
    return row ? { title: row.name, content: row.raw_text || '' } : null
  } else if (itemType === 'inbox_item') {
    const row = db.prepare('SELECT title, content FROM inbox_items WHERE id = ?').get(itemId)
    return row ? { title: row.title, content: row.content || '' } : null
  }
  return null
}

/**
 * Strips markdown wrapping from a JSON string if present.
 */
function cleanJsonResponse(raw: string): string {
  let clean = raw.trim()
  if (clean.startsWith('```')) {
    clean = clean
      .replace(/^```(json)?/i, '')
      .replace(/```$/, '')
      .trim()
  }
  return clean
}

/**
 * Automatically classifies note/item content using local LLM to generate tags,
 * inserts those tags if they do not exist, and maps them in the item_tags table.
 */
export async function autoClassifyAndTag(itemId: string, itemType: string): Promise<string[]> {
  const db = getDatabase()
  const contentData = getItemContent(db, itemId, itemType)

  if (!contentData) {
    throw new Error(`Item not found for auto-classification: ${itemType} ${itemId}`)
  }

  const prompt = `Please analyze the following content:\nTitle: "${contentData.title}"\nContent:\n"""\n${contentData.content}\n"""`
  const systemPrompt = `You are a taxonomy and classification assistant. Your task is to analyze the content and generate 2 to 5 relevant, specific tags or topics.
Each tag must be a single word or short phrase (e.g., "React", "Meeting", "Project Alpha", "Finance", "Invoice").
Return ONLY a comma-separated list of the tag names. Do not include markdown formatting, introductions, explanations, or numbers.`

  const rawTags = await llmService.generateCompletion(prompt, systemPrompt)
  const tagList = rawTags
    .split(',')
    .map((t) => t.replace(/^[#\-\*\s]+/, '').trim())
    .filter((t) => t.length > 0 && t.length < 50) // Sanity limits

  if (tagList.length === 0) {
    return []
  }

  db.transaction(() => {
    // 1. Clear existing tag associations for this item
    db.prepare('DELETE FROM item_tags WHERE item_id = ? AND item_type = ?').run(itemId, itemType)

    // 2. Map tags
    for (const tagName of tagList) {
      // Find or create the tag
      let tagRow = db.prepare('SELECT id FROM tags WHERE name = ?').get(tagName) as
        { id: string } | undefined
      let tagId: string

      if (tagRow) {
        tagId = tagRow.id
      } else {
        tagId = crypto.randomUUID()
        const colors = ['#3498db', '#2ecc71', '#9b59b6', '#e67e22', '#e74c3c', '#1abc9c', '#f1c40f']
        const color = colors[Math.floor(Math.random() * colors.length)]
        db.prepare('INSERT INTO tags (id, name, color) VALUES (?, ?, ?)').run(tagId, tagName, color)
      }

      // Associate the tag with the item
      db.prepare(
        'INSERT OR IGNORE INTO item_tags (tag_id, item_id, item_type) VALUES (?, ?, ?)'
      ).run(tagId, itemId, itemType)
    }
  })()

  return tagList
}

/**
 * Parses content text using a prompt to extract actionable tasks and auto-inserts them as new tasks into the database.
 */
export async function extractTasksFromContent(
  sourceId: string,
  sourceType: string,
  text: string
): Promise<any[]> {
  const db = getDatabase()

  // Find a related project ID if applicable
  let projectId: string | null = null
  if (sourceType === 'note') {
    const note = db.prepare('SELECT project_id FROM notes WHERE id = ?').get(sourceId) as
      { project_id: string | null } | undefined
    if (note) projectId = note.project_id
  } else if (sourceType === 'file') {
    const file = db.prepare('SELECT project_id FROM files WHERE id = ?').get(sourceId) as
      { project_id: string | null } | undefined
    if (file) projectId = file.project_id
  } else if (sourceType === 'task') {
    const task = db.prepare('SELECT project_id FROM tasks WHERE id = ?').get(sourceId) as
      { project_id: string | null } | undefined
    if (task) projectId = task.project_id
  }

  const prompt = `Text to analyze:\n"""\n${text}\n"""`
  const systemPrompt = `You are a task extraction assistant. Read the text provided and extract all actionable tasks/todos.
For each task, determine:
1. title (concise action statement, e.g., 'Submit quarterly report')
2. description (additional details or context if any, e.g. from the text)
3. priority (must be one of: 'High', 'Medium', 'Low')
4. dueDate (if a date is mentioned, in YYYY-MM-DD format; otherwise null)

Return ONLY a valid JSON array of objects with the keys: "title", "description", "priority", and "dueDate".
Do not output any introductory or explanatory text. Do not use markdown wrappers. If no tasks are found, return [].`

  const rawResult = await llmService.generateCompletion(prompt, systemPrompt)
  const cleanResult = cleanJsonResponse(rawResult)

  let tasks: Array<{
    title: string
    description?: string
    priority?: string
    dueDate?: string | null
  }> = []
  try {
    tasks = JSON.parse(cleanResult)
    if (!Array.isArray(tasks)) {
      tasks = []
    }
  } catch (err) {
    console.error('Failed to parse JSON tasks from LLM response:', rawResult, err)
  }

  const insertedTasks: any[] = []
  db.transaction(() => {
    for (const task of tasks) {
      if (!task.title) continue

      const id = crypto.randomUUID()
      const title = task.title.trim()
      const description = task.description ? task.description.trim() : null
      const priority = ['High', 'Medium', 'Low'].includes(task.priority || '')
        ? task.priority
        : 'Medium'
      const status = 'Todo'
      const dueDate = task.dueDate || null

      db.prepare(
        `
        INSERT INTO tasks (id, project_id, title, description, due_date, priority, status)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      ).run(id, projectId, title, description, dueDate, priority, status)

      // Create a relationship between the source item and the new task
      const relId = crypto.randomUUID()
      db.prepare(
        `
        INSERT INTO relationships (id, source_id, source_type, target_id, target_type, type, weight)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `
      ).run(relId, sourceId, sourceType, id, 'task', 'extracted_task', 1.0)

      insertedTasks.push({
        id,
        projectId,
        title,
        description,
        dueDate,
        priority,
        status
      })
    }
  })()

  return insertedTasks
}
