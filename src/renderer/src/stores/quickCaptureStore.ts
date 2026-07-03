import { create } from 'zustand'

interface QuickCaptureState {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
}

export const useQuickCaptureStore = create<QuickCaptureState>((set, get) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  toggle: () => set({ isOpen: !get().isOpen })
}))
