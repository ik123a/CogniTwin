import React, { useEffect, useState } from 'react'
import { useWorkspaceStore, Project, Note, Task, IngestedFile } from '../stores/workspaceStore'
import { useModalStore } from '../stores/modalStore'
import { useHistoryStore } from '../stores/historyStore'
import { usePrivacyStore } from '../stores/privacyStore'
import {
  Folder,
  FileText,
  CheckSquare,
  File,
  Plus,
  Eye,
  Trash2,
  Tag,
  Clock,
  Compass,
  ArrowRightLeft,
  Calendar,
  Layers,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Shield
} from 'lucide-react'
import KnowledgeQualityBadge from '../components/KnowledgeQualityBadge'
import NoteVersionHistory from '../components/NoteVersionHistory'
import ItemVersionHistory from '../components/ItemVersionHistory'

export default function Workspace(): React.JSX.Element {
  const {
    projects,
    currentProject,
    notes,
    tasks,
    files,
    tags,
    selectProject,
    loadItems,
    loadProjects,
    deleteNote,
    deleteTask,
    createNote,
    createTask,
    updateNote,
    updateTask
  } = useWorkspaceStore()

  const { openModal } = useModalStore()
  const { pushAction } = useHistoryStore()

  // Selected item state for right context panel
  const [selectedItem, setSelectedItem] = useState<{
    id: string
    type: 'note' | 'task' | 'file'
    title: string
    description: string
    createdAt: string
    summary: string | null
    details: any
  } | null>(null)

  // Filters and views
  const [activeFilter, setActiveFilter] = useState<'all' | 'notes' | 'tasks' | 'files'>('all')
  const [viewMode, setViewMode] = useState<'card' | 'list'>('card')
  const [searchQuery, setSearchQuery] = useState('')

  // Expand states for folders
  const [projectsExpanded, setProjectsExpanded] = useState(true)
  const [tagsExpanded, setTagsExpanded] = useState(true)

  // Phase 2 Semantic Intelligence States
  const [relatedItems, setRelatedItems] = useState<any[]>([])
  const [extractedEntities, setExtractedEntities] = useState<any[]>([])

  // Phase 3 LLM Summary States
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)

  const handleGenerateSummary = async () => {
    if (!selectedItem || isGeneratingSummary) return
    setIsGeneratingSummary(true)
    try {
      const summaryText = await window.api.llm.summarize(selectedItem.description)

      // Update database
      const table = selectedItem.type === 'note' ? 'notes' : 'files'
      await window.api.db.execute(`UPDATE ${table} SET summary = ? WHERE id = ?`, [
        summaryText,
        selectedItem.id
      ])

      // Update local state
      setSelectedItem((prev) => (prev ? { ...prev, summary: summaryText } : null))

      // Reload workspace items to sync store state
      await loadItems()
    } catch (err) {
      console.error('Failed to generate summary:', err)
    } finally {
      setIsGeneratingSummary(false)
    }
  }

  // Phase 7C States & Handlers
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false)
  const [editorTitle, setEditorTitle] = useState('')
  const [editorContent, setEditorContent] = useState('')
  const [recoverableDrafts, setRecoverableDrafts] = useState<any[]>([])

  // Phase 9 States
  const { privacyMode } = usePrivacyStore()
  const [isItemVersionHistoryOpen, setIsItemVersionHistoryOpen] = useState(false)

  // Check for recoverable drafts on mount
  useEffect(() => {
    window.api.drafts
      .getRecoverable()
      .then((draftsList) => {
        if (draftsList && draftsList.length > 0) {
          setRecoverableDrafts(draftsList)
        }
      })
      .catch(console.error)
  }, [])

  // Autosave interval check
  useEffect(() => {
    const interval = setInterval(async () => {
      if (selectedItem && selectedItem.type === 'note') {
        const currentNote = notes.find((n) => n.id === selectedItem.id)
        if (
          currentNote &&
          (editorTitle !== currentNote.title || editorContent !== (currentNote.raw_text || ''))
        ) {
          await window.api.drafts.save(selectedItem.id, editorTitle, editorContent)
          console.log('Autosaved note draft:', selectedItem.id)
        }
      }
    }, 5000)
    return () => clearInterval(interval)
  }, [selectedItem?.id, editorTitle, editorContent, notes])

  const handleRecoverDraft = async (draft: any) => {
    try {
      const noteExists = notes.some((n) => n.id === draft.note_id)
      if (noteExists) {
        await updateNote(draft.note_id, draft.title, draft.content, draft.content)
      } else {
        await window.api.db.execute(
          'INSERT INTO notes (id, title, content, raw_text, updated_at) VALUES (?, ?, ?, ?, datetime("now"))',
          [draft.note_id, draft.title, draft.content, draft.content]
        )
      }
      await window.api.drafts.discard(draft.note_id)
      setRecoverableDrafts((prev) => prev.filter((d) => d.note_id !== draft.note_id))
      await loadItems()

      const loaded = notes.find((n) => n.id === draft.note_id)
      if (loaded) {
        handleSelectItem(loaded, 'note')
      } else {
        const dbNotes = await window.api.db.query('SELECT * FROM notes WHERE id = ?', [
          draft.note_id
        ])
        if (dbNotes.length > 0) handleSelectItem(dbNotes[0], 'note')
      }
      alert(`Draft for "${draft.title}" recovered!`)
    } catch (err) {
      console.error('Failed to recover draft:', err)
    }
  }

  const handleDiscardDraft = async (draft: any) => {
    try {
      await window.api.drafts.discard(draft.note_id)
      setRecoverableDrafts((prev) => prev.filter((d) => d.note_id !== draft.note_id))
    } catch (err) {
      console.error('Failed to discard draft:', err)
    }
  }

  // Sync editor with selected note
  useEffect(() => {
    if (selectedItem && selectedItem.type === 'note') {
      setEditorTitle(selectedItem.title)
      setEditorContent(selectedItem.description || '')
    } else {
      setEditorTitle('')
      setEditorContent('')
    }
  }, [selectedItem?.id])

  const handleSaveNote = async () => {
    if (!selectedItem || selectedItem.type !== 'note') return
    try {
      const prevNote = notes.find((n) => n.id === selectedItem.id)
      const originalTitle = prevNote ? prevNote.title : ''
      const originalContent = prevNote ? prevNote.raw_text || '' : ''

      await updateNote(selectedItem.id, editorTitle, editorContent, editorContent)

      const savedTitle = editorTitle
      const savedContent = editorContent
      pushAction({
        type: 'EDIT_NOTE',
        undo: async () => {
          await updateNote(selectedItem.id, originalTitle, originalContent, originalContent)
          setEditorTitle(originalTitle)
          setEditorContent(originalContent)
          setSelectedItem((prev) =>
            prev ? { ...prev, title: originalTitle, description: originalContent } : null
          )
          await loadItems()
        },
        redo: async () => {
          await updateNote(selectedItem.id, savedTitle, savedContent, savedContent)
          setEditorTitle(savedTitle)
          setEditorContent(savedContent)
          setSelectedItem((prev) =>
            prev ? { ...prev, title: savedTitle, description: savedContent } : null
          )
          await loadItems()
        },
        description: `Edit note "${savedTitle}"`
      })

      setSelectedItem((prev) =>
        prev ? { ...prev, title: editorTitle, description: editorContent } : null
      )
      await window.api.drafts.discard(selectedItem.id)
      await loadItems()
    } catch (err) {
      console.error('Failed to save note changes:', err)
    }
  }

  const handleRestoreNoteVersion = (restoredTitle: string, restoredContent: string) => {
    setEditorTitle(restoredTitle)
    setEditorContent(restoredContent)
    setSelectedItem((prev) =>
      prev ? { ...prev, title: restoredTitle, description: restoredContent } : null
    )
    loadItems()
  }

  const handleRestoreItemVersion = async (restoredData: any) => {
    await loadItems()
    if (selectedItem) {
      if (selectedItem.type === 'task') {
        setSelectedItem({
          ...selectedItem,
          title: restoredData.title,
          description: restoredData.description,
          details: restoredData
        })
      } else if (selectedItem.type === 'file') {
        setSelectedItem({
          ...selectedItem,
          title: restoredData.name,
          description: restoredData.raw_text,
          details: restoredData
        })
      }
    }
  }

  useEffect(() => {
    if (!selectedItem) {
      setRelatedItems([])
      setExtractedEntities([])
      return
    }

    // Fetch related items via semantic search
    window.api.intelligence
      .search(selectedItem.title, { limit: 5 })
      .then((res) => {
        const filtered = res.filter((item) => item.id !== selectedItem.id)
        setRelatedItems(filtered)
      })
      .catch(console.error)

    // Fetch entities extracted from this item
    window.api.db
      .query(
        'SELECT e.name, e.type FROM entities e JOIN entity_mentions em ON e.id = em.entity_id WHERE em.source_id = ?',
        [selectedItem.id]
      )
      .then((res) => {
        setExtractedEntities(res)
      })
      .catch(console.error)
  }, [selectedItem?.id])

  useEffect(() => {
    loadItems()
  }, [currentProject])

  const handleSelectItem = (item: any, type: 'note' | 'task' | 'file'): void => {
    if (type === 'note') {
      setSelectedItem({
        id: item.id,
        type,
        title: item.title,
        description: item.raw_text || 'No content',
        createdAt: item.created_at,
        summary: item.summary || null,
        details: item
      })
    } else if (type === 'task') {
      setSelectedItem({
        id: item.id,
        type,
        title: item.title,
        description: item.description || 'No description',
        createdAt: item.created_at,
        summary: null,
        details: item
      })
    } else if (type === 'file') {
      setSelectedItem({
        id: item.id,
        type,
        title: item.name,
        description: item.raw_text || 'Metadata preview only',
        createdAt: item.created_at,
        summary: item.summary || null,
        details: item
      })
    }
  }

  const handleAddProject = (): void => {
    openModal('newProject')
  }

  const handleAddNote = async (): Promise<void> => {
    const note = await createNote('Untitled Note', '', '')
    handleSelectItem(note, 'note')

    pushAction({
      type: 'ADD_NOTE',
      undo: async () => {
        await deleteNote(note.id)
        if (selectedItem?.id === note.id) setSelectedItem(null)
        await loadItems()
      },
      redo: async () => {
        await window.api.db.execute(
          'INSERT INTO notes (id, project_id, title, content, raw_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            note.id,
            note.project_id,
            note.title,
            note.content,
            note.raw_text,
            note.created_at,
            note.updated_at
          ]
        )
        await window.api.intelligence
          .indexItem(note.id, 'note', note.title, note.raw_text)
          .catch(console.error)
        await loadItems()
      },
      description: `Add note "${note.title}"`
    })

    await loadItems()
  }

  const handleAddTask = (): void => {
    openModal('taskCreation')
  }

  const handleToggleTaskStatus = async (e: React.MouseEvent, task: Task) => {
    e.stopPropagation()
    const nextStatus = task.status === 'Completed' ? 'Todo' : 'Completed'
    const prevStatus = task.status

    await updateTask(task.id, { status: nextStatus })

    pushAction({
      type: 'TOGGLE_TASK_STATUS',
      undo: async () => {
        await updateTask(task.id, { status: prevStatus })
        await loadItems()
      },
      redo: async () => {
        await updateTask(task.id, { status: nextStatus })
        await loadItems()
      },
      description: `Toggle status of task "${task.title}" to ${nextStatus}`
    })

    await loadItems()
  }

  const handleDeleteItem = async (
    e: React.MouseEvent,
    id: string,
    type: 'note' | 'task'
  ): Promise<void> => {
    e.stopPropagation()
    if (type === 'note') {
      const noteToDelete = notes.find((n) => n.id === id)
      if (!noteToDelete) return
      await deleteNote(id)

      pushAction({
        type: 'DELETE_NOTE',
        undo: async () => {
          await window.api.db.execute(
            'INSERT INTO notes (id, project_id, title, content, raw_text, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              noteToDelete.id,
              noteToDelete.project_id,
              noteToDelete.title,
              noteToDelete.content,
              noteToDelete.raw_text,
              noteToDelete.created_at,
              noteToDelete.updated_at
            ]
          )
          await window.api.intelligence
            .indexItem(noteToDelete.id, 'note', noteToDelete.title, noteToDelete.raw_text)
            .catch(console.error)
          await loadItems()
        },
        redo: async () => {
          await deleteNote(id)
          await loadItems()
        },
        description: `Delete note "${noteToDelete.title}"`
      })
    } else {
      const taskToDelete = tasks.find((t) => t.id === id)
      if (!taskToDelete) return
      await deleteTask(id)

      pushAction({
        type: 'DELETE_TASK',
        undo: async () => {
          await window.api.db.execute(
            'INSERT INTO tasks (id, project_id, title, description, due_date, priority, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              taskToDelete.id,
              taskToDelete.project_id,
              taskToDelete.title,
              taskToDelete.description,
              taskToDelete.due_date,
              taskToDelete.priority,
              taskToDelete.status,
              taskToDelete.created_at,
              taskToDelete.updated_at
            ]
          )
          if (taskToDelete.subtasks) {
            for (const sub of taskToDelete.subtasks) {
              await window.api.db.execute(
                'INSERT INTO subtasks (id, task_id, title, completed, created_at) VALUES (?, ?, ?, ?, ?)',
                [sub.id, sub.task_id, sub.title, sub.completed, sub.created_at]
              )
            }
          }
          await window.api.intelligence
            .indexItem(taskToDelete.id, 'task', taskToDelete.title, taskToDelete.description)
            .catch(console.error)
          await loadItems()
        },
        redo: async () => {
          await deleteTask(id)
          await loadItems()
        },
        description: `Delete task "${taskToDelete.title}"`
      })
    }
    if (selectedItem?.id === id) {
      setSelectedItem(null)
    }
    await loadItems()
  }

  const handleSecureDeleteItem = async (
    e: React.MouseEvent,
    id: string,
    type: 'note' | 'task'
  ): Promise<void> => {
    e.stopPropagation()
    const confirmMsg = `Are you sure you want to SECURELY delete this ${type}? This will overwrite all fields 3 times and perform a database VACUUM. It CANNOT be undone!`
    if (!confirm(confirmMsg)) return

    try {
      const res = await window.api.privacy.secureDelete(type, id)
      if (res.success) {
        alert(`${type} securely expunged.`)
        if (selectedItem?.id === id) {
          setSelectedItem(null)
        }
        await loadItems()
      } else {
        alert('Secure delete failed.')
      }
    } catch (err) {
      console.error(err)
    }
  }

  // Drag and Drop mechanics
  const handleDragStart = (e: React.DragEvent, id: string, type: 'note' | 'task') => {
    e.dataTransfer.setData('text/plain', JSON.stringify({ id, type }))
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDropOnProject = async (e: React.DragEvent, projectId: string | null) => {
    e.preventDefault()
    try {
      const rawData = e.dataTransfer.getData('text/plain')
      if (!rawData) return
      const { id, type } = JSON.parse(rawData)

      if (type === 'note') {
        const note = notes.find((n) => n.id === id)
        if (!note) return
        const oldProjId = note.project_id
        await window.api.db.execute('UPDATE notes SET project_id = ? WHERE id = ?', [projectId, id])

        pushAction({
          type: 'MOVE_NOTE_PROJECT',
          undo: async () => {
            await window.api.db.execute('UPDATE notes SET project_id = ? WHERE id = ?', [
              oldProjId,
              id
            ])
            await loadItems()
          },
          redo: async () => {
            await window.api.db.execute('UPDATE notes SET project_id = ? WHERE id = ?', [
              projectId,
              id
            ])
            await loadItems()
          },
          description: `Move note "${note.title}"`
        })
      } else if (type === 'task') {
        const task = tasks.find((t) => t.id === id)
        if (!task) return
        const oldProjId = task.project_id
        await window.api.db.execute('UPDATE tasks SET project_id = ? WHERE id = ?', [projectId, id])

        pushAction({
          type: 'MOVE_TASK_PROJECT',
          undo: async () => {
            await window.api.db.execute('UPDATE tasks SET project_id = ? WHERE id = ?', [
              oldProjId,
              id
            ])
            await loadItems()
          },
          redo: async () => {
            await window.api.db.execute('UPDATE tasks SET project_id = ? WHERE id = ?', [
              projectId,
              id
            ])
            await loadItems()
          },
          description: `Move task "${task.title}"`
        })
      }
      await loadItems()
    } catch (err) {
      console.error('Drop on project failed:', err)
    }
  }

  const handleDropOnTag = async (e: React.DragEvent, tagId: string, tagName: string) => {
    e.preventDefault()
    try {
      const rawData = e.dataTransfer.getData('text/plain')
      if (!rawData) return
      const { id, type } = JSON.parse(rawData)

      await window.api.db.execute(
        'INSERT OR IGNORE INTO item_tags (tag_id, item_id, item_type) VALUES (?, ?, ?)',
        [tagId, id, type]
      )

      pushAction({
        type: 'TAG_ITEM',
        undo: async () => {
          await window.api.db.execute('DELETE FROM item_tags WHERE tag_id = ? AND item_id = ?', [
            tagId,
            id
          ])
          await loadItems()
        },
        redo: async () => {
          await window.api.db.execute(
            'INSERT OR IGNORE INTO item_tags (tag_id, item_id, item_type) VALUES (?, ?, ?)',
            [tagId, id, type]
          )
          await loadItems()
        },
        description: `Tag item with #${tagName}`
      })
      await loadItems()
    } catch (err) {
      console.error('Drop on tag failed:', err)
    }
  }

  // Filter items based on search query
  const filteredNotes = notes.filter((n) =>
    n.title.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredTasks = tasks.filter((t) =>
    t.title.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const filteredFiles = files.filter((f) =>
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

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
      {/* 1. Left Panel: Organization Tree */}
      <div
        className="card"
        style={{
          width: 220,
          display: 'flex',
          flexDirection: 'column',
          padding: 16,
          height: '100%',
          overflowY: 'auto',
          flexShrink: 0
        }}
      >
        {/* Projects section */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
              cursor: 'pointer'
            }}
            onClick={() => setProjectsExpanded(!projectsExpanded)}
          >
            <span className="font-semibold text-sm flex items-center gap-1">
              {projectsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              PROJECTS
            </span>
            <button
              className="btn-ghost"
              style={{ padding: 2, borderRadius: 4 }}
              onClick={(e) => {
                e.stopPropagation()
                handleAddProject()
              }}
              title="New Project"
            >
              <Plus size={14} />
            </button>
          </div>

          {projectsExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingLeft: 8 }}>
              <div
                style={{
                  padding: '6px 10px',
                  borderRadius: 6,
                  fontSize: '13px',
                  fontWeight: !currentProject ? 600 : 500,
                  color: !currentProject ? 'var(--color-secondary)' : 'var(--text-muted)',
                  backgroundColor: !currentProject ? 'rgba(52, 152, 219, 0.08)' : 'transparent',
                  cursor: 'pointer'
                }}
                onClick={() => selectProject(null)}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDropOnProject(e, null)}
              >
                📁 All Projects
              </div>
              {projects.map((p) => {
                const isSelected = currentProject?.id === p.id
                return (
                  <div
                    key={p.id}
                    style={{
                      padding: '6px 10px',
                      borderRadius: 6,
                      fontSize: '13px',
                      fontWeight: isSelected ? 600 : 500,
                      color: isSelected ? p.color : 'var(--text-muted)',
                      backgroundColor: isSelected ? 'rgba(0,0,0,0.03)' : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6
                    }}
                    onClick={() => selectProject(p)}
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDropOnProject(e, p.id)}
                  >
                    <span
                      style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: p.color }}
                    />
                    <span
                      style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {p.name}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Tags section */}
        <div style={{ marginBottom: 20 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
              cursor: 'pointer'
            }}
            onClick={() => setTagsExpanded(!tagsExpanded)}
          >
            <span className="font-semibold text-sm flex items-center gap-1">
              {tagsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              TAGS
            </span>
          </div>

          {tagsExpanded && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingLeft: 8 }}>
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  style={{
                    fontSize: '11px',
                    padding: '2px 8px',
                    borderRadius: 12,
                    backgroundColor: 'var(--bg-surface)',
                    border: `1px solid ${tag.color}`,
                    color: tag.color,
                    cursor: 'pointer'
                  }}
                  onClick={() => setSearchQuery(`#${tag.name}`)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDropOnTag(e, tag.id, tag.name)}
                >
                  #{tag.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 2. Middle Panel: Content Grid */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Workspace Toolbar */}
        <div
          className="card flex justify-between items-center"
          style={{ padding: 12, marginBottom: 16, borderRadius: 8 }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { id: 'all', label: 'All Items' },
              { id: 'notes', label: 'Notes' },
              { id: 'tasks', label: 'Tasks' },
              { id: 'files', label: 'Files' }
            ].map((f) => (
              <button
                key={f.id}
                className="btn btn-ghost"
                onClick={() => setActiveFilter(f.id as any)}
                style={{
                  padding: '6px 12px',
                  fontSize: '13px',
                  backgroundColor: activeFilter === f.id ? 'var(--bg-surface)' : 'transparent',
                  color: activeFilter === f.id ? 'var(--text-main)' : 'var(--text-muted)'
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <input
              type="text"
              className="input-field"
              placeholder="Search in workspace..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '6px 12px', width: 180, fontSize: '13px' }}
            />
            <button
              className="btn btn-secondary"
              style={{ padding: '6px 10px' }}
              onClick={handleAddNote}
              title="New Note"
            >
              <Plus size={14} /> Note
            </button>
            <button
              className="btn btn-primary"
              style={{ padding: '6px 10px' }}
              onClick={handleAddTask}
              title="New Task"
            >
              <Plus size={14} /> Task
            </button>
          </div>
        </div>

        {/* Content list viewport */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 16
            }}
          >
            {/* Notes Rendering */}
            {(activeFilter === 'all' || activeFilter === 'notes') &&
              filteredNotes.map((note) => (
                <div
                  key={note.id}
                  className="card flex flex-col justify-between"
                  style={{
                    minHeight: 120,
                    cursor: 'grab',
                    borderLeft: '4px solid var(--color-secondary)',
                    backgroundColor:
                      selectedItem?.id === note.id
                        ? 'rgba(52, 152, 219, 0.05)'
                        : 'var(--bg-surface-elevated)'
                  }}
                  onClick={() => handleSelectItem(note, 'note')}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, note.id, 'note')}
                >
                  <div>
                    <h5
                      className="font-semibold text-sm flex items-center gap-2"
                      style={{ marginBottom: 6 }}
                    >
                      <FileText size={14} className="text-muted" />
                      <span>{note.title || 'Untitled Note'}</span>
                    </h5>
                    <p
                      className="text-muted"
                      style={{
                        fontSize: '12px',
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {note.raw_text || 'No additional content.'}
                    </p>
                  </div>
                  <div className="flex justify-between items-center" style={{ marginTop: 12 }}>
                    <span className="font-mono text-muted" style={{ fontSize: '10px' }}>
                      {new Date(note.updated_at).toLocaleDateString()}
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        className="btn-ghost"
                        style={{ padding: 4, borderRadius: 4 }}
                        onClick={(e) => handleSecureDeleteItem(e, note.id, 'note')}
                        title="Securely expunge note"
                      >
                        <Shield size={12} color="#e74c3c" />
                      </button>
                      <button
                        className="btn-ghost"
                        style={{ padding: 4, borderRadius: 4 }}
                        onClick={(e) => handleDeleteItem(e, note.id, 'note')}
                        title="Delete note"
                      >
                        <Trash2 size={12} className="text-muted" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

            {/* Tasks Rendering */}
            {(activeFilter === 'all' || activeFilter === 'tasks') &&
              filteredTasks.map((task) => (
                <div
                  key={task.id}
                  className="card flex flex-col justify-between"
                  style={{
                    minHeight: 120,
                    cursor: 'grab',
                    borderLeft: '4px solid var(--color-success)',
                    backgroundColor:
                      selectedItem?.id === task.id
                        ? 'rgba(46, 204, 113, 0.05)'
                        : 'var(--bg-surface-elevated)'
                  }}
                  onClick={() => handleSelectItem(task, 'task')}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, task.id, 'task')}
                >
                  <div>
                    <h5
                      className="font-semibold text-sm flex items-center gap-2"
                      style={{ marginBottom: 6 }}
                    >
                      <CheckSquare size={14} className="text-muted" />
                      <span>{task.title}</span>
                    </h5>
                    <p className="text-muted" style={{ fontSize: '12px' }}>
                      {task.description || 'No description.'}
                    </p>
                  </div>
                  <div className="flex justify-between items-center" style={{ marginTop: 12 }}>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: 4,
                        backgroundColor:
                          task.status === 'Completed'
                            ? 'rgba(46, 204, 113, 0.1)'
                            : 'rgba(230, 126, 34, 0.1)',
                        color:
                          task.status === 'Completed'
                            ? 'var(--color-success)'
                            : 'var(--color-accent)',
                        cursor: 'pointer'
                      }}
                      onClick={(e) => handleToggleTaskStatus(e, task)}
                      title="Click to toggle status"
                    >
                      {task.status}
                    </span>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <button
                        className="btn-ghost"
                        style={{ padding: 4, borderRadius: 4 }}
                        onClick={(e) => handleSecureDeleteItem(e, task.id, 'task')}
                        title="Securely expunge task"
                      >
                        <Shield size={12} color="#e74c3c" />
                      </button>
                      <button
                        className="btn-ghost"
                        style={{ padding: 4, borderRadius: 4 }}
                        onClick={(e) => handleDeleteItem(e, task.id, 'task')}
                        title="Delete task"
                      >
                        <Trash2 size={12} className="text-muted" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

            {/* Files Ingested Rendering */}
            {(activeFilter === 'all' || activeFilter === 'files') &&
              filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className="card flex flex-col justify-between"
                  style={{
                    minHeight: 120,
                    cursor: 'pointer',
                    borderLeft: '4px solid #95a5a6',
                    backgroundColor:
                      selectedItem?.id === file.id
                        ? 'rgba(149, 165, 166, 0.05)'
                        : 'var(--bg-surface-elevated)'
                  }}
                  onClick={() => handleSelectItem(file, 'file')}
                >
                  <div>
                    <h5
                      className="font-semibold text-sm flex items-center gap-2"
                      style={{ marginBottom: 6 }}
                    >
                      <File size={14} className="text-muted" />
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {file.name}
                      </span>
                    </h5>
                    <span className="font-mono text-muted" style={{ fontSize: '11px' }}>
                      Type: {file.type} | {(file.size_bytes / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <div className="flex justify-between items-center" style={{ marginTop: 12 }}>
                    <span className="font-mono text-muted" style={{ fontSize: '10px' }}>
                      {new Date(file.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* 3. Right Panel: Context Details */}
      <div
        className="card"
        style={{
          width: 280,
          display: 'flex',
          flexDirection: 'column',
          padding: 20,
          height: '100%',
          overflowY: 'auto',
          flexShrink: 0
        }}
      >
        {selectedItem ? (
          <div className="flex flex-col gap-4" style={{ height: '100%' }}>
            <div>
              <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    color: 'var(--color-secondary)',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    padding: '2px 8px',
                    borderRadius: 4
                  }}
                >
                  {selectedItem.type}
                </span>
                <span className="font-mono text-muted" style={{ fontSize: '10px' }}>
                  {new Date(selectedItem.createdAt).toLocaleDateString()}
                </span>
              </div>
              {selectedItem.type === 'note' ? (
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}
                >
                  <div className="input-group">
                    <span className="input-label">NOTE TITLE</span>
                    <input
                      type="text"
                      className="input-field"
                      value={editorTitle}
                      onChange={(e) => setEditorTitle(e.target.value)}
                      style={{
                        fontSize: '13px',
                        padding: '6px 10px',
                        filter: privacyMode ? 'blur(4px)' : 'none'
                      }}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <KnowledgeQualityBadge title={editorTitle} content={editorContent} />
                    <button
                      className="btn btn-ghost flex items-center gap-1"
                      onClick={() => setIsVersionHistoryOpen(true)}
                      style={{ fontSize: '11px', padding: '4px 8px' }}
                      type="button"
                    >
                      <Clock size={12} />
                      <span>History</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <h4
                      className="font-semibold text-lg"
                      style={{ margin: 0, filter: privacyMode ? 'blur(4px)' : 'none' }}
                    >
                      {selectedItem.title}
                    </h4>
                    <button
                      className="btn btn-ghost flex items-center gap-1"
                      onClick={() => setIsItemVersionHistoryOpen(true)}
                      style={{ fontSize: '11px', padding: '4px 8px' }}
                      type="button"
                    >
                      <Clock size={12} />
                      <span>History</span>
                    </button>
                  </div>

                  {/* Extracted Named Entities */}
                  {extractedEntities.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                      {extractedEntities.map((ent, idx) => (
                        <span
                          key={idx}
                          style={{
                            fontSize: '10px',
                            padding: '2px 8px',
                            borderRadius: 12,
                            backgroundColor:
                              ent.type === 'person'
                                ? 'rgba(52, 152, 219, 0.15)'
                                : ent.type === 'organization'
                                  ? 'rgba(155, 89, 182, 0.15)'
                                  : 'rgba(46, 204, 113, 0.15)',
                            color:
                              ent.type === 'person'
                                ? 'var(--color-secondary)'
                                : ent.type === 'organization'
                                  ? '#9b59b6'
                                  : 'var(--color-success)',
                            fontWeight: 600
                          }}
                        >
                          {ent.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div
              style={{
                flex: 1,
                borderTop: '1px solid var(--border-color)',
                paddingTop: 16,
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <span className="input-label" style={{ display: 'block', marginBottom: 8 }}>
                {selectedItem.type === 'note' ? 'NOTE EDITOR' : 'DETAILS PREVIEW'}
              </span>

              {selectedItem.type === 'note' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                  <textarea
                    className="input-field"
                    value={editorContent}
                    onChange={(e) => setEditorContent(e.target.value)}
                    style={{
                      fontSize: '13px',
                      lineHeight: '1.5',
                      fontFamily: 'inherit',
                      resize: 'none',
                      flex: 1,
                      minHeight: 120,
                      backgroundColor: 'var(--bg-surface)',
                      padding: 10,
                      borderRadius: 6,
                      filter: privacyMode ? 'blur(4px)' : 'none'
                    }}
                  />
                  <button
                    className="btn btn-primary w-full flex items-center justify-center"
                    onClick={handleSaveNote}
                    style={{ padding: '8px 12px' }}
                  >
                    Save Note Changes
                  </button>
                </div>
              ) : (
                <p
                  style={{
                    fontSize: '13px',
                    lineHeight: '1.5',
                    color: 'var(--text-muted)',
                    whiteSpace: 'pre-wrap',
                    maxHeight: 180,
                    overflowY: 'auto',
                    backgroundColor: 'var(--bg-surface)',
                    padding: 10,
                    borderRadius: 6,
                    filter: privacyMode ? 'blur(4px)' : 'none'
                  }}
                >
                  {selectedItem.description}
                </p>
              )}

              {/* AI Summary Section */}
              {(selectedItem.type === 'note' || selectedItem.type === 'file') && (
                <div style={{ marginTop: 16 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 6
                    }}
                  >
                    <span className="input-label">AI SUMMARY</span>
                    <button
                      className="btn-ghost"
                      onClick={handleGenerateSummary}
                      disabled={isGeneratingSummary}
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      <Sparkles size={10} className="text-secondary" />
                      <span>
                        {isGeneratingSummary
                          ? 'Summarizing...'
                          : selectedItem.summary
                            ? 'Re-generate'
                            : 'Generate'}
                      </span>
                    </button>
                  </div>
                  {selectedItem.summary ? (
                    <p
                      style={{
                        fontSize: '12px',
                        lineHeight: '1.4',
                        color: 'var(--text-muted)',
                        fontStyle: 'italic',
                        padding: 8,
                        borderRadius: 6,
                        backgroundColor: 'rgba(52, 152, 219, 0.05)',
                        border: '1px solid rgba(52, 152, 219, 0.1)'
                      }}
                    >
                      "{selectedItem.summary}"
                    </p>
                  ) : (
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      No summary generated yet. Click generate to summarize.
                    </span>
                  )}
                </div>
              )}

              {/* Semantic Recommendations */}
              <div style={{ marginTop: 20 }}>
                <span className="input-label" style={{ display: 'block', marginBottom: 8 }}>
                  SEMANTIC RECOMMENDATIONS
                </span>
                <div className="flex flex-col gap-2">
                  {relatedItems.length === 0 ? (
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      No semantically related items found
                    </span>
                  ) : (
                    relatedItems.map((item) => (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '8px 10px',
                          borderRadius: 6,
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border-color)',
                          fontSize: '12px'
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 160
                          }}
                          title={item.title}
                        >
                          {item.title}
                        </span>
                        <span
                          className="font-mono"
                          style={{ fontSize: '10px', color: 'var(--color-secondary)' }}
                        >
                          {(item.score * 100).toFixed(0)}% Match
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div
              style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16 }}
              className="flex flex-col gap-2"
            >
              <button
                className="btn btn-secondary w-full"
                style={{ padding: '8px 12px' }}
                onClick={() => openModal('aiQuery', selectedItem)}
              >
                🤖 AI Analyze
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
            <Layers size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
            <span className="text-sm">
              Select an item in workspace to display context parameters
            </span>
          </div>
        )}
      </div>

      {selectedItem && selectedItem.type === 'note' && (
        <NoteVersionHistory
          isOpen={isVersionHistoryOpen}
          onClose={() => setIsVersionHistoryOpen(false)}
          noteId={selectedItem.id}
          currentTitle={editorTitle}
          currentContent={editorContent}
          onRestore={handleRestoreNoteVersion}
        />
      )}

      {selectedItem && (selectedItem.type === 'task' || selectedItem.type === 'file') && (
        <ItemVersionHistory
          isOpen={isItemVersionHistoryOpen}
          onClose={() => setIsItemVersionHistoryOpen(false)}
          entityId={selectedItem.id}
          entityType={selectedItem.type as any}
          currentData={selectedItem.details}
          onRestore={handleRestoreItemVersion}
        />
      )}

      {/* Unsaved Drafts Recovery Prompt */}
      {recoverableDrafts.length > 0 && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 450 }}>
            <div className="modal-header" style={{ borderBottomColor: 'var(--color-accent)' }}>
              <h4
                className="font-semibold flex items-center gap-2"
                style={{ color: 'var(--color-accent)' }}
              >
                <Clock size={16} />
                <span>Recover Unsaved Drafts</span>
              </h4>
            </div>
            <div className="modal-body flex flex-col gap-4">
              <p className="text-sm text-muted">
                Unsaved drafts were found from a previous session. You can recover these changes or
                discard them.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {recoverableDrafts.map((draft) => (
                  <div
                    key={draft.note_id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 12,
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-surface)'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        overflow: 'hidden',
                        marginRight: 12
                      }}
                    >
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {draft.title || 'Untitled Note'}
                      </span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Last modified: {new Date(draft.updated_at).toLocaleString()}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                      <button
                        className="btn btn-primary"
                        style={{ padding: '4px 8px', fontSize: '11px' }}
                        onClick={() => handleRecoverDraft(draft)}
                      >
                        Recover
                      </button>
                      <button
                        className="btn btn-secondary"
                        style={{
                          padding: '4px 8px',
                          fontSize: '11px',
                          color: 'var(--color-error)'
                        }}
                        onClick={() => handleDiscardDraft(draft)}
                      >
                        Discard
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setRecoverableDrafts([])}>
                Close Dialog
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
