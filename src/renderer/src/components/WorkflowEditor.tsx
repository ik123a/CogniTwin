import React, { useState, useEffect } from 'react'
import { useModalStore } from '../stores/modalStore'
import { X, Plus, Trash2, ArrowDown, Bot, Tag, Bell, CheckSquare, Save } from 'lucide-react'

interface WorkflowNode {
  id: string
  type: 'trigger' | 'llm_summary' | 'tag_item' | 'create_task' | 'create_reminder'
  data: Record<string, any>
}

export default function WorkflowEditor(): React.JSX.Element {
  const { closeModal, activePayloads } = useModalStore()

  const [name, setName] = useState('')
  const [nodes, setNodes] = useState<WorkflowNode[]>([
    { id: '1', type: 'trigger', data: { event: 'NOTE_CREATED' } }
  ])
  const [isActive, setIsActive] = useState(true)

  useEffect(() => {
    const existingWorkflow = activePayloads.workflowEditor
    if (existingWorkflow) {
      setName(existingWorkflow.name || '')
      setIsActive(existingWorkflow.is_active === 1)
      try {
        setNodes(JSON.parse(existingWorkflow.nodes_json) || [])
      } catch (e) {
        console.error(e)
      }
    }
  }, [activePayloads.workflowEditor])

  const handleAddNode = (type: WorkflowNode['type']) => {
    const newNode: WorkflowNode = {
      id: crypto.randomUUID(),
      type,
      data:
        type === 'tag_item'
          ? { tag: '' }
          : type === 'create_task'
            ? { title: '', priority: 'Medium' }
            : type === 'create_reminder'
              ? { message: '' }
              : {}
    }
    setNodes([...nodes, newNode])
  }

  const handleRemoveNode = (id: string) => {
    setNodes(nodes.filter((n) => n.id !== id))
  }

  const handleUpdateNodeData = (id: string, key: string, value: any) => {
    setNodes(
      nodes.map((n) => {
        if (n.id === id) {
          return { ...n, data: { ...n.data, [key]: value } }
        }
        return n
      })
    )
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      const workflow = {
        id: activePayloads.workflowEditor?.id || null,
        name,
        nodes_json: JSON.stringify(nodes),
        edges_json: JSON.stringify([]), // Edge connections represented implicitly in sequence list
        is_active: isActive ? 1 : 0
      }

      await window.api.automation.saveWorkflow(workflow)
      closeModal('workflowEditor')
    } catch (err) {
      console.error('Failed to save workflow:', err)
    }
  }

  return (
    <div className="modal-overlay" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div
        className="modal-content glass"
        style={{
          maxWidth: 700,
          width: '95vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          padding: 24
        }}
      >
        <div className="modal-header" style={{ marginBottom: 20 }}>
          <h4 className="font-semibold flex items-center gap-2 text-lg">
            <Bot size={20} className="text-secondary" />
            <span>
              {activePayloads.workflowEditor ? 'Edit DAG Workflow' : 'Create DAG Workflow'}
            </span>
          </h4>
          <button
            className="btn-ghost"
            onClick={() => closeModal('workflowEditor')}
            style={{ padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 16 }}>
            <div className="input-group">
              <span className="input-label">WORKFLOW NAME</span>
              <input
                type="text"
                className="input-field"
                placeholder="e.g. Automated PDF Intake & Synthesize"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="input-group">
              <span className="input-label">STATUS</span>
              <div style={{ display: 'flex', alignItems: 'center', height: 38, gap: 8 }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                  id="wf-active-chk"
                />
                <label
                  htmlFor="wf-active-chk"
                  style={{ fontSize: '12px', userSelect: 'none', cursor: 'pointer' }}
                >
                  Active
                </label>
              </div>
            </div>
          </div>

          {/* Graphical Step Blocks Flow */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              backgroundColor: 'rgba(0,0,0,0.15)',
              borderRadius: 8,
              padding: 20,
              minHeight: 200
            }}
          >
            <span className="input-label" style={{ alignSelf: 'flex-start', margin: 0 }}>
              EXECUTION DAG SEQUENCE
            </span>

            {nodes.map((node, index) => {
              const isStart = node.type === 'trigger'
              return (
                <React.Fragment key={node.id}>
                  {/* Step Card */}
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 500,
                      borderRadius: 8,
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-surface)',
                      display: 'flex',
                      alignItems: 'center',
                      padding: 12,
                      gap: 16,
                      position: 'relative'
                    }}
                  >
                    {/* Block Icon */}
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 6,
                        backgroundColor: isStart
                          ? 'rgba(52, 152, 219, 0.15)'
                          : node.type === 'llm_summary'
                            ? 'rgba(155, 89, 182, 0.15)'
                            : node.type === 'tag_item'
                              ? 'rgba(46, 204, 113, 0.15)'
                              : 'rgba(230, 126, 34, 0.15)',
                        color: isStart
                          ? 'var(--color-secondary)'
                          : node.type === 'llm_summary'
                            ? '#9b59b6'
                            : node.type === 'tag_item'
                              ? 'var(--color-success)'
                              : '#e67e22',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {isStart && <Bot size={16} />}
                      {node.type === 'llm_summary' && <Bot size={16} className="animate-pulse" />}
                      {node.type === 'tag_item' && <Tag size={16} />}
                      {node.type === 'create_task' && <CheckSquare size={16} />}
                      {node.type === 'create_reminder' && <Bell size={16} />}
                    </div>

                    {/* Block Config details */}
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: 'var(--text-muted)'
                        }}
                      >
                        Step {index + 1}: {node.type === 'trigger' ? 'Trigger Event' : node.type}
                      </span>

                      {isStart ? (
                        <select
                          className="input-field"
                          value={node.data.event || 'NOTE_CREATED'}
                          onChange={(e) => handleUpdateNodeData(node.id, 'event', e.target.value)}
                          style={{ height: 28, padding: '0 8px', fontSize: '11px', maxWidth: 200 }}
                        >
                          <option value="NOTE_CREATED">When Note is Created</option>
                          <option value="FILE_WATCHED">When File is Watched</option>
                          <option value="TASK_DONE">When Task is Done</option>
                          <option value="CRON_TRIGGER">On Scheduler Cron Run</option>
                        </select>
                      ) : (
                        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                          {node.type === 'tag_item' && (
                            <input
                              type="text"
                              className="input-field"
                              placeholder="Tag name..."
                              value={node.data.tag || ''}
                              onChange={(e) => handleUpdateNodeData(node.id, 'tag', e.target.value)}
                              style={{ height: 28, padding: '0 8px', fontSize: '11px' }}
                              required
                            />
                          )}

                          {node.type === 'llm_summary' && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              Summarizes textual payload using Qwen GGUF model offline.
                            </span>
                          )}

                          {node.type === 'create_task' && (
                            <div
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1fr 90px',
                                gap: 8,
                                width: '100%'
                              }}
                            >
                              <input
                                type="text"
                                className="input-field"
                                placeholder="Task title..."
                                value={node.data.title || ''}
                                onChange={(e) =>
                                  handleUpdateNodeData(node.id, 'title', e.target.value)
                                }
                                style={{ height: 28, padding: '0 8px', fontSize: '11px' }}
                                required
                              />
                              <select
                                className="input-field"
                                value={node.data.priority || 'Medium'}
                                onChange={(e) =>
                                  handleUpdateNodeData(node.id, 'priority', e.target.value)
                                }
                                style={{ height: 28, padding: '0 8px', fontSize: '11px' }}
                              >
                                <option value="Low">Low</option>
                                <option value="Medium">Medium</option>
                                <option value="High">High</option>
                              </select>
                            </div>
                          )}

                          {node.type === 'create_reminder' && (
                            <input
                              type="text"
                              className="input-field"
                              placeholder="Reminder message..."
                              value={node.data.message || ''}
                              onChange={(e) =>
                                handleUpdateNodeData(node.id, 'message', e.target.value)
                              }
                              style={{ height: 28, padding: '0 8px', fontSize: '11px' }}
                              required
                            />
                          )}
                        </div>
                      )}
                    </div>

                    {/* Delete action */}
                    {!isStart && (
                      <button
                        type="button"
                        className="btn-ghost"
                        onClick={() => handleRemoveNode(node.id)}
                        style={{ padding: 4 }}
                      >
                        <Trash2 size={13} className="text-error" />
                      </button>
                    )}
                  </div>

                  {/* Flow edge arrow */}
                  {index < nodes.length - 1 && (
                    <ArrowDown size={14} style={{ color: 'var(--border-color)' }} />
                  )}
                </React.Fragment>
              )
            })}

            {/* Quick node selector */}
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
                onClick={() => handleAddNode('llm_summary')}
              >
                <Plus size={10} /> AI Summarize
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
                onClick={() => handleAddNode('tag_item')}
              >
                <Plus size={10} /> Auto Tag
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
                onClick={() => handleAddNode('create_task')}
              >
                <Plus size={10} /> Create Task
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
                onClick={() => handleAddNode('create_reminder')}
              >
                <Plus size={10} /> Send Alert
              </button>
            </div>
          </div>

          <div
            className="modal-footer"
            style={{
              borderTop: '1px solid var(--border-color)',
              paddingTop: 16,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => closeModal('workflowEditor')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <Save size={16} />
              <span>Save Workflow</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
