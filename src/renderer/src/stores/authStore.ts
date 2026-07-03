import { create } from 'zustand'

interface User {
  id: string
  name: string
  created_at: string
}

interface AuthState {
  isAuthenticated: boolean
  currentUser: User | null
  hasUsers: boolean
  isLoading: boolean
  error: string | null
  checkHasUsers: () => Promise<boolean>
  login: (password: string) => Promise<boolean>
  register: (name: string, pass: string) => Promise<boolean>
  logout: () => void
  clearError: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  currentUser: null,
  hasUsers: false,
  isLoading: false,
  error: null,

  checkHasUsers: async () => {
    set({ isLoading: true, error: null })
    try {
      const result = await window.api.auth.hasUsers()
      set({ hasUsers: result, isLoading: false })
      return result
    } catch (err: any) {
      set({ error: err.message || 'Failed to check database users', isLoading: false })
      return false
    }
  },

  login: async (password: string) => {
    set({ isLoading: true, error: null })
    try {
      const user = await window.api.auth.login(password)
      set({ isAuthenticated: true, currentUser: user, isLoading: false })
      return true
    } catch (err: any) {
      set({ error: err.message || 'Invalid master password', isLoading: false })
      return false
    }
  },

  register: async (name: string, pass: string) => {
    set({ isLoading: true, error: null })
    try {
      const user = await window.api.auth.register(name, pass)
      set({ isAuthenticated: true, currentUser: user, hasUsers: true, isLoading: false })
      return true
    } catch (err: any) {
      set({ error: err.message || 'Registration failed', isLoading: false })
      return false
    }
  },

  logout: () => {
    set({ isAuthenticated: false, currentUser: null })
  },

  clearError: () => set({ error: null })
}))
