import React, { useEffect, useRef } from 'react'
import { useCommandPaletteStore } from '../stores/commandPaletteStore'
import {
  LayoutDashboard,
  FolderKanban,
  Inbox,
  Network,
  BarChart3,
  Settings,
  Sparkles,
  FileText,
  CheckSquare,
  File,
  Database,
  Search,
  CornerDownLeft,
  X,
  Zap
} from 'lucide-react'

export default function CommandPalette(): React.JSX.Element | null {
  const {
    isOpen,
    searchTerm,
    selectedIndex,
    results,
    close,
    toggle,
    setSearchTerm,
    navigateResults,
    executeSelected
  } = useCommandPaletteStore()

  const inputRef = useRef<HTMLInputElement>(null)

  // Bind global hotkey Ctrl+K / Cmd+K
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [toggle])

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      navigateResults('down')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      navigateResults('up')
    } else if (e.key === 'Enter') {
      e.preventDefault()
      executeSelected()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  const getIcon = (iconType?: string): React.JSX.Element => {
    switch (iconType) {
      case 'dashboard':
        return <LayoutDashboard size={15} className="text-secondary" />
      case 'workspace':
        return <FolderKanban size={15} className="text-secondary" />
      case 'inbox':
        return <Inbox size={15} className="text-secondary" />
      case 'knowledge':
        return <Network size={15} className="text-secondary" />
      case 'analytics':
        return <BarChart3 size={15} className="text-secondary" />
      case 'settings':
        return <Settings size={15} className="text-secondary" />
      case 'note':
        return <FileText size={15} style={{ color: 'var(--color-secondary)' }} />
      case 'task':
        return <CheckSquare size={15} style={{ color: 'var(--color-success)' }} />
      case 'file':
        return <File size={15} style={{ color: 'var(--color-accent)' }} />
      case 'inbox_item':
        return <Inbox size={15} style={{ color: 'var(--color-warning)' }} />
      case 'action':
        return <Zap size={15} style={{ color: 'var(--color-accent)' }} />
      default:
        return <Database size={15} className="text-muted" />
    }
  }

  // Group the items by category to display sections
  const categories: { [key: string]: typeof results } = {}
  results.forEach((item) => {
    const cat = item.category
    if (!categories[cat]) {
      categories[cat] = []
    }
    categories[cat].push(item)
  })

  return (
    <div
      className="modal-overlay"
      style={{
        alignItems: 'flex-start',
        paddingTop: '12vh',
        zIndex: 9999,
        backgroundColor: 'rgba(10, 10, 12, 0.65)',
        backdropFilter: 'blur(8px)'
      }}
      onClick={close}
    >
      <div
        className="modal-content glass"
        style={{
          maxWidth: 640,
          width: '100%',
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-card)'
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '14px 18px',
            borderBottom: '1px solid var(--border-color)'
          }}
        >
          <Search size={18} className="text-muted" style={{ marginRight: 10 }} />
          <input
            ref={inputRef}
            type="text"
            className="input-field"
            placeholder="Type command, page name, or search notes & tasks..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '15px',
              padding: 0,
              flex: 1,
              outline: 'none',
              boxShadow: 'none',
              color: 'var(--text-main)'
            }}
          />
          <button className="btn-ghost" onClick={close} style={{ padding: 4, borderRadius: 4 }}>
            <X size={16} />
          </button>
        </div>

        {/* Info Toolbar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 18px',
            backgroundColor: 'rgba(255,255,255,0.02)',
            borderBottom: '1px solid var(--border-color)',
            fontSize: '11px',
            color: 'var(--text-muted)'
          }}
        >
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Sparkles size={11} className="text-secondary" /> Fuzzy Vector Search Enabled
            </span>
          </div>
          <span className="font-mono" style={{ fontSize: '10px' }}>
            ↑↓ to navigate • ↵ to select • ESC to close
          </span>
        </div>

        {/* Search results list */}
        <div style={{ maxHeight: 360, overflowY: 'auto', padding: '8px' }}>
          {results.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '32px 0',
                color: 'var(--text-muted)'
              }}
            >
              <Search size={24} style={{ marginBottom: 8, opacity: 0.4 }} />
              <span className="text-sm">No results match your query</span>
            </div>
          ) : (
            Object.entries(categories).map(([categoryName, categoryItems]) => (
              <div key={categoryName} style={{ marginBottom: 8 }}>
                <div
                  style={{
                    padding: '6px 12px',
                    fontSize: '10px',
                    textTransform: 'uppercase',
                    color: 'var(--color-secondary)',
                    fontWeight: 700,
                    letterSpacing: '0.8px',
                    opacity: 0.8
                  }}
                >
                  {categoryName}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {categoryItems.map((item) => {
                    const idx = results.indexOf(item)
                    const active = idx === selectedIndex
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          item.action()
                          close()
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 12px',
                          borderRadius: 6,
                          backgroundColor: active ? 'rgba(255, 255, 255, 0.05)' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background-color 0.15s ease'
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            flex: 1,
                            minWidth: 0
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: 26,
                              height: 26,
                              borderRadius: 5,
                              backgroundColor: 'rgba(255,255,255,0.03)',
                              border: '1px solid rgba(255,255,255,0.05)'
                            }}
                          >
                            {getIcon(item.iconType)}
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              minWidth: 0,
                              flex: 1
                            }}
                          >
                            <span
                              style={{
                                fontSize: '12.5px',
                                fontWeight: active ? 600 : 500,
                                color: active ? 'var(--text-main)' : 'rgba(255,255,255,0.85)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              {item.title}
                            </span>
                            {item.subtitle && (
                              <span
                                style={{
                                  fontSize: '10.5px',
                                  color: 'var(--text-muted)',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  marginTop: 1.5
                                }}
                              >
                                {item.subtitle}
                              </span>
                            )}
                          </div>
                        </div>

                        {active && (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              color: 'var(--text-muted)',
                              fontSize: '10px'
                            }}
                          >
                            {item.score !== undefined && (
                              <span
                                className="font-mono"
                                style={{
                                  backgroundColor: 'rgba(0,0,0,0.2)',
                                  padding: '2px 4px',
                                  borderRadius: 3,
                                  color: 'var(--color-success)'
                                }}
                              >
                                {(item.score * 100).toFixed(0)}% Match
                              </span>
                            )}
                            <CornerDownLeft size={12} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
