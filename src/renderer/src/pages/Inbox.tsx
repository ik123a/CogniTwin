import React, { useEffect, useState } from 'react'
import { useInboxStore, InboxItem } from '../stores/inboxStore'
import { useModalStore } from '../stores/modalStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import {
  Inbox,
  Mail,
  FileText,
  MessageSquare,
  AlertCircle,
  Clock,
  Archive,
  Trash2,
  CheckCheck,
  ChevronRight,
  PlusSquare,
  Sparkles
} from 'lucide-react'

export default function SmartInbox(): React.JSX.Element {
  const {
    items,
    filter,
    priorityFilter,
    loadInbox,
    markAsRead,
    archiveItem,
    deleteItem,
    setFilter,
    setPriorityFilter
  } = useInboxStore()

  const { openModal } = useModalStore()
  const { createTask } = useWorkspaceStore()

  // Selected item state
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null)

  useEffect(() => {
    loadInbox()
  }, [])

  const handleSelectItem = (item: InboxItem): void => {
    setSelectedItem(item)
    if (item.is_read === 0) {
      markAsRead(item.id, true)
    }
  }

  const handleQuickTask = async (item: InboxItem): Promise<void> => {
    // Create task from inbox item
    await createTask(`Follow up: ${item.title}`, item.content || '', null, 'Medium')

    // Mark inbox item as archived
    await archiveItem(item.id)
    if (selectedItem?.id === item.id) {
      setSelectedItem(null)
    }

    alert(`Created follow-up task: "Follow up: ${item.title}"`)
  }

  const getPriorityColor = (priority: string): string => {
    switch (priority) {
      case 'Red':
        return '#e74c3c' // Urgent
      case 'Orange':
        return '#e67e22' // Important
      case 'Yellow':
        return '#f1c40f' // Review
      case 'Blue':
        return '#3498db' // Info
      default:
        return '#95a5a6' // Low
    }
  }

  const getPriorityLabel = (priority: string): string => {
    switch (priority) {
      case 'Red':
        return 'Urgent'
      case 'Orange':
        return 'Important'
      case 'Yellow':
        return 'Review'
      case 'Blue':
        return 'Info'
      default:
        return 'Low'
    }
  }

  const getItemIcon = (type: string): React.JSX.Element => {
    switch (type) {
      case 'email':
        return <Mail size={16} />
      case 'note':
        return <FileText size={16} />
      case 'message':
        return <MessageSquare size={16} />
      case 'ai':
        return <Sparkles size={16} className="text-secondary" />
      default:
        return <Inbox size={16} />
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        height: '100%',
        gap: 16,
        margin: '-24px',
        padding: 24,
        overflow: 'hidden'
      }}
    >
      {/* Left Panel: Inbox Feed (60%) */}
      <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Inbox Header Controls */}
        <div
          className="card flex justify-between items-center"
          style={{ padding: 12, marginBottom: 16, borderRadius: 8 }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { id: 'unread', label: 'Unread' },
              { id: 'all', label: 'All Inbox' },
              { id: 'archived', label: 'Archived' }
            ].map((f) => (
              <button
                key={f.id}
                className="btn btn-ghost"
                onClick={() => setFilter(f.id as any)}
                style={{
                  padding: '6px 12px',
                  fontSize: '13px',
                  backgroundColor: filter === f.id ? 'var(--bg-surface)' : 'transparent',
                  color: filter === f.id ? 'var(--text-main)' : 'var(--text-muted)'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span className="text-sm text-muted">Priority:</span>
            <select
              className="input-field"
              value={priorityFilter || ''}
              onChange={(e) => setPriorityFilter(e.target.value || null)}
              style={{
                padding: '4px 8px',
                fontSize: '13px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-surface)',
                outline: 'none'
              }}
            >
              <option value="">All Priorities</option>
              <option value="Red">Red (Urgent)</option>
              <option value="Orange">Orange (Important)</option>
              <option value="Yellow">Yellow (Review)</option>
              <option value="Blue">Blue (Info)</option>
              <option value="Gray">Gray (Low)</option>
            </select>
          </div>
        </div>

        {/* Feed List Viewport */}
        <div
          style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          {items.length > 0 ? (
            items.map((item) => {
              const borderCol = getPriorityColor(item.priority)
              const isSelected = selectedItem?.id === item.id
              return (
                <div
                  key={item.id}
                  className="card flex items-center justify-between"
                  style={{
                    padding: '16px 20px',
                    cursor: 'pointer',
                    borderLeft: `4px solid ${borderCol}`,
                    backgroundColor: isSelected
                      ? 'rgba(52, 152, 219, 0.05)'
                      : 'var(--bg-surface-elevated)',
                    transition: 'all var(--transition-fast)'
                  }}
                  onClick={() => handleSelectItem(item)}
                >
                  <div
                    style={{
                      display: 'flex',
                      gap: 16,
                      alignItems: 'center',
                      flex: 1,
                      overflow: 'hidden'
                    }}
                  >
                    <div style={{ color: 'var(--text-muted)' }}>{getItemIcon(item.type)}</div>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        flex: 1
                      }}
                    >
                      <span
                        className="font-semibold text-sm"
                        style={{
                          textDecoration: item.is_read ? 'none' : 'underline',
                          fontWeight: item.is_read ? 500 : 700,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {item.title}
                      </span>
                      <span
                        className="text-muted"
                        style={{
                          fontSize: '12px',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                      >
                        {item.content}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span className="font-mono text-muted" style={{ fontSize: '11px' }}>
                      {new Date(item.date_received).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                    <ChevronRight size={16} className="text-muted" />
                  </div>
                </div>
              )
            })
          ) : (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
                fontSize: '14px'
              }}
            >
              Your inbox is fully processed. Enjoy the quiet!
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Detail View (40%) */}
      <div
        className="card"
        style={{
          flex: 0.8,
          display: 'flex',
          flexDirection: 'column',
          padding: 24,
          height: '100%',
          overflowY: 'auto'
        }}
      >
        {selectedItem ? (
          <div className="flex flex-col gap-4" style={{ height: '100%' }}>
            {/* Detail Header */}
            <div>
              <div className="flex justify-between items-center" style={{ marginBottom: 12 }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: getPriorityColor(selectedItem.priority),
                    backgroundColor: 'var(--bg-surface)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    border: `1px solid ${getPriorityColor(selectedItem.priority)}`
                  }}
                >
                  {getPriorityLabel(selectedItem.priority)} Priority
                </span>
                <span className="font-mono text-muted text-sm">
                  {new Date(selectedItem.date_received).toLocaleDateString()}
                </span>
              </div>
              <h3 className="font-bold text-lg">{selectedItem.title}</h3>
              <span className="text-muted text-sm">
                Source: <strong>{selectedItem.source || 'Unknown'}</strong>
              </span>
            </div>

            {/* Content Body */}
            <div style={{ flex: 1, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
              <span className="input-label" style={{ display: 'block', marginBottom: 8 }}>
                BODY CONTENTS
              </span>
              <p
                style={{
                  fontSize: '13px',
                  lineHeight: '1.6',
                  color: 'var(--text-main)',
                  whiteSpace: 'pre-wrap',
                  maxHeight: 180,
                  overflowY: 'auto',
                  backgroundColor: 'var(--bg-surface)',
                  padding: 12,
                  borderRadius: 8
                }}
              >
                {selectedItem.content}
              </p>

              {/* AI Summary Block */}
              <div
                style={{
                  marginTop: 20,
                  padding: 16,
                  borderRadius: 8,
                  backgroundColor: 'rgba(52, 152, 219, 0.05)',
                  border: '1px solid rgba(52, 152, 219, 0.1)'
                }}
              >
                <span
                  className="font-semibold text-sm flex items-center gap-2"
                  style={{ color: 'var(--color-secondary)', marginBottom: 8 }}
                >
                  <Sparkles size={14} />
                  <span>AI Copilot Summary</span>
                </span>
                <p style={{ fontSize: '12px', lineHeight: '1.5', color: 'var(--text-main)' }}>
                  This request requires an action item regarding project coordination. It highlights
                  draft completions and asks for a confirmation. Recommends creating a follow-up
                  workspace task.
                </p>
              </div>
            </div>

            {/* Action Bar */}
            <div
              style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16 }}
              className="flex gap-2 justify-end"
            >
              <button
                className="btn btn-secondary"
                style={{ padding: '8px 12px' }}
                onClick={() => archiveItem(selectedItem.id).then(() => setSelectedItem(null))}
                title="Archive Item"
              >
                <Archive size={16} />
              </button>
              <button
                className="btn btn-secondary"
                style={{ padding: '8px 12px' }}
                onClick={() => deleteItem(selectedItem.id).then(() => setSelectedItem(null))}
                title="Delete Item"
              >
                <Trash2 size={16} />
              </button>
              <button
                className="btn btn-primary"
                style={{ padding: '8px 12px' }}
                onClick={() => handleQuickTask(selectedItem)}
              >
                <PlusSquare size={16} />
                <span>Create Task</span>
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
              color: 'var(--text-muted)'
            }}
          >
            <Inbox size={36} style={{ marginBottom: 12, opacity: 0.3 }} />
            <span className="text-sm">Select an inbox notification to inspect details</span>
          </div>
        )}
      </div>
    </div>
  )
}
