import React, { useEffect, useState } from 'react'
import { Clock, RotateCcw, X, PlusCircle, ArrowLeft, Check } from 'lucide-react'

interface ItemVersion {
  id: string
  entityType: string
  entityId: string
  versionNumber: number
  snapshotJson: string
  diffText: string | null
  createdAt: string
}

interface ItemVersionHistoryProps {
  isOpen: boolean
  onClose: () => void
  entityId: string
  entityType: 'task' | 'file' | 'project'
  currentData: any
  onRestore: (data: any) => void
}

export default function ItemVersionHistory({
  isOpen,
  onClose,
  entityId,
  entityType,
  currentData,
  onRestore
}: ItemVersionHistoryProps): React.JSX.Element | null {
  const [versions, setVersions] = useState<ItemVersion[]>([])
  const [selectedVersion, setSelectedVersion] = useState<ItemVersion | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const loadVersions = async () => {
    setIsLoading(true)
    try {
      const list = await window.api.versioning.itemHistory(entityType, entityId)
      setVersions(list)
    } catch (err) {
      console.error('Failed to load item versions:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && entityId) {
      loadVersions()
      setSelectedVersion(null)
    }
  }, [isOpen, entityId, entityType])

  const handleCreateSnapshot = async () => {
    try {
      await window.api.versioning.snapshotItem(entityType, entityId, currentData)
      setSuccessMsg('Snapshot captured!')
      setTimeout(() => setSuccessMsg(''), 2000)
      loadVersions()
    } catch (err) {
      console.error('Failed to capture snapshot:', err)
    }
  }

  const handleRollback = async () => {
    if (!selectedVersion) return
    try {
      const res = await window.api.versioning.rollbackItem(entityType, entityId, selectedVersion.id)
      if (res.success) {
        onRestore(res.data)
        setSuccessMsg('Restored successfully!')
        setTimeout(() => {
          setSuccessMsg('')
          onClose()
        }, 1500)
      }
    } catch (err) {
      console.error('Failed to rollback item:', err)
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
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
        className="flex justify-between items-center"
      >
        <div className="flex items-center gap-2">
          <Clock className="text-secondary" size={18} />
          <span className="font-semibold text-md" style={{ textTransform: 'capitalize' }}>
            {entityType} Version History
          </span>
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

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!selectedVersion ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 20, gap: 16 }}>
            <button
              className="btn btn-secondary w-full flex items-center justify-center gap-2"
              onClick={handleCreateSnapshot}
            >
              <PlusCircle size={16} />
              <span>Capture Current State</span>
            </button>

            <span className="text-xs font-semibold text-muted uppercase tracking-wider block">
              Saved State Snapshots
            </span>

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
                </div>
              ) : (
                versions.map((ver) => {
                  const data = JSON.parse(ver.snapshotJson)
                  return (
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
                          Snapshot {ver.versionNumber}
                        </span>
                        <span className="text-xs text-muted block mt-0.5">
                          {data.title || data.name || 'Unnamed Snapshot'}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-muted block">{ver.createdAt}</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: 'rgba(0,0,0,0.02)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <button
                className="btn-ghost flex items-center gap-1 text-xs text-muted"
                onClick={() => setSelectedVersion(null)}
              >
                <ArrowLeft size={13} /> Back to versions
              </button>
              <span className="text-xs font-semibold">
                Viewing Snapshot {selectedVersion.versionNumber}
              </span>
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: 16,
                backgroundColor: 'var(--bg-surface)'
              }}
            >
              <pre
                style={{
                  margin: 0,
                  fontSize: '12px',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  color: '#e2e8f0'
                }}
              >
                {JSON.stringify(JSON.parse(selectedVersion.snapshotJson), null, 2)}
              </pre>
            </div>

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
                <span>Rollback to Snapshot {selectedVersion.versionNumber}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
