import React, { useEffect } from 'react'
import { Search, Plus, Bell, Sun, Moon } from 'lucide-react'
import { useModalStore } from '../stores/modalStore'
import { useThemeStore } from '../stores/themeStore'
import { useNavigationStore } from '../stores/navigationStore'
import { useEntityStore } from '../stores/entityStore'

export default function TopBar(): React.JSX.Element {
  const { openModal } = useModalStore()
  const { theme, setTheme } = useThemeStore()
  const { currentView } = useNavigationStore()
  const { indexStatus, fetchIndexStatus, setIndexProgress } = useEntityStore()

  useEffect(() => {
    fetchIndexStatus()
    // Hook up real-time IPC progress listener
    const unsubscribe = window.api.intelligence.onIndexProgress((data) => {
      setIndexProgress(data.processed, data.total)
    })
    return () => {
      unsubscribe()
    }
  }, [])

  const handleSearchClick = (): void => {
    // Open Command Palette modal
    openModal('quickCapture', { mode: 'search' }) // Open capture modal in search mode
  }

  const handleQuickCapture = (): void => {
    openModal('quickCapture')
  }

  const handleToggleTheme = (): void => {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  const handleNotifications = (): void => {
    openModal('notificationCenter')
  }

  const getPageTitle = (): string => {
    switch (currentView) {
      case 'dashboard':
        return 'Productivity Twin Dashboard'
      case 'workspace':
        return 'Personal Workbench'
      case 'inbox':
        return 'Unified Smart Inbox'
      case 'knowledge':
        return 'Personal Knowledge Graph'
      case 'analytics':
        return 'Cognitive Analytics'
      case 'settings':
        return 'System Settings'
      default:
        return 'CogniTwin'
    }
  }

  return (
    <div className="top-bar">
      <div className="top-bar-left">
        <h1 className="font-semibold text-lg" style={{ letterSpacing: '0.2px' }}>
          {getPageTitle()}
        </h1>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border-color)',
            borderRadius: 8,
            padding: '6px 12px',
            width: 320,
            cursor: 'pointer'
          }}
          onClick={handleSearchClick}
        >
          <Search size={16} className="text-muted" />
          <span className="text-muted text-sm" style={{ flex: 1 }}>
            Search everything...
          </span>
          <kbd
            style={{
              fontSize: '10px',
              backgroundColor: 'var(--border-color)',
              padding: '2px 6px',
              borderRadius: 4,
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-sans)',
              fontWeight: 600
            }}
          >
            Ctrl + K
          </kbd>
        </div>
        {indexStatus.isIndexing && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 16 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                border: '2px solid var(--border-color)',
                borderTopColor: 'var(--color-secondary)',
                animation: 'spin 1s linear infinite'
              }}
            />
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }} className="font-mono">
              AI Indexing ({indexStatus.processedItems}/{indexStatus.totalItems})
            </span>
          </div>
        )}
      </div>

      <div className="top-bar-right">
        <button
          className="btn btn-primary"
          style={{ padding: '8px 12px', borderRadius: 8 }}
          onClick={handleQuickCapture}
          title="Quick Capture (Ctrl+Shift+C)"
        >
          <Plus size={16} />
          <span className="text-sm">Capture</span>
        </button>

        <button
          className="btn btn-ghost"
          style={{ padding: 8, borderRadius: 8 }}
          onClick={handleNotifications}
          title="Notifications"
        >
          <Bell size={18} />
        </button>

        <button
          className="btn btn-ghost"
          style={{ padding: 8, borderRadius: 8 }}
          onClick={handleToggleTheme}
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`}
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </div>
  )
}
