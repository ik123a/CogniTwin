import React, { useEffect, useState } from 'react'
import { Play, Power, RotateCw, FolderOpen, ShieldAlert } from 'lucide-react'

interface PluginInfo {
  id: string
  name: string
  version: string
  description: string | null
  author: string | null
  entry_point: string
  is_active: number
  permissions_json: string | null
  created_at: string
}

export function PluginManager(): React.JSX.Element {
  const [plugins, setPlugins] = useState<PluginInfo[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null)

  const loadPlugins = async () => {
    setLoading(true)
    try {
      const list = await window.api.plugins.list()
      setPlugins(list)
    } catch (e: any) {
      console.error(e)
      setMessage({ text: 'Failed to load plugins list.', isError: true })
    } finally {
      setLoading(false)
    }
  }

  const handleScan = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const list = await window.api.plugins.scan()
      setPlugins(list)
      setMessage({ text: 'Scan completed successfully!' })
    } catch (e: any) {
      console.error(e)
      setMessage({ text: 'Error occurred during plugin directory scan.', isError: true })
    } finally {
      setLoading(false)
    }
  }

  const handleToggle = async (pluginId: string, currentActive: number) => {
    setMessage(null)
    const nextActive = currentActive === 1 ? false : true
    try {
      const res = await window.api.plugins.toggle(pluginId, nextActive)
      if (res.success) {
        setPlugins((prev) =>
          prev.map((p) => (p.id === pluginId ? { ...p, is_active: nextActive ? 1 : 0 } : p))
        )
        setMessage({ text: `Plugin ${nextActive ? 'activated' : 'deactivated'} successfully.` })
      } else {
        setMessage({ text: 'Failed to toggle plugin status. Check logs.', isError: true })
      }
    } catch (e: any) {
      console.error(e)
      setMessage({ text: 'Error deactivating/activating plugin.', isError: true })
    }
  }

  useEffect(() => {
    loadPlugins()
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h4 style={{ fontSize: '18px', fontWeight: 600, color: '#fff', margin: 0 }}>
            Plugin Extensions
          </h4>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Extend your Cognitive Twin with third-party components and custom view integrations.
          </p>
        </div>
        <button
          onClick={handleScan}
          disabled={loading}
          className="btn btn-secondary"
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px' }}
        >
          <RotateCw size={14} className={loading ? 'animate-spin' : ''} />
          <span>Scan Plugins Folder</span>
        </button>
      </div>

      {message && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 6,
            fontSize: '13px',
            backgroundColor: message.isError
              ? 'rgba(231, 76, 60, 0.12)'
              : 'rgba(46, 204, 113, 0.12)',
            color: message.isError ? '#e74c3c' : '#2ecc71',
            border: `1px solid ${message.isError ? 'rgba(231, 76, 60, 0.2)' : 'rgba(46, 204, 113, 0.2)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <ShieldAlert size={14} />
          <span>{message.text}</span>
        </div>
      )}

      {plugins.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 20px',
            background: 'rgba(255, 255, 255, 0.02)',
            border: '1px dashed rgba(255, 255, 255, 0.08)',
            borderRadius: 12
          }}
        >
          <FolderOpen
            size={36}
            style={{ color: 'var(--text-muted)', marginBottom: 12, opacity: 0.5 }}
          />
          <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-muted)' }}>
            No plugins detected in the plugins directory.
          </p>
          <p
            style={{
              margin: '4px 0 0 0',
              fontSize: '12px',
              color: 'var(--text-muted)',
              opacity: 0.8
            }}
          >
            Click "Scan Plugins Folder" to initialize the default sample plugin.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: 16
          }}
        >
          {plugins.map((plugin) => {
            const isActive = plugin.is_active === 1
            return (
              <div
                key={plugin.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  backdropFilter: 'blur(10px)',
                  border: `1px solid ${isActive ? 'rgba(52, 152, 219, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
                  borderRadius: 12,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'between',
                  gap: 12,
                  transition: 'all 0.2s ease',
                  boxShadow: isActive ? '0 4px 15px rgba(52, 152, 219, 0.1)' : 'none'
                }}
              >
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'start'
                    }}
                  >
                    <h5 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#fff' }}>
                      {plugin.name}
                    </h5>
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: 4,
                        background: 'rgba(255,255,255,0.06)',
                        color: 'var(--text-muted)'
                      }}
                    >
                      v{plugin.version}
                    </span>
                  </div>
                  {plugin.author && (
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-muted)',
                        display: 'block',
                        marginTop: 2
                      }}
                    >
                      by {plugin.author}
                    </span>
                  )}
                  <p
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-muted)',
                      margin: '8px 0 0 0',
                      minHeight: '36px'
                    }}
                  >
                    {plugin.description || 'No description provided.'}
                  </p>
                </div>

                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-muted)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  <strong>Path:</strong> {plugin.entry_point}
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                    paddingTop: 12,
                    marginTop: 'auto'
                  }}
                >
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: isActive ? '#2ecc71' : 'var(--text-muted)'
                    }}
                  >
                    ● {isActive ? 'Active & Running' : 'Deactivated'}
                  </span>
                  <label className="toggle-switch">
                    <input
                      type="checkbox"
                      checked={isActive}
                      onChange={() => handleToggle(plugin.id, plugin.is_active)}
                    />
                    <span className="slider" />
                  </label>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
