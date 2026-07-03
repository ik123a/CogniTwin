import { create } from 'zustand'
import { useNavigationStore } from './navigationStore'
import { useModalStore } from './modalStore'

export interface CommandPaletteItem {
  id: string
  type: 'navigation' | 'action' | 'search_result'
  title: string
  subtitle?: string
  category: 'Navigation' | 'Actions' | 'Search Results'
  action: () => void | Promise<void>
  iconType?: string
  score?: number
}

interface CommandPaletteState {
  isOpen: boolean
  searchTerm: string
  selectedIndex: number
  results: CommandPaletteItem[]

  open: () => void
  close: () => void
  toggle: () => void
  setSearchTerm: (term: string) => Promise<void>
  navigateResults: (direction: 'up' | 'down') => void
  executeSelected: () => void
}

// Helper fuzzy match function
function fuzzyMatch(text: string, query: string): boolean {
  if (!query) return true
  const target = text.toLowerCase()
  const search = query.toLowerCase()

  if (target.includes(search)) return true

  let searchIdx = 0
  for (let i = 0; i < target.length; i++) {
    if (target[i] === search[searchIdx]) {
      searchIdx++
      if (searchIdx === search.length) {
        return true
      }
    }
  }
  return false
}

export const useCommandPaletteStore = create<CommandPaletteState>((set, get) => {
  const getStaticItems = (): CommandPaletteItem[] => [
    // Navigation items
    {
      id: 'nav_dashboard',
      type: 'navigation',
      title: 'Go to Dashboard',
      subtitle: 'View overall summary, metrics, and active reminders',
      category: 'Navigation',
      iconType: 'dashboard',
      action: () => useNavigationStore.getState().setView('dashboard')
    },
    {
      id: 'nav_workspace',
      type: 'navigation',
      title: 'Go to Workspace',
      subtitle: 'Manage projects, notes, and tasks',
      category: 'Navigation',
      iconType: 'workspace',
      action: () => useNavigationStore.getState().setView('workspace')
    },
    {
      id: 'nav_inbox',
      type: 'navigation',
      title: 'Go to Inbox',
      subtitle: 'View smart notifications, emails, and alerts',
      category: 'Navigation',
      iconType: 'inbox',
      action: () => useNavigationStore.getState().setView('inbox')
    },
    {
      id: 'nav_knowledge',
      type: 'navigation',
      title: 'Go to Knowledge Graph',
      subtitle: 'Explore semantic connections and entity mappings',
      category: 'Navigation',
      iconType: 'knowledge',
      action: () => useNavigationStore.getState().setView('knowledge')
    },
    {
      id: 'nav_analytics',
      type: 'navigation',
      title: 'Go to Analytics',
      subtitle: 'Review productivity heatmap and cognitive loading stats',
      category: 'Navigation',
      iconType: 'analytics',
      action: () => useNavigationStore.getState().setView('analytics')
    },
    {
      id: 'nav_settings',
      type: 'navigation',
      title: 'Go to Settings',
      subtitle: 'Configure local backup, watchers, and integration accounts',
      category: 'Navigation',
      iconType: 'settings',
      action: () => useNavigationStore.getState().setView('settings')
    },

    // Actions items
    {
      id: 'act_create_note',
      type: 'action',
      title: 'Create Note',
      subtitle: 'Jot down a quick note in current workspace project',
      category: 'Actions',
      iconType: 'action',
      action: () => useModalStore.getState().openModal('quickCapture')
    },
    {
      id: 'act_create_task',
      type: 'action',
      title: 'Create Task',
      subtitle: 'Add a new action item to your tracker',
      category: 'Actions',
      iconType: 'action',
      action: () => useModalStore.getState().openModal('taskCreation')
    },
    {
      id: 'act_run_sync',
      type: 'action',
      title: 'Run Sync',
      subtitle: 'Trigger manual synchronization across integrated accounts',
      category: 'Actions',
      iconType: 'action',
      action: async () => {
        try {
          const res = await window.api.integrations.syncAll()
          alert(
            `Sync complete! Ingested ${res.counts.emails} emails, ${res.counts.events} events, and ${res.counts.history} browser history items.`
          )
        } catch (e) {
          console.error('Failed to run sync:', e)
          alert('Synchronization failed. Check developer console.')
        }
      }
    },
    {
      id: 'act_sync_accounts',
      type: 'action',
      title: 'Sync Accounts',
      subtitle: 'Manage connected email, calendar, and browser integrations',
      category: 'Actions',
      iconType: 'action',
      action: () => useNavigationStore.getState().setView('settings')
    }
  ]

  return {
    isOpen: false,
    searchTerm: '',
    selectedIndex: 0,
    results: getStaticItems(),

    open: () => set({ isOpen: true, searchTerm: '', selectedIndex: 0, results: getStaticItems() }),
    close: () => set({ isOpen: false, searchTerm: '', selectedIndex: 0 }),
    toggle: () => {
      const isCurrentlyOpen = get().isOpen
      if (isCurrentlyOpen) {
        get().close()
      } else {
        get().open()
      }
    },

    setSearchTerm: async (term: string) => {
      set({ searchTerm: term })
      const staticItems = getStaticItems()

      // Fuzzy filter static navigation/actions
      const filteredStatic = staticItems.filter(
        (item) => fuzzyMatch(item.title, term) || fuzzyMatch(item.subtitle || '', term)
      )

      if (!term.trim()) {
        set({ results: filteredStatic, selectedIndex: 0 })
        return
      }

      // Retrieve search results from the intelligence service
      try {
        const searchResults = await window.api.intelligence.search(term, { limit: 5 })
        const mappedSearchResults: CommandPaletteItem[] = searchResults.map((res) => ({
          id: `search_${res.type}_${res.id}`,
          type: 'search_result',
          title: res.title,
          subtitle: `Type: ${res.type.replace('_', ' ')} • ${res.snippet}`,
          category: 'Search Results',
          iconType: res.type,
          score: res.score,
          action: () => {
            if (res.type === 'note' || res.type === 'task' || res.type === 'file') {
              useNavigationStore.getState().setView('workspace')
            } else if (res.type === 'inbox_item') {
              useNavigationStore.getState().setView('inbox')
            }
          }
        }))

        set({
          results: [...filteredStatic, ...mappedSearchResults],
          selectedIndex: 0
        })
      } catch (e) {
        console.warn('CommandPalette intelligence search failed, showing local shortcuts only:', e)
        set({ results: filteredStatic, selectedIndex: 0 })
      }
    },

    navigateResults: (direction: 'up' | 'down') => {
      const { selectedIndex, results } = get()
      if (results.length === 0) return

      let nextIndex = selectedIndex
      if (direction === 'up') {
        nextIndex = selectedIndex - 1 < 0 ? results.length - 1 : selectedIndex - 1
      } else {
        nextIndex = selectedIndex + 1 >= results.length ? 0 : selectedIndex + 1
      }

      set({ selectedIndex: nextIndex })
    },

    executeSelected: () => {
      const { selectedIndex, results } = get()
      const item = results[selectedIndex]
      if (item) {
        item.action()
        get().close()
      }
    }
  }
})
