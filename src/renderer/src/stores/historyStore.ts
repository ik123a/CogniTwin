import { create } from 'zustand'

export interface HistoryAction {
  type: string
  undo: () => void | Promise<void>
  redo: () => void | Promise<void>
  description?: string
}

interface HistoryState {
  past: HistoryAction[]
  future: HistoryAction[]
  pushAction: (action: HistoryAction) => void
  undo: () => Promise<void>
  redo: () => Promise<void>
  canUndo: () => boolean
  canRedo: () => boolean
  clear: () => void
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  past: [],
  future: [],
  pushAction: (action) => {
    set((state) => ({
      past: [...state.past, action],
      future: [] // Clear redo stack on new action
    }))
  },
  undo: async () => {
    const { past, future } = get()
    if (past.length === 0) return
    const action = past[past.length - 1]
    try {
      await action.undo()
      set({
        past: past.slice(0, -1),
        future: [action, ...future]
      })
    } catch (err) {
      console.error('Failed to undo action:', err)
    }
  },
  redo: async () => {
    const { past, future } = get()
    if (future.length === 0) return
    const action = future[0]
    try {
      await action.redo()
      set({
        past: [...past, action],
        future: future.slice(1)
      })
    } catch (err) {
      console.error('Failed to redo action:', err)
    }
  },
  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
  clear: () => set({ past: [], future: [] })
}))
