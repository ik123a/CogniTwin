import { create } from 'zustand'

export interface PrivacyRule {
  id: string
  pattern: string
  replacement: string
  is_active: number
  created_at: string
}

interface PrivacyStore {
  privacyMode: boolean
  rules: PrivacyRule[]
  loading: boolean
  togglePrivacy: () => void
  fetchRules: () => Promise<void>
  addRule: (pattern: string, replacement?: string) => Promise<void>
  removeRule: (ruleId: string) => Promise<void>
}

export const usePrivacyStore = create<PrivacyStore>((set, get) => ({
  privacyMode: false,
  rules: [],
  loading: false,
  togglePrivacy: () => {
    const current = get().privacyMode
    set({ privacyMode: !current })
    // Write an audit log for security awareness
    window.api.audit.log(
      !current ? 'PRIVACY_MODE_ENABLED' : 'PRIVACY_MODE_DISABLED',
      'system',
      'privacy_mode'
    )
  },
  fetchRules: async () => {
    set({ loading: true })
    try {
      const rules = await window.api.privacy.getRules()
      set({ rules })
    } catch (error) {
      console.error('Failed to fetch privacy rules:', error)
    } finally {
      set({ loading: false })
    }
  },
  addRule: async (pattern, replacement = '███') => {
    try {
      await window.api.privacy.createRule(pattern, replacement)
      await get().fetchRules()
      window.api.audit.log('PRIVACY_RULE_ADDED', 'system', 'privacy_rules', {
        pattern,
        replacement
      })
    } catch (error) {
      console.error('Failed to add privacy rule:', error)
    }
  },
  removeRule: async (ruleId) => {
    try {
      await window.api.privacy.deleteRule(ruleId)
      await get().fetchRules()
      window.api.audit.log('PRIVACY_RULE_DELETED', 'system', 'privacy_rules', { ruleId })
    } catch (error) {
      console.error('Failed to remove privacy rule:', error)
    }
  }
}))
