import { create } from 'zustand'

interface SystemStatus {
  cpu: { model: string; cores: number; load: number }
  memory: { total: number; used: number; free: number; percentage: number }
  system: { platform: string; arch: string; uptime: number }
}

interface AppSettings {
  general: {
    appName: string
    theme: string
    language: string
    telemetry: boolean
  }
  security: {
    dataRetentionDays: number
    encryptionLevel: string
    privacyMode: boolean
  }
  ai: {
    activeModel: string
    temperature: number
    gpuAcceleration: boolean
    maxContextTokens: number
  }
  automation: {
    autoSchedule: boolean
    autoOrganize: boolean
    autoRespond: boolean
  }
}

interface SettingsState {
  settings: AppSettings
  systemMetrics: SystemStatus | null
  isLoading: boolean
  isBackingUp: boolean

  loadSettings: () => Promise<void>
  updateSettings: <K extends keyof AppSettings>(
    category: K,
    updates: Partial<AppSettings[K]>
  ) => Promise<void>
  fetchSystemMetrics: () => Promise<void>
  createBackup: (dirPath: string) => Promise<string>
  restoreBackup: (filePath: string) => Promise<void>
}

const DEFAULT_SETTINGS: AppSettings = {
  general: {
    appName: 'CogniTwin',
    theme: 'dark',
    language: 'English',
    telemetry: false
  },
  security: {
    dataRetentionDays: 0, // forever
    encryptionLevel: 'AES-256-GCM',
    privacyMode: false
  },
  ai: {
    activeModel: 'Llama-3-8B-Instruct-GGUF',
    temperature: 0.7,
    gpuAcceleration: true,
    maxContextTokens: 4096
  },
  automation: {
    autoSchedule: true,
    autoOrganize: false,
    autoRespond: false
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  systemMetrics: null,
  isLoading: false,
  isBackingUp: false,

  loadSettings: async () => {
    set({ isLoading: true })
    try {
      const rows = await window.api.db.query<{ key: string; value: string }>(
        'SELECT * FROM settings'
      )
      if (rows.length > 0) {
        const loaded: Partial<AppSettings> = {}
        for (const row of rows) {
          try {
            loaded[row.key] = JSON.parse(row.value)
          } catch (e) {
            console.error(`Failed to parse settings key: ${row.key}`, e)
          }
        }
        set((state) => ({
          settings: { ...state.settings, ...loaded },
          isLoading: false
        }))
      } else {
        // Save default settings to DB if empty
        const db = window.api.db
        await db.transaction([
          {
            type: 'execute',
            sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            params: ['general', JSON.stringify(DEFAULT_SETTINGS.general)]
          },
          {
            type: 'execute',
            sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            params: ['security', JSON.stringify(DEFAULT_SETTINGS.security)]
          },
          {
            type: 'execute',
            sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            params: ['ai', JSON.stringify(DEFAULT_SETTINGS.ai)]
          },
          {
            type: 'execute',
            sql: 'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
            params: ['automation', JSON.stringify(DEFAULT_SETTINGS.automation)]
          }
        ])
        set({ isLoading: false })
      }
    } catch (error) {
      console.warn('Settings table not accessible, using default configurations:', error)
      set({ isLoading: false })
    }
  },

  updateSettings: async (category, updates) => {
    const nextCategorySettings = { ...get().settings[category], ...updates }
    const nextSettings = { ...get().settings, [category]: nextCategorySettings }

    set({ settings: nextSettings })

    try {
      await window.api.db.execute('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [
        category,
        JSON.stringify(nextCategorySettings)
      ])
    } catch (e) {
      console.error(`Failed to save settings category: ${category}`, e)
    }
  },

  fetchSystemMetrics: async () => {
    try {
      const stats = await window.api.system.status()
      set({ systemMetrics: stats })
    } catch (error) {
      console.error('Failed to query system status:', error)
    }
  },

  createBackup: async (dirPath: string) => {
    set({ isBackingUp: true })
    try {
      const result = await window.api.backup.create(dirPath)
      set({ isBackingUp: false })
      return result
    } catch (error) {
      set({ isBackingUp: false })
      throw error
    }
  },

  restoreBackup: async (filePath: string) => {
    set({ isLoading: true })
    try {
      await window.api.backup.restore(filePath)
      set({ isLoading: false })
    } catch (error) {
      set({ isLoading: false })
      throw error
    }
  }
}))
