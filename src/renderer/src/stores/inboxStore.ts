import { create } from 'zustand'

export interface InboxItem {
  id: string
  type: 'email' | 'note' | 'message' | 'file' | 'reminder' | 'ai'
  source: string | null
  title: string
  content: string | null
  priority: 'Red' | 'Orange' | 'Yellow' | 'Blue' | 'Gray'
  date_received: string
  is_read: number // 0 or 1
  is_archived: number // 0 or 1
  metadata: string
}

interface InboxState {
  items: InboxItem[]
  filter: 'all' | 'unread' | 'archived'
  priorityFilter: string | null // e.g. 'Red', 'Orange', etc.
  isLoading: boolean

  loadInbox: () => Promise<void>
  markAsRead: (id: string, isRead: boolean) => Promise<void>
  archiveItem: (id: string) => Promise<void>
  deleteItem: (id: string) => Promise<void>
  setFilter: (filter: 'all' | 'unread' | 'archived') => void
  setPriorityFilter: (priority: string | null) => void
}

export const useInboxStore = create<InboxState>((set, get) => ({
  items: [],
  filter: 'unread', // Default to unread items
  priorityFilter: null,
  isLoading: false,

  loadInbox: async () => {
    set({ isLoading: true })
    try {
      const activeFilter = get().filter
      const priority = get().priorityFilter

      let query = 'SELECT * FROM inbox_items'
      const params: any[] = []

      if (activeFilter === 'unread') {
        query += ' WHERE is_read = 0 AND is_archived = 0'
      } else if (activeFilter === 'archived') {
        query += ' WHERE is_archived = 1'
      } else {
        query += ' WHERE is_archived = 0'
      }

      if (priority) {
        query +=
          activeFilter === 'all' || activeFilter === 'archived' || activeFilter === 'unread'
            ? ' AND priority = ?'
            : ' WHERE priority = ?'
        params.push(priority)
      }

      query += ' ORDER BY date_received DESC'

      const list = await window.api.db.query<InboxItem>(query, params)
      set({ items: list, isLoading: false })
    } catch (error) {
      console.error('Failed to load inbox items:', error)
      set({ isLoading: false })
    }
  },

  markAsRead: async (id: string, isRead: boolean) => {
    const val = isRead ? 1 : 0
    await window.api.db.execute('UPDATE inbox_items SET is_read = ? WHERE id = ?', [val, id])
    set((state) => ({
      items: state.items.map((item) => (item.id === id ? { ...item, is_read: val } : item))
    }))
    // Re-load to update filter states if active filter is "unread"
    if (get().filter === 'unread' && isRead) {
      set((state) => ({
        items: state.items.filter((item) => item.id !== id)
      }))
    }
  },

  archiveItem: async (id: string) => {
    await window.api.db.execute('UPDATE inbox_items SET is_archived = 1 WHERE id = ?', [id])
    set((state) => ({
      items: state.items.filter((item) => item.id !== id)
    }))
  },

  deleteItem: async (id: string) => {
    await window.api.db.execute('DELETE FROM inbox_items WHERE id = ?', [id])
    set((state) => ({
      items: state.items.filter((item) => item.id !== id)
    }))
  },

  setFilter: (filter) => {
    set({ filter })
    get().loadInbox()
  },

  setPriorityFilter: (priorityFilter) => {
    set({ priorityFilter })
    get().loadInbox()
  }
}))
