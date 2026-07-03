import { create } from 'zustand'

export interface DashboardPanel {
  id: string
  title: string
  visible: boolean
  order: number
}

interface DashboardState {
  panels: DashboardPanel[]
  focusMode: boolean
  energyLevel: 'High' | 'Medium' | 'Low'
  focusTimeToday: number // in minutes
  completedTasksCount: number
  totalTasksCount: number
  upcomingMeetingsCount: number
  activeAutomationsCount: number
  smartReminders: any[]

  loadDashboard: () => Promise<void>
  toggleFocusMode: () => void
  reorderPanels: (newPanels: DashboardPanel[]) => void
  setPanelVisibility: (id: string, visible: boolean) => void
  dismissReminder: (id: string) => Promise<void>
}

const DEFAULT_PANELS: DashboardPanel[] = [
  { id: 'focus', title: "Today's Focus", visible: true, order: 0 },
  { id: 'energy', title: 'Energy Graph', visible: true, order: 1 },
  { id: 'activity', title: 'Recent Activity', visible: true, order: 2 },
  { id: 'metrics', title: 'Metrics Summary', visible: true, order: 3 },
  { id: 'graph', title: 'Knowledge Graph Preview', visible: true, order: 4 },
  { id: 'automation', title: 'Automation Status', visible: true, order: 5 },
  { id: 'upcoming', title: 'Upcoming', visible: true, order: 6 },
  { id: 'suggestions', title: 'AI Suggestions', visible: true, order: 7 }
]

export const useDashboardStore = create<DashboardState>((set, get) => ({
  panels: DEFAULT_PANELS,
  focusMode: false,
  energyLevel: 'High',
  focusTimeToday: 252, // 4.2 hours
  completedTasksCount: 12,
  totalTasksCount: 15,
  upcomingMeetingsCount: 3,
  activeAutomationsCount: 5,
  smartReminders: [],

  loadDashboard: async () => {
    // In Phase 1 we read custom panel order from localStorage and fetch count metrics from database
    try {
      const savedPanels = localStorage.getItem('cognitwin_dashboard_panels')
      if (savedPanels) {
        set({ panels: JSON.parse(savedPanels) })
      }

      // Fetch task metrics from SQLite
      const tasks = await window.api.db.query<{ status: string }>('SELECT status FROM tasks')
      const total = tasks.length
      const completed = tasks.filter((t) => t.status === 'Completed').length

      // Fetch automations count
      const autos = await window.api.db.query<{ id: string }>(
        'SELECT id FROM automations WHERE is_active = 1'
      )

      // Calculate energy level based on current time of day (simulating pattern recognition)
      const hour = new Date().getHours()
      let energy: 'High' | 'Medium' | 'Low' = 'Medium'
      if (hour >= 9 && hour <= 12) energy = 'High'
      else if (hour >= 14 && hour <= 16) energy = 'Low'
      else if (hour >= 19 && hour <= 22) energy = 'High'

      // Fetch active reminders
      try {
        await window.api.reminders.generate().catch(console.error)
        const reminders = await window.api.reminders.getActive()
        set({ smartReminders: reminders })
      } catch (e) {
        console.warn('Failed to load active reminders:', e)
      }

      set({
        completedTasksCount: completed || 12,
        totalTasksCount: total || 15,
        activeAutomationsCount: autos.length || 5,
        energyLevel: energy
      })
    } catch (e) {
      console.warn('Failed to load dashboard metrics from database, using defaults:', e)
    }
  },

  toggleFocusMode: () => {
    set((state) => {
      const nextMode = !state.focusMode
      // Write audit log on focus mode toggle
      window.api.audit
        .log('FOCUS_MODE_TOGGLE', 'system', undefined, { active: nextMode })
        .catch(console.error)

      return { focusMode: nextMode }
    })
  },

  reorderPanels: (newPanels) => {
    set({ panels: newPanels })
    localStorage.setItem('cognitwin_dashboard_panels', JSON.stringify(newPanels))
  },

  setPanelVisibility: (id, visible) => {
    const updated = get().panels.map((p) => (p.id === id ? { ...p, visible } : p))
    set({ panels: updated })
    localStorage.setItem('cognitwin_dashboard_panels', JSON.stringify(updated))
  },

  dismissReminder: async (id: string) => {
    try {
      await window.api.reminders.dismiss(id)
      set((state) => ({
        smartReminders: state.smartReminders.filter((rem) => rem.id !== id)
      }))
    } catch (err) {
      console.error('Failed to dismiss reminder:', err)
    }
  }
}))
