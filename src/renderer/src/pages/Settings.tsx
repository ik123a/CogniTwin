import React, { useEffect, useState } from 'react'
import { useSettingsStore } from '../stores/settingsStore'
import { useModalStore } from '../stores/modalStore'
import { useThemeStore } from '../stores/themeStore'
import { PrivacyPanel } from '../components/PrivacyPanel'
import { AuditLogViewer } from '../components/AuditLogViewer'
import { DataManagement } from '../components/DataManagement'
import { PluginManager } from '../components/PluginManager'
import { ScriptingConsole } from '../components/ScriptingConsole'
import {
  Settings,
  Shield,
  Brain,
  Sliders,
  Link,
  Palette,
  LayoutGrid,
  Cpu,
  Info,
  Save,
  Download,
  AlertCircle,
  Blocks,
  Code
} from 'lucide-react'

type SettingsTab =
  | 'general'
  | 'security'
  | 'data'
  | 'ai'
  | 'automation'
  | 'integrations'
  | 'plugins'
  | 'developer'
  | 'appearance'
  | 'system'
  | 'about'

export default function SettingsPage(): React.JSX.Element {
  const {
    settings,
    systemMetrics,
    isLoading,
    loadSettings,
    updateSettings,
    fetchSystemMetrics,
    createBackup,
    restoreBackup
  } = useSettingsStore()
  const { modals, openModal } = useModalStore()
  const { theme, setTheme } = useThemeStore()
  const [activeTab, setActiveTab] = useState<SettingsTab>('general')

  // Phase 4 Automation States
  const [rules, setRules] = useState<any[]>([])
  const [workflows, setWorkflows] = useState<any[]>([])
  const [macros, setMacros] = useState<any[]>([])
  const [isRecordingMacro, setIsRecordingMacro] = useState(false)
  const [macroNameInput, setMacroNameInput] = useState('')
  const [isIncremental, setIsIncremental] = useState(false)
  const [backupPassword, setBackupPassword] = useState('')

  // Phase 6 Integrations States
  const [integrationAccounts, setIntegrationAccounts] = useState<any[]>([])
  const [isSyncingAll, setIsSyncingAll] = useState(false)
  const [accountName, setAccountName] = useState('')
  const [accountUser, setAccountUser] = useState('')
  const [integrationType, setIntegrationType] = useState<'imap' | 'caldav'>('imap')
  const [configHost, setConfigHost] = useState('')
  const [configUrl, setConfigUrl] = useState('')

  const loadIntegrationAccounts = async () => {
    try {
      const res = await window.api.integrations.getAccounts()
      setIntegrationAccounts(res)
    } catch (e) {
      console.error(e)
    }
  }

  const loadAutomationData = async () => {
    try {
      const rulesList = await window.api.automation.getRules()
      const workflowsList = await window.api.automation.getWorkflows()
      const macrosList = await window.api.automation.getMacros()
      setRules(rulesList)
      setWorkflows(workflowsList)
      setMacros(macrosList)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadSettings()
    if (activeTab === 'system') {
      fetchSystemMetrics()
      const interval = setInterval(fetchSystemMetrics, 3000)
      return () => clearInterval(interval)
    }
    return undefined
  }, [activeTab])

  useEffect(() => {
    if (activeTab === 'automation') {
      loadAutomationData()
    }
  }, [activeTab, modals.ruleBuilder, modals.workflowEditor])

  useEffect(() => {
    if (activeTab === 'integrations') {
      loadIntegrationAccounts()
    }
  }, [activeTab])

  const handleSaveIntegrationAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountName.trim()) return

    try {
      const config =
        integrationType === 'imap'
          ? { host: configHost || 'imap.gmail.com', port: 993, ssl: true }
          : { url: configUrl || 'https://calendar.google.com/dav' }

      const account = {
        type: integrationType,
        name: accountName,
        username: accountUser,
        config_json: JSON.stringify(config),
        is_active: 1
      }

      await window.api.integrations.saveAccount(account)

      setAccountName('')
      setAccountUser('')
      setConfigHost('')
      setConfigUrl('')

      loadIntegrationAccounts()
      alert('Integration account linked successfully!')
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeleteIntegrationAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to unlink this account?')) return
    try {
      await window.api.integrations.deleteAccount(accountId)
      loadIntegrationAccounts()
    } catch (e) {
      console.error(e)
    }
  }

  const handleSyncAllIntegrations = async () => {
    setIsSyncingAll(true)
    try {
      const res = await window.api.integrations.syncAll()
      alert(
        `Sync completed successfully!\nSynced:\n- Emails: ${res.counts.emails}\n- Calendar Events: ${res.counts.events}\n- Browser History Links: ${res.counts.history}`
      )
      loadIntegrationAccounts()
    } catch (e) {
      console.error(e)
    } finally {
      setIsSyncingAll(false)
    }
  }

  const handleStartMacroRecording = async () => {
    if (!macroNameInput.trim()) return
    try {
      await window.api.automation.startRecording(macroNameInput)
      setIsRecordingMacro(true)
      alert(
        `Macro recording started for "${macroNameInput}". Perform some tasks now (e.g. create a note or task) and return here to stop recording.`
      )
    } catch (e) {
      console.error(e)
    }
  }

  const handleStopMacroRecording = async () => {
    try {
      const res = await window.api.automation.stopRecording()
      setIsRecordingMacro(false)
      setMacroNameInput('')
      loadAutomationData()
      alert(`Macro "${res.name}" successfully recorded with ${res.stepCount} steps.`)
    } catch (e) {
      console.error(e)
    }
  }

  const handlePlayMacro = async (macroId: string) => {
    try {
      await window.api.automation.playMacro(macroId)
      alert('Macro sequence replayed successfully!')
    } catch (e: any) {
      alert(`Macro play failed: ${e.message}`)
    }
  }

  const handleDeleteMacro = async (macroId: string) => {
    if (!confirm('Are you sure you want to delete this macro?')) return
    try {
      await window.api.db.execute('DELETE FROM macros WHERE id = ?', [macroId])
      loadAutomationData()
    } catch (e) {
      console.error(e)
    }
  }

  const handleToggleRule = async (rule: any) => {
    try {
      const nextActive = rule.is_active === 1 ? 0 : 1
      await window.api.automation.saveRule({ ...rule, is_active: nextActive })
      loadAutomationData()
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteRule = async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this rule?')) return
    try {
      await window.api.automation.deleteRule(ruleId)
      loadAutomationData()
    } catch (e) {
      console.error(e)
    }
  }

  const handleToggleWorkflow = async (workflow: any) => {
    try {
      const nextActive = workflow.is_active === 1 ? 0 : 1
      await window.api.automation.saveWorkflow({ ...workflow, is_active: nextActive })
      loadAutomationData()
    } catch (e) {
      console.error(e)
    }
  }

  const handleDeleteWorkflow = async (workflowId: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return
    try {
      await window.api.automation.deleteWorkflow(workflowId)
      loadAutomationData()
    } catch (e) {
      console.error(e)
    }
  }

  const handleSaveGeneral = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    alert('Settings successfully saved persistently!')
  }

  const handleBackupNow = async (): Promise<void> => {
    try {
      const defaultDir = await window.api.db.get<{ value: string }>(
        'SELECT value FROM settings WHERE key = ?',
        ['backup_dir']
      )
      const backupDir = defaultDir?.value ? JSON.parse(defaultDir.value) : 'C:\\'

      let pathSaved = ''
      if (isIncremental) {
        pathSaved = await window.api.backup.createIncremental(backupDir)
      } else if (backupPassword) {
        pathSaved = await window.api.backup.createEncrypted(backupDir, backupPassword)
      } else {
        pathSaved = await createBackup(backupDir)
      }

      alert(`Backup successfully generated at: ${pathSaved}`)
    } catch (e: any) {
      alert(`Backup creation failed: ${e.message}`)
    }
  }

  const handleCustomCSSInject = (css: string): void => {
    // Inject custom CSS styling
    const styleId = 'cognitwin-custom-css'
    let style = document.getElementById(styleId)
    if (!style) {
      style = document.createElement('style')
      style.id = styleId
      document.head.appendChild(style)
    }
    style.innerHTML = css
    localStorage.setItem('cognitwin_custom_css', css)
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        gap: 16,
        margin: '-24px',
        padding: 24,
        overflow: 'hidden'
      }}
    >
      {/* Settings Navigation Sidebar */}
      <div
        className="card"
        style={{
          width: 200,
          display: 'flex',
          flexDirection: 'column',
          padding: 16,
          height: '100%',
          overflowY: 'auto',
          flexShrink: 0
        }}
      >
        <span
          className="font-semibold text-sm flex items-center gap-2"
          style={{ marginBottom: 12, paddingLeft: 8 }}
        >
          <Settings size={16} />
          <span>SETTINGS</span>
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {[
            { id: 'general' as SettingsTab, label: 'General', icon: Settings },
            { id: 'security' as SettingsTab, label: 'Privacy & Security', icon: Shield },
            { id: 'data' as SettingsTab, label: 'Data Management', icon: LayoutGrid },
            { id: 'ai' as SettingsTab, label: 'AI Engine', icon: Brain },
            { id: 'automation' as SettingsTab, label: 'Automation Rules', icon: Sliders },
            { id: 'integrations' as SettingsTab, label: 'External Integrations', icon: Link },
            { id: 'plugins' as SettingsTab, label: 'Plugin Extensions', icon: Blocks },
            { id: 'developer' as SettingsTab, label: 'Developer Console', icon: Code },
            { id: 'appearance' as SettingsTab, label: 'Appearance Theme', icon: Palette },
            { id: 'system' as SettingsTab, label: 'System Health', icon: Cpu },
            { id: 'about' as SettingsTab, label: 'About App', icon: Info }
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 6,
                  fontSize: '13px',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? 'var(--color-secondary)' : 'var(--text-muted)',
                  backgroundColor: isActive ? 'rgba(52, 152, 219, 0.08)' : 'transparent',
                  cursor: 'pointer'
                }}
              >
                <Icon size={16} />
                <span>{tab.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Settings Tab Content */}
      <div className="card" style={{ flex: 1, padding: 32, overflowY: 'auto', height: '100%' }}>
        {/* Tab 1: General */}
        {activeTab === 'general' && (
          <form
            onSubmit={handleSaveGeneral}
            className="flex flex-col gap-6"
            style={{ maxWidth: 480 }}
          >
            <h3 className="font-bold text-lg" style={{ fontSize: '20px' }}>
              General Configuration
            </h3>

            <div className="input-group">
              <span className="input-label">APPLICATION NAME</span>
              <input
                type="text"
                className="input-field"
                value={settings.general.appName}
                onChange={(e) => updateSettings('general', { appName: e.target.value })}
              />
            </div>

            <div className="input-group">
              <span className="input-label">INTERFACE LANGUAGE</span>
              <select
                className="input-field"
                value={settings.general.language}
                onChange={(e) => updateSettings('general', { language: e.target.value })}
              >
                <option value="English">English</option>
                <option value="Spanish">Spanish</option>
                <option value="German">German</option>
                <option value="French">French</option>
              </select>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 12
              }}
            >
              <div>
                <span className="font-semibold text-sm" style={{ display: 'block' }}>
                  Share Diagnostic Telemetry
                </span>
                <span className="text-muted text-sm">Sends anonymous usage logs to developers</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.general.telemetry}
                  onChange={(e) => updateSettings('general', { telemetry: e.target.checked })}
                />
                <span className="slider" />
              </label>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ alignSelf: 'flex-start', marginTop: 12 }}
            >
              <Save size={16} />
              <span>Save General Settings</span>
            </button>
          </form>
        )}

        {/* Tab 2: Security & Backup */}
        {activeTab === 'security' && (
          <div className="flex flex-col gap-6" style={{ width: '100%' }}>
            <PrivacyPanel />

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px',
                  padding: '24px',
                  color: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}
              >
                <h4 className="font-semibold text-sm" style={{ margin: 0 }}>
                  Local Database Status
                </h4>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: 8,
                    backgroundColor: 'rgba(0,0,0,0.15)',
                    border: '1px solid rgba(255,255,255,0.05)'
                  }}
                >
                  <div>
                    <span className="font-semibold text-sm" style={{ display: 'block' }}>
                      Field-Level encryption active
                    </span>
                    <span className="text-muted text-xs">
                      Sensitive note fields are secured via AES-256-GCM.
                    </span>
                  </div>
                  <span
                    className="font-mono text-xs"
                    style={{ color: '#2ecc71', fontWeight: 'bold' }}
                  >
                    ACTIVE
                  </span>
                </div>

                <h4 className="font-semibold text-sm" style={{ margin: 0, marginTop: 8 }}>
                  Secure Backup Options
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <input
                      type="password"
                      placeholder="Backup Encryption Password (Optional)"
                      value={backupPassword}
                      onChange={(e) => setBackupPassword(e.target.value)}
                      style={{
                        flex: 1,
                        background: '#1a1a2e',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        color: '#fff',
                        padding: '8px 12px',
                        fontSize: '0.85rem'
                      }}
                    />
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 0'
                    }}
                  >
                    <div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 500, display: 'block' }}>
                        Incremental Differential Backup
                      </span>
                      <span style={{ fontSize: '0.75rem', color: '#a0aec0' }}>
                        Only backup data modified since last run.
                      </span>
                    </div>
                    <label className="toggle-switch">
                      <input
                        type="checkbox"
                        checked={isIncremental}
                        onChange={(e) => setIsIncremental(e.target.checked)}
                      />
                      <span className="slider" />
                    </label>
                  </div>

                  <div className="flex gap-4" style={{ marginTop: 8 }}>
                    <button
                      className="btn btn-primary"
                      onClick={handleBackupNow}
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                      <Download size={14} />
                      <span>Create Backup</span>
                    </button>
                    <button className="btn btn-secondary" onClick={() => openModal('backupConfig')}>
                      Restore History
                    </button>
                  </div>
                </div>
              </div>

              <AuditLogViewer />
            </div>
          </div>
        )}

        {/* Tab 2.5: Data Management */}
        {activeTab === 'data' && <DataManagement />}

        {/* Tab 3: AI Engine */}
        {activeTab === 'ai' && (
          <div className="flex flex-col gap-6" style={{ maxWidth: 480 }}>
            <h3 className="font-bold text-lg" style={{ fontSize: '20px' }}>
              Local AI Settings
            </h3>

            <div className="input-group">
              <span className="input-label">ACTIVE LOCAL MODEL (GGUF)</span>
              <select
                className="input-field"
                value={settings.ai.activeModel}
                onChange={(e) => updateSettings('ai', { activeModel: e.target.value })}
              >
                <option value="Llama-3-8B-Instruct-GGUF">
                  Llama-3-8B-Instruct.gguf (Recommended)
                </option>
                <option value="Mistral-7B-Instruct-v0.2-GGUF">Mistral-7B-Instruct-v0.2.gguf</option>
                <option value="Phi-3-mini-4k-instruct-GGUF">Phi-3-mini-4k-instruct.gguf</option>
              </select>
            </div>

            <div className="input-group">
              <div className="flex justify-between items-center">
                <span className="input-label">MODEL TEMPERATURE</span>
                <span className="font-mono text-muted text-sm">{settings.ai.temperature}</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.2"
                step="0.1"
                value={settings.ai.temperature}
                onChange={(e) => updateSettings('ai', { temperature: Number(e.target.value) })}
                style={{ accentColor: 'var(--color-secondary)', cursor: 'pointer' }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 12
              }}
            >
              <div>
                <span className="font-semibold text-sm" style={{ display: 'block' }}>
                  GPU Hardware Acceleration
                </span>
                <span className="text-muted text-sm">
                  Speeds up inference load times utilizing GPU
                </span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.ai.gpuAcceleration}
                  onChange={(e) => updateSettings('ai', { gpuAcceleration: e.target.checked })}
                />
                <span className="slider" />
              </label>
            </div>
          </div>
        )}

        {/* Tab 5: Appearance Custom CSS Injection */}
        {activeTab === 'appearance' && (
          <div className="flex flex-col gap-6" style={{ maxWidth: 540 }}>
            <h3 className="font-bold text-lg" style={{ fontSize: '20px' }}>
              Appearance Style Engine
            </h3>

            {/* High Contrast Toggle Switch */}
            <div
              style={{
                padding: 16,
                borderRadius: 10,
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface)'
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div>
                  <span className="font-semibold text-sm" style={{ display: 'block' }}>
                    High Contrast Theme
                  </span>
                  <span className="text-muted text-sm">
                    Enable high-contrast mode for accessibility.
                  </span>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={theme === 'high-contrast'}
                    onChange={(e) => setTheme(e.target.checked ? 'high-contrast' : 'dark')}
                  />
                  <span className="slider" />
                </label>
              </div>
            </div>

            {/* Standard Theme Selector Dropdown */}
            <div className="input-group">
              <span className="input-label">WORKSPACE THEME</span>
              <select
                className="input-field"
                value={theme}
                onChange={(e) => setTheme(e.target.value as any)}
                style={{ fontSize: '13px' }}
              >
                <option value="light">Light Mode</option>
                <option value="dark">Dark Mode</option>
                <option value="auto">Auto (System Default)</option>
                <option value="high-contrast">High Contrast Mode</option>
              </select>
            </div>

            <div className="input-group" style={{ marginTop: 8 }}>
              <span className="input-label">CUSTOM CSS OVERRIDES</span>
              <p className="text-muted text-sm" style={{ marginBottom: 8 }}>
                Inject styling rules globally into the workbench layout.
              </p>
              <textarea
                className="input-field font-mono"
                rows={8}
                placeholder="/* Example: body { font-family: monospace; } */"
                defaultValue={localStorage.getItem('cognitwin_custom_css') || ''}
                onChange={(e) => handleCustomCSSInject(e.target.value)}
                style={{ resize: 'vertical', fontSize: '12px' }}
              />
            </div>
          </div>
        )}

        {/* Tab 4.5: Automation Rules, DAG Workflows, and Macro Recorder */}
        {activeTab === 'automation' && (
          <div className="flex flex-col gap-6" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="font-bold text-lg" style={{ fontSize: '20px' }}>
                  Workbench Automation Engine
                </h3>
                <p className="text-muted text-sm">
                  Automate recurring actions, record macros, and configure DAG workflows.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-secondary" onClick={() => openModal('ruleBuilder')}>
                  + Add Rule
                </button>
                <button className="btn btn-primary" onClick={() => openModal('workflowEditor')}>
                  + Add Workflow
                </button>
              </div>
            </div>

            {/* Macro Recorder Control Widget */}
            <div
              style={{
                padding: 16,
                borderRadius: 10,
                border: '1px solid var(--border-color)',
                backgroundColor: 'rgba(230, 126, 34, 0.05)'
              }}
            >
              <h4
                style={{
                  fontSize: '14px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8
                }}
                className="text-accent"
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-accent)',
                    display: 'inline-block',
                    animation: isRecordingMacro ? 'pulse 1s infinite' : 'none'
                  }}
                />
                <span>Macro Sequence Recorder</span>
              </h4>
              <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
                Record note creation, tasks creation, and tag mappings and replay them instantly.
              </p>
              {isRecordingMacro ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span
                    style={{ fontSize: '12px', color: 'var(--color-accent)', fontWeight: 600 }}
                    className="animate-pulse"
                  >
                    🔴 Recording actions in progress...
                  </span>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleStopMacroRecording}
                    style={{ padding: '6px 12px', borderRadius: 6 }}
                  >
                    Stop & Save Macro
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Macro name (e.g. Daily Setup)..."
                    value={macroNameInput}
                    onChange={(e) => setMacroNameInput(e.target.value)}
                    style={{ maxWidth: 260, height: 32, borderRadius: 6, fontSize: '12px' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={handleStartMacroRecording}
                    disabled={!macroNameInput.trim()}
                    style={{ padding: '6px 12px', borderRadius: 6, fontSize: '12px' }}
                  >
                    Record Sequence
                  </button>
                </div>
              )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Rules List */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 10,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)'
                }}
              >
                <span
                  className="font-semibold text-sm"
                  style={{ display: 'block', marginBottom: 12 }}
                >
                  AUTOMATION RULES
                </span>

                {rules.length === 0 ? (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    No rules defined yet. Create your first rule above.
                  </span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {rules.map((rule) => (
                      <div
                        key={rule.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: 10,
                          borderRadius: 6,
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'rgba(0,0,0,0.1)'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>{rule.name}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            Trigger: {rule.trigger_event}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            className="btn btn-ghost"
                            onClick={() => handleToggleRule(rule)}
                            style={{
                              padding: '2px 8px',
                              fontSize: '11px',
                              color:
                                rule.is_active === 1 ? 'var(--color-success)' : 'var(--text-muted)'
                            }}
                          >
                            {rule.is_active === 1 ? 'Active' : 'Disabled'}
                          </button>
                          <button
                            className="btn btn-ghost"
                            onClick={() => openModal('ruleBuilder', rule)}
                            style={{ padding: 4 }}
                          >
                            ⚙️
                          </button>
                          <button
                            className="btn btn-ghost"
                            onClick={() => handleDeleteRule(rule.id)}
                            style={{ padding: 4 }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Workflows List */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 10,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)'
                }}
              >
                <span
                  className="font-semibold text-sm"
                  style={{ display: 'block', marginBottom: 12 }}
                >
                  DAG WORKFLOWS
                </span>

                {workflows.length === 0 ? (
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    No DAG workflows defined yet. Create your first workflow above.
                  </span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {workflows.map((wf) => (
                      <div
                        key={wf.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: 10,
                          borderRadius: 6,
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'rgba(0,0,0,0.1)'
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ fontSize: '13px', fontWeight: 600 }}>{wf.name}</span>
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                            Nodes: {JSON.parse(wf.nodes_json || '[]').length} nodes
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <button
                            className="btn btn-ghost"
                            onClick={() => handleToggleWorkflow(wf)}
                            style={{
                              padding: '2px 8px',
                              fontSize: '11px',
                              color:
                                wf.is_active === 1 ? 'var(--color-success)' : 'var(--text-muted)'
                            }}
                          >
                            {wf.is_active === 1 ? 'Active' : 'Disabled'}
                          </button>
                          <button
                            className="btn btn-ghost"
                            onClick={() => openModal('workflowEditor', wf)}
                            style={{ padding: 4 }}
                          >
                            ⚙️
                          </button>
                          <button
                            className="btn btn-ghost"
                            onClick={() => handleDeleteWorkflow(wf.id)}
                            style={{ padding: 4 }}
                          >
                            🗑️
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Macros List */}
            <div
              style={{
                padding: 16,
                borderRadius: 10,
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface)',
                marginTop: 8
              }}
            >
              <span
                className="font-semibold text-sm"
                style={{ display: 'block', marginBottom: 12 }}
              >
                RECORDED MACROS
              </span>
              {macros.length === 0 ? (
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  No macros recorded yet. Use the macro recorder above to capture actions.
                </span>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {macros.map((macro) => (
                    <div
                      key={macro.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: 10,
                        borderRadius: 6,
                        border: '1px solid var(--border-color)',
                        backgroundColor: 'rgba(0,0,0,0.1)'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: '13px', fontWeight: 600 }}>{macro.name}</span>
                        <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                          Steps: {JSON.parse(macro.steps_json || '[]').length} steps
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          className="btn btn-primary"
                          onClick={() => handlePlayMacro(macro.id)}
                          style={{ padding: '4px 10px', fontSize: '11px' }}
                        >
                          Replay Macro
                        </button>
                        <button
                          className="btn btn-ghost"
                          onClick={() => handleDeleteMacro(macro.id)}
                          style={{ padding: 4 }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4.8: External Integrations (IMAP/CalDAV/Chrome History) */}
        {activeTab === 'integrations' && (
          <div className="flex flex-col gap-6" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 className="font-bold text-lg" style={{ fontSize: '20px' }}>
                  Digital Life Integrations
                </h3>
                <p className="text-muted text-sm">
                  Connect external mail boxes, calendars, and local web browsers to index context.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSyncAllIntegrations}
                disabled={isSyncingAll}
                style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              >
                {isSyncingAll ? (
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      border: '2px solid var(--border-color)',
                      borderTopColor: 'var(--color-secondary)',
                      animation: 'spin 1s linear infinite'
                    }}
                  />
                ) : (
                  <span>🔄</span>
                )}
                <span>{isSyncingAll ? 'Synchronizing Feeds...' : 'Sync All Feeds'}</span>
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* Linked Accounts */}
              <div
                style={{
                  padding: 16,
                  borderRadius: 10,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)'
                }}
              >
                <span
                  className="font-semibold text-sm"
                  style={{ display: 'block', marginBottom: 12 }}
                >
                  CONNECTED ACCOUNTS
                </span>

                {integrationAccounts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        display: 'block',
                        marginBottom: 8
                      }}
                    >
                      No external accounts linked yet.
                    </span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      Configure an IMAP or CalDAV account to start indexing messages and calendar
                      tasks.
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {integrationAccounts.map((acc) => (
                      <div
                        key={acc.id}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: 12,
                          borderRadius: 6,
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'rgba(0,0,0,0.1)'
                        }}
                      >
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                          <span style={{ fontSize: '18px' }}>
                            {acc.type === 'imap' ? '✉️' : '📅'}
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <span style={{ fontSize: '13px', fontWeight: 600 }}>{acc.name}</span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Type: {acc.type.toUpperCase()} | User: {acc.username}
                            </span>
                            {acc.last_synced_at && (
                              <span style={{ fontSize: '9px', color: 'var(--color-success)' }}>
                                Last synced: {acc.last_synced_at}
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          className="btn btn-ghost"
                          onClick={() => handleDeleteIntegrationAccount(acc.id)}
                          style={{ padding: 6 }}
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add New Integration Config */}
              <form
                onSubmit={handleSaveIntegrationAccount}
                style={{
                  padding: 16,
                  borderRadius: 10,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12
                }}
              >
                <span className="font-semibold text-sm" style={{ display: 'block' }}>
                  LINK EXTERNAL ACCOUNT
                </span>

                <div className="input-group">
                  <span className="input-label">ACCOUNT TYPE</span>
                  <select
                    className="input-field"
                    value={integrationType}
                    onChange={(e) => setIntegrationType(e.target.value as any)}
                    style={{ height: 34, fontSize: '12px' }}
                  >
                    <option value="imap">Email Inbox (IMAP Client)</option>
                    <option value="caldav">Calendar Schedule (CalDAV Server)</option>
                  </select>
                </div>

                <div className="input-group">
                  <span className="input-label">LABEL NAME</span>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="e.g. Personal Gmail"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    style={{ height: 34, fontSize: '12px' }}
                    required
                  />
                </div>

                <div className="input-group">
                  <span className="input-label">USERNAME / ADDRESS</span>
                  <input
                    type="email"
                    className="input-field"
                    placeholder="e.g. user@gmail.com"
                    value={accountUser}
                    onChange={(e) => setAccountUser(e.target.value)}
                    style={{ height: 34, fontSize: '12px' }}
                    required
                  />
                </div>

                {integrationType === 'imap' ? (
                  <div className="input-group">
                    <span className="input-label">IMAP SERVER HOST</span>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="imap.gmail.com"
                      value={configHost}
                      onChange={(e) => setConfigHost(e.target.value)}
                      style={{ height: 34, fontSize: '12px' }}
                      required
                    />
                  </div>
                ) : (
                  <div className="input-group">
                    <span className="input-label">CALDAV CALENDAR URL</span>
                    <input
                      type="url"
                      className="input-field"
                      placeholder="https://calendar.google.com/dav/..."
                      value={configUrl}
                      onChange={(e) => setConfigUrl(e.target.value)}
                      style={{ height: 34, fontSize: '12px' }}
                      required
                    />
                  </div>
                )}

                <button type="submit" className="btn btn-primary" style={{ marginTop: 8 }}>
                  Link Connection
                </button>
              </form>
            </div>

            {/* Local Browser Ingestion Module */}
            <div
              style={{
                padding: 16,
                borderRadius: 10,
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface)'
              }}
            >
              <span className="font-semibold text-sm" style={{ display: 'block', marginBottom: 6 }}>
                LOCAL WEB BROWSER INTEGRATION
              </span>
              <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
                CogniTwin automatically reads and indexes active Chrome/Firefox local profile
                histories so you can search previously visited web research links inside your twin
                workbench.
              </p>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 12,
                  borderRadius: 6,
                  backgroundColor: 'rgba(52, 152, 219, 0.05)',
                  border: '1px dashed rgba(52, 152, 219, 0.2)'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: '12px', fontWeight: 600 }}>
                    Google Chrome Local History File
                  </span>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    Status: Active (Automatic Copy & Index bypass lock)
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', borderRadius: 6, fontSize: '12px' }}
                  onClick={handleSyncAllIntegrations}
                >
                  Sync History Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 6: System Status Gauges */}
        {activeTab === 'system' && (
          <div className="flex flex-col gap-6">
            <h3 className="font-bold text-lg" style={{ fontSize: '20px' }}>
              System Diagnostics
            </h3>

            {systemMetrics ? (
              <div
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 12 }}
              >
                {/* CPU usage */}
                <div
                  style={{
                    padding: 20,
                    borderRadius: 10,
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-surface)'
                  }}
                >
                  <span
                    className="font-semibold text-sm flex items-center gap-2"
                    style={{ marginBottom: 12 }}
                  >
                    <Cpu size={16} />
                    <span>CPU STATUS</span>
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <span>
                      Model: <strong>{systemMetrics.cpu.model}</strong>
                    </span>
                    <span>
                      Cores: <strong>{systemMetrics.cpu.cores} cores</strong>
                    </span>
                    <span>
                      Load Avg: <strong>{(systemMetrics.cpu.load * 100).toFixed(1)}%</strong>
                    </span>
                  </div>
                </div>

                {/* Memory usage progress bar gauge */}
                <div
                  style={{
                    padding: 20,
                    borderRadius: 10,
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-surface)'
                  }}
                >
                  <span
                    className="font-semibold text-sm flex items-center gap-2"
                    style={{ marginBottom: 12 }}
                  >
                    <LayoutGrid size={16} />
                    <span>MEMORY UTILITY</span>
                  </span>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '12px',
                      marginBottom: 6
                    }}
                    className="font-mono text-muted flex"
                  >
                    <span>RAM PERCENTAGE</span>
                    <span style={{ float: 'right' }}>
                      {systemMetrics.memory.percentage.toFixed(1)}%
                    </span>
                  </div>

                  <div
                    style={{
                      width: '100%',
                      height: 8,
                      backgroundColor: 'var(--border-color)',
                      borderRadius: 4,
                      overflow: 'hidden',
                      marginBottom: 12
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${systemMetrics.memory.percentage}%`,
                        backgroundColor:
                          systemMetrics.memory.percentage > 85
                            ? 'var(--color-error)'
                            : 'var(--color-secondary)',
                        borderRadius: 4
                      }}
                    />
                  </div>
                  <div style={{ fontSize: '12px' }} className="text-muted">
                    Total: {(systemMetrics.memory.total / (1024 * 1024 * 1024)).toFixed(1)} GB |
                    Used: {(systemMetrics.memory.used / (1024 * 1024 * 1024)).toFixed(1)} GB
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{ display: 'flex', alignItems: 'center', gap: 12 }}
                className="text-muted"
              >
                <AlertCircle size={18} />
                <span>Loading desktop hardware parameters...</span>
              </div>
            )}
          </div>
        )}

        {/* Tab: Plugins */}
        {activeTab === 'plugins' && <PluginManager />}

        {/* Tab: Developer */}
        {activeTab === 'developer' && <ScriptingConsole />}

        {/* Tab 7: About */}
        {activeTab === 'about' && (
          <div
            className="flex flex-col gap-4"
            style={{ textAlign: 'center', alignItems: 'center', padding: '20px 0' }}
          >
            <div
              style={{
                width: 54,
                height: 54,
                border: '3px solid var(--color-secondary)',
                borderRadius: '8px',
                transform: 'rotate(45deg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-secondary)',
                marginBottom: 16
              }}
            >
              <div
                style={{
                  width: 26,
                  height: 26,
                  border: '2px solid var(--color-accent)',
                  borderRadius: '4px',
                  transform: 'rotate(-45deg)'
                }}
              />
            </div>

            <h4 className="font-bold text-lg">CogniTwin Desktop Workbench</h4>
            <span className="font-mono text-muted text-sm">Version 1.0.0 (Phase 1 build)</span>
            <p
              className="text-muted"
              style={{ maxWidth: 360, fontSize: '13px', lineHeight: '1.5', marginTop: 8 }}
            >
              Built locally-first for Windows. Employs neural embeddings, offline LLMs, and secure
              credential storage APIs.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
