import { create } from 'zustand'

type ModalType =
  | 'quickCapture'
  | 'newProject'
  | 'taskCreation'
  | 'aiQuery'
  | 'export'
  | 'import'
  | 'ruleBuilder'
  | 'workflowEditor'
  | 'themeEditor'
  | 'pluginInstaller'
  | 'backupConfig'
  | 'keyboardShortcuts'
  | 'notificationCenter'
  | 'profileSettings'
  | 'systemStatus'
  | 'update'
  | 'conflictResolution'
  | 'confirmation'
  | 'loading'
  | 'spacedRepetition'

interface ConfirmationPayload {
  title: string
  message: string
  onConfirm: () => void | Promise<void>
  confirmText?: string
  cancelText?: string
}

interface ModalState {
  modals: Record<ModalType, boolean>
  activePayloads: Record<string, any>
  confirmationPayload: ConfirmationPayload | null

  openModal: (type: ModalType, payload?: any) => void
  closeModal: (type: ModalType) => void
  openConfirmation: (payload: ConfirmationPayload) => void
  closeConfirmation: () => void
}

const INITIAL_MODALS: Record<ModalType, boolean> = {
  quickCapture: false,
  newProject: false,
  taskCreation: false,
  aiQuery: false,
  export: false,
  import: false,
  ruleBuilder: false,
  workflowEditor: false,
  themeEditor: false,
  pluginInstaller: false,
  backupConfig: false,
  keyboardShortcuts: false,
  notificationCenter: false,
  profileSettings: false,
  systemStatus: false,
  update: false,
  conflictResolution: false,
  confirmation: false,
  loading: false,
  spacedRepetition: false
}

export const useModalStore = create<ModalState>((set) => ({
  modals: INITIAL_MODALS,
  activePayloads: {},
  confirmationPayload: null,

  openModal: (type, payload = null) => {
    set((state) => ({
      modals: { ...state.modals, [type]: true },
      activePayloads: { ...state.activePayloads, [type]: payload }
    }))
  },

  closeModal: (type) => {
    set((state) => ({
      modals: { ...state.modals, [type]: false },
      activePayloads: { ...state.activePayloads, [type]: null }
    }))
  },

  openConfirmation: (payload) => {
    set((state) => ({
      modals: { ...state.modals, confirmation: true },
      confirmationPayload: payload
    }))
  },

  closeConfirmation: () => {
    set((state) => ({
      modals: { ...state.modals, confirmation: false },
      confirmationPayload: null
    }))
  }
}))
