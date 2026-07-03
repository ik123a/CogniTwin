import { create } from 'zustand'

export interface TaxonomyCategory {
  id: string
  name: string
  parent_id: string | null
  description: string | null
  created_at?: string
}

interface ClassificationState {
  categories: TaxonomyCategory[]
  isLoading: boolean

  initDatabase: () => Promise<void>
  loadCategories: () => Promise<void>
  createCategory: (
    name: string,
    parentId: string | null,
    description: string
  ) => Promise<TaxonomyCategory>
  deleteCategory: (id: string) => Promise<void>
  assignNoteToCategory: (noteId: string, categoryId: string) => Promise<void>
  getNoteCategory: (noteId: string) => Promise<TaxonomyCategory | null>
  getNotesInCategory: (categoryId: string) => Promise<string[]>
}

export const useClassificationStore = create<ClassificationState>((set, get) => ({
  categories: [],
  isLoading: false,

  initDatabase: async () => {
    try {
      // 1. Create table for taxonomy categories
      await window.api.db.execute(`
        CREATE TABLE IF NOT EXISTS taxonomy_categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          parent_id TEXT,
          description TEXT,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (parent_id) REFERENCES taxonomy_categories(id) ON DELETE CASCADE
        );
      `)

      // 2. Create join table for notes mapping to categories
      await window.api.db.execute(`
        CREATE TABLE IF NOT EXISTS note_categories (
          note_id TEXT NOT NULL,
          category_id TEXT NOT NULL,
          PRIMARY KEY (note_id, category_id),
          FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
          FOREIGN KEY (category_id) REFERENCES taxonomy_categories(id) ON DELETE CASCADE
        );
      `)

      // 3. Seed default taxonomy if empty
      const existing = await window.api.db.query<TaxonomyCategory>(
        'SELECT * FROM taxonomy_categories'
      )
      if (existing.length === 0) {
        const rootCategories = [
          {
            id: 'cs',
            name: 'Computer Science',
            parent_id: null,
            description: 'Algorithms, systems, software engineering, and hardware.'
          },
          {
            id: 'sci',
            name: 'Natural Sciences',
            parent_id: null,
            description: 'Physics, biology, chemistry, and environmental science.'
          },
          {
            id: 'biz',
            name: 'Business & Economics',
            parent_id: null,
            description: 'Finance, marketing, strategy, and commerce.'
          },
          {
            id: 'hum',
            name: 'Humanities',
            parent_id: null,
            description: 'Philosophy, history, literature, and art.'
          }
        ]

        for (const cat of rootCategories) {
          await window.api.db.execute(
            'INSERT INTO taxonomy_categories (id, name, parent_id, description) VALUES (?, ?, ?, ?)',
            [cat.id, cat.name, cat.parent_id, cat.description]
          )
        }

        const subCategories = [
          {
            id: 'ai',
            name: 'Artificial Intelligence',
            parent_id: 'cs',
            description: 'Machine learning, neural networks, NLP, and computer vision.'
          },
          {
            id: 'se',
            name: 'Software Engineering',
            parent_id: 'cs',
            description: 'Architecture, design patterns, coding best practices.'
          },
          {
            id: 'sys',
            name: 'System Architecture',
            parent_id: 'cs',
            description: 'Distributed systems, networking, databases, cloud engineering.'
          },
          {
            id: 'physics',
            name: 'Physics & Thermodynamics',
            parent_id: 'sci',
            description: 'Classical mechanics, quantum physics, heat transfer, and entropy.'
          },
          {
            id: 'finance',
            name: 'Finance & Markets',
            parent_id: 'biz',
            description: 'Stock markets, valuations, options, macroeconomics.'
          },
          {
            id: 'cogsci',
            name: 'Cognitive Science',
            parent_id: 'sci',
            description: 'Neuroscience, psychology, mental models, and learning theories.'
          }
        ]

        for (const sub of subCategories) {
          await window.api.db.execute(
            'INSERT INTO taxonomy_categories (id, name, parent_id, description) VALUES (?, ?, ?, ?)',
            [sub.id, sub.name, sub.parent_id, sub.description]
          )
        }
      }
    } catch (error) {
      console.error('Failed to initialize taxonomy database:', error)
    }
  },

  loadCategories: async () => {
    set({ isLoading: true })
    try {
      await get().initDatabase()
      const list = await window.api.db.query<TaxonomyCategory>(
        'SELECT * FROM taxonomy_categories ORDER BY parent_id NULLS FIRST, name ASC'
      )
      set({ categories: list })
    } catch (error) {
      console.error('Failed to load taxonomy categories:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  createCategory: async (name, parentId, description) => {
    await get().initDatabase()
    const id = crypto.randomUUID()
    await window.api.db.execute(
      'INSERT INTO taxonomy_categories (id, name, parent_id, description) VALUES (?, ?, ?, ?)',
      [id, name, parentId, description]
    )
    const newCat: TaxonomyCategory = {
      id,
      name,
      parent_id: parentId,
      description,
      created_at: new Date().toISOString()
    }
    set((state) => ({ categories: [...state.categories, newCat] }))
    return newCat
  },

  deleteCategory: async (id) => {
    await window.api.db.execute('DELETE FROM taxonomy_categories WHERE id = ?', [id])
    set((state) => ({ categories: state.categories.filter((c) => c.id !== id) }))
  },

  assignNoteToCategory: async (noteId, categoryId) => {
    await get().initDatabase()
    // Delete existing category assignment first
    await window.api.db.execute('DELETE FROM note_categories WHERE note_id = ?', [noteId])
    if (categoryId) {
      await window.api.db.execute(
        'INSERT INTO note_categories (note_id, category_id) VALUES (?, ?)',
        [noteId, categoryId]
      )
    }
  },

  getNoteCategory: async (noteId) => {
    await get().initDatabase()
    const result = await window.api.db.query<TaxonomyCategory>(
      `SELECT tc.* FROM taxonomy_categories tc 
       JOIN note_categories nc ON tc.id = nc.category_id 
       WHERE nc.note_id = ? LIMIT 1`,
      [noteId]
    )
    return result[0] || null
  },

  getNotesInCategory: async (categoryId) => {
    await get().initDatabase()
    const results = await window.api.db.query<{ note_id: string }>(
      'SELECT note_id FROM note_categories WHERE category_id = ?',
      [categoryId]
    )
    return results.map((r) => r.note_id)
  }
}))
