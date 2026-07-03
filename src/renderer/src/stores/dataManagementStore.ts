import { create } from 'zustand'

export interface DuplicateGroup {
  id: string
  entityType: string
  similarityScore: number
  members: Array<{
    id: string
    title: string
    details: string
    isPrimary: number
  }>
}

export interface IntegrityReport {
  total: number
  valid: number
  mismatches: any[]
}

interface DataManagementStore {
  exportInProgress: boolean
  importInProgress: boolean
  scanInProgress: boolean
  integrityLoading: boolean
  duplicateGroups: DuplicateGroup[]
  integrityReport: IntegrityReport | null
  transferHistory: any[]
  backupHistory: any[]

  scanForDuplicates: (entityType?: 'note' | 'task') => Promise<void>
  fetchDuplicateGroups: () => Promise<void>
  mergeDuplicates: (groupId: string, primaryId: string) => Promise<boolean>
  dismissDuplicateGroup: (groupId: string) => Promise<boolean>

  runIntegrityCheck: () => Promise<void>
  validateReferences: () => Promise<{ orphans: any[]; brokenLinks: any[] }>
  repairIntegrityIssues: (issues: any[]) => Promise<{ repaired: number; failed: number }>

  fetchTransferHistory: () => Promise<void>
  fetchBackupHistory: () => Promise<void>

  createEncryptedBackup: (destinationPath: string, password: string) => Promise<string>
  restoreEncryptedBackup: (backupPath: string, password: string) => Promise<boolean>
  createIncrementalBackup: (destinationPath: string) => Promise<string>
}

export const useDataManagementStore = create<DataManagementStore>((set, get) => ({
  exportInProgress: false,
  importInProgress: false,
  scanInProgress: false,
  integrityLoading: false,
  duplicateGroups: [],
  integrityReport: null,
  transferHistory: [],
  backupHistory: [],

  scanForDuplicates: async (entityType) => {
    set({ scanInProgress: true })
    try {
      await window.api.dedup.scan(entityType)
      await get().fetchDuplicateGroups()
    } catch (error) {
      console.error('Scan for duplicates failed:', error)
    } finally {
      set({ scanInProgress: false })
    }
  },

  fetchDuplicateGroups: async () => {
    try {
      const duplicateGroups = await window.api.dedup.groups()
      set({ duplicateGroups })
    } catch (error) {
      console.error('Fetch duplicate groups failed:', error)
    }
  },

  mergeDuplicates: async (groupId, primaryId) => {
    try {
      const res = await window.api.dedup.merge(groupId, primaryId)
      if (res.success) {
        await get().fetchDuplicateGroups()
        return true
      }
      return false
    } catch (error) {
      console.error('Merge duplicates failed:', error)
      return false
    }
  },

  dismissDuplicateGroup: async (groupId) => {
    try {
      const res = await window.api.dedup.dismiss(groupId)
      if (res.success) {
        await get().fetchDuplicateGroups()
        return true
      }
      return false
    } catch (error) {
      console.error('Dismiss duplicate group failed:', error)
      return false
    }
  },

  runIntegrityCheck: async () => {
    set({ integrityLoading: true })
    try {
      const report = await window.api.integrity.checkAll()
      set({ integrityReport: report })
    } catch (error) {
      console.error('Integrity check failed:', error)
    } finally {
      set({ integrityLoading: false })
    }
  },

  validateReferences: async () => {
    try {
      return await window.api.integrity.validate()
    } catch (error) {
      console.error('Validate references failed:', error)
      return { orphans: [], brokenLinks: [] }
    }
  },

  repairIntegrityIssues: async (issues) => {
    try {
      const res = await window.api.integrity.repair(issues)
      await get().runIntegrityCheck()
      return res
    } catch (error) {
      console.error('Repair integrity failed:', error)
      return { repaired: 0, failed: issues.length }
    }
  },

  fetchTransferHistory: async () => {
    try {
      const history = await window.api.dataExport.history()
      set({ transferHistory: history })
    } catch (error) {
      console.error('Fetch transfer history failed:', error)
    }
  },

  fetchBackupHistory: async () => {
    try {
      const history = await window.api.backup.history()
      set({ backupHistory: history })
    } catch (error) {
      console.error('Fetch backup history failed:', error)
    }
  },

  createEncryptedBackup: async (destinationPath, password) => {
    try {
      const path = await window.api.backup.createEncrypted(destinationPath, password)
      await get().fetchBackupHistory()
      return path
    } catch (error) {
      console.error('Create encrypted backup failed:', error)
      throw error
    }
  },

  restoreEncryptedBackup: async (backupPath, password) => {
    try {
      const res = await window.api.backup.restoreEncrypted(backupPath, password)
      return res.success
    } catch (error) {
      console.error('Restore encrypted backup failed:', error)
      return false
    }
  },

  createIncrementalBackup: async (destinationPath) => {
    try {
      const path = await window.api.backup.createIncremental(destinationPath)
      await get().fetchBackupHistory()
      return path
    } catch (error) {
      console.error('Create incremental backup failed:', error)
      throw error
    }
  }
}))
