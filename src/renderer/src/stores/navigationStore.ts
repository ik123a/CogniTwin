import { create } from 'zustand'

export type ViewType =
  | 'login'
  | 'onboarding'
  | 'dashboard'
  | 'workspace'
  | 'inbox'
  | 'knowledge'
  | 'analytics'
  | 'settings'
  | 'search'
  | 'timeline'
  | 'learning'
  | 'expertise'
  | 'simulation'

interface NavigationState {
  currentView: ViewType
  setView: (view: ViewType) => void
}

export const useNavigationStore = create<NavigationState>((set) => ({
  currentView: 'login', // Initial view is login screen

  setView: (currentView) => {
    set({ currentView })
    // Write audit log on navigation
    window.api.audit
      .log('NAVIGATION', 'system', undefined, { view: currentView })
      .catch(console.error)
  }
}))
