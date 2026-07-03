import React, { useEffect, useState } from 'react'
import { useAuditStore } from '../stores/auditStore'
import { Shield, Clock, Filter, RefreshCw, FileText } from 'lucide-react'

export const AuditLogViewer: React.FC = () => {
  const { logs, loading, fetchLogs } = useAuditStore()
  const [actionFilter, setActionFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')

  useEffect(() => {
    fetchLogs()
  }, [])

  const handleRefresh = () => {
    fetchLogs({
      action: actionFilter || undefined,
      entityType: entityFilter || undefined
    })
  }

  const getActionColor = (action: string) => {
    const act = action.toUpperCase()
    if (act.includes('CREATE') || act.includes('ADD') || act.includes('REGISTER')) return '#2ecc71'
    if (
      act.includes('UPDATE') ||
      act.includes('EDIT') ||
      act.includes('MODIFY') ||
      act.includes('ROLLBACK')
    )
      return '#f1c40f'
    if (
      act.includes('DELETE') ||
      act.includes('REMOVE') ||
      act.includes('DISCARD') ||
      act.includes('SECURE_DELETE')
    )
      return '#e74c3c'
    if (act.includes('LOGIN') || act.includes('AUTH') || act.includes('INIT')) return '#3498db'
    if (act.includes('BACKUP') || act.includes('EXPORT') || act.includes('IMPORT')) return '#9b59b6'
    return '#95a5a6'
  }

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '24px',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        height: '100%',
        maxHeight: '600px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3
          style={{
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '1.2rem',
            fontWeight: 600
          }}
        >
          <Shield size={20} color="#667eea" />
          Security Audit Logs
        </h3>
        <button
          onClick={handleRefresh}
          disabled={loading}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '6px',
            color: '#fff',
            padding: '6px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: 'pointer',
            fontSize: '0.85rem'
          }}
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <div
          style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '150px' }}
        >
          <Filter size={14} color="#a0aec0" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            style={{
              background: '#1a1a2e',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              color: '#fff',
              padding: '6px 10px',
              width: '100%',
              fontSize: '0.85rem'
            }}
          >
            <option value="">All Actions</option>
            <option value="LOGIN">LOGIN</option>
            <option value="CREATE_NOTE">CREATE_NOTE</option>
            <option value="DELETE_TASK">DELETE_TASK</option>
            <option value="BACKUP_CREATED">BACKUP_CREATED</option>
            <option value="BACKUP_SECURE_CREATED">BACKUP_SECURE_CREATED</option>
            <option value="PRIVACY_MODE_ENABLED">PRIVACY_MODE_ENABLED</option>
            <option value="PRIVACY_RULE_ADDED">PRIVACY_RULE_ADDED</option>
            <option value="ITEM_ROLLBACK">ITEM_ROLLBACK</option>
          </select>
        </div>

        <div
          style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: '150px' }}
        >
          <Filter size={14} color="#a0aec0" />
          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            style={{
              background: '#1a1a2e',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '6px',
              color: '#fff',
              padding: '6px 10px',
              width: '100%',
              fontSize: '0.85rem'
            }}
          >
            <option value="">All Entities</option>
            <option value="note">Notes</option>
            <option value="task">Tasks</option>
            <option value="project">Projects</option>
            <option value="system">System</option>
          </select>
        </div>
      </div>

      {/* Logs Table */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: '420px',
          border: '1px solid rgba(255,255,255,0.05)',
          borderRadius: '8px'
        }}
      >
        {loading ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '200px',
              color: '#a0aec0'
            }}
          >
            Loading audit history...
          </div>
        ) : logs.length === 0 ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '200px',
              color: '#a0aec0',
              fontSize: '0.9rem'
            }}
          >
            No audit logs found matching criteria.
          </div>
        ) : (
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.85rem',
              textAlign: 'left'
            }}
          >
            <thead>
              <tr
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  borderBottom: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                <th style={{ padding: '12px 16px', color: '#a0aec0', fontWeight: 500 }}>
                  Timestamp
                </th>
                <th style={{ padding: '12px 16px', color: '#a0aec0', fontWeight: 500 }}>Action</th>
                <th style={{ padding: '12px 16px', color: '#a0aec0', fontWeight: 500 }}>Entity</th>
                <th style={{ padding: '12px 16px', color: '#a0aec0', fontWeight: 500 }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  style={
                    {
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      hover: { background: 'rgba(255,255,255,0.01)' }
                    } as any
                  }
                >
                  <td
                    style={{
                      padding: '10px 16px',
                      whiteSpace: 'nowrap',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: '#e2e8f0'
                    }}
                  >
                    <Clock size={12} color="#a0aec0" />
                    {log.created_at}
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span
                      style={{
                        background: `${getActionColor(log.action)}15`,
                        color: getActionColor(log.action),
                        border: `1px solid ${getActionColor(log.action)}30`,
                        borderRadius: '4px',
                        padding: '2px 6px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        textTransform: 'uppercase'
                      }}
                    >
                      {log.action}
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#cbd5e0' }}>
                    {log.entity_type
                      ? `${log.entity_type}:${(log.entity_id || '').substring(0, 8)}`
                      : '-'}
                  </td>
                  <td
                    style={{
                      padding: '10px 16px',
                      color: '#cbd5e0',
                      maxWidth: '300px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <FileText size={12} color="#a0aec0" />
                      {log.details_json || '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
