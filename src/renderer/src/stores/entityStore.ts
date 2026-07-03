import { create } from 'zustand'

export interface Entity {
  id: string
  name: string
  type: 'person' | 'organization' | 'place' | 'concept' | 'date'
  normalized_name: string
  mention_count: number
}

export interface Topic {
  id: string
  label: string
  keywords: string // JSON array string
  document_count: number
}

export interface IndexStatus {
  isIndexing: boolean
  totalItems: number
  processedItems: number
  queueSize: number
}

interface EntityState {
  entities: Entity[]
  topics: Topic[]
  indexStatus: IndexStatus
  isLoading: boolean

  loadEntities: () => Promise<void>
  loadTopics: () => Promise<void>
  fetchIndexStatus: () => Promise<void>
  setIndexProgress: (processed: number, total: number) => void
  reindexAll: () => Promise<void>
}

export const useEntityStore = create<EntityState>((set, get) => ({
  entities: [],
  topics: [],
  indexStatus: {
    isIndexing: false,
    totalItems: 0,
    processedItems: 0,
    queueSize: 0
  },
  isLoading: false,

  loadEntities: async () => {
    set({ isLoading: true })
    try {
      const list = await window.api.db.query<Entity>(
        'SELECT * FROM entities ORDER BY mention_count DESC LIMIT 100'
      )
      set({ entities: list, isLoading: false })
    } catch (e) {
      console.error('Failed to load entities:', e)
      set({ isLoading: false })
    }
  },

  loadTopics: async () => {
    try {
      const list = await window.api.db.query<Topic>('SELECT * FROM topics')
      set({ topics: list })
    } catch (e) {
      console.error('Failed to load topics:', e)
    }
  },

  fetchIndexStatus: async () => {
    try {
      const status = await window.api.intelligence.getIndexStatus()
      set({ indexStatus: status })
    } catch (e) {
      console.error('Failed to fetch indexing status:', e)
    }
  },

  setIndexProgress: (processed, total) => {
    set((state) => ({
      indexStatus: {
        isIndexing: true,
        totalItems: total,
        processedItems: processed,
        queueSize: Math.max(0, total - processed)
      }
    }))
  },

  reindexAll: async () => {
    set((state) => ({
      indexStatus: {
        ...state.indexStatus,
        isIndexing: true
      }
    }))
    try {
      await window.api.intelligence.reindexAll()
    } catch (e) {
      console.error('Failed to trigger re-index:', e)
      set((state) => ({
        indexStatus: {
          ...state.indexStatus,
          isIndexing: false
        }
      }))
    }
  }
}))
