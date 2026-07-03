import { create } from 'zustand'

export interface SearchResult {
  id: string
  type: 'note' | 'task' | 'file' | 'inbox_item'
  title: string
  snippet: string
  score: number
  scoreType: 'semantic' | 'keyword' | 'hybrid'
}

interface SearchState {
  query: string
  results: SearchResult[]
  searchMode: 'semantic' | 'keyword' | 'hybrid'
  isSearching: boolean
  setQuery: (q: string) => void
  setSearchMode: (mode: 'semantic' | 'keyword' | 'hybrid') => void
  search: (queryOverride?: string) => Promise<void>
  clear: () => void
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: '',
  results: [],
  searchMode: 'hybrid',
  isSearching: false,

  setQuery: (query) => set({ query }),

  setSearchMode: (searchMode) => {
    set({ searchMode })
    // Trigger re-search with new mode if query exists
    const q = get().query
    if (q.trim()) {
      get().search()
    }
  },

  search: async (queryOverride) => {
    const q = queryOverride !== undefined ? queryOverride : get().query
    if (!q.trim()) {
      set({ results: [], isSearching: false })
      return
    }

    set({ isSearching: true })
    try {
      const mode = get().searchMode
      const response = await window.api.intelligence.search(q, {
        limit: 20,
        mode
      })
      set({ results: response, isSearching: false })
    } catch (error) {
      console.error('Semantic search query failed:', error)
      set({ isSearching: false, results: [] })
    }
  },

  clear: () => set({ query: '', results: [], isSearching: false })
}))
