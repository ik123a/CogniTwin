import React, { useEffect, useState } from 'react'
import { useDashboardStore } from '../stores/dashboardStore'
import { useWorkspaceStore, Task, CalendarEvent } from '../stores/workspaceStore'
import { useModalStore } from '../stores/modalStore'
import SmartRemindersPanel from '../components/SmartRemindersPanel'
import {
  Sparkles,
  Zap,
  Activity,
  Calendar,
  CheckCircle,
  Play,
  Pause,
  AlertCircle,
  ArrowRight,
  TrendingUp
} from 'lucide-react'

export default function Dashboard(): React.JSX.Element {
  const {
    panels,
    focusMode,
    energyLevel,
    focusTimeToday,
    completedTasksCount,
    totalTasksCount,
    upcomingMeetingsCount,
    activeAutomationsCount,
    loadDashboard,
    toggleFocusMode
  } = useDashboardStore()

  const { tasks, events, loadItems, updateTask } = useWorkspaceStore()
  const { openModal } = useModalStore()

  // Audit activities log
  const [activities, setActivities] = useState<
    Array<{ id: number; action: string; details: string; timestamp: string }>
  >([])
  const [recentEntities, setRecentEntities] = useState<any[]>([])

  useEffect(() => {
    loadDashboard()
    loadItems()

    // Fetch recent audit logs from SQLite
    window.api.db
      .query('SELECT * FROM audit_log ORDER BY created_at DESC LIMIT 5')
      .then((res) => setActivities(res))
      .catch(console.error)

    // Fetch top context entities extracted
    window.api.db
      .query('SELECT * FROM entities ORDER BY last_seen DESC LIMIT 6')
      .then((res) => setRecentEntities(res))
      .catch(console.error)
  }, [])

  const handleToggleTaskStatus = async (task: Task): Promise<void> => {
    const nextStatus = task.status === 'Completed' ? 'Todo' : 'Completed'
    await updateTask(task.id, { status: nextStatus })
    await loadDashboard()
  }

  const activeFocusTasks = tasks.filter((t) => t.status !== 'Completed').slice(0, 3)
  const nextMeetings = events.slice(0, 2)

  // Mock AI Suggestions
  const [suggestions, setSuggestions] = useState([
    {
      id: 'sug_1',
      title: 'Auto-schedule Project Alpha report compilation',
      desc: 'Based on your Friday evening completion pattern, compile research documents at 4 PM.',
      confidence: 94,
      type: 'automation'
    },
    {
      id: 'sug_2',
      title: 'Block focus time at 10:00 AM tomorrow',
      desc: 'Your energy cycles indicate peak focus between 9:30 AM and 11:30 AM.',
      confidence: 88,
      type: 'energy'
    },
    {
      id: 'sug_3',
      title: 'Link "invoice_template.doc" to Client Project',
      desc: 'Semantic relationships link client invoices with Client Project tags.',
      confidence: 82,
      type: 'graph'
    }
  ])

  const handleAcceptSuggestion = (id: string): void => {
    setSuggestions(suggestions.filter((s) => s.id !== id))
    // Log action to DB
    window.api.audit
      .log('AI_SUGGESTION_ACCEPTED', 'system', undefined, { suggestionId: id })
      .catch(console.error)
  }

  const handleRejectSuggestion = (id: string): void => {
    setSuggestions(suggestions.filter((s) => s.id !== id))
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Top Banner */}
      <div
        className="card flex justify-between items-center"
        style={{
          background:
            'linear-gradient(90deg, rgba(52, 152, 219, 0.15) 0%, rgba(230, 126, 34, 0.05) 100%)',
          border: '1px solid var(--border-color)',
          padding: '20px 24px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: 'rgba(52, 152, 219, 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-secondary)'
            }}
          >
            <Sparkles size={22} className={focusMode ? 'animate-pulse' : ''} />
          </div>
          <div>
            <h3 className="font-semibold text-lg" style={{ color: 'var(--text-main)' }}>
              {focusMode ? 'Focus session active' : 'Welcome back, Twin'}
            </h3>
            <p className="text-muted text-sm">
              {focusMode
                ? 'All non-essential notifications are snoozed. Focus on your active session.'
                : `Your energy levels are predicted to be HIGH for the next 2.5 hours.`}
            </p>
          </div>
        </div>

        <button
          className={`btn ${focusMode ? 'btn-secondary' : 'btn-primary'}`}
          onClick={toggleFocusMode}
          style={{ padding: '10px 20px', borderRadius: 8 }}
        >
          {focusMode ? <Pause size={16} /> : <Play size={16} />}
          <span>{focusMode ? 'End Focus Session' : 'Start Focus Mode'}</span>
        </button>
      </div>

      {/* Grid Panels */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: 20
        }}
      >
        {/* Smart Reminders Panel */}
        <SmartRemindersPanel />

        {/* 1. Today's Focus */}
        <div className="card flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h4 className="font-semibold flex items-center gap-2">
              <CheckCircle size={18} className="text-muted" />
              <span>Today's Focus</span>
            </h4>
            <span className="text-sm font-mono text-muted">
              {completedTasksCount}/{totalTasksCount} Complete
            </span>
          </div>

          <div className="flex flex-col gap-2" style={{ flex: 1 }}>
            {activeFocusTasks.length > 0 ? (
              activeFocusTasks.map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 8,
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <input
                      type="checkbox"
                      checked={t.status === 'Completed'}
                      onChange={() => handleToggleTaskStatus(t)}
                      style={{ cursor: 'pointer', accentColor: 'var(--color-secondary)' }}
                    />
                    <span className="text-sm" style={{ fontWeight: 500 }}>
                      {t.title}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '11px',
                      padding: '2px 8px',
                      borderRadius: 4,
                      backgroundColor:
                        t.priority === 'High'
                          ? 'rgba(231, 76, 60, 0.1)'
                          : t.priority === 'Medium'
                            ? 'rgba(241, 196, 15, 0.1)'
                            : 'rgba(52, 152, 219, 0.1)',
                      color:
                        t.priority === 'High'
                          ? 'var(--color-error)'
                          : t.priority === 'Medium'
                            ? 'var(--color-warning)'
                            : 'var(--color-secondary)'
                    }}
                  >
                    {t.priority}
                  </span>
                </div>
              ))
            ) : (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '13px'
                }}
              >
                All clear! Add a task to get started.
              </div>
            )}
          </div>
        </div>

        {/* 2. Energy cycles line chart */}
        <div className="card flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <h4 className="font-semibold flex items-center gap-2">
              <Zap size={18} className="text-muted" />
              <span>Energy Predictor</span>
            </h4>
            <span
              style={{
                fontSize: '11px',
                padding: '2px 8px',
                borderRadius: 4,
                backgroundColor: 'rgba(46, 204, 113, 0.1)',
                color: 'var(--color-success)',
                fontWeight: 600
              }}
            >
              Peak efficiency
            </span>
          </div>

          <div style={{ height: 120, position: 'relative', marginTop: 10 }}>
            {/* Draw inline SVG chart curve */}
            <svg width="100%" height="100%" viewBox="0 0 300 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-secondary)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="var(--color-secondary)" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {/* Grid Lines */}
              <line
                x1="0"
                y1="25"
                x2="300"
                y2="25"
                stroke="var(--border-color)"
                strokeWidth="0.5"
                strokeDasharray="3"
              />
              <line
                x1="0"
                y1="50"
                x2="300"
                y2="50"
                stroke="var(--border-color)"
                strokeWidth="0.5"
                strokeDasharray="3"
              />
              <line
                x1="0"
                y1="75"
                x2="300"
                y2="75"
                stroke="var(--border-color)"
                strokeWidth="0.5"
                strokeDasharray="3"
              />

              {/* Curve line */}
              <path
                d="M 0,60 C 50,20 100,10 150,70 C 200,95 250,30 300,15 L 300,100 L 0,100 Z"
                fill="url(#chartGradient)"
              />
              <path
                d="M 0,60 C 50,20 100,10 150,70 C 200,95 250,30 300,15"
                fill="none"
                stroke="var(--color-secondary)"
                strokeWidth="2.5"
              />

              {/* Current Time Dot */}
              <circle cx="110" cy="30" r="4.5" fill="var(--color-accent)" />
              <circle cx="110" cy="30" r="8" fill="var(--color-accent)" fillOpacity="0.2" />
            </svg>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 8,
                fontSize: '10px'
              }}
              className="font-mono text-muted flex w-full"
            >
              <span>8 AM</span>
              <span style={{ margin: '0 auto' }}>12 PM</span>
              <span style={{ float: 'right' }}>6 PM</span>
            </div>
          </div>
        </div>

        {/* 3. Recent Activity */}
        <div className="card flex flex-col gap-4">
          <h4 className="font-semibold flex items-center gap-2">
            <Activity size={18} className="text-muted" />
            <span>Recent Activity Log</span>
          </h4>
          <div className="flex flex-col gap-3" style={{ fontSize: '13px' }}>
            {activities.map((act) => (
              <div key={act.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-secondary)',
                    marginTop: 6,
                    flexShrink: 0
                  }}
                />
                <div className="flex flex-col" style={{ flex: 1 }}>
                  <span>{act.details}</span>
                  <span className="text-muted font-mono" style={{ fontSize: '10px' }}>
                    {new Date(act.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 4. Upcoming Events */}
        <div className="card flex flex-col gap-4">
          <h4 className="font-semibold flex items-center gap-2">
            <Calendar size={18} className="text-muted" />
            <span>Upcoming Commitments</span>
          </h4>
          <div className="flex flex-col gap-3" style={{ flex: 1 }}>
            {nextMeetings.length > 0 ? (
              nextMeetings.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    padding: '10px 12px',
                    borderRadius: 8,
                    backgroundColor: 'var(--bg-surface)',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      width: 36,
                      borderRight: '1px solid var(--border-color)',
                      paddingRight: 12
                    }}
                  >
                    <span style={{ fontSize: '10px', fontWeight: 700 }} className="text-muted">
                      {new Date(ev.start_time)
                        .toLocaleDateString([], { month: 'short' })
                        .toUpperCase()}
                    </span>
                    <span style={{ fontSize: '16px', fontWeight: 700 }}>
                      {new Date(ev.start_time).getDate()}
                    </span>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden'
                    }}
                  >
                    <span
                      className="font-semibold text-sm"
                      style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                    >
                      {ev.title}
                    </span>
                    <span className="text-muted font-mono" style={{ fontSize: '11px' }}>
                      {new Date(ev.start_time).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '13px'
                }}
              >
                No upcoming events scheduled.
              </div>
            )}
          </div>
        </div>

        {/* 5. Recently Discovered Context Entities */}
        <div className="card flex flex-col gap-4">
          <h4 className="font-semibold flex items-center gap-2">
            <Sparkles size={18} className="text-muted" style={{ color: 'var(--color-accent)' }} />
            <span>Discovered Context Entities</span>
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
            {recentEntities.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {recentEntities.map((ent) => (
                  <div
                    key={ent.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '8px 12px',
                      borderRadius: 8,
                      backgroundColor: 'var(--bg-surface)',
                      border: '1px solid var(--border-color)',
                      flex: '1 1 calc(50% - 8px)',
                      minWidth: 120
                    }}
                  >
                    <span style={{ fontSize: '12px', fontWeight: 600 }}>{ent.name}</span>
                    <span
                      className="font-mono text-muted"
                      style={{ fontSize: '9px', textTransform: 'uppercase', marginTop: 2 }}
                    >
                      {ent.type} • {ent.mention_count} mentions
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  fontSize: '13px'
                }}
              >
                Run re-indexing to extract entity context.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. AI Suggestions section */}
      {suggestions.length > 0 && (
        <div className="card flex flex-col gap-4" style={{ marginTop: 12 }}>
          <h4 className="font-semibold flex items-center gap-2">
            <Sparkles size={18} className="text-muted" style={{ color: 'var(--color-accent)' }} />
            <span>AI Copilot Suggestions</span>
          </h4>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 16
            }}
          >
            {suggestions.map((sug) => (
              <div
                key={sug.id}
                style={{
                  padding: 16,
                  borderRadius: 10,
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-surface)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: 12
                }}
              >
                <div>
                  <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color:
                          sug.type === 'automation'
                            ? 'var(--color-secondary)'
                            : sug.type === 'energy'
                              ? 'var(--color-success)'
                              : 'var(--color-accent)'
                      }}
                    >
                      {sug.type} recommendation
                    </span>
                    <span
                      className="font-mono text-sm text-muted"
                      style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                    >
                      <TrendingUp size={12} style={{ color: 'var(--color-success)' }} />
                      {sug.confidence}%
                    </span>
                  </div>
                  <h5 className="font-semibold text-sm" style={{ marginBottom: 4 }}>
                    {sug.title}
                  </h5>
                  <p className="text-muted" style={{ fontSize: '12px', lineHeight: '1.4' }}>
                    {sug.desc}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-ghost"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                    onClick={() => handleRejectSuggestion(sug.id)}
                  >
                    Dismiss
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ padding: '6px 12px', fontSize: '12px' }}
                    onClick={() => handleAcceptSuggestion(sug.id)}
                  >
                    Approve
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
