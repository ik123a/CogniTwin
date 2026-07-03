import React from 'react'
import TitleBar from './TitleBar'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { useWorkspaceStore } from '../stores/workspaceStore'

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps): React.JSX.Element {
  const { currentWorkspace, currentProject } = useWorkspaceStore()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        width: '100vw',
        overflow: 'hidden'
      }}
    >
      {/* 1. Custom Frameless TitleBar */}
      <TitleBar />

      <div className="app-shell">
        <div className="app-container">
          {/* 2. Collapsible Navigation Sidebar */}
          <Sidebar />

          {/* 3. Main Workspace Area */}
          <div className="app-main">
            {/* Header Toolbar */}
            <TopBar />

            {/* Dynamic View Panel */}
            <div className="content-pane">{children}</div>

            {/* 4. Desktop Status Bar */}
            <div className="status-bar">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span>
                  Workspace: <strong>{currentWorkspace?.name || 'Default'}</strong>
                </span>
                {currentProject && (
                  <>
                    <span style={{ color: 'var(--text-muted)' }}>|</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: currentProject.color
                        }}
                      />
                      Project: <strong>{currentProject.name}</strong>
                    </span>
                  </>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <span>
                  Local Core Status:{' '}
                  <strong style={{ color: 'var(--color-success)' }}>ONLINE</strong>
                </span>
                <span>DB Latency: 1ms</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
