import React, { useState, useEffect } from 'react'
import { useModalStore } from '../stores/modalStore'
import { X, Play, Plus, Trash2, ShieldCheck, Cpu } from 'lucide-react'

interface Condition {
  field: string
  operator: 'contains' | 'equals' | 'starts_with' | 'ends_with'
  value: string
}

interface RuleAction {
  type: 'TAG_ITEM' | 'GENERATE_SUMMARY' | 'MOVE_TO_PROJECT' | 'CREATE_TASK' | 'CREATE_REMINDER'
  params: Record<string, any>
}

export default function RuleBuilder(): React.JSX.Element {
  const { closeModal, activePayloads } = useModalStore()

  const [name, setName] = useState('')
  const [triggerEvent, setTriggerEvent] = useState('NOTE_CREATED')
  const [conditions, setConditions] = useState<Condition[]>([])
  const [actions, setActions] = useState<RuleAction[]>([])
  const [isActive, setIsActive] = useState(true)
  const [projects, setProjects] = useState<any[]>([])

  // Load projects to select for MOVE_TO_PROJECT action
  useEffect(() => {
    window.api.db
      .query('SELECT id, name FROM projects ORDER BY name ASC')
      .then(setProjects)
      .catch(console.error)

    // If editing existing rule
    const existingRule = activePayloads.ruleBuilder
    if (existingRule) {
      setName(existingRule.name || '')
      setTriggerEvent(existingRule.trigger_event || 'NOTE_CREATED')
      setIsActive(existingRule.is_active === 1)
      try {
        setConditions(JSON.parse(existingRule.conditions_json) || [])
        setActions(JSON.parse(existingRule.actions_json) || [])
      } catch (e) {
        console.error(e)
      }
    }
  }, [activePayloads.ruleBuilder])

  const handleAddCondition = () => {
    setConditions([...conditions, { field: 'title', operator: 'contains', value: '' }])
  }

  const handleRemoveCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index))
  }

  const handleUpdateCondition = (index: number, key: keyof Condition, val: string) => {
    const updated = [...conditions]
    updated[index] = { ...updated[index], [key]: val }
    setConditions(updated)
  }

  const handleAddAction = () => {
    setActions([...actions, { type: 'TAG_ITEM', params: { tag: '' } }])
  }

  const handleRemoveAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index))
  }

  const handleUpdateActionType = (index: number, type: RuleAction['type']) => {
    const updated = [...actions]
    let params = {}
    if (type === 'TAG_ITEM') params = { tag: '' }
    if (type === 'MOVE_TO_PROJECT') params = { projectId: projects[0]?.id || '' }
    if (type === 'CREATE_TASK') params = { title: '', priority: 'Medium' }
    if (type === 'CREATE_REMINDER') params = { message: '' }

    updated[index] = { type, params }
    setActions(updated)
  }

  const handleUpdateActionParam = (index: number, key: string, val: any) => {
    const updated = [...actions]
    updated[index].params = { ...updated[index].params, [key]: val }
    setActions(updated)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      const rule = {
        id: activePayloads.ruleBuilder?.id || null,
        name,
        trigger_event: triggerEvent,
        conditions_json: JSON.stringify(conditions),
        actions_json: JSON.stringify(actions),
        is_active: isActive ? 1 : 0
      }

      await window.api.automation.saveRule(rule)
      closeModal('ruleBuilder')
    } catch (err) {
      console.error('Failed to save rule:', err)
    }
  }

  return (
    <div className="modal-overlay" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div
        className="modal-content glass"
        style={{
          maxWidth: 600,
          width: '90vw',
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
            <Cpu size={20} className="text-secondary animate-pulse" />
            <span>
              {activePayloads.ruleBuilder ? 'Edit Automation Rule' : 'Create Automation Rule'}
            </span>
          </h4>
          <button
            className="btn-ghost"
            onClick={() => closeModal('ruleBuilder')}
            style={{ padding: 4 }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-5">
          <div className="input-group">
            <span className="input-label">RULE NAME</span>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Auto-tag invoice PDFs"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 16 }}>
            <div className="input-group">
              <span className="input-label">WHEN EVENT OCCURS</span>
              <select
                className="input-field"
                value={triggerEvent}
                onChange={(e) => setTriggerEvent(e.target.value)}
              >
                <option value="NOTE_CREATED">Note Created</option>
                <option value="FILE_WATCHED">File Ingested / Watched</option>
                <option value="TASK_DONE">Task Completed</option>
                <option value="CRON_TRIGGER">Scheduled Time / Cron Trigger</option>
              </select>
            </div>

            <div className="input-group">
              <span className="input-label">STATUS</span>
              <div style={{ display: 'flex', alignItems: 'center', height: 38, gap: 8 }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                  id="rule-active-chk"
                />
                <label
                  htmlFor="rule-active-chk"
                  style={{ fontSize: '12px', userSelect: 'none', cursor: 'pointer' }}
                >
                  Active
                </label>
              </div>
            </div>
          </div>

          {/* Conditions segment */}
          <div
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: 16,
              backgroundColor: 'rgba(0,0,0,0.1)'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12
              }}
            >
              <span className="input-label" style={{ margin: 0 }}>
                IF CONDITIONS MATCH (AND)
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '2px 8px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
                onClick={handleAddCondition}
              >
                <Plus size={12} /> Add Filter
              </button>
            </div>

            {conditions.length === 0 ? (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                No filters set. Executes on all events of this type.
              </span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {conditions.map((cond, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '120px 120px 1fr 32px',
                      gap: 10,
                      alignItems: 'center'
                    }}
                  >
                    <select
                      className="input-field"
                      value={cond.field}
                      onChange={(e) => handleUpdateCondition(idx, 'field', e.target.value)}
                      style={{ height: 32, fontSize: '12px' }}
                    >
                      <option value="title">Title / Name</option>
                      <option value="description">Content / Text</option>
                      <option value="type">Type / Ext</option>
                    </select>

                    <select
                      className="input-field"
                      value={cond.operator}
                      onChange={(e) =>
                        handleUpdateCondition(idx, 'operator', e.target.value as any)
                      }
                      style={{ height: 32, fontSize: '12px' }}
                    >
                      <option value="contains">Contains</option>
                      <option value="equals">Equals</option>
                      <option value="starts_with">Starts with</option>
                      <option value="ends_with">Ends with</option>
                    </select>

                    <input
                      type="text"
                      className="input-field"
                      placeholder="matching text..."
                      value={cond.value}
                      onChange={(e) => handleUpdateCondition(idx, 'value', e.target.value)}
                      style={{ height: 32, fontSize: '12px' }}
                      required
                    />

                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => handleRemoveCondition(idx)}
                      style={{ padding: 4 }}
                    >
                      <Trash2 size={14} className="text-error" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions segment */}
          <div
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              padding: 16,
              backgroundColor: 'rgba(0,0,0,0.1)'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 12
              }}
            >
              <span className="input-label" style={{ margin: 0 }}>
                THEN EXECUTE ACTIONS
              </span>
              <button
                type="button"
                className="btn btn-secondary"
                style={{
                  padding: '2px 8px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
                onClick={handleAddAction}
              >
                <Plus size={12} /> Add Action
              </button>
            </div>

            {actions.length === 0 ? (
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                No actions configured yet. Add at least one action.
              </span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {actions.map((act, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignItems: 'center',
                      borderBottom:
                        idx < actions.length - 1 ? '1px dashed var(--border-color)' : 'none',
                      paddingBottom: idx < actions.length - 1 ? 12 : 0
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                      <span
                        style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}
                      >
                        ACTION TYPE
                      </span>
                      <select
                        className="input-field"
                        value={act.type}
                        onChange={(e) => handleUpdateActionType(idx, e.target.value as any)}
                        style={{ height: 32, fontSize: '12px' }}
                      >
                        <option value="TAG_ITEM">Attach Tag</option>
                        <option value="GENERATE_SUMMARY">AI Summarize</option>
                        <option value="MOVE_TO_PROJECT">Move to Project</option>
                        <option value="CREATE_TASK">Create Task</option>
                        <option value="CREATE_REMINDER">Trigger Alert Notification</option>
                      </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 2 }}>
                      <span
                        style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}
                      >
                        PARAMETERS
                      </span>

                      {act.type === 'TAG_ITEM' && (
                        <input
                          type="text"
                          className="input-field"
                          placeholder="tag label (e.g. work)..."
                          value={act.params.tag || ''}
                          onChange={(e) => handleUpdateActionParam(idx, 'tag', e.target.value)}
                          style={{ height: 32, fontSize: '12px' }}
                          required
                        />
                      )}

                      {act.type === 'GENERATE_SUMMARY' && (
                        <span
                          style={{
                            fontSize: '12px',
                            color: 'var(--text-muted)',
                            lineHeight: '32px'
                          }}
                        >
                          Summarizes note/file using local LLM.
                        </span>
                      )}

                      {act.type === 'MOVE_TO_PROJECT' && (
                        <select
                          className="input-field"
                          value={act.params.projectId || ''}
                          onChange={(e) =>
                            handleUpdateActionParam(idx, 'projectId', e.target.value)
                          }
                          style={{ height: 32, fontSize: '12px' }}
                        >
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      )}

                      {act.type === 'CREATE_TASK' && (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: 8 }}>
                          <input
                            type="text"
                            className="input-field"
                            placeholder="Task title..."
                            value={act.params.title || ''}
                            onChange={(e) => handleUpdateActionParam(idx, 'title', e.target.value)}
                            style={{ height: 32, fontSize: '12px' }}
                            required
                          />
                          <select
                            className="input-field"
                            value={act.params.priority || 'Medium'}
                            onChange={(e) =>
                              handleUpdateActionParam(idx, 'priority', e.target.value)
                            }
                            style={{ height: 32, fontSize: '12px' }}
                          >
                            <option value="Low">Low</option>
                            <option value="Medium">Medium</option>
                            <option value="High">High</option>
                          </select>
                        </div>
                      )}

                      {act.type === 'CREATE_REMINDER' && (
                        <input
                          type="text"
                          className="input-field"
                          placeholder="Reminder text..."
                          value={act.params.message || ''}
                          onChange={(e) => handleUpdateActionParam(idx, 'message', e.target.value)}
                          style={{ height: 32, fontSize: '12px' }}
                          required
                        />
                      )}
                    </div>

                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => handleRemoveAction(idx)}
                      style={{ padding: 4, marginTop: 18 }}
                    >
                      <Trash2 size={14} className="text-error" />
                    </button>
                  </div>
                ))}
              </div>
            )}
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
              onClick={() => closeModal('ruleBuilder')}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
              disabled={actions.length === 0}
            >
              <ShieldCheck size={16} />
              <span>Save Rule</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
