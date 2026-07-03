import { ipcMain } from 'electron'
import { getDatabase } from '../database/connection'
import * as authService from '../services/auth.service'
import * as backupService from '../services/backup.service'
import * as fileWatcherService from '../services/file-watcher.service'
import * as indexingService from '../services/indexing.service'
import * as llmService from '../services/llm.service'
import * as ruleEngineService from '../services/rule-engine.service'
import * as macroRecorderService from '../services/macro-recorder.service'
import * as schedulerService from '../services/scheduler.service'
import * as analyticsService from '../services/analytics.service'
import * as emailIntegrationService from '../services/email-integration.service'
import * as calendarIntegrationService from '../services/calendar-integration.service'
import * as browserIntegrationService from '../services/browser-integration.service'
import * as autoOrganizeService from '../services/auto-organize.service'
import * as smartRemindersService from '../services/smart-reminders.service'
import * as clusteringService from '../services/clustering.service'
import * as shortcutManagerService from '../services/shortcut-manager.service'
import * as spacedRepetitionService from '../services/spaced-repetition.service'
import * as learningPathService from '../services/learning-path.service'
import * as ideaMaturationService from '../services/idea-maturation.service'
import * as classificationService from '../services/classification.service'
import * as versioningService from '../services/versioning.service'
import * as expertiseService from '../services/expertise.service'
import * as windowManagerService from '../services/window-manager.service'
import * as contextStateService from '../services/context-state.service'
import * as auditService from '../services/audit.service'
import * as integrityService from '../services/integrity.service'
import * as privacyService from '../services/privacy.service'
import * as dataExportService from '../services/data-export.service'
import * as dataImportService from '../services/data-import.service'
import * as deduplicationService from '../services/deduplication.service'
import * as pluginManagerService from '../services/plugin-manager.service'
import * as scriptingService from '../services/scripting.service'
import * as simulationService from '../services/simulation.service'
import os from 'os'
import crypto from 'crypto'

const expressHandlers = new Map<string, Function>()

export function registerIpcHandlers(): void {
  const originalHandle = ipcMain.handle.bind(ipcMain)
  ipcMain.handle = (channel: string, fn: any) => {
    originalHandle(channel, fn)
    expressHandlers.set(channel, fn)
  }

  // --- AUTH IPC HANDLERS ---
  ipcMain.handle('auth:has-users', () => {
    return authService.hasUsers()
  })

  ipcMain.handle('auth:register', (_event, { name, password }) => {
    return authService.registerUser(name, password)
  })

  ipcMain.handle('auth:login', (_event, { password }) => {
    return authService.loginUser(password)
  })

  // --- DATABASE IPC HANDLERS ---
  ipcMain.handle('db:query', (_event, { sql, params = [] }) => {
    const db = getDatabase()
    try {
      const stmt = db.prepare(sql)
      return stmt.all(...params)
    } catch (error) {
      console.error(`DB Query Error on SQL: "${sql}":`, error)
      throw error
    }
  })

  ipcMain.handle('db:get', (_event, { sql, params = [] }) => {
    const db = getDatabase()
    try {
      const stmt = db.prepare(sql)
      return stmt.get(...params)
    } catch (error) {
      console.error(`DB Get Error on SQL: "${sql}":`, error)
      throw error
    }
  })

  ipcMain.handle('db:execute', (_event, { sql, params = [] }) => {
    const db = getDatabase()
    try {
      const stmt = db.prepare(sql)
      const result = stmt.run(...params)

      // Intercept database actions for automation rules and macros
      handleDatabaseEvents(sql, params, result)

      return {
        changes: result.changes,
        lastInsertRowid: result.lastInsertRowid.toString()
      }
    } catch (error) {
      console.error(`DB Execute Error on SQL: "${sql}":`, error)
      throw error
    }
  })

  ipcMain.handle('db:transaction', (_event, { queries }) => {
    const db = getDatabase()
    const runTx = db.transaction((qList) => {
      const results: any[] = []
      for (const q of qList) {
        const stmt = db.prepare(q.sql)
        if (q.type === 'execute') {
          const res = stmt.run(...(q.params || []))
          results.push({
            changes: res.changes,
            lastInsertRowid: res.lastInsertRowid.toString()
          })
        } else {
          results.push(stmt.all(...(q.params || [])))
        }
      }
      return results
    })

    try {
      return runTx(queries)
    } catch (error) {
      console.error('DB Transaction Error:', error)
      throw error
    }
  })

  // --- BACKUP IPC HANDLERS ---
  ipcMain.handle('backup:create', (_event, { destinationPath }) => {
    return backupService.createBackup(destinationPath)
  })

  ipcMain.handle('backup:restore', (_event, { backupFilePath }) => {
    backupService.restoreBackup(backupFilePath)
    return { success: true }
  })

  // --- FILE WATCHER IPC HANDLERS ---
  ipcMain.handle('watch:start', (_event, { folderPath, workspaceId, projectId }) => {
    fileWatcherService.startWatchingFolder(folderPath, workspaceId, projectId)
    return { success: true }
  })

  ipcMain.handle('watch:stop', (_event, { folderPath }) => {
    fileWatcherService.stopWatchingFolder(folderPath)
    return { success: true }
  })

  // --- SYSTEM STATUS IPC HANDLERS ---
  ipcMain.handle('system:status', () => {
    const totalMemory = os.totalmem()
    const freeMemory = os.freemem()
    const usedMemory = totalMemory - freeMemory
    const cpuLoad = os.loadavg()[0] // 1-minute load average
    const cpus = os.cpus()

    return {
      cpu: {
        model: cpus[0]?.model || 'Unknown',
        cores: cpus.length,
        load: cpuLoad
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        free: freeMemory,
        percentage: (usedMemory / totalMemory) * 100
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        uptime: os.uptime()
      }
    }
  })

  // --- INTELLIGENCE IPC HANDLERS ---
  ipcMain.handle('intelligence:search', (_event, { query, options = {} }) => {
    const limit = options.limit || 20
    if (options.mode === 'semantic') {
      return indexingService.semanticSearch(query, limit)
    } else if (options.mode === 'keyword') {
      return indexingService.keywordSearch(query, limit)
    } else {
      return indexingService.hybridSearch(query, limit)
    }
  })

  ipcMain.handle('intelligence:index-item', (_event, { id, type, title, content }) => {
    return indexingService.indexItem(id, type, title, content)
  })

  ipcMain.handle('intelligence:reindex-all', (event) => {
    return indexingService.reindexAll((processed, total) => {
      event.sender.send('intelligence:index-progress', { processed, total })
    })
  })

  ipcMain.handle('intelligence:get-index-status', () => {
    return indexingService.getIndexStatus()
  })

  // --- LOCAL LLM IPC HANDLERS ---
  ipcMain.handle('llm:chat-stream', async (event, { sessionId, prompt }) => {
    return llmService.generateChatResponse(sessionId, prompt, (token) => {
      event.sender.send('llm:token', { sessionId, token })
    })
  })

  ipcMain.handle('llm:summarize', async (_event, { text }) => {
    return llmService.summarizeText(text)
  })

  ipcMain.handle('llm:get-sessions', () => {
    const db = getDatabase()
    return db.prepare('SELECT * FROM chat_sessions ORDER BY created_at DESC').all()
  })

  ipcMain.handle('llm:create-session', (_event, { title }) => {
    const db = getDatabase()
    const id = crypto.randomUUID()
    db.prepare('INSERT INTO chat_sessions (id, title) VALUES (?, ?)').run(id, title)
    return { id, title }
  })

  ipcMain.handle('llm:delete-session', (_event, { sessionId }) => {
    const db = getDatabase()
    db.prepare('DELETE FROM chat_sessions WHERE id = ?').run(sessionId)
    return { success: true }
  })

  ipcMain.handle('llm:get-messages', (_event, { sessionId }) => {
    const db = getDatabase()
    return db
      .prepare('SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC')
      .all(sessionId)
  })

  // --- AUTOMATION IPC HANDLERS ---
  ipcMain.handle('automation:get-rules', () => {
    const db = getDatabase()
    return db.prepare('SELECT * FROM rules ORDER BY created_at DESC').all()
  })

  ipcMain.handle('automation:save-rule', (_event, { rule }) => {
    const db = getDatabase()
    const id = rule.id || crypto.randomUUID()
    db.prepare(
      `
      INSERT INTO rules (id, name, trigger_event, conditions_json, actions_json, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        trigger_event = excluded.trigger_event,
        conditions_json = excluded.conditions_json,
        actions_json = excluded.actions_json,
        is_active = excluded.is_active
    `
    ).run(
      id,
      rule.name,
      rule.trigger_event,
      rule.conditions_json,
      rule.actions_json,
      rule.is_active ?? 1
    )
    return { id, ...rule }
  })

  ipcMain.handle('automation:delete-rule', (_event, { ruleId }) => {
    const db = getDatabase()
    db.prepare('DELETE FROM rules WHERE id = ?').run(ruleId)
    return { success: true }
  })

  ipcMain.handle('automation:get-workflows', () => {
    const db = getDatabase()
    return db.prepare('SELECT * FROM workflows ORDER BY created_at DESC').all()
  })

  ipcMain.handle('automation:save-workflow', (_event, { workflow }) => {
    const db = getDatabase()
    const id = workflow.id || crypto.randomUUID()
    db.prepare(
      `
      INSERT INTO workflows (id, name, nodes_json, edges_json, is_active)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        nodes_json = excluded.nodes_json,
        edges_json = excluded.edges_json,
        is_active = excluded.is_active
    `
    ).run(id, workflow.name, workflow.nodes_json, workflow.edges_json, workflow.is_active ?? 1)
    return { id, ...workflow }
  })

  ipcMain.handle('automation:delete-workflow', (_event, { workflowId }) => {
    const db = getDatabase()
    db.prepare('DELETE FROM workflows WHERE id = ?').run(workflowId)
    return { success: true }
  })

  ipcMain.handle('automation:get-macros', () => {
    const db = getDatabase()
    return db.prepare('SELECT * FROM macros ORDER BY created_at DESC').all()
  })

  ipcMain.handle('automation:start-recording', (_event, { name }) => {
    macroRecorderService.startRecording(name)
    return { success: true }
  })

  ipcMain.handle('automation:stop-recording', () => {
    return macroRecorderService.stopRecording()
  })

  ipcMain.handle('automation:play-macro', (_event, { macroId }) => {
    return macroRecorderService.playMacro(macroId)
  })

  ipcMain.handle('automation:get-scheduled-actions', () => {
    const db = getDatabase()
    return db.prepare('SELECT * FROM scheduled_actions ORDER BY next_run_at ASC').all()
  })

  ipcMain.handle('automation:save-scheduled-action', (_event, { schedule }) => {
    const db = getDatabase()
    const id = schedule.id || crypto.randomUUID()

    // Calculate next run date
    const nextRun = schedulerService.calculateNextRun(schedule.cron_expr, new Date())

    db.prepare(
      `
      INSERT INTO scheduled_actions (id, name, cron_expr, workflow_id, rule_id, next_run_at, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        cron_expr = excluded.cron_expr,
        workflow_id = excluded.workflow_id,
        rule_id = excluded.rule_id,
        next_run_at = excluded.next_run_at,
        is_active = excluded.is_active
    `
    ).run(
      id,
      schedule.name,
      schedule.cron_expr,
      schedule.workflow_id || null,
      schedule.rule_id || null,
      nextRun.toISOString(),
      schedule.is_active ?? 1
    )
    return { id, ...schedule, next_run_at: nextRun.toISOString() }
  })

  ipcMain.handle('automation:delete-scheduled-action', (_event, { scheduleId }) => {
    const db = getDatabase()
    db.prepare('DELETE FROM scheduled_actions WHERE id = ?').run(scheduleId)
    return { success: true }
  })

  ipcMain.handle('analytics:get-stats', async (_event, { rangeDays }) => {
    const timeline = await analyticsService.getTimelineStats(rangeDays)
    const skills = await analyticsService.getSkillRadarStats()
    const heatmap = await analyticsService.getHeatmapStats()

    const db = getDatabase()
    const totalNotes = db.prepare('SELECT count(*) as count FROM notes').get() as { count: number }
    const totalTasks = db.prepare('SELECT count(*) as count FROM tasks').get() as { count: number }
    const completedTasks = db
      .prepare("SELECT count(*) as count FROM tasks WHERE status = 'Completed'")
      .get() as { count: number }
    const totalFiles = db.prepare('SELECT count(*) as count FROM files').get() as { count: number }

    return {
      timeline,
      skills,
      heatmap,
      summary: {
        totalNotes: totalNotes.count,
        totalTasks: totalTasks.count,
        completedTasks: completedTasks.count,
        totalFiles: totalFiles.count
      }
    }
  })

  ipcMain.handle('integrations:get-accounts', () => {
    const db = getDatabase()
    return db.prepare('SELECT * FROM integration_accounts ORDER BY created_at DESC').all()
  })

  ipcMain.handle('integrations:save-account', (_event, { account }) => {
    const db = getDatabase()
    const id = account.id || crypto.randomUUID()
    db.prepare(
      `
      INSERT INTO integration_accounts (id, type, name, username, config_json, is_active)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        username = excluded.username,
        config_json = excluded.config_json,
        is_active = excluded.is_active
    `
    ).run(id, account.type, account.name, account.username, account.config_json, account.is_active)
    return { id, ...account }
  })

  ipcMain.handle('integrations:delete-account', (_event, { accountId }) => {
    const db = getDatabase()
    db.prepare('DELETE FROM integration_accounts WHERE id = ?').run(accountId)
    return { success: true }
  })

  ipcMain.handle('integrations:sync-all', async () => {
    const emailResult = await emailIntegrationService.syncEmailAccounts()
    const calendarResult = await calendarIntegrationService.syncCalendarAccounts()
    const browserResult = await browserIntegrationService.syncBrowserHistory()

    return {
      success: true,
      counts: {
        emails: emailResult.count,
        events: calendarResult.count,
        history: browserResult.count
      }
    }
  })

  ipcMain.handle('integrations:get-energy-blocks', async () => {
    return await calendarIntegrationService.getEnergyOptimizedBlocks()
  })

  // --- KNOWLEDGE / CLUSTERING / AUTO-ORGANIZE IPC HANDLERS ---
  ipcMain.handle('knowledge:search-unified', (_event, { query, limit = 20 }) => {
    return indexingService.hybridSearch(query, limit)
  })

  ipcMain.handle('knowledge:get-clusters', () => {
    return clusteringService.getClusters()
  })

  ipcMain.handle('knowledge:run-clustering', async (_event, { customK } = {}) => {
    await clusteringService.runClustering(customK)
    return { success: true }
  })

  ipcMain.handle('knowledge:auto-organize', (_event, { itemId, itemType }) => {
    return autoOrganizeService.autoClassifyAndTag(itemId, itemType)
  })

  ipcMain.handle('knowledge:extract-tasks', (_event, { sourceId, sourceType, text }) => {
    return autoOrganizeService.extractTasksFromContent(sourceId, sourceType, text)
  })

  // --- SMART REMINDERS IPC HANDLERS ---
  ipcMain.handle('reminders:get-active', () => {
    return smartRemindersService.getActiveReminders()
  })

  ipcMain.handle('reminders:dismiss', (_event, { reminderId }) => {
    smartRemindersService.dismissReminder(reminderId)
    return { success: true }
  })

  ipcMain.handle('reminders:generate', async () => {
    await smartRemindersService.generateSmartReminders()
    return { success: true }
  })

  // --- SHORTCUTS IPC HANDLERS ---
  ipcMain.handle('shortcuts:get-all', () => {
    return shortcutManagerService.getAllShortcuts()
  })

  ipcMain.handle('shortcuts:update', (_event, { action, accelerator, isEnabled }) => {
    const success = shortcutManagerService.updateShortcut(action, accelerator, isEnabled)
    return { success }
  })

  // --- SPACED REPETITION IPC HANDLERS ---
  ipcMain.handle('spaced:get-due', () => {
    return spacedRepetitionService.getDueCards()
  })

  ipcMain.handle('spaced:review', (_event, { cardId, grade }) => {
    return spacedRepetitionService.reviewCard(cardId, grade)
  })

  ipcMain.handle('spaced:create', (_event, { noteId, front, back }) => {
    return spacedRepetitionService.createCard(noteId, front, back)
  })

  // --- LEARNING PATH IPC HANDLERS ---
  ipcMain.handle('learning:get-goals', () => {
    return learningPathService.getGoals()
  })

  ipcMain.handle('learning:create-goal', (_event, { title, topic }) => {
    return learningPathService.createGoal(title, topic)
  })

  ipcMain.handle('learning:get-steps', (_event, { goalId }) => {
    return learningPathService.getSteps(goalId)
  })

  ipcMain.handle('learning:complete-step', (_event, { stepId }) => {
    return learningPathService.completeStep(stepId)
  })

  ipcMain.handle('learning:perform-gap', (_event, { goalId }) => {
    return learningPathService.performGapAnalysis(goalId)
  })

  // --- IDEA MATURATION IPC HANDLERS ---
  ipcMain.handle('maturation:get-timeline', () => {
    return ideaMaturationService.getKnowledgeTimeline()
  })

  ipcMain.handle('maturation:get-state', (_event, { noteId }) => {
    return ideaMaturationService.getMaturationStats(noteId)
  })

  // --- CLASSIFICATION IPC HANDLERS ---
  ipcMain.handle('classification:classify', (_event, { itemId, itemType, content }) => {
    return classificationService.classifyItem(itemId, itemType, content)
  })

  ipcMain.handle('classification:get', (_event, { itemId, itemType }) => {
    return classificationService.getClassifications(itemId, itemType)
  })

  ipcMain.handle('classification:by-category', (_event, { categoryId }) => {
    return classificationService.getItemsByCategory(categoryId)
  })

  ipcMain.handle('classification:categories', () => {
    return classificationService.getCategories()
  })

  ipcMain.handle('classification:create-category', (_event, { name, description }) => {
    return classificationService.createCategory(name, description)
  })

  // --- DRAFTS IPC HANDLERS ---
  ipcMain.handle('drafts:save', (_event, { noteId, title, content }) => {
    const db = getDatabase()
    try {
      db.prepare(
        `
        INSERT INTO note_drafts (note_id, title, content, updated_at)
        VALUES (?, ?, ?, (datetime('now')))
        ON CONFLICT(note_id) DO UPDATE SET
          title = excluded.title,
          content = excluded.content,
          updated_at = (datetime('now'))
      `
      ).run(noteId, title, content)
      return { success: true }
    } catch (error) {
      console.error('Failed to save draft:', error)
      throw error
    }
  })

  ipcMain.handle('drafts:get', (_event, { noteId }) => {
    const db = getDatabase()
    try {
      return db.prepare('SELECT * FROM note_drafts WHERE note_id = ?').get(noteId)
    } catch (error) {
      console.error('Failed to get draft:', error)
      throw error
    }
  })

  ipcMain.handle('drafts:delete', (_event, { noteId }) => {
    const db = getDatabase()
    try {
      db.prepare('DELETE FROM note_drafts WHERE note_id = ?').run(noteId)
      return { success: true }
    } catch (error) {
      console.error('Failed to delete draft:', error)
      throw error
    }
  })

  ipcMain.handle('drafts:get-all', () => {
    const db = getDatabase()
    try {
      return db.prepare('SELECT * FROM note_drafts').all()
    } catch (error) {
      console.error('Failed to get all drafts:', error)
      throw error
    }
  })

  ipcMain.handle('drafts:discard', (_event, { noteId }) => {
    return contextStateService.discardDraft(noteId)
  })

  ipcMain.handle('drafts:get-recoverable', () => {
    return contextStateService.recoverDrafts()
  })

  // --- VERSIONING IPC HANDLERS ---
  ipcMain.handle('versioning:snapshot', (_event, { noteId }) => {
    return versioningService.createSnapshot(noteId)
  })

  ipcMain.handle('versioning:history', (_event, { noteId }) => {
    return versioningService.getHistory(noteId)
  })

  ipcMain.handle('versioning:diff', (_event, { versionId }) => {
    return versioningService.getDiff(versionId)
  })

  ipcMain.handle('versioning:rollback', (_event, { noteId, versionId }) => {
    return versioningService.rollbackToVersion(noteId, versionId)
  })

  // --- EXPERTISE IPC HANDLERS ---
  ipcMain.handle('expertise:detect', () => {
    return expertiseService.detectExpertise()
  })

  ipcMain.handle('expertise:get-profile', () => {
    return expertiseService.getExpertiseProfiles()
  })

  ipcMain.handle('expertise:score-note', (_event, { noteId }) => {
    return expertiseService.scoreNoteQuality(noteId)
  })

  ipcMain.handle('expertise:get-quality', (_event, { noteId }) => {
    return expertiseService.getNoteQuality(noteId)
  })

  ipcMain.handle('expertise:discover-links', () => {
    return expertiseService.discoverCrossDomainLinks()
  })

  ipcMain.handle('expertise:get-links', () => {
    return expertiseService.getCrossDomainLinks()
  })

  // --- WINDOW UX IPC HANDLERS ---
  ipcMain.handle('window:create-auxiliary', (_event, { route }) => {
    return windowManagerService.createSecondaryWindow(route)
  })

  ipcMain.handle('window:close-auxiliary', (_event, { windowId } = {}) => {
    if (windowId !== undefined && windowId !== null) {
      return windowManagerService.closeSecondaryWindow(windowId)
    } else {
      const win = require('electron').BrowserWindow.fromWebContents(_event.sender)
      if (win) {
        win.close()
        return true
      }
      return false
    }
  })

  // --- CONTEXT IPC HANDLERS ---
  ipcMain.handle('context:save', (_event, { projectId, contextData }) => {
    return contextStateService.saveWorkspaceContext(projectId, contextData)
  })

  ipcMain.handle('context:load', (_event, { projectId }) => {
    return contextStateService.loadWorkspaceContext(projectId)
  })

  // --- AUDIT IPC HANDLERS ---
  ipcMain.handle('audit:log', (_event, { userId, action, entityType, entityId, details }) => {
    return auditService.logAction(userId, action, entityType, entityId, details)
  })

  ipcMain.handle('audit:get', (_event, { filters }) => {
    return auditService.getAuditLog(filters)
  })

  ipcMain.handle('audit:entity', (_event, { entityType, entityId }) => {
    return auditService.getAuditLogForEntity(entityType, entityId)
  })

  // --- INTEGRITY IPC HANDLERS ---
  ipcMain.handle('integrity:verify', (_event, { entityType, entityId, currentContent }) => {
    return integrityService.verifyChecksum(entityType, entityId, currentContent)
  })

  ipcMain.handle('integrity:check-all', () => {
    return integrityService.runIntegrityCheck()
  })

  ipcMain.handle('integrity:validate', () => {
    return integrityService.validateReferences()
  })

  ipcMain.handle('integrity:repair', (_event, { issues }) => {
    return integrityService.autoRepair(issues)
  })

  // --- PRIVACY IPC HANDLERS ---
  ipcMain.handle('privacy:get-rules', () => {
    return privacyService.getRules()
  })

  ipcMain.handle('privacy:create-rule', (_event, { pattern, replacement }) => {
    return privacyService.createRule(pattern, replacement)
  })

  ipcMain.handle('privacy:delete-rule', (_event, { ruleId }) => {
    return privacyService.deleteRule(ruleId)
  })

  ipcMain.handle('privacy:redact', (_event, { text }) => {
    return privacyService.redactContent(text)
  })

  ipcMain.handle('privacy:secure-delete', (_event, { entityType, entityId }) => {
    return privacyService.secureDelete(entityType, entityId)
  })

  // --- DATA EXPORT IPC HANDLERS ---
  ipcMain.handle('export:json', (_event, { projectId }) => {
    return dataExportService.exportToJSON(projectId)
  })

  ipcMain.handle('export:csv', (_event, { entityType, projectId }) => {
    return dataExportService.exportToCSV(entityType, projectId)
  })

  ipcMain.handle('export:markdown', (_event, { noteIds }) => {
    return dataExportService.exportToMarkdown(noteIds)
  })

  ipcMain.handle('export:history', () => {
    return dataExportService.getExportHistory()
  })

  // --- DATA IMPORT IPC HANDLERS ---
  ipcMain.handle('import:detect', (_event, { filePath }) => {
    return dataImportService.detectFormat(filePath)
  })

  ipcMain.handle('import:preview', (_event, { filePath }) => {
    return dataImportService.previewImport(filePath)
  })

  ipcMain.handle('import:json', (_event, { filePath, projectId }) => {
    return dataImportService.importFromJSON(filePath, projectId)
  })

  ipcMain.handle('import:csv', (_event, { filePath, entityType, mapping }) => {
    return dataImportService.importFromCSV(filePath, entityType, mapping)
  })

  ipcMain.handle('import:markdown', (_event, { folderPath, projectId }) => {
    return dataImportService.importFromMarkdown(folderPath, projectId)
  })

  ipcMain.handle('import:history', () => {
    return dataImportService.getImportHistory()
  })

  // --- DEDUPLICATION IPC HANDLERS ---
  ipcMain.handle('dedup:scan', (_event, { entityType }) => {
    return deduplicationService.scanForDuplicates(entityType)
  })

  ipcMain.handle('dedup:groups', () => {
    return deduplicationService.getDuplicateGroups()
  })

  ipcMain.handle('dedup:merge', (_event, { groupId, primaryId }) => {
    return deduplicationService.mergeDuplicates(groupId, primaryId)
  })

  ipcMain.handle('dedup:dismiss', (_event, { groupId }) => {
    return deduplicationService.dismissGroup(groupId)
  })

  // --- ENCRYPTED/INCREMENTAL BACKUP IPC EXTENSIONS ---
  ipcMain.handle('backup:create-encrypted', (_event, { destinationPath, password }) => {
    return backupService.createEncryptedBackup(destinationPath, password)
  })

  ipcMain.handle('backup:restore-encrypted', (_event, { backupPath, password }) => {
    return backupService.restoreEncryptedBackup(backupPath, password)
  })

  ipcMain.handle('backup:create-incremental', (_event, { destinationPath }) => {
    return backupService.createIncrementalBackup(destinationPath)
  })

  ipcMain.handle('backup:history', () => {
    return backupService.getBackupHistory()
  })

  // --- GENERALIZED VERSIONING IPC EXTENSIONS ---
  ipcMain.handle('versioning:snapshot-item', (_event, { entityType, entityId, snapshotData }) => {
    return versioningService.snapshotItem(entityType, entityId, snapshotData)
  })

  ipcMain.handle('versioning:item-history', (_event, { entityType, entityId }) => {
    return versioningService.getItemHistory(entityType, entityId)
  })

  ipcMain.handle('versioning:rollback-item', (_event, { entityType, entityId, versionId }) => {
    return versioningService.rollbackItem(entityType, entityId, versionId)
  })

  // --- PLUGIN IPC HANDLERS ---
  ipcMain.handle('plugin:scan', () => {
    return pluginManagerService.scanPlugins()
  })

  ipcMain.handle('plugin:toggle', (_event, { pluginId, isActive }) => {
    return pluginManagerService.togglePlugin(pluginId, isActive)
  })

  ipcMain.handle('plugin:list', () => {
    return pluginManagerService.getPlugins()
  })

  // --- SCRIPTING IPC HANDLERS ---
  ipcMain.handle('script:run-js', (_event, { code }) => {
    return scriptingService.executeJavaScript(code)
  })

  ipcMain.handle('script:run-python', (_event, { code }) => {
    return scriptingService.executePython(code)
  })

  ipcMain.handle('script:save', (_event, { name, language, codeContent, description }) => {
    return scriptingService.saveScript(name, language, codeContent, description)
  })

  ipcMain.handle('script:list', () => {
    return scriptingService.getScripts()
  })

  ipcMain.handle('script:delete', (_event, { scriptId }) => {
    return scriptingService.deleteScript(scriptId)
  })

  // --- SIMULATION IPC HANDLERS ---
  ipcMain.handle('simulation:markov-forecast', () => {
    return simulationService.getMarkovForecast()
  })

  ipcMain.handle('simulation:monte-carlo', (_event, { projectId, runsCount }) => {
    return simulationService.runMonteCarlo(projectId, runsCount)
  })

  ipcMain.handle('simulation:decision-save', (_event, { title, description, options, factors }) => {
    return simulationService.solveDecision(title, description, options, factors)
  })

  ipcMain.handle('simulation:decision-list', () => {
    return simulationService.getSavedDecisions()
  })

  ipcMain.handle('simulation:decision-delete', (_event, { id }) => {
    return simulationService.deleteDecision(id)
  })

  // Start Express API Server for Web & Mobile Clients
  try {
    const express = require('express')
    const cors = require('cors')
    const app = express()
    app.use(cors())
    app.use(express.json())

    app.post('/api/rpc', async (req: any, res: any) => {
      const { channel, args } = req.body
      const handler = expressHandlers.get(channel)
      
      if (!handler) {
        return res.status(404).json({ error: `RPC Handler for ${channel} not found` })
      }

      // Stream events support for chat
      if (channel === 'llm:chat-stream') {
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        })

        const mockEvent = {
          sender: {
            send: (eventName: string, token: any) => {
              res.write(`data: ${JSON.stringify({ event: eventName, token })}\n\n`)
            }
          }
        }

        try {
          await handler(mockEvent, args)
        } catch (err: any) {
          res.write(`data: ${JSON.stringify({ event: 'error', error: err.message })}\n\n`)
        } finally {
          res.end()
        }
      } else {
        // Standard non-streaming handler
        try {
          const result = await handler({ sender: { send: () => {} } }, args)
          res.json({ success: true, data: result })
        } catch (err: any) {
          res.status(500).json({ error: err.message })
        }
      }
    })

    const port = process.env.PORT || 3000
    app.listen(port, () => {
      console.log(`[Express] Core API Server running on port ${port}`)
    })
  } catch (error) {
    console.error('Failed to start Express API Server:', error)
  }
}

function handleDatabaseEvents(sql: string, params: any[], _result: any) {
  try {
    const db = getDatabase()
    const sqlLower = sql.toLowerCase()

    // 1. NOTES INSERTION
    if (sqlLower.includes('insert into notes')) {
      const noteId = params[0]
      if (noteId) {
        const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId) as any
        if (note) {
          ruleEngineService.publishEvent('NOTE_CREATED', {
            id: note.id,
            type: 'note',
            title: note.title,
            description: note.raw_text || note.content || '',
            project_id: note.project_id
          })

          if (macroRecorderService.isRecording()) {
            macroRecorderService.recordAction('CREATE_NOTE', {
              project_id: note.project_id,
              title: note.title,
              content: note.content,
              raw_text: note.raw_text
            })
          }
        }
      }
    }

    // 2. FILES INSERTION
    if (sqlLower.includes('insert into files')) {
      const fileId = params[0]
      if (fileId) {
        const file = db.prepare('SELECT * FROM files WHERE id = ?').get(fileId) as any
        if (file) {
          ruleEngineService.publishEvent('FILE_WATCHED', {
            id: file.id,
            type: 'file',
            title: file.name,
            description: file.raw_text || '',
            project_id: file.project_id
          })
        }
      }
    }

    // 3. TASKS COMPLETED
    if (sqlLower.includes('update tasks') && sqlLower.includes("status = 'completed'")) {
      const taskId = params[params.length - 1]
      if (taskId) {
        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any
        if (task) {
          ruleEngineService.publishEvent('TASK_DONE', {
            id: task.id,
            type: 'task',
            title: task.title,
            description: task.description || '',
            project_id: task.project_id
          })
        }
      }
    }

    if (sqlLower.includes('insert into tasks')) {
      const taskId = params[0]
      if (taskId && macroRecorderService.isRecording()) {
        const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId) as any
        if (task) {
          macroRecorderService.recordAction('CREATE_TASK', {
            project_id: task.project_id,
            title: task.title,
            description: task.description,
            priority: task.priority
          })
        }
      }
    }

    // 4. TAG MAPPING INSERTION
    if (sqlLower.includes('insert into item_tags')) {
      const tagId = params[0]
      const itemId = params[1]
      const itemType = params[2]
      if (tagId && itemId && itemType && macroRecorderService.isRecording()) {
        macroRecorderService.recordAction('TAG_ITEM', {
          tag_id: tagId,
          item_id: itemId,
          item_type: itemType
        })
      }
    }
  } catch (err) {
    console.error('[DatabaseEvents] Error handling database event intercept:', err)
  }
}
