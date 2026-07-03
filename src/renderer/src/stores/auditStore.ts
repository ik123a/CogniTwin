import { create } from 'zustand'

export interface AuditEntry {
  id: string
  user_id: string
  action: string
  entity_type: string | null
  entity_id: string | null
  details_json: string | null
  created_at: string
}

interface AuditStore {
  logs: AuditEntry[]
  loading: boolean
  fetchLogs: (filters?: {
    action?: string
    entityType?: string
    from?: string
    to?: string
    limit?: number
  }) => Promise<void>
  fetchEntityHistory: (entityType: string, entityId: string) => Promise<void>
}

export const useAuditStore = create<AuditStore>((set) => ({
  logs: [],
  loading: false,
  fetchLogs: async (filters) => {
    set({ loading: true })
    try {
      const logs = await window.api.audit.get(filters)
      set({ logs })
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
    } finally {
      set({ loading: false })
    }
  },
  fetchEntityHistory: async (entityType, entityId) => {
    set({ loading: true })
    try {
      const logs = await window.api.audit.entity(entityType, entityId)
      set({ logs })
    } catch (error) {
      console.error(`Failed to fetch history for ${entityType} ${entityId}:`, error)
    } finally {
      set({ loading: false })
    }
  }
}))
