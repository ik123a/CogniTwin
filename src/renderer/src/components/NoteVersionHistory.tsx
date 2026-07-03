import React, { useEffect, useState } from 'react'
import { Clock, RotateCcw, X, PlusCircle, ArrowLeft, Check } from 'lucide-react'
import { useWorkspaceStore } from '../stores/workspaceStore'

export interface NoteVersion {
  id: string
  note_id: string
  title: string
  content: string
  raw_text: string
  version_number: number
  created_at: string
}

interface NoteVersionHistoryProps {
  isOpen: boolean
  onClose: () => void
  noteId: string
  currentTitle: string
  currentContent: string
  onRestore: (title: string, content: string) => void
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged'
  content: string
}

// Custom simple line-based diff utility
function generateDiff(oldStr: string, newStr: string): DiffLine[] {
  const oldLines = (oldStr || '').split('\n')
  const newLines = (newStr || '').split('\n')
  const diff: DiffLine[] = []

  let i = 0
  let j = 0

  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length) {
      if (oldLines[i] === newLines[j]) {
        diff.push({ type: 'unchanged', content: oldLines[i] })
        i++
        j++
      } else {
        // Lookahead to see if it is an insertion or deletion
        const nextOldIdx = oldLines.indexOf(newLines[j], i)
        const nextNewIdx = newLines.indexOf(oldLines[i], j)

        if (nextOldIdx !== -1 && (nextNewIdx === -1 || nextOldIdx - i <= nextNewIdx - j)) {
          for (let k = i; k < nextOldIdx; k++) {
            diff.push({ type: 'removed', content: oldLines[k] })
          }
          i = nextOldIdx
        } else if (nextNewIdx !== -1) {
          for (let k = j; k < nextNewIdx; k++) {
            diff.push({ type: 'added', content: newLines[k] })
          }
          j = nextNewIdx
        } else {
          diff.push({ type: 'removed', content: oldLines[i] })
          diff.push({ type: 'added', content: newLines[j] })
          i++
          j++
        }
      }
    } else if (i < oldLines.length) {
      diff.push({ type: 'removed', content: oldLines[i] })
      i++
    } else if (j < newLines.length) {
      diff.push({ type: 'added', content: newLines[j] })
      j++
    }
  }

  return diff
}

export default function NoteVersionHistory({
  isOpen,
  onClose,
  noteId,
  currentTitle,
  currentContent,
  onRestore
}: NoteVersionHistoryProps): React.JSX.Element | null {
  const [versions, setVersions] = useState<NoteVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<NoteVersion | null>(null)
  const [diffResult, setDiffResult] = useState<DiffLine[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  // 1. Ensure table exists & load versions
  const loadVersions = async () => {
    setIsLoading(true)
    try {
      await window.api.db.execute(`
        CREATE TABLE IF NOT EXISTS note_versions (
          id TEXT PRIMARY KEY,
          note_id TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT,
          raw_text TEXT,
          version_number INTEGER NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE
        );
      `)

      const list = await window.api.db.query<NoteVersion>(
        'SELECT * FROM note_versions WHERE note_id = ? ORDER BY version_number DESC',
        [noteId]
      )
      setVersions(list)
    } catch (err) {
      console.error('Failed to load note versions:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && noteId) {
      loadVersions()
      setSelectedVersion(null)
      setDiffResult([])
    }
  }, [isOpen, noteId])

  // 2. Compute diff when selecting a version
  useEffect(() => {
    if (selectedVersion) {
      const diff = generateDiff(selectedVersion.content, currentContent)
      setDiffResult(diff)
    } else {
      setDiffResult([])
    }
  }, [selectedVersion, currentContent])

  // 3. Create a snapshot manually
  const handleCreateSnapshot = async () => {
    try {
      const versionNum = versions.length > 0 ? versions[0].version_number + 1 : 1
      const uuid = crypto.randomUUID()

      await window.api.db.execute(
        'INSERT INTO note_versions (id, note_id, title, content, raw_text, version_number) VALUES (?, ?, ?, ?, ?, ?)',
        [uuid, noteId, currentTitle, currentContent, currentContent, versionNum]
      )

      setSuccessMsg('Snapshot created!')
      setTimeout(() => setSuccessMsg(''), 2000)
      loadVersions()
    } catch (err) {
      console.error('Failed to create version snapshot:', err)
    }
  }

  // 4. Rollback Note content to selected version
  const handleRollback = async () => {
    if (!selectedVersion) return
    try {
      // Restore note in notes database table
      const now = new Date().toISOString()
      await window.api.db.execute(
        'UPDATE notes SET title = ?, content = ?, raw_text = ?, updated_at = ? WHERE id = ?',
        [selectedVersion.title, selectedVersion.content, selectedVersion.content, now, noteId]
      )

      // Trigger parent callback to update UI editor state
      onRestore(selectedVersion.title, selectedVersion.content)

      setSuccessMsg('Restored successfully!')
      setTimeout(() => {
        setSuccessMsg('')
        onClose()
      }, 1500)
    } catch (err) {
      console.error('Failed to restore note version:', err)
    }
  }

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: '460px',
        height: '100%',
        backgroundColor: 'var(--bg-surface-elevated)',
        borderLeft: '1px solid var(--border-color)',
        boxShadow: '-4px 0 24px rgba(0, 0, 0, 0.15)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        backdropFilter: 'blur(20px)',
        animation: 'slide-in 0.3s ease'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'between',
          alignItems: 'center'
        }}
        className="flex justify-between items-center"
      >
        <div className="flex items-center gap-2">
          <Clock className="text-secondary" size={18} />
          <span className="font-semibold text-md">Note Version History</span>
        </div>
        <div className="flex items-center gap-2">
          {successMsg && (
            <span
              className="text-xs font-medium text-success flex items-center gap-1"
              style={{
                backgroundColor: 'rgba(46, 204, 113, 0.1)',
                padding: '2px 8px',
                borderRadius: 4
              }}
            >
              <Check size={12} /> {successMsg}
            </span>
          )}
          <button className="btn-ghost" onClick={onClose} style={{ padding: 4, borderRadius: 4 }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Main panel body */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Toggle between list view and details view */}
        {!selectedVersion ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20, gap: 16 }}>
            {/* Create Snapshot Button */}
            <button
              className="btn btn-secondary w-full flex items-center justify-center gap-2"
              onClick={handleCreateSnapshot}
            >
              <PlusCircle size={16} />
              <span>Capture Current Snapshot</span>
            </button>

            <span className="text-xs font-semibold text-muted uppercase tracking-wider block">
              Saved Snapshots
            </span>

            {/* List of versions */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 10
              }}
            >
              {isLoading ? (
                <div className="flex justify-center py-8 text-muted">Loading versions...</div>
              ) : versions.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center text-muted text-center py-12"
                  style={{ border: '2px dashed var(--border-color)', borderRadius: 8 }}
                >
                  <Clock size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
                  <span className="text-sm">No historical snapshots saved yet.</span>
                  <span className="text-xs text-muted mt-1">
                    Capture a snapshot above or make changes to generate history.
                  </span>
                </div>
              ) : (
                versions.map((ver) => (
                  <div
                    key={ver.id}
                    className="card flex justify-between items-center hover-elevated"
                    style={{
                      padding: '12px 16px',
                      cursor: 'pointer',
                      borderLeft: '3px solid var(--color-secondary)'
                    }}
                    onClick={() => setSelectedVersion(ver)}
                  >
                    <div>
                      <span className="font-semibold text-sm block">
                        Version {ver.version_number}
                      </span>
                      <span className="text-xs text-muted block mt-0.5">
                        {ver.title || 'Untitled Note'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-muted block">
                        {new Date(ver.created_at).toLocaleDateString()}
                      </span>
                      <span
                        className="text-xs text-muted block mt-0.5"
                        style={{ fontSize: '10px' }}
                      >
                        {new Date(ver.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          // Diff / Version Details view
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Sub-header to go back */}
            <div
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'rgba(0,0,0,0.02)',
                display: 'flex',
                justifyContent: 'between',
                alignItems: 'center'
              }}
              className="flex justify-between items-center"
            >
              <button
                className="btn-ghost flex items-center gap-1 text-xs text-muted"
                onClick={() => setSelectedVersion(null)}
              >
                <ArrowLeft size={13} /> Back to versions
              </button>
              <span className="text-xs font-semibold">
                Comparing Version {selectedVersion.version_number} &rarr; Current
              </span>
            </div>

            {/* Diff content view */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 16,
                fontFamily: 'monospace',
                fontSize: '12px',
                lineHeight: '1.5',
                whiteSpace: 'pre-wrap',
                backgroundColor: 'var(--bg-surface)'
              }}
            >
              {diffResult.length === 0 ? (
                <div className="text-muted text-center py-8">No difference detected.</div>
              ) : (
                diffResult.map((line, idx) => {
                  let bgColor = 'transparent'
                  let textColor = 'var(--text-main)'
                  let prefix = ' '

                  if (line.type === 'added') {
                    bgColor = 'rgba(46, 204, 113, 0.15)'
                    textColor = 'var(--color-success)'
                    prefix = '+'
                  } else if (line.type === 'removed') {
                    bgColor = 'rgba(231, 76, 60, 0.15)'
                    textColor = 'var(--color-error)'
                    prefix = '-'
                  }

                  return (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: bgColor,
                        color: textColor,
                        padding: '1px 6px',
                        borderRadius: 2
                      }}
                    >
                      {prefix} {line.content}
                    </div>
                  )
                })
              )}
            </div>

            {/* Version Actions Footer */}
            <div
              style={{
                padding: 16,
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface-elevated)',
                display: 'flex',
                gap: 12
              }}
            >
              <button className="btn btn-secondary flex-1" onClick={() => setSelectedVersion(null)}>
                Cancel
              </button>
              <button
                className="btn btn-primary flex-1 flex items-center justify-center gap-1.5"
                onClick={handleRollback}
                style={{ backgroundColor: 'var(--color-accent)' }}
              >
                <RotateCcw size={14} />
                <span>Rollback to Version {selectedVersion.version_number}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
