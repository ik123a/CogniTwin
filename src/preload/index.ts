import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom API for renderer containing DB, Auth, Backup, Watcher and Window controls
const api = {
  auth: {
    hasUsers: () => ipcRenderer.invoke('auth:has-users'),
    register: (name: string, pass: string) =>
      ipcRenderer.invoke('auth:register', { name, password: pass }),
    login: (pass: string) => ipcRenderer.invoke('auth:login', { password: pass })
  },
  db: {
    query: (sql: string, params: any[] = []) => ipcRenderer.invoke('db:query', { sql, params }),
    get: (sql: string, params: any[] = []) => ipcRenderer.invoke('db:get', { sql, params }),
    execute: (sql: string, params: any[] = []) => ipcRenderer.invoke('db:execute', { sql, params }),
    transaction: (queries: Array<{ type: 'execute' | 'query'; sql: string; params?: any[] }>) =>
      ipcRenderer.invoke('db:transaction', { queries })
  },
  backup: {
    create: (destinationPath: string) => ipcRenderer.invoke('backup:create', { destinationPath }),
    restore: (backupFilePath: string) => ipcRenderer.invoke('backup:restore', { backupFilePath }),
    createEncrypted: (destinationPath: string, password: string) =>
      ipcRenderer.invoke('backup:create-encrypted', { destinationPath, password }),
    restoreEncrypted: (backupPath: string, password: string) =>
      ipcRenderer.invoke('backup:restore-encrypted', { backupPath, password }),
    createIncremental: (destinationPath: string) =>
      ipcRenderer.invoke('backup:create-incremental', { destinationPath }),
    history: () => ipcRenderer.invoke('backup:history')
  },
  watch: {
    start: (folderPath: string, workspaceId: string, projectId: string) =>
      ipcRenderer.invoke('watch:start', { folderPath, workspaceId, projectId }),
    stop: (folderPath: string) => ipcRenderer.invoke('watch:stop', { folderPath })
  },
  system: {
    status: () => ipcRenderer.invoke('system:status')
  },
  intelligence: {
    search: (query: string, options: any = {}) =>
      ipcRenderer.invoke('intelligence:search', { query, options }),
    indexItem: (id: string, type: string, title: string, content: string | null) =>
      ipcRenderer.invoke('intelligence:index-item', { id, type, title, content }),
    reindexAll: () => ipcRenderer.invoke('intelligence:reindex-all'),
    getIndexStatus: () => ipcRenderer.invoke('intelligence:get-index-status'),
    onIndexProgress: (callback: (data: { processed: number; total: number }) => void) => {
      const listener = (_event: any, data: { processed: number; total: number }) => callback(data)
      ipcRenderer.on('intelligence:index-progress', listener)
      return () => {
        ipcRenderer.removeListener('intelligence:index-progress', listener)
      }
    }
  },
  llm: {
    createSession: (title: string) => ipcRenderer.invoke('llm:create-session', { title }),
    getSessions: () => ipcRenderer.invoke('llm:get-sessions'),
    deleteSession: (sessionId: string) => ipcRenderer.invoke('llm:delete-session', { sessionId }),
    getMessages: (sessionId: string) => ipcRenderer.invoke('llm:get-messages', { sessionId }),
    sendMessage: (sessionId: string, prompt: string) =>
      ipcRenderer.invoke('llm:chat-stream', { sessionId, prompt }),
    summarize: (text: string) => ipcRenderer.invoke('llm:summarize', { text }),
    onToken: (callback: (data: { sessionId: string; token: string }) => void) => {
      const listener = (_event: any, data: { sessionId: string; token: string }) => callback(data)
      ipcRenderer.on('llm:token', listener)
      return () => {
        ipcRenderer.removeListener('llm:token', listener)
      }
    }
  },
  automation: {
    getRules: () => ipcRenderer.invoke('automation:get-rules'),
    saveRule: (rule: any) => ipcRenderer.invoke('automation:save-rule', { rule }),
    deleteRule: (ruleId: string) => ipcRenderer.invoke('automation:delete-rule', { ruleId }),
    getWorkflows: () => ipcRenderer.invoke('automation:get-workflows'),
    saveWorkflow: (workflow: any) => ipcRenderer.invoke('automation:save-workflow', { workflow }),
    deleteWorkflow: (workflowId: string) =>
      ipcRenderer.invoke('automation:delete-workflow', { workflowId }),
    getMacros: () => ipcRenderer.invoke('automation:get-macros'),
    startRecording: (name: string) => ipcRenderer.invoke('automation:start-recording', { name }),
    stopRecording: () => ipcRenderer.invoke('automation:stop-recording'),
    playMacro: (macroId: string) => ipcRenderer.invoke('automation:play-macro', { macroId }),
    getScheduledActions: () => ipcRenderer.invoke('automation:get-scheduled-actions'),
    saveScheduledAction: (schedule: any) =>
      ipcRenderer.invoke('automation:save-scheduled-action', { schedule }),
    deleteScheduledAction: (scheduleId: string) =>
      ipcRenderer.invoke('automation:delete-scheduled-action', { scheduleId })
  },
  analytics: {
    getStats: (rangeDays: number) => ipcRenderer.invoke('analytics:get-stats', { rangeDays })
  },
  integrations: {
    getAccounts: () => ipcRenderer.invoke('integrations:get-accounts'),
    saveAccount: (account: any) => ipcRenderer.invoke('integrations:save-account', { account }),
    deleteAccount: (accountId: string) =>
      ipcRenderer.invoke('integrations:delete-account', { accountId }),
    syncAll: () => ipcRenderer.invoke('integrations:sync-all'),
    getEnergyBlocks: () => ipcRenderer.invoke('integrations:get-energy-blocks')
  },
  knowledge: {
    searchUnified: (query: string, limit?: number) =>
      ipcRenderer.invoke('knowledge:search-unified', { query, limit }),
    getClusters: () => ipcRenderer.invoke('knowledge:get-clusters'),
    runClustering: (customK?: number) =>
      ipcRenderer.invoke('knowledge:run-clustering', { customK }),
    autoOrganize: (itemId: string, itemType: string) =>
      ipcRenderer.invoke('knowledge:auto-organize', { itemId, itemType }),
    extractTasks: (sourceId: string, sourceType: string, text: string) =>
      ipcRenderer.invoke('knowledge:extract-tasks', { sourceId, sourceType, text })
  },
  reminders: {
    getActive: () => ipcRenderer.invoke('reminders:get-active'),
    dismiss: (reminderId: string) => ipcRenderer.invoke('reminders:dismiss', { reminderId }),
    generate: () => ipcRenderer.invoke('reminders:generate')
  },
  shortcuts: {
    getAll: () => ipcRenderer.invoke('shortcuts:get-all'),
    update: (action: string, accelerator: string, isEnabled: number) =>
      ipcRenderer.invoke('shortcuts:update', { action, accelerator, isEnabled }),
    onTrigger: (callback: (action: string) => void) => {
      const listener = (_event: any, action: string) => callback(action)
      ipcRenderer.on('shortcut:trigger', listener)
      return () => {
        ipcRenderer.removeListener('shortcut:trigger', listener)
      }
    }
  },
  spaced: {
    getDue: () => ipcRenderer.invoke('spaced:get-due'),
    review: (cardId: string, grade: number) =>
      ipcRenderer.invoke('spaced:review', { cardId, grade }),
    create: (noteId: string | null, front: string, back: string) =>
      ipcRenderer.invoke('spaced:create', { noteId, front, back })
  },
  learning: {
    getGoals: () => ipcRenderer.invoke('learning:get-goals'),
    createGoal: (title: string, topic: string) =>
      ipcRenderer.invoke('learning:create-goal', { title, topic }),
    getSteps: (goalId: string) => ipcRenderer.invoke('learning:get-steps', { goalId }),
    completeStep: (stepId: string) => ipcRenderer.invoke('learning:complete-step', { stepId }),
    performGap: (goalId: string) => ipcRenderer.invoke('learning:perform-gap', { goalId })
  },
  maturation: {
    getTimeline: () => ipcRenderer.invoke('maturation:get-timeline'),
    getState: (noteId: string) => ipcRenderer.invoke('maturation:get-state', { noteId })
  },
  classification: {
    classify: (itemId: string, itemType: string, content: string) =>
      ipcRenderer.invoke('classification:classify', { itemId, itemType, content }),
    get: (itemId: string, itemType: string) =>
      ipcRenderer.invoke('classification:get', { itemId, itemType }),
    byCategory: (categoryId: string) =>
      ipcRenderer.invoke('classification:by-category', { categoryId }),
    categories: () => ipcRenderer.invoke('classification:categories'),
    createCategory: (name: string, description: string | null) =>
      ipcRenderer.invoke('classification:create-category', { name, description })
  },
  versioning: {
    snapshot: (noteId: string) => ipcRenderer.invoke('versioning:snapshot', { noteId }),
    history: (noteId: string) => ipcRenderer.invoke('versioning:history', { noteId }),
    diff: (versionId: string) => ipcRenderer.invoke('versioning:diff', { versionId }),
    rollback: (noteId: string, versionId: string) =>
      ipcRenderer.invoke('versioning:rollback', { noteId, versionId }),
    snapshotItem: (entityType: string, entityId: string, snapshotData: any) =>
      ipcRenderer.invoke('versioning:snapshot-item', { entityType, entityId, snapshotData }),
    itemHistory: (entityType: string, entityId: string) =>
      ipcRenderer.invoke('versioning:item-history', { entityType, entityId }),
    rollbackItem: (entityType: string, entityId: string, versionId: string) =>
      ipcRenderer.invoke('versioning:rollback-item', { entityType, entityId, versionId })
  },
  audit: {
    log: (action: string, entityType?: string, entityId?: string, details?: any) =>
      ipcRenderer.invoke('audit:log', { userId: 'default', action, entityType, entityId, details }),
    get: (filters: any) => ipcRenderer.invoke('audit:get', { filters }),
    entity: (entityType: string, entityId: string) =>
      ipcRenderer.invoke('audit:entity', { entityType, entityId })
  },
  integrity: {
    verify: (entityType: string, entityId: string, currentContent: string) =>
      ipcRenderer.invoke('integrity:verify', { entityType, entityId, currentContent }),
    checkAll: () => ipcRenderer.invoke('integrity:check-all'),
    validate: () => ipcRenderer.invoke('integrity:validate'),
    repair: (issues: any[]) => ipcRenderer.invoke('integrity:repair', { issues })
  },
  privacy: {
    getRules: () => ipcRenderer.invoke('privacy:get-rules'),
    createRule: (pattern: string, replacement?: string) =>
      ipcRenderer.invoke('privacy:create-rule', { pattern, replacement }),
    deleteRule: (ruleId: string) => ipcRenderer.invoke('privacy:delete-rule', { ruleId }),
    redact: (text: string) => ipcRenderer.invoke('privacy:redact', { text }),
    secureDelete: (entityType: string, entityId: string) =>
      ipcRenderer.invoke('privacy:secure-delete', { entityType, entityId })
  },
  dataExport: {
    toJSON: (projectId?: string) => ipcRenderer.invoke('export:json', { projectId }),
    toCSV: (entityType: string, projectId?: string) =>
      ipcRenderer.invoke('export:csv', { entityType, projectId }),
    toMarkdown: (noteIds?: string[]) => ipcRenderer.invoke('export:markdown', { noteIds }),
    history: () => ipcRenderer.invoke('export:history')
  },
  dataImport: {
    detect: (filePath: string) => ipcRenderer.invoke('import:detect', { filePath }),
    preview: (filePath: string) => ipcRenderer.invoke('import:preview', { filePath }),
    fromJSON: (filePath: string, projectId?: string) =>
      ipcRenderer.invoke('import:json', { filePath, projectId }),
    fromCSV: (filePath: string, entityType: string, mapping: any) =>
      ipcRenderer.invoke('import:csv', { filePath, entityType, mapping }),
    fromMarkdown: (folderPath: string, projectId?: string) =>
      ipcRenderer.invoke('import:markdown', { folderPath, projectId }),
    history: () => ipcRenderer.invoke('import:history')
  },
  dedup: {
    scan: (entityType?: string) => ipcRenderer.invoke('dedup:scan', { entityType }),
    groups: () => ipcRenderer.invoke('dedup:groups'),
    merge: (groupId: string, primaryId: string) =>
      ipcRenderer.invoke('dedup:merge', { groupId, primaryId }),
    dismiss: (groupId: string) => ipcRenderer.invoke('dedup:dismiss', { groupId })
  },
  expertise: {
    detect: () => ipcRenderer.invoke('expertise:detect'),
    getProfile: () => ipcRenderer.invoke('expertise:get-profile'),
    scoreNote: (noteId: string) => ipcRenderer.invoke('expertise:score-note', { noteId }),
    getQuality: (noteId: string) => ipcRenderer.invoke('expertise:get-quality', { noteId }),
    discoverLinks: () => ipcRenderer.invoke('expertise:discover-links'),
    getLinks: () => ipcRenderer.invoke('expertise:get-links')
  },
  context: {
    save: (projectId: string, contextData: any) =>
      ipcRenderer.invoke('context:save', { projectId, contextData }),
    load: (projectId: string) => ipcRenderer.invoke('context:load', { projectId })
  },
  drafts: {
    save: (noteId: string, title: string, content: string) =>
      ipcRenderer.invoke('drafts:save', { noteId, title, content }),
    discard: (noteId: string) => ipcRenderer.invoke('drafts:discard', { noteId }),
    getRecoverable: () => ipcRenderer.invoke('drafts:get-recoverable'),
    get: (noteId: string) => ipcRenderer.invoke('drafts:get', { noteId }),
    delete: (noteId: string) => ipcRenderer.invoke('drafts:delete', { noteId }),
    getAll: () => ipcRenderer.invoke('drafts:get-all')
  },
  plugins: {
    scan: () => ipcRenderer.invoke('plugin:scan'),
    toggle: (pluginId: string, isActive: boolean) =>
      ipcRenderer.invoke('plugin:toggle', { pluginId, isActive }),
    list: () => ipcRenderer.invoke('plugin:list')
  },
  scripting: {
    runJs: (code: string) => ipcRenderer.invoke('script:run-js', { code }),
    runPython: (code: string) => ipcRenderer.invoke('script:run-python', { code }),
    save: (name: string, language: string, codeContent: string, description?: string) =>
      ipcRenderer.invoke('script:save', { name, language, codeContent, description }),
    list: () => ipcRenderer.invoke('script:list'),
    delete: (scriptId: string) => ipcRenderer.invoke('script:delete', { scriptId })
  },
  simulation: {
    markovForecast: () => ipcRenderer.invoke('simulation:markov-forecast'),
    monteCarlo: (projectId: string | null, runsCount?: number) =>
      ipcRenderer.invoke('simulation:monte-carlo', { projectId, runsCount }),
    decisionSave: (title: string, description: string | null, options: any[], factors: any[]) =>
      ipcRenderer.invoke('simulation:decision-save', { title, description, options, factors }),
    decisionList: () => ipcRenderer.invoke('simulation:decision-list'),
    decisionDelete: (id: string) => ipcRenderer.invoke('simulation:decision-delete', { id })
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    createAuxiliary: (route: string) => ipcRenderer.invoke('window:create-auxiliary', { route }),
    closeAuxiliary: (windowId?: number) =>
      ipcRenderer.invoke('window:close-auxiliary', { windowId })
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('Error exposing contextBridge APIs:', error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
