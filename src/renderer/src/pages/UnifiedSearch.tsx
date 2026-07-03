import React, { useState, useEffect } from 'react'
import { useNavigationStore } from '../stores/navigationStore'
import {
  Search,
  Sparkles,
  FileText,
  CheckSquare,
  File,
  Database,
  ArrowRight,
  Inbox,
  Filter,
  RefreshCw,
  ChevronRight,
  X
} from 'lucide-react'

interface ClusterInfo {
  id: string
  name: string
  description: string | null
  keywords: string | null
  item_count: number
}

interface SearchItem {
  id: string
  type: 'note' | 'task' | 'file' | 'inbox_item'
  title: string
  snippet: string
  score?: number
  subtitle?: string
  created_at?: string
}

export default function UnifiedSearch(): React.JSX.Element {
  const { setView } = useNavigationStore()

  const [query, setQuery] = useState('')
  const [searchMode, setSearchMode] = useState<'hybrid' | 'semantic' | 'keyword'>('hybrid')
  const [clusters, setClusters] = useState<ClusterInfo[]>([])
  const [selectedCluster, setSelectedCluster] = useState<ClusterInfo | null>(null)
  const [results, setResults] = useState<SearchItem[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all') // 'all', 'note', 'task', 'file', 'inbox_item'

  // Load Clusters on mount
  const loadClusters = async (): Promise<void> => {
    try {
      // 1. First ensure table exists and has mock data if empty
      const existing = await window.api.db.query('SELECT count(*) as count FROM topic_clusters')
      const count = existing[0]?.count || 0

      if (count === 0) {
        // Seed mock clusters
        const c1Id = crypto.randomUUID()
        const c2Id = crypto.randomUUID()
        const c3Id = crypto.randomUUID()

        await window.api.db.execute(
          'INSERT INTO topic_clusters (id, name, description, keywords) VALUES (?, ?, ?, ?)',
          [
            c1Id,
            'Personal Brainstorming',
            'Ideas, thoughts, and draft articles',
            'note, idea, draft, thoughts'
          ]
        )
        await window.api.db.execute(
          'INSERT INTO topic_clusters (id, name, description, keywords) VALUES (?, ?, ?, ?)',
          [
            c2Id,
            'Workspace Tasks & Dev',
            'Coding tasks, priorities, status reports',
            'task, build, priority, coding'
          ]
        )
        await window.api.db.execute(
          'INSERT INTO topic_clusters (id, name, description, keywords) VALUES (?, ?, ?, ?)',
          [
            c3Id,
            'External Integrations',
            'Sync settings, accounts, calendar links',
            'sync, email, imap, calendar'
          ]
        )

        // Map some existing items if they exist
        const notes = await window.api.db.query('SELECT id FROM notes LIMIT 3')
        const tasks = await window.api.db.query('SELECT id FROM tasks LIMIT 3')

        for (const n of notes) {
          await window.api.db.execute(
            'INSERT OR IGNORE INTO item_clusters (cluster_id, item_id, item_type) VALUES (?, ?, ?)',
            [c1Id, n.id, 'note']
          )
        }
        for (const t of tasks) {
          await window.api.db.execute(
            'INSERT OR IGNORE INTO item_clusters (cluster_id, item_id, item_type) VALUES (?, ?, ?)',
            [c2Id, t.id, 'task']
          )
        }
      }

      // Fetch clusters with item count
      const list = await window.api.db.query<ClusterInfo>(`
        SELECT tc.*, COUNT(ic.item_id) as item_count 
        FROM topic_clusters tc 
        LEFT JOIN item_clusters ic ON tc.id = ic.cluster_id 
        GROUP BY tc.id
        ORDER BY tc.created_at DESC
      `)
      setClusters(list)
    } catch (e) {
      console.warn('Failed to load topic clusters:', e)
    }
  }

  // Perform query-based or browse-based search
  const performSearch = async (): Promise<void> => {
    setIsSearching(true)
    try {
      let tempResults: SearchItem[] = []

      if (query.trim()) {
        // Run AI hybrid/semantic/keyword search
        const raw = await window.api.intelligence.search(query, { limit: 30, mode: searchMode })
        tempResults = raw.map((r) => ({
          id: r.id,
          type: r.type,
          title: r.title,
          snippet: r.snippet,
          score: r.score
        }))
      } else if (selectedCluster) {
        // Browse items specifically in cluster
        const clusterItems = await window.api.db.query<{ item_id: string; item_type: string }>(
          'SELECT item_id, item_type FROM item_clusters WHERE cluster_id = ?',
          [selectedCluster.id]
        )

        for (const ci of clusterItems) {
          if (ci.item_type === 'note') {
            const notes = await window.api.db.query(
              'SELECT id, title, raw_text as snippet, created_at FROM notes WHERE id = ?',
              [ci.item_id]
            )
            if (notes[0]) tempResults.push({ ...notes[0], type: 'note' })
          } else if (ci.item_type === 'task') {
            const tasks = await window.api.db.query(
              'SELECT id, title, description as snippet, status, created_at FROM tasks WHERE id = ?',
              [ci.item_id]
            )
            if (tasks[0]) {
              tempResults.push({
                ...tasks[0],
                type: 'task',
                subtitle: `Status: ${tasks[0].status}`
              })
            }
          } else if (ci.item_type === 'file') {
            const files = await window.api.db.query(
              'SELECT id, name as title, type, path as snippet, created_at FROM files WHERE id = ?',
              [ci.item_id]
            )
            if (files[0]) {
              tempResults.push({
                ...files[0],
                type: 'file',
                subtitle: `File Type: ${files[0].type}`
              })
            }
          }
        }
      } else {
        // Show recent overall items
        const recentNotes = await window.api.db.query(
          'SELECT id, title, raw_text as snippet, created_at FROM notes ORDER BY updated_at DESC LIMIT 6'
        )
        const recentTasks = await window.api.db.query(
          'SELECT id, title, description as snippet, status, created_at FROM tasks ORDER BY updated_at DESC LIMIT 6'
        )
        const recentFiles = await window.api.db.query(
          'SELECT id, name as title, type, path as snippet, created_at FROM files ORDER BY created_at DESC LIMIT 6'
        )

        tempResults = [
          ...recentNotes.map((n) => ({ ...n, type: 'note' as const })),
          ...recentTasks.map((t) => ({
            ...t,
            type: 'task' as const,
            subtitle: `Status: ${t.status}`
          })),
          ...recentFiles.map((f) => ({ ...f, type: 'file' as const, subtitle: `Type: ${f.type}` }))
        ]
      }

      // If a cluster is selected AND there's a typed query, filter query results by cluster items
      if (selectedCluster && query.trim()) {
        const clusterItems = await window.api.db.query<{ item_id: string }>(
          'SELECT item_id FROM item_clusters WHERE cluster_id = ?',
          [selectedCluster.id]
        )
        const allowedIds = new Set(clusterItems.map((ci) => ci.item_id))
        tempResults = tempResults.filter((res) => allowedIds.has(res.id))
      }

      // Filter by Category Facet
      if (selectedCategory !== 'all') {
        tempResults = tempResults.filter((res) => res.type === selectedCategory)
      }

      setResults(tempResults)
    } catch (e) {
      console.error('UnifiedSearch search execution error:', e)
    } finally {
      setIsSearching(false)
    }
  }

  useEffect(() => {
    loadClusters()
  }, [])

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      performSearch()
    }, 250)

    return () => clearTimeout(delayDebounce)
  }, [query, selectedCluster, selectedCategory, searchMode])

  const handleSelectResult = (item: SearchItem): void => {
    if (item.type === 'note' || item.type === 'task' || item.type === 'file') {
      setView('workspace')
    } else if (item.type === 'inbox_item') {
      setView('inbox')
    }
  }

  const getIcon = (type: string): React.JSX.Element => {
    switch (type) {
      case 'note':
        return <FileText size={16} className="text-secondary" />
      case 'task':
        return <CheckSquare size={16} style={{ color: 'var(--color-success)' }} />
      case 'file':
        return <File size={16} style={{ color: 'var(--color-accent)' }} />
      default:
        return <Inbox size={16} style={{ color: 'var(--color-warning)' }} />
    }
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
        gap: 24,
        height: '100%',
        minHeight: 'calc(100vh - 120px)'
      }}
    >
      {/* 1. Left Cluster Sidebar */}
      <div
        className="card"
        style={{
          padding: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          backgroundColor: 'rgba(255,255,255,0.01)',
          borderRight: '1px solid var(--border-color)',
          borderRadius: 10
        }}
      >
        <div>
          <h4
            className="font-semibold text-sm flex items-center gap-2"
            style={{ color: 'var(--text-main)', marginBottom: 4 }}
          >
            <Filter size={15} />
            <span>Topic Clusters</span>
          </h4>
          <p className="text-muted" style={{ fontSize: '11px' }}>
            Browse items clustered semantically by AI keywords.
          </p>
        </div>

        {/* Clusters List */}
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, overflowY: 'auto' }}
        >
          <button
            onClick={() => setSelectedCluster(null)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              borderRadius: 6,
              border: 'none',
              backgroundColor: !selectedCluster ? 'rgba(52, 152, 219, 0.12)' : 'transparent',
              color: !selectedCluster ? 'var(--color-secondary)' : 'var(--text-muted)',
              cursor: 'pointer',
              textAlign: 'left',
              fontWeight: !selectedCluster ? 600 : 500
            }}
          >
            <span>All Sources</span>
            <ChevronRight size={14} style={{ opacity: !selectedCluster ? 0.8 : 0 }} />
          </button>

          {clusters.map((c) => {
            const isActive = selectedCluster?.id === c.id
            return (
              <button
                key={c.id}
                onClick={() => setSelectedCluster(c)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '10px 12px',
                  borderRadius: 6,
                  border: 'none',
                  backgroundColor: isActive ? 'rgba(52, 152, 219, 0.12)' : 'transparent',
                  color: isActive ? 'var(--color-secondary)' : 'rgba(255, 255, 255, 0.85)',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease'
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: '100%'
                  }}
                >
                  <span
                    style={{
                      fontSize: '12.5px',
                      fontWeight: isActive ? 600 : 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {c.name}
                  </span>
                  <span
                    style={{
                      fontSize: '10px',
                      backgroundColor: isActive ? 'rgba(52,152,219,0.2)' : 'rgba(0,0,0,0.15)',
                      color: isActive ? 'var(--color-secondary)' : 'var(--text-muted)',
                      padding: '1px 6px',
                      borderRadius: 10
                    }}
                  >
                    {c.item_count}
                  </span>
                </div>
                {c.keywords && (
                  <span
                    style={{
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      marginTop: 4,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      width: '100%'
                    }}
                  >
                    Keywords: {c.keywords}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <button
          className="btn btn-secondary"
          onClick={loadClusters}
          style={{ width: '100%', fontSize: '11px', gap: 6, height: 32 }}
        >
          <RefreshCw size={12} />
          <span>Regenerate Clusters</span>
        </button>
      </div>

      {/* 2. Main Search Area */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Search Bar */}
        <div
          className="card"
          style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Search size={20} className="text-muted" style={{ marginRight: 12 }} />
            <input
              type="text"
              className="input-field"
              placeholder="Search across all files, notes, tasks, and integrations..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '16px',
                padding: 0,
                flex: 1,
                outline: 'none',
                boxShadow: 'none',
                color: 'var(--text-main)'
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
                  marginRight: 8
                }}
              />
            )}
            {query && (
              <button
                className="btn-ghost"
                onClick={() => setQuery('')}
                style={{ padding: 4, borderRadius: 4 }}
              >
                <X size={16} />
              </button>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingTop: 8,
              borderTop: '1px solid var(--border-color)'
            }}
          >
            {/* Search Modes */}
            <div style={{ display: 'flex', gap: 8 }}>
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
                      cursor: 'pointer',
                      fontSize: '11px'
                    }}
                  >
                    <Icon size={12} />
                    <span>{mode.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Category Badges / Filters */}
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { id: 'all', label: 'All Items' },
                { id: 'note', label: 'Notes' },
                { id: 'task', label: 'Tasks' },
                { id: 'file', label: 'Files' }
              ].map((cat) => {
                const active = selectedCategory === cat.id
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: 4,
                      border: '1px solid',
                      borderColor: active ? 'var(--color-secondary)' : 'var(--border-color)',
                      backgroundColor: active ? 'rgba(52, 152, 219, 0.05)' : 'transparent',
                      color: active ? 'var(--color-secondary)' : 'var(--text-muted)',
                      fontSize: '10.5px',
                      cursor: 'pointer',
                      fontWeight: active ? 600 : 500
                    }}
                  >
                    {cat.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Selected Cluster Info Banner */}
        {selectedCluster && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 16px',
              borderRadius: 8,
              backgroundColor: 'rgba(52,152,219,0.06)',
              border: '1px solid rgba(52,152,219,0.15)',
              fontSize: '12px'
            }}
          >
            <span>
              Filtering by cluster: <strong>{selectedCluster.name}</strong>
              {selectedCluster.description && (
                <span style={{ color: 'var(--text-muted)' }}> — {selectedCluster.description}</span>
              )}
            </span>
            <button
              className="btn-ghost"
              onClick={() => setSelectedCluster(null)}
              style={{
                padding: 4,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '11px',
                color: 'var(--color-secondary)'
              }}
            >
              <span>Clear Filter</span>
              <X size={13} />
            </button>
          </div>
        )}

        {/* Search Results */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {results.length === 0 ? (
            <div
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '60px 0',
                color: 'var(--text-muted)'
              }}
            >
              <Database size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
              <span className="text-sm font-semibold">No results found</span>
              <span style={{ fontSize: '12px', marginTop: 4 }}>
                Try typing a different query or clearing your cluster filters.
              </span>
            </div>
          ) : (
            results.map((item) => (
              <div
                key={item.id}
                onClick={() => handleSelectResult(item)}
                className="card"
                style={{
                  padding: '12px 18px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'transform 0.15s ease, background-color 0.15s ease',
                  backgroundColor: 'var(--bg-card)'
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      backgroundColor: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.06)'
                    }}
                  >
                    {getIcon(item.type)}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}
                      >
                        {item.title}
                      </span>
                      <span
                        style={{
                          fontSize: '9px',
                          textTransform: 'uppercase',
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          padding: '1px 6px',
                          borderRadius: 4,
                          color: 'var(--text-muted)'
                        }}
                      >
                        {item.type}
                      </span>
                      {item.subtitle && (
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          • {item.subtitle}
                        </span>
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: '12.5px',
                        color: 'var(--text-muted)',
                        marginTop: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {item.snippet}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 16 }}>
                  {item.score !== undefined && (
                    <span
                      className="font-mono"
                      style={{
                        fontSize: '11px',
                        color: item.score > 0.6 ? 'var(--color-success)' : 'var(--text-muted)',
                        backgroundColor: 'rgba(0,0,0,0.15)',
                        padding: '2.5px 7px',
                        borderRadius: 4
                      }}
                    >
                      {(item.score * 100).toFixed(0)}% Match
                    </span>
                  )}
                  <div className="btn-ghost" style={{ padding: 6, borderRadius: 6 }}>
                    <ArrowRight size={14} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
