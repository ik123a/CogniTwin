import React, { useEffect, useState } from 'react'
import AppShell from './components/AppShell'
import ModalsContainer from './components/ModalsContainer'

// Import View Pages
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Workspace from './pages/Workspace'
import Inbox from './pages/Inbox'
import KnowledgeGraph from './pages/KnowledgeGraph'
import Analytics from './pages/Analytics'
import SettingsPage from './pages/Settings'
import UnifiedSearch from './pages/UnifiedSearch'
import KnowledgeTimeline from './pages/KnowledgeTimeline'
import LearningHub from './pages/LearningHub'
import ExpertiseProfile from './pages/ExpertiseProfile'
import Simulation from './pages/Simulation'

// Import Components
import CommandPalette from './components/CommandPalette'
import QuickCapture from './components/QuickCapture'

// Import Stores
import { useAuthStore } from './stores/authStore'
import { useThemeStore } from './stores/themeStore'
import { useNavigationStore } from './stores/navigationStore'
import { useModalStore } from './stores/modalStore'
import { useHistoryStore } from './stores/historyStore'

export default function App(): React.JSX.Element {
  const { isAuthenticated } = useAuthStore()
  const { initTheme } = useThemeStore()
  const { currentView } = useNavigationStore()
  const { openModal } = useModalStore()

  // Auxiliary route detection
  const [isAuxiliary, setIsAuxiliary] = useState(false)
  const [auxRoute, setAuxRoute] = useState('')

  useEffect(() => {
    const handleHashChange = (): void => {
      const hash = window.location.hash
      if (hash && (hash.startsWith('#/') || hash.startsWith('#'))) {
        setIsAuxiliary(true)
        const route = hash.startsWith('#/') ? hash.slice(2) : hash.slice(1)
        setAuxRoute(route)
      } else {
        setIsAuxiliary(false)
        setAuxRoute('')
      }
    }

    handleHashChange()
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  // Initialize theme and global key listeners
  useEffect(() => {
    initTheme()

    const handleKeyDown = (e: KeyboardEvent): void => {
      // Global Quick Capture: Ctrl+Shift+C (Cmd+Shift+C on macOS)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'c') {
        e.preventDefault()
        openModal('quickCapture')
      }

      // Undo: Ctrl+Z
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        // Only run if not typing in editable element (optional, but global undo is requested)
        const target = e.target as HTMLElement
        if (
          target &&
          (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
        ) {
          // If in editor, still let it bubble or handle if it's our rich editor.
          // Let's do preventDefault to use our global undo stack
          e.preventDefault()
          useHistoryStore.getState().undo()
        } else {
          e.preventDefault()
          useHistoryStore.getState().undo()
        }
      }

      // Redo: Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        useHistoryStore.getState().redo()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Helper to mount the active page view
  const renderActiveView = (viewName: string): React.JSX.Element => {
    switch (viewName) {
      case 'dashboard':
        return <Dashboard />
      case 'workspace':
        return <Workspace />
      case 'inbox':
        return <Inbox />
      case 'knowledge':
        return <KnowledgeGraph />
      case 'analytics':
        return <Analytics />
      case 'settings':
        return <SettingsPage />
      case 'search':
        return <UnifiedSearch />
      case 'timeline':
        return <KnowledgeTimeline />
      case 'learning':
        return <LearningHub />
      case 'expertise':
        return <ExpertiseProfile />
      case 'simulation':
        return <Simulation />
      default:
        return <Dashboard />
    }
  }

  // If auxiliary route is detected, render standard single view
  if (isAuxiliary) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          padding: 24,
          backgroundColor: 'var(--bg-app)'
        }}
      >
        {renderActiveView(auxRoute)}
        <ModalsContainer />
      </div>
    )
  }

  // 1. If not authenticated, render Login view (covers registration and unlocking)
  if (!isAuthenticated) {
    return (
      <>
        <Login />
        <ModalsContainer />
      </>
    )
  }

  // 2. If authenticated and in onboarding flow, render Onboarding wizard
  if (currentView === 'onboarding') {
    return (
      <>
        <Onboarding />
        <ModalsContainer />
      </>
    )
  }

  // 3. Render page wrapped inside the app shell
  return (
    <>
      <AppShell>{renderActiveView(currentView)}</AppShell>
      <ModalsContainer />
      <CommandPalette />
      <QuickCapture />
    </>
  )
}
