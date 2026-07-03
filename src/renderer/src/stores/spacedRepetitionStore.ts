import { create } from 'zustand'

export interface Flashcard {
  id: string
  note_id: string | null
  front: string
  back: string
  ease_factor: number
  interval: number
  repetitions: number
  next_review: string
  created_at: string
}

interface SpacedRepetitionState {
  dueCards: Flashcard[]
  isLoading: boolean
  loadDueCards: () => Promise<void>
  submitReview: (cardId: string, grade: number) => Promise<void>
  createCard: (noteId: string | null, front: string, back: string) => Promise<void>
}

export const useSpacedRepetitionStore = create<SpacedRepetitionState>((set, get) => ({
  dueCards: [],
  isLoading: false,

  loadDueCards: async () => {
    set({ isLoading: true })
    try {
      const cards = await window.api.spaced.getDue()
      set({ dueCards: cards })
    } catch (error) {
      console.error('Failed to load due flashcards:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  submitReview: async (cardId, grade) => {
    set({ isLoading: true })
    try {
      await window.api.spaced.review(cardId, grade)
      // Reload due cards after review
      await get().loadDueCards()
    } catch (error) {
      console.error('Failed to submit flashcard review:', error)
      set({ isLoading: false })
    }
  },

  createCard: async (noteId, front, back) => {
    set({ isLoading: true })
    try {
      await window.api.spaced.create(noteId, front, back)
      await get().loadDueCards()
    } catch (error) {
      console.error('Failed to create flashcard:', error)
    } finally {
      set({ isLoading: false })
    }
  }
}))
