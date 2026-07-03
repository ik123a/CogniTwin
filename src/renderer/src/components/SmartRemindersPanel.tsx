import React from 'react'
import { useDashboardStore } from '../stores/dashboardStore'
import { Bell, X, AlertTriangle, AlertCircle, Clock, Check } from 'lucide-react'

export default function SmartRemindersPanel(): React.JSX.Element {
  const { smartReminders, dismissReminder } = useDashboardStore()

  const getReminderStyle = (triggerType: string) => {
    switch (triggerType) {
      case 'deadline_overdue':
        return {
          icon: <AlertCircle size={15} style={{ color: 'var(--color-error)' }} />,
          bg: 'rgba(231, 76, 60, 0.08)',
          border: 'rgba(231, 76, 60, 0.2)',
          label: 'Overdue'
        }
      case 'deadline_approaching':
        return {
          icon: <Clock size={15} style={{ color: 'var(--color-warning)' }} />,
          bg: 'rgba(241, 196, 15, 0.08)',
          border: 'rgba(241, 196, 15, 0.2)',
          label: 'Urgent'
        }
      case 'stale_in_progress':
        return {
          icon: <AlertTriangle size={15} style={{ color: 'var(--color-secondary)' }} />,
          bg: 'rgba(52, 152, 219, 0.08)',
          border: 'rgba(52, 152, 219, 0.2)',
          label: 'Stale'
        }
      default:
        return {
          icon: <Bell size={15} style={{ color: 'var(--text-muted)' }} />,
          bg: 'rgba(255, 255, 255, 0.03)',
          border: 'rgba(255, 255, 255, 0.06)',
          label: 'System'
        }
    }
  }

  return (
    <div className="card flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h4 className="font-semibold flex items-center gap-2">
          <Bell size={18} className="text-muted" />
          <span>Active Smart Reminders</span>
        </h4>
        <span
          className="text-xs font-mono text-muted"
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.03)',
            padding: '2px 8px',
            borderRadius: 4
          }}
        >
          {smartReminders.length} Active
        </span>
      </div>

      <div className="flex flex-col gap-2.5" style={{ maxHeight: 240, overflowY: 'auto', flex: 1 }}>
        {smartReminders.length > 0 ? (
          smartReminders.map((rem) => {
            const style = getReminderStyle(rem.trigger_type)
            return (
              <div
                key={rem.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  borderRadius: 8,
                  backgroundColor: style.bg,
                  border: `1px solid ${style.border}`,
                  gap: 12
                }}
              >
                <div style={{ display: 'flex', gap: 10, flex: 1, minWidth: 0 }}>
                  <div style={{ marginTop: 2, flexShrink: 0 }}>{style.icon}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'rgba(255,255,255,0.9)',
                        lineHeight: 1.4,
                        fontWeight: 500
                      }}
                    >
                      {rem.message}
                    </span>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 4 }}>
                      {style.label} • {new Date(rem.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => dismissReminder(rem.id)}
                  className="btn-ghost"
                  title="Dismiss Reminder"
                  style={
                    {
                      padding: 4,
                      borderRadius: 4,
                      alignSelf: 'center',
                      flexShrink: 0,
                      color: 'var(--text-muted)',
                      hover: {
                        color: 'var(--text-main)',
                        backgroundColor: 'rgba(255,255,255,0.05)'
                      }
                    } as any
                  }
                >
                  <X size={14} />
                </button>
              </div>
            )
          })
        ) : (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              fontSize: '12.5px',
              padding: '24px 0',
              textAlign: 'center',
              gap: 6
            }}
          >
            <Check size={20} className="text-secondary" style={{ opacity: 0.6 }} />
            <span>No pending task alerts. You are completely caught up!</span>
          </div>
        )}
      </div>
    </div>
  )
}
