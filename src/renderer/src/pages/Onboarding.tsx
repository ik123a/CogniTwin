import React, { useState } from 'react'
import { useNavigationStore } from '../stores/navigationStore'
import { useThemeStore } from '../stores/themeStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { Sun, Moon, Monitor, Folder, Mail, Calendar, Globe, FileText, Check } from 'lucide-react'

export default function Onboarding(): React.JSX.Element {
  const { setView } = useNavigationStore()
  const { theme, setTheme, fontSize, setFontSize } = useThemeStore()
  const { createWorkspace, createProject } = useWorkspaceStore()

  const [step, setStep] = useState(1)
  const [workspaceName, setWorkspaceName] = useState('My Twin Core')

  // Data ingestion selections
  const [sources, setSources] = useState({
    email: true,
    files: true,
    calendar: true,
    browser: false,
    notes: true,
    messages: false,
    voice: false,
    images: false
  })

  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(0)

  const handleSourceToggle = (key: keyof typeof sources): void => {
    setSources({ ...sources, [key]: !sources[key] })
  }

  const handleNextStep = async (): Promise<void> => {
    if (step < 3) {
      setStep(step + 1)
    } else if (step === 3) {
      // Step 3 -> Step 4 starts processing ingestion simulation
      setStep(4)
      setIsProcessing(true)

      // Initialize workspace and project structures in database
      try {
        const ws = await createWorkspace(workspaceName)
        // Create two default projects: Work and Personal
        await createProject(
          'Project Alpha (Work)',
          'Work tasks and note records',
          '#3498db',
          'briefcase'
        )
        await createProject(
          'Personal Life (Home)',
          'Personal logs and habit patterns',
          '#2ecc71',
          'home'
        )

        // Write mock audit log for onboarding completion
        await window.api.audit.log('ONBOARDING_INIT', 'system', undefined, { workspaceName })
      } catch (err) {
        console.error('Failed to configure initial workspace:', err)
      }

      // Simulate parsing data and building embeddings
      let currentProgress = 0
      const interval = setInterval(() => {
        currentProgress += 5
        setProgress(currentProgress)
        if (currentProgress >= 100) {
          clearInterval(interval)
          setIsProcessing(false)
        }
      }, 150)
    }
  }

  const handleBackStep = (): void => {
    if (step > 1) {
      setStep(step - 1)
    }
  }

  const handleFinish = (): void => {
    setView('dashboard')
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        backgroundColor: 'var(--bg-app)',
        padding: 24,
        position: 'relative'
      }}
    >
      {/* Progress Indicators */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 40, width: '100%', maxWidth: 600 }}>
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor: step >= s ? 'var(--color-secondary)' : 'var(--border-color)',
              transition: 'background-color var(--transition-normal)'
            }}
          />
        ))}
      </div>

      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: 640,
          minHeight: 440,
          padding: '40px 48px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        {/* STEP 1: Introduction */}
        {step === 1 && (
          <div className="flex flex-col items-center" style={{ textAlign: 'center', flex: 1 }}>
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                backgroundColor: 'rgba(52, 152, 219, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--color-secondary)',
                marginBottom: 24,
                animation: 'pulse 2s infinite'
              }}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
            </div>
            <h2 className="font-bold" style={{ fontSize: '28px', marginBottom: 16 }}>
              Your digital twin is ready.
            </h2>
            <p
              className="text-muted"
              style={{ lineHeight: '1.6', fontSize: '15px', maxWidth: 480 }}
            >
              CogniTwin scans, catalogs, and connects your files, calendar notes, emails, and
              browsing history. Everything is encrypted locally and remains entirely private on your
              device.
            </p>
          </div>
        )}

        {/* STEP 2: Preferences */}
        {step === 2 && (
          <div className="flex flex-col gap-4" style={{ flex: 1 }}>
            <h3 className="font-bold text-lg" style={{ fontSize: '22px', marginBottom: 12 }}>
              Configure Workbench Preferences
            </h3>

            <div className="input-group" style={{ marginBottom: 12 }}>
              <span className="input-label">DEFAULT WORKSPACE NAME</span>
              <input
                type="text"
                className="input-field"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
              />
            </div>

            <span className="input-label">THEME</span>
            <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
              {[
                { name: 'dark', label: 'Dark', icon: Moon },
                { name: 'light', label: 'Light', icon: Sun },
                { name: 'auto', label: 'System', icon: Monitor }
              ].map((t) => {
                const Icon = t.icon
                const isSelected = theme === t.name
                return (
                  <button
                    key={t.name}
                    className="btn"
                    onClick={() => setTheme(t.name as any)}
                    style={{
                      flex: 1,
                      border: isSelected
                        ? '2px solid var(--color-secondary)'
                        : '1px solid var(--border-color)',
                      backgroundColor: isSelected
                        ? 'rgba(52, 152, 219, 0.05)'
                        : 'var(--bg-surface)',
                      color: 'var(--text-main)'
                    }}
                  >
                    <Icon size={16} />
                    <span>{t.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="input-group">
              <div className="flex justify-between items-center">
                <span className="input-label">TEXT SIZE</span>
                <span className="font-mono text-muted text-sm">{fontSize}px</span>
              </div>
              <input
                type="range"
                min="12"
                max="20"
                step="1"
                value={fontSize}
                onChange={(e) => setFontSize(Number(e.target.value))}
                style={{
                  width: '100%',
                  accentColor: 'var(--color-secondary)',
                  cursor: 'pointer'
                }}
              />
            </div>
          </div>
        )}

        {/* STEP 3: Data Import */}
        {step === 3 && (
          <div className="flex flex-col gap-4" style={{ flex: 1 }}>
            <h3 className="font-bold text-lg" style={{ fontSize: '22px', marginBottom: 6 }}>
              Enable Automatic Local Ingestion
            </h3>
            <p className="text-muted text-sm" style={{ marginBottom: 12 }}>
              Choose which digital footprints you want to sync into your personal knowledge base.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              {[
                { key: 'files', label: 'Local Files (Folders)', icon: Folder },
                { key: 'email', label: 'Email Accounts', icon: Mail },
                { key: 'calendar', label: 'Calendars', icon: Calendar },
                { key: 'notes', label: 'Import Notes (MD, Notion)', icon: FileText }
              ].map((src) => {
                const Icon = src.icon
                const isChecked = sources[src.key as keyof typeof sources]
                return (
                  <div
                    key={src.key}
                    onClick={() => handleSourceToggle(src.key as keyof typeof sources)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 16px',
                      borderRadius: 10,
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-surface)',
                      cursor: 'pointer',
                      transition: 'border-color var(--transition-fast)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <Icon size={18} className="text-muted" />
                      <span className="text-sm font-semibold">{src.label}</span>
                    </div>
                    <label className="toggle-switch" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleSourceToggle(src.key as keyof typeof sources)}
                      />
                      <span className="slider" />
                    </label>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* STEP 4: First Look Preview */}
        {step === 4 && (
          <div className="flex flex-col items-center" style={{ textAlign: 'center', flex: 1 }}>
            <h3 className="font-bold" style={{ fontSize: '24px', marginBottom: 12 }}>
              {isProcessing
                ? 'Scaffolding database & scanning indices...'
                : 'Your Workbench is ready!'}
            </h3>
            <p className="text-muted text-sm" style={{ marginBottom: 32 }}>
              {isProcessing
                ? 'Building knowledge graphs, setting local encryption buffers, and loading LLM structures...'
                : 'Scaffold successfully completed. Welcome to your personal digital twin.'}
            </p>

            <div style={{ width: '100%', maxWidth: 400, marginBottom: 20 }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 6,
                  fontSize: '12px'
                }}
                className="font-mono text-muted"
              >
                <span>PROGRESS</span>
                <span style={{ float: 'right' }}>{progress}%</span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: 8,
                  backgroundColor: 'var(--border-color)',
                  borderRadius: 4,
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progress}%`,
                    backgroundColor: 'var(--color-secondary)',
                    borderRadius: 4,
                    transition: 'width 0.15s ease-out'
                  }}
                />
              </div>
            </div>

            {!isProcessing && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  backgroundColor: 'rgba(46, 204, 113, 0.1)',
                  color: 'var(--color-success)',
                  marginBottom: 24
                }}
              >
                <Check size={24} />
              </div>
            )}
          </div>
        )}

        {/* Controls Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
          {step > 1 && step < 4 ? (
            <button className="btn btn-secondary" onClick={handleBackStep}>
              Back
            </button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <button className="btn btn-primary" onClick={handleNextStep}>
              Continue
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleFinish} disabled={isProcessing}>
              Enter CogniTwin
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
