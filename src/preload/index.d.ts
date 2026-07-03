import { ElectronAPI } from '@electron-toolkit/preload'

interface AuthAPI {
  hasUsers(): Promise<boolean>
  register(name: string, pass: string): Promise<{ id: string; name: string; created_at: string }>
  login(pass: string): Promise<{ id: string; name: string; created_at: string }>
}

interface DbExecuteResult {
  changes: number
  lastInsertRowid: string
}

interface DbAPI {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>
  get<T = any>(sql: string, params?: any[]): Promise<T | undefined>
  execute(sql: string, params?: any[]): Promise<DbExecuteResult>
  transaction(
    queries: Array<{ type: 'execute' | 'query'; sql: string; params?: any[] }>
  ): Promise<any[]>
}

interface BackupAPI {
  create(destinationPath: string): Promise<string>
  restore(backupFilePath: string): Promise<{ success: boolean }>
  createEncrypted(destinationPath: string, password: string): Promise<string>
  restoreEncrypted(backupPath: string, password: string): Promise<{ success: boolean }>
  createIncremental(destinationPath: string): Promise<string>
  history(): Promise<any[]>
}

interface WatchAPI {
  start(folderPath: string, workspaceId: string, projectId: string): Promise<{ success: boolean }>
  stop(folderPath: string): Promise<{ success: boolean }>
}

interface SystemAPI {
  status(): Promise<{
    cpu: { model: string; cores: number; load: number }
    memory: { total: number; used: number; free: number; percentage: number }
    system: { platform: string; arch: string; uptime: number }
  }>
}

interface WindowAPI {
  minimize(): void
  maximize(): void
  close(): void
  createAuxiliary(route: string): Promise<number>
  closeAuxiliary(windowId?: number): Promise<boolean>
}

interface ContextAPI {
  save(projectId: string, contextData: any): Promise<void>
  load(projectId: string): Promise<any | null>
}

interface DraftsAPI {
  save(noteId: string, title: string, content: string): Promise<{ success: boolean } | void>
  discard(noteId: string): Promise<void>
  getRecoverable(): Promise<
    Array<{ noteId: string; title: string; content: string; updatedAt: string }>
  >
  get(noteId: string): Promise<any>
  delete(noteId: string): Promise<{ success: boolean }>
  getAll(): Promise<any[]>
}

interface SearchResult {
  id: string
  type: 'note' | 'task' | 'file' | 'inbox_item'
  title: string
  snippet: string
  score: number
  scoreType: 'semantic' | 'keyword' | 'hybrid'
}

interface IndexStatus {
  isIndexing: boolean
  totalItems: number
  processedItems: number
  queueSize: number
}

interface IntelligenceAPI {
  search(
    query: string,
    options?: { limit?: number; mode?: 'semantic' | 'keyword' | 'hybrid' }
  ): Promise<SearchResult[]>
  indexItem(
    id: string,
    type: string,
    title: string,
    content: string | null
  ): Promise<{ success: boolean }>
  reindexAll(): Promise<{ success: boolean }>
  getIndexStatus(): Promise<IndexStatus>
  onIndexProgress(callback: (data: { processed: number; total: number }) => void): () => void
}

interface KnowledgeAPI {
  searchUnified(query: string, limit?: number): Promise<SearchResult[]>
  getClusters(): Promise<any[]>
  runClustering(customK?: number): Promise<{ success: boolean }>
  autoOrganize(itemId: string, itemType: string): Promise<string[]>
  extractTasks(sourceId: string, sourceType: string, text: string): Promise<any[]>
}

interface RemindersAPI {
  getActive(): Promise<any[]>
  dismiss(reminderId: string): Promise<{ success: boolean }>
  generate(): Promise<{ success: boolean }>
}

interface ShortcutsAPI {
  getAll(): Promise<any[]>
  update(action: string, accelerator: string, isEnabled: number): Promise<{ success: boolean }>
  onTrigger(callback: (action: string) => void): () => void
}

interface SpacedAPI {
  getDue(): Promise<any[]>
  review(cardId: string, grade: number): Promise<any>
  create(noteId: string | null, front: string, back: string): Promise<any>
}

interface LearningAPI {
  getGoals(): Promise<any[]>
  createGoal(title: string, topic: string): Promise<any>
  getSteps(goalId: string): Promise<any[]>
  completeStep(stepId: string): Promise<void>
  performGap(goalId: string): Promise<void>
}

interface MaturationAPI {
  getTimeline(): Promise<any[]>
  getState(noteId: string): Promise<any>
}

interface ClassificationAPI {
  classify(itemId: string, itemType: string, content: string): Promise<any[]>
  get(itemId: string, itemType: string): Promise<any[]>
  byCategory(categoryId: string): Promise<any[]>
  categories(): Promise<any[]>
  createCategory(name: string, description: string | null): Promise<any>
}

interface VersioningAPI {
  snapshot(noteId: string): Promise<any>
  history(noteId: string): Promise<any[]>
  diff(versionId: string): Promise<string | null>
  rollback(noteId: string, versionId: string): Promise<any>
  snapshotItem(entityType: string, entityId: string, snapshotData: any): Promise<any>
  itemHistory(entityType: string, entityId: string): Promise<any[]>
  rollbackItem(entityType: string, entityId: string, versionId: string): Promise<any>
}

interface AuditAPI {
  log(action: string, entityType?: string, entityId?: string, details?: any): Promise<void>
  get(filters?: {
    action?: string
    entityType?: string
    from?: string
    to?: string
    limit?: number
  }): Promise<any[]>
  entity(entityType: string, entityId: string): Promise<any[]>
}

interface IntegrityAPI {
  verify(
    entityType: string,
    entityId: string,
    currentContent: string
  ): Promise<{ valid: boolean; expected: string; actual: string }>
  checkAll(): Promise<{ total: number; valid: number; mismatches: any[] }>
  validate(): Promise<{ orphans: any[]; brokenLinks: any[] }>
  repair(issues: any[]): Promise<{ repaired: number; failed: number }>
}

interface PrivacyAPI {
  getRules(): Promise<any[]>
  createRule(pattern: string, replacement?: string): Promise<any>
  deleteRule(ruleId: string): Promise<{ success: boolean }>
  redact(text: string): Promise<string>
  secureDelete(entityType: string, entityId: string): Promise<{ success: boolean }>
}

interface DataExportAPI {
  toJSON(projectId?: string): Promise<{ filePath: string; itemCount: number }>
  toCSV(entityType: string, projectId?: string): Promise<{ filePath: string; rowCount: number }>
  toMarkdown(noteIds?: string[]): Promise<{ filePath: string; fileCount: number }>
  history(): Promise<any[]>
}

interface DataImportAPI {
  detect(filePath: string): Promise<{ format: string; confidence: number }>
  preview(filePath: string): Promise<{ items: any[]; fieldMapping: any }>
  fromJSON(filePath: string, projectId?: string): Promise<{ imported: number }>
  fromCSV(filePath: string, entityType: string, mapping: any): Promise<{ imported: number }>
  fromMarkdown(folderPath: string, projectId?: string): Promise<{ imported: number }>
  history(): Promise<any[]>
}

interface DedupAPI {
  scan(entityType?: string): Promise<{ groupsFound: number }>
  groups(): Promise<any[]>
  merge(groupId: string, primaryId: string): Promise<{ success: boolean }>
  dismiss(groupId: string): Promise<{ success: boolean }>
}

interface ExpertiseAPI {
  detect(): Promise<any[]>
  getProfile(): Promise<any[]>
  scoreNote(noteId: string): Promise<any>
  getQuality(noteId: string): Promise<any>
  discoverLinks(): Promise<any[]>
  getLinks(): Promise<any[]>
}

interface PluginsAPI {
  scan(): Promise<any[]>
  toggle(pluginId: string, isActive: boolean): Promise<{ success: boolean }>
  list(): Promise<any[]>
}

interface ScriptingAPI {
  runJs(
    code: string
  ): Promise<{ success: boolean; result?: string; error?: string; logs: string[] }>
  runPython(
    code: string
  ): Promise<{ success: boolean; result?: string; error?: string; logs: string[] }>
  save(
    name: string,
    language: string,
    codeContent: string,
    description?: string
  ): Promise<{ success: boolean; id: string }>
  list(): Promise<any[]>
  delete(scriptId: string): Promise<{ success: boolean }>
}

interface SimulationAPI {
  markovForecast(): Promise<{
    matrix: Record<string, Record<string, number>>
    forecast: Array<{ hour: number; state: string }>
  }>
  monteCarlo(
    projectId: string | null,
    runsCount?: number
  ): Promise<{
    meanDays: number
    confidence90: number
    riskFactor: 'Low' | 'Medium' | 'High'
    chartData: Array<{ days: number; probability: number; cumulative: number }>
  }>
  decisionSave(
    title: string,
    description: string | null,
    options: any[],
    factors: any[]
  ): Promise<{
    id: string
    recommendedOption: string
    rankings: Array<{ name: string; score: number; confidence: number }>
  }>
  decisionList(): Promise<any[]>
  decisionDelete(id: string): Promise<{ success: boolean }>
}

interface CustomAPI {
  auth: AuthAPI
  db: DbAPI
  backup: BackupAPI
  watch: WatchAPI
  system: SystemAPI
  intelligence: IntelligenceAPI
  llm: LlmAPI
  automation: AutomationAPI
  analytics: AnalyticsAPI
  integrations: IntegrationsAPI
  knowledge: KnowledgeAPI
  reminders: RemindersAPI
  shortcuts: ShortcutsAPI
  spaced: SpacedAPI
  learning: LearningAPI
  maturation: MaturationAPI
  classification: ClassificationAPI
  versioning: VersioningAPI
  expertise: ExpertiseAPI
  context: ContextAPI
  drafts: DraftsAPI
  window: WindowAPI
  audit: AuditAPI
  integrity: IntegrityAPI
  privacy: PrivacyAPI
  dataExport: DataExportAPI
  dataImport: DataImportAPI
  dedup: DedupAPI
  plugins: PluginsAPI
  scripting: ScriptingAPI
  simulation: SimulationAPI
}

interface IntegrationsAPI {
  getAccounts(): Promise<any[]>
  saveAccount(account: any): Promise<any>
  deleteAccount(accountId: string): Promise<{ success: boolean }>
  syncAll(): Promise<{
    success: boolean
    counts: {
      emails: number
      events: number
      history: number
    }
  }>
  getEnergyBlocks(): Promise<Array<{ start: string; end: string; score: number; label: string }>>
}

interface AnalyticsAPI {
  getStats(rangeDays: number): Promise<{
    timeline: any[]
    skills: any[]
    heatmap: any[]
    summary: {
      totalNotes: number
      totalTasks: number
      completedTasks: number
      totalFiles: number
    }
  }>
}

interface AutomationAPI {
  getRules(): Promise<any[]>
  saveRule(rule: any): Promise<any>
  deleteRule(ruleId: string): Promise<{ success: boolean }>
  getWorkflows(): Promise<any[]>
  saveWorkflow(workflow: any): Promise<any>
  deleteWorkflow(workflowId: string): Promise<{ success: boolean }>
  getMacros(): Promise<any[]>
  startRecording(name: string): Promise<{ success: boolean }>
  stopRecording(): Promise<{ id: string; name: string; stepCount: number }>
  playMacro(macroId: string): Promise<void>
  getScheduledActions(): Promise<any[]>
  saveScheduledAction(schedule: any): Promise<any>
  deleteScheduledAction(scheduleId: string): Promise<{ success: boolean }>
}

interface LlmSession {
  id: string
  title: string
  created_at: string
}

interface LlmMessage {
  id: string
  session_id: string
  sender: 'user' | 'assistant'
  content: string
  created_at: string
}

interface LlmAPI {
  createSession(title: string): Promise<LlmSession>
  getSessions(): Promise<LlmSession[]>
  deleteSession(sessionId: string): Promise<{ success: boolean }>
  getMessages(sessionId: string): Promise<LlmMessage[]>
  sendMessage(sessionId: string, prompt: string): Promise<string>
  summarize(text: string): Promise<string>
  onToken(callback: (data: { sessionId: string; token: string }) => void): () => void
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: CustomAPI
  }
}
