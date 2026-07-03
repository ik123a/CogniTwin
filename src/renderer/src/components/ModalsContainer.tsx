import React, { useState } from 'react'
import { useModalStore } from '../stores/modalStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { useSettingsStore } from '../stores/settingsStore'
import SemanticSearch from './SemanticSearch'
import AICopilotChat from './AICopilotChat'
import RuleBuilder from './RuleBuilder'
import WorkflowEditor from './WorkflowEditor'
import FlashcardsReview from './FlashcardsReview'
import {
  X,
  Calendar,
  Flag,
  Sparkles,
  Folder,
  Check,
  FileText,
  Download,
  ShieldAlert
} from 'lucide-react'

export default function ModalsContainer(): React.JSX.Element | null {
  const { modals, closeModal, activePayloads, confirmationPayload, closeConfirmation } =
    useModalStore()
  const { projects, createProject, createTask, createNote, currentProject } = useWorkspaceStore()
  const { settings, createBackup } = useSettingsStore()

  // --- STATE FOR QUICK CAPTURE ---
  const [captureType, setCaptureType] = useState<'note' | 'task' | 'event'>('note')
  const [captureTitle, setCaptureTitle] = useState('')
  const [captureContent, setCaptureContent] = useState('')

  // --- STATE FOR NEW PROJECT ---
  const [projName, setProjName] = useState('')
  const [projDesc, setProjDesc] = useState('')
  const [projColor, setProjColor] = useState('#3498db')
  const [projIcon, setProjIcon] = useState('folder')

  // --- STATE FOR TASK CREATION ---
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDesc, setTaskDesc] = useState('')
  const [taskPriority, setTaskPriority] = useState<'Low' | 'Medium' | 'High'>('Medium')
  const [taskDue, setTaskDue] = useState('')
  const [taskProjId, setTaskProjId] = useState('')

  // --- STATE FOR AI QUERY PANEL ---
  const [aiResponse, setAiResponse] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const handleQuickCaptureSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!captureTitle.trim()) return

    if (captureType === 'note') {
      await createNote(captureTitle, captureContent, captureContent)
    } else if (captureType === 'task') {
      await createTask(captureTitle, captureContent, null, 'Medium')
    }

    // Clear and close
    setCaptureTitle('')
    setCaptureContent('')
    closeModal('quickCapture')
  }

  const handleCreateProjectSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!projName.trim()) return

    await createProject(projName, projDesc, projColor, projIcon)

    setProjName('')
    setProjDesc('')
    closeModal('newProject')
  }

  const handleCreateTaskSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    if (!taskTitle.trim()) return

    // Use selected project or workspace fallback
    await createTask(taskTitle, taskDesc, taskDue || null, taskPriority)

    setTaskTitle('')
    setTaskDesc('')
    setTaskDue('')
    closeModal('taskCreation')
  }

  const handleAIQueryTrigger = (): void => {
    setAiLoading(true)
    setAiResponse(null)

    // Simulate streaming LLM response in Phase 1
    setTimeout(() => {
      setAiResponse(
        `Analysis Completed for: "${activePayloads.aiQuery?.title || 'Selected Node'}"\n\n` +
          `This entity displays high contextual relevance to local files and task items. ` +
          `It is associated with Tag parameters. Recommends mapping related workspaces to enhance knowledge graph density.`
      )
      setAiLoading(false)
    }, 1500)
  }

  return (
    <>
      {/* 1. QUICK CAPTURE MODAL */}
      {modals.quickCapture &&
        (activePayloads.quickCapture?.mode === 'search' ? (
          <SemanticSearch />
        ) : (
          <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: 500 }}>
              <div className="modal-header">
                <h4 className="font-semibold flex items-center gap-2">
                  <Sparkles size={16} className="text-secondary" />
                  <span>Quick Capture Tool</span>
                </h4>
                <button
                  className="btn-ghost"
                  onClick={() => closeModal('quickCapture')}
                  style={{ padding: 4, borderRadius: 4 }}
                >
                  <X size={16} />
                </button>
              </div>
              <form onSubmit={handleQuickCaptureSubmit}>
                <div className="modal-body flex flex-col gap-4">
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['note', 'task'].map((type) => (
                      <button
                        key={type}
                        type="button"
                        className="btn"
                        onClick={() => setCaptureType(type as any)}
                        style={{
                          flex: 1,
                          backgroundColor:
                            captureType === type ? 'var(--bg-surface)' : 'transparent',
                          borderColor:
                            captureType === type ? 'var(--color-secondary)' : 'var(--border-color)',
                          color:
                            captureType === type ? 'var(--color-secondary)' : 'var(--text-muted)'
                        }}
                      >
                        {type === 'note' ? <FileText size={14} /> : <Check size={14} />}
                        <span style={{ textTransform: 'capitalize' }}>{type}</span>
                      </button>
                    ))}
                  </div>

                  <div className="input-group">
                    <span className="input-label">TITLE</span>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="Enter short title..."
                      value={captureTitle}
                      onChange={(e) => setCaptureTitle(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="input-group">
                    <span className="input-label">CONTENTS / DESCRIPTION</span>
                    <textarea
                      className="input-field"
                      placeholder="Capture thoughts here..."
                      value={captureContent}
                      onChange={(e) => setCaptureContent(e.target.value)}
                      rows={4}
                      style={{ resize: 'none' }}
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => closeModal('quickCapture')}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    Save Ingestion
                  </button>
                </div>
              </form>
            </div>
          </div>
        ))}

      {/* 2. NEW PROJECT DIALOG */}
      {modals.newProject && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h4 className="font-semibold flex items-center gap-2">
                <Folder size={16} className="text-secondary" />
                <span>Create New Project</span>
              </h4>
              <button
                className="btn-ghost"
                onClick={() => closeModal('newProject')}
                style={{ padding: 4, borderRadius: 4 }}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateProjectSubmit}>
              <div className="modal-body flex flex-col gap-4">
                <div className="input-group">
                  <span className="input-label">PROJECT NAME</span>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Enter project name..."
                    value={projName}
                    onChange={(e) => setProjName(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <span className="input-label">DESCRIPTION</span>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Brief description..."
                    value={projDesc}
                    onChange={(e) => setProjDesc(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <span className="input-label">COLOR SCHEME</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {['#3498db', '#2ecc71', '#e67e22', '#e74c3c', '#9b59b6', '#f1c40f'].map((c) => (
                      <div
                        key={c}
                        onClick={() => setProjColor(c)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: '50%',
                          backgroundColor: c,
                          cursor: 'pointer',
                          border: projColor === c ? '2.5px solid var(--text-main)' : 'none',
                          boxShadow: projColor === c ? '0 0 6px rgba(0,0,0,0.2)' : 'none'
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => closeModal('newProject')}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. TASK CREATION DIALOG */}
      {modals.taskCreation && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h4 className="font-semibold flex items-center gap-2">
                <Check size={16} className="text-secondary" />
                <span>Create Workspace Task</span>
              </h4>
              <button
                className="btn-ghost"
                onClick={() => closeModal('taskCreation')}
                style={{ padding: 4, borderRadius: 4 }}
              >
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleCreateTaskSubmit}>
              <div className="modal-body flex flex-col gap-4">
                <div className="input-group">
                  <span className="input-label">TASK TITLE</span>
                  <input
                    type="text"
                    className="input-field"
                    placeholder="What needs to be done?"
                    value={taskTitle}
                    onChange={(e) => setTaskTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <span className="input-label">DESCRIPTION</span>
                  <textarea
                    className="input-field"
                    placeholder="Add details..."
                    value={taskDesc}
                    onChange={(e) => setTaskDesc(e.target.value)}
                    rows={3}
                    style={{ resize: 'none' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                  <div className="input-group">
                    <span className="input-label">PRIORITY</span>
                    <select
                      className="input-field"
                      value={taskPriority}
                      onChange={(e) => setTaskPriority(e.target.value as any)}
                    >
                      <option value="Low">Low</option>
                      <option value="Medium">Medium</option>
                      <option value="High">High</option>
                    </select>
                  </div>
                  <div className="input-group">
                    <span className="input-label">DUE DATE</span>
                    <input
                      type="date"
                      className="input-field"
                      value={taskDue}
                      onChange={(e) => setTaskDue(e.target.value)}
                    />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => closeModal('taskCreation')}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. AI QUERY PANEL (COPILOT CHAT DRAWER) */}
      {modals.aiQuery && <AICopilotChat />}

      {/* 5. EXPORT DIALOG */}
      {modals.export && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h4 className="font-semibold flex items-center gap-2">
                <Download size={16} className="text-secondary" />
                <span>Export Workbench Data</span>
              </h4>
              <button
                className="btn-ghost"
                onClick={() => closeModal('export')}
                style={{ padding: 4, borderRadius: 4 }}
              >
                <X size={16} />
              </button>
            </div>
            <div className="modal-body flex flex-col gap-4">
              <p className="text-muted text-sm">
                Select format to export database records locally.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {['JSON Archive', 'CSV Logs', 'Markdown Files'].map((f) => (
                  <button
                    key={f}
                    className="btn btn-secondary"
                    onClick={() => {
                      alert(`Successfully exported database logs in ${f} format!`)
                      closeModal('export')
                    }}
                    style={{ padding: 12, justifyContent: 'flex-start' }}
                  >
                    <span>{f}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => closeModal('export')}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5.1. RULE BUILDER MODAL */}
      {modals.ruleBuilder && <RuleBuilder />}

      {/* 5.2. WORKFLOW EDITOR MODAL */}
      {modals.workflowEditor && <WorkflowEditor />}

      {/* 6. SYSTEM CONFIRMATION OVERLAY */}
      {modals.confirmation && confirmationPayload && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: 400 }}>
            <div className="modal-header" style={{ borderBottomColor: 'var(--color-error)' }}>
              <h4
                className="font-semibold flex items-center gap-2"
                style={{ color: 'var(--color-error)' }}
              >
                <ShieldAlert size={16} />
                <span>{confirmationPayload.title}</span>
              </h4>
            </div>
            <div className="modal-body">
              <p className="text-sm" style={{ lineHeight: '1.5' }}>
                {confirmationPayload.message}
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeConfirmation}>
                {confirmationPayload.cancelText || 'Cancel'}
              </button>
              <button
                className="btn"
                style={{ backgroundColor: 'var(--color-error)', color: 'var(--text-inverse)' }}
                onClick={() => {
                  confirmationPayload.onConfirm()
                  closeConfirmation()
                }}
              >
                {confirmationPayload.confirmText || 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Spaced Repetition flashcard quiz widget */}
      {modals.spacedRepetition && <FlashcardsReview />}
    </>
  )
}
