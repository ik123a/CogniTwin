import { create } from 'zustand'

export interface LearningGoal {
  id: string
  title: string
  topic: string
  status: string
  created_at: string
  updated_at: string
}

export interface LearningPathStep {
  id: string
  goal_id: string
  title: string
  description: string | null
  estimated_duration: string | null
  order_index: number
  note_id: string | null
  status: string
  recommendations: string | null
  created_at: string
  updated_at: string
}

interface LearningState {
  goals: LearningGoal[]
  selectedGoal: LearningGoal | null
  steps: LearningPathStep[]
  isLoading: boolean

  loadGoals: () => Promise<void>
  selectGoal: (goal: LearningGoal | null) => Promise<void>
  createGoal: (title: string, topic: string) => Promise<void>
  completeStep: (stepId: string) => Promise<void>
  performGapAnalysis: (goalId: string) => Promise<void>
}

export const useLearningStore = create<LearningState>((set, get) => ({
  goals: [],
  selectedGoal: null,
  steps: [],
  isLoading: false,

  loadGoals: async () => {
    set({ isLoading: true })
    try {
      const goals = await window.api.learning.getGoals()
      set({ goals })

      // Update selectedGoal reference if it is still selected
      const currentSelected = get().selectedGoal
      if (currentSelected) {
        const updatedSelected = goals.find((g) => g.id === currentSelected.id)
        if (updatedSelected) {
          set({ selectedGoal: updatedSelected })
        }
      }
    } catch (error) {
      console.error('Failed to load learning goals:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  selectGoal: async (goal) => {
    set({ selectedGoal: goal })
    if (goal) {
      set({ isLoading: true })
      try {
        const steps = await window.api.learning.getSteps(goal.id)
        set({ steps })
      } catch (error) {
        console.error(`Failed to load steps for goal ${goal.id}:`, error)
      } finally {
        set({ isLoading: false })
      }
    } else {
      set({ steps: [] })
    }
  },

  createGoal: async (title, topic) => {
    set({ isLoading: true })
    try {
      const newGoal = await window.api.learning.createGoal(title, topic)
      await get().loadGoals()
      await get().selectGoal(newGoal)
    } catch (error) {
      console.error('Failed to create learning goal:', error)
      set({ isLoading: false })
    }
  },

  completeStep: async (stepId) => {
    set({ isLoading: true })
    try {
      await window.api.learning.completeStep(stepId)

      // Reload goals in case status updated to completed
      await get().loadGoals()

      const currentSelected = get().selectedGoal
      if (currentSelected) {
        const steps = await window.api.learning.getSteps(currentSelected.id)
        set({ steps })
      }
    } catch (error) {
      console.error('Failed to complete step:', error)
      set({ isLoading: false })
    }
  },

  performGapAnalysis: async (goalId) => {
    set({ isLoading: true })
    try {
      await window.api.learning.performGap(goalId)

      // Reload goals and steps
      await get().loadGoals()

      const currentSelected = get().selectedGoal
      if (currentSelected && currentSelected.id === goalId) {
        const steps = await window.api.learning.getSteps(goalId)
        set({ steps })
      }
    } catch (error) {
      console.error('Failed to perform gap analysis:', error)
      set({ isLoading: false })
    }
  }
}))
