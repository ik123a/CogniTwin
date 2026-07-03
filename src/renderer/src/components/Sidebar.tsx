import React, { useState } from 'react'
import { useNavigationStore, ViewType } from '../stores/navigationStore'
import { useAuthStore } from '../stores/authStore'
import { useDashboardStore } from '../stores/dashboardStore'
import { useModalStore } from '../stores/modalStore'
import { usePrivacyStore } from '../stores/privacyStore'
import {
  LayoutDashboard,
  FolderKanban,
  Inbox,
  Network,
  BarChart3,
  Settings,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  History,
  GraduationCap,
  BookOpen,
  Award,
  Cpu
} from 'lucide-react'

export default function Sidebar(): React.JSX.Element {
  const { currentView, setView } = useNavigationStore()
  const { currentUser, logout } = useAuthStore()
  const { energyLevel } = useDashboardStore()
  const { openModal } = useModalStore()
  const { privacyMode, togglePrivacy } = usePrivacyStore()
  const [collapsed, setCollapsed] = useState(false)

  const navItems = [
    { view: 'dashboard' as ViewType, label: 'Dashboard', icon: LayoutDashboard },
    { view: 'workspace' as ViewType, label: 'Workspace', icon: FolderKanban },
    { view: 'inbox' as ViewType, label: 'Inbox', icon: Inbox },
    { view: 'knowledge' as ViewType, label: 'Knowledge', icon: Network },
    { view: 'timeline' as ViewType, label: 'Timeline', icon: History },
    { view: 'learning' as ViewType, label: 'Learning', icon: GraduationCap },
    { view: 'expertise' as ViewType, label: 'Expertise', icon: Award },
    { view: 'analytics' as ViewType, label: 'Analytics', icon: BarChart3 },
    { view: 'simulation' as ViewType, label: 'Twin Simulation', icon: Cpu },
    { view: 'settings' as ViewType, label: 'Settings', icon: Settings }
  ]

  return (
    <div
      className={`app-sidebar ${collapsed ? 'collapsed' : ''}`}
      style={
        privacyMode
          ? {
              boxShadow: 'inset 0 0 10px rgba(46, 204, 113, 0.2)',
              borderRight: '1px solid rgba(46, 204, 113, 0.3)'
            }
          : undefined
      }
    >
      <div className="sidebar-header">
        {!collapsed && (
          <div className="sidebar-logo">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--color-secondary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4.5 16.5c-1.5 1.26-2.5 3.19-2.5 5.5h20c0-2.31-1-4.24-2.5-5.5" />
              <path d="M12 2C6.5 2 2 6.5 2 12c0 2.24.78 4.29 2.1 5.92L12 10l7.9 7.92c1.32-1.63 2.1-3.68 2.1-5.92 0-5.5-4.5-10-10-10z" />
            </svg>
            <span style={{ letterSpacing: '0.5px' }}>CogniTwin</span>
          </div>
        )}
        <button
          className="btn-ghost"
          style={{ padding: 4, borderRadius: 4, cursor: 'pointer' }}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      <div className="sidebar-nav">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = currentView === item.view
          return (
            <div
              key={item.view}
              className={`sidebar-item ${isActive ? 'active' : ''}`}
              onClick={() => setView(item.view)}
              title={collapsed ? item.label : undefined}
            >
              <Icon size={18} />
              {!collapsed && <span>{item.label}</span>}
            </div>
          )
        })}

        {/* Local AI Copilot Chat Trigger */}
        <div
          className="sidebar-item"
          onClick={() => openModal('aiQuery')}
          title={collapsed ? 'Copilot Chat' : undefined}
          style={{ marginTop: 24, borderTop: '1px solid var(--border-color)', paddingTop: 12 }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-accent animate-pulse"
          >
            <path d="M12 2a10 10 0 0 1 7.54 16.59c-.24.28-.34.66-.27 1.03l.6 3.1c.1.51-.4.93-.88.73l-3.32-1.39a1 1 0 0 0-.75.05A9.97 9.97 0 0 1 12 22a10 10 0 0 1 0-20z" />
            <path d="M8 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
            <path d="M16 11.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
            <path d="M12 16a3 3 0 0 0 2.5-1.5H9.5A3 3 0 0 0 12 16z" />
          </svg>
          {!collapsed && (
            <span style={{ color: 'var(--color-accent)', fontWeight: 600 }}>Copilot Chat</span>
          )}
        </div>

        {/* Flashcard Study Trigger */}
        <div
          className="sidebar-item"
          onClick={() => openModal('spacedRepetition' as any)}
          title={collapsed ? 'Study Flashcards' : undefined}
          style={{ marginTop: 8 }}
        >
          <BookOpen size={18} className="text-secondary" />
          {!collapsed && (
            <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>Study Cards</span>
          )}
        </div>
      </div>

      <div className="sidebar-footer">
        {/* Privacy Mode Indicator Icon */}
        <div
          className="sidebar-item"
          onClick={togglePrivacy}
          title={collapsed ? (privacyMode ? 'Privacy Mode Active' : 'Privacy Mode Off') : undefined}
          style={{
            marginBottom: 8,
            cursor: 'pointer',
            padding: '8px 12px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            backgroundColor: privacyMode ? 'rgba(231, 76, 60, 0.08)' : 'transparent',
            border: privacyMode ? '1px solid rgba(231, 76, 60, 0.2)' : '1px solid transparent'
          }}
        >
          {privacyMode ? (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#e74c3c"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="animate-pulse"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            </svg>
          ) : (
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#2ecc71"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          )}
          {!collapsed && (
            <span
              style={{
                color: privacyMode ? '#e74c3c' : '#2ecc71',
                fontWeight: 600,
                fontSize: '13px'
              }}
            >
              {privacyMode ? 'Privacy Active' : 'Privacy Mode'}
            </span>
          )}
        </div>

        <div className="user-profile">
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              backgroundColor: 'var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-main)'
            }}
          >
            <User size={16} />
          </div>
          {!collapsed && (
            <div className="user-details" style={{ flex: 1 }}>
              <span className="user-name">{currentUser?.name || 'User'}</span>
              <div className="user-metrics">
                <span>Score: 87%</span>
                <span
                  style={{
                    color:
                      energyLevel === 'High'
                        ? 'var(--color-success)'
                        : energyLevel === 'Medium'
                          ? 'var(--color-warning)'
                          : 'var(--color-error)'
                  }}
                >
                  ⚡ {energyLevel}
                </span>
              </div>
            </div>
          )}
          {!collapsed && (
            <button
              className="btn-ghost"
              onClick={logout}
              title="Logout"
              style={{ padding: 4, borderRadius: 4 }}
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
