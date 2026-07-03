import React, { useState, useEffect, useRef } from 'react'
import { useSearchStore, SearchResult } from '../stores/searchStore'
import { useModalStore } from '../stores/modalStore'
import { useNavigationStore } from '../stores/navigationStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import {
  Search,
  Sparkles,
  FileText,
  CheckSquare,
  File,
  Database,
  X,
  ArrowRight,
  CornerDownLeft
} from 'lucide-react'

export default function SemanticSearch(): React.JSX.Element {
  const { query, results, searchMode, isSearching, setQuery, setSearchMode, search, clear } =
    useSearchStore()
  const { closeModal } = useModalStore()
  const { setView } = useNavigationStore()
  const { selectProject, selectWorkspace } = useWorkspaceStore()

  const [selectedIndex, setSelectedIndex] = useState<number>(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  // Debounced search trigger
  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      if (query.trim()) {
        search()
      }
    }, 300)

    return () => clearTimeout(delayDebounce)
  }, [query])

  // Focus input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
    return () => clear()
  }, [])

  const handleSelectResult = async (res: SearchResult) => {
    // Navigate to respective workspace view depending on type
    if (res.type === 'note' || res.type === 'task' || res.type === 'file') {
      setView('workspace')
      closeModal('quickCapture')
    } else if (res.type === 'inbox_item') {
      setView('inbox')
      closeModal('quickCapture')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && results[selectedIndex]) {
        handleSelectResult(results[selectedIndex])
      } else if (results.length > 0) {
        handleSelectResult(results[0])
      }
    } else if (e.key === 'Escape') {
      closeModal('quickCapture')
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'note':
        return <FileText size={16} className="text-secondary" />
      case 'task':
        return <CheckSquare size={16} style={{ color: 'var(--color-success)' }} />
      case 'file':
        return <File size={16} style={{ color: 'var(--color-accent)' }} />
      default:
        return <Database size={16} className="text-muted" />
    }
  }

  return (
    <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '10vh' }}>
      <div
        className="modal-content glass"
        style={{
          maxWidth: 680,
          width: '100%',
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden'
        }}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)'
          }}
        >
          <Search size={20} className="text-muted" style={{ marginRight: 12 }} />
          <input
            ref={inputRef}
            type="text"
            className="input-field"
            placeholder="Search notes, files, tasks semantically..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: '16px',
              padding: 0,
              flex: 1,
              outline: 'none',
              boxShadow: 'none'
            }}
          />
          {isSearching && (
            <div
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                border: '2px solid var(--border-color)',
                borderTopColor: 'var(--color-secondary)',
                animation: 'spin 1s linear infinite',
                marginRight: 12
              }}
            />
          )}
          <button
            className="btn-ghost"
            onClick={() => closeModal('quickCapture')}
            style={{ padding: 4 }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Search Mode Toolbar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '8px 20px',
            backgroundColor: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border-color)',
            fontSize: '12px'
          }}
        >
          <div style={{ display: 'flex', gap: 6 }}>
            {[
              { id: 'hybrid', label: 'Hybrid AI', icon: Sparkles },
              { id: 'semantic', label: 'Semantic', icon: Database },
              { id: 'keyword', label: 'Keyword', icon: Search }
            ].map((mode) => {
              const Icon = mode.icon
              const active = searchMode === mode.id
              return (
                <button
                  key={mode.id}
                  onClick={() => setSearchMode(mode.id as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 10px',
                    borderRadius: 4,
                    border: 'none',
                    backgroundColor: active ? 'rgba(52, 152, 219, 0.15)' : 'transparent',
                    color: active ? 'var(--color-secondary)' : 'var(--text-muted)',
                    fontWeight: active ? 600 : 500,
                    cursor: 'pointer'
                  }}
                >
                  <Icon size={12} />
                  <span>{mode.label}</span>
                </button>
              )
            })}
          </div>
          <span className="text-muted font-mono" style={{ fontSize: '10px' }}>
            ESC to close
          </span>
        </div>

        {/* Results Body */}
        <div style={{ maxHeight: 380, overflowY: 'auto', padding: '12px 8px' }}>
          {!query.trim() ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '40px 0',
                color: 'var(--text-muted)'
              }}
            >
              <Sparkles
                size={28}
                style={{ marginBottom: 12, opacity: 0.4 }}
                className="text-secondary"
              />
              <span className="text-sm font-semibold">Semantic Vector Engine Ready</span>
              <span style={{ fontSize: '12px', marginTop: 4 }}>
                Type concepts, questions, or topics to retrieve matching nodes.
              </span>
            </div>
          ) : results.length === 0 && !isSearching ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '40px 0',
                color: 'var(--text-muted)'
              }}
            >
              <Search size={28} style={{ marginBottom: 12, opacity: 0.4 }} />
              <span className="text-sm">No results match your search parameters</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {results.map((res, index) => {
                const active = index === selectedIndex
                return (
                  <div
                    key={`${res.type}:${res.id}`}
                    onClick={() => handleSelectResult(res)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 16px',
                      borderRadius: 8,
                      backgroundColor: active ? 'rgba(255, 255, 255, 0.04)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'background-color 0.15s ease'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        flex: 1,
                        minWidth: 0
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 28,
                          height: 28,
                          borderRadius: 6,
                          backgroundColor: 'var(--bg-surface)'
                        }}
                      >
                        {getIcon(res.type)}
                      </div>
                      <div
                        style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}
                      >
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: active ? 'var(--text-main)' : 'var(--text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {res.title}
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            color: 'var(--text-muted)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginTop: 2
                          }}
                        >
                          {res.snippet}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 16 }}>
                      <span
                        className="font-mono"
                        style={{
                          fontSize: '11px',
                          color: res.score > 0.6 ? 'var(--color-success)' : 'var(--text-muted)',
                          backgroundColor: 'rgba(0,0,0,0.15)',
                          padding: '2px 6px',
                          borderRadius: 4
                        }}
                      >
                        {(res.score * 100).toFixed(0)}% Match
                      </span>
                      {active ? (
                        <CornerDownLeft size={14} className="text-muted" />
                      ) : (
                        <ArrowRight size={14} style={{ opacity: 0 }} />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
