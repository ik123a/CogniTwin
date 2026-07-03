import React, { useEffect, useState } from 'react'
import { Play, Save, Trash2, Code2, AlertTriangle, Terminal, RefreshCw } from 'lucide-react'

interface SavedScript {
  id: string
  name: string
  language: string
  code_content: string
  description: string | null
  last_run: string | null
}

const DEFAULT_JS = `// JavaScript Scripting Console
// Use dbQuery(sql, ...params) to run database commands
// e.g. console.log(dbQuery("SELECT count(*) as count FROM notes"));

const notes = dbQuery("SELECT id, title FROM notes LIMIT 5");
console.log("Found notes: " + JSON.stringify(notes));
notes;
`

const DEFAULT_PYTHON = `# Python Scripting Console
# Spawns system python process. Print outputs to see results.
import sys
print("Hello from Python " + sys.version)
`

export function ScriptingConsole(): React.JSX.Element {
  const [code, setCode] = useState(DEFAULT_JS)
  const [language, setLanguage] = useState<'javascript' | 'python'>('javascript')
  const [scriptName, setScriptName] = useState('')
  const [scriptDesc, setScriptDesc] = useState('')
  const [savedScripts, setSavedScripts] = useState<SavedScript[]>([])
  const [running, setRunning] = useState(false)
  const [consoleLogs, setConsoleLogs] = useState<string[]>([])
  const [consoleResult, setConsoleResult] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; isError?: boolean } | null>(null)

  const loadSavedScripts = async () => {
    try {
      const list = await window.api.scripting.list()
      setSavedScripts(list)
    } catch (e) {
      console.error(e)
    }
  }

  const handleRun = async () => {
    setRunning(true)
    setConsoleLogs([])
    setConsoleResult(null)
    setMessage(null)
    try {
      let res
      if (language === 'javascript') {
        res = await window.api.scripting.runJs(code)
      } else {
        res = await window.api.scripting.runPython(code)
      }

      if (res.logs && res.logs.length > 0) {
        setConsoleLogs(res.logs)
      } else {
        setConsoleLogs(['[SYSTEM] Executed successfully with no stdout/logs.'])
      }

      if (res.success) {
        setConsoleResult(res.result || 'No return value')
      } else {
        setMessage({ text: res.error || 'Execution failed.', isError: true })
      }
    } catch (e: any) {
      console.error(e)
      setMessage({ text: e.message || 'Fatal execution crash.', isError: true })
    } finally {
      setRunning(false)
      loadSavedScripts() // Refresh list to see updated run times
    }
  }

  const handleSave = async () => {
    if (!scriptName.trim()) {
      setMessage({ text: 'Please specify a name to save the script.', isError: true })
      return
    }
    try {
      const res = await window.api.scripting.save(scriptName, language, code, scriptDesc)
      if (res.success) {
        setMessage({ text: `Script "${scriptName}" saved successfully!` })
        loadSavedScripts()
      }
    } catch (e: any) {
      console.error(e)
      setMessage({ text: 'Failed to save script to database.', isError: true })
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this script?')) return
    try {
      const res = await window.api.scripting.delete(id)
      if (res.success) {
        setMessage({ text: 'Script deleted successfully.' })
        loadSavedScripts()
      }
    } catch (e) {
      console.error(e)
      setMessage({ text: 'Failed to delete script.', isError: true })
    }
  }

  const selectScript = (script: SavedScript) => {
    setScriptName(script.name)
    setScriptDesc(script.description || '')
    setLanguage(script.language as any)
    setCode(script.code_content)
    setMessage(null)
  }

  useEffect(() => {
    loadSavedScripts()
  }, [])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, width: '100%' }}>
      {/* Saved Scripts Left Panel */}
      <div
        style={{
          background: 'rgba(255, 255, 255, 0.02)',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          paddingRight: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        <div style={{ display: 'flex', justifyItems: 'center', gap: 8 }}>
          <Code2 size={16} className="text-muted" style={{ marginTop: 2 }} />
          <h5 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#fff' }}>
            Saved Scripts
          </h5>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            maxHeight: '400px',
            overflowY: 'auto'
          }}
        >
          {savedScripts.length === 0 ? (
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No scripts saved yet.
            </span>
          ) : (
            savedScripts.map((script) => (
              <div
                key={script.id}
                onClick={() => selectScript(script)}
                style={{
                  padding: '8px 10px',
                  borderRadius: 6,
                  background:
                    scriptName === script.name
                      ? 'rgba(52, 152, 219, 0.1)'
                      : 'rgba(255, 255, 255, 0.02)',
                  border: `1px solid ${scriptName === script.name ? 'rgba(52, 152, 219, 0.2)' : 'rgba(255, 255, 255, 0.05)'}`,
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <span
                    style={{
                      fontSize: '13px',
                      color: '#fff',
                      textOverflow: 'ellipsis',
                      overflow: 'hidden',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {script.name}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {script.language === 'javascript' ? 'JS' : 'Python'}
                  </span>
                </div>
                <button
                  onClick={(e) => handleDelete(e, script.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#e74c3c',
                    padding: 4,
                    cursor: 'pointer',
                    borderRadius: 4
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor & Console Right Panel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Editor Form settings */}
        <div style={{ display: 'flex', gap: 16, alignItems: 'end' }}>
          <div className="input-group" style={{ flex: 1 }}>
            <span className="input-label">SCRIPT NAME</span>
            <input
              type="text"
              placeholder="e.g. CleanOrphanTasks"
              className="input-field"
              value={scriptName}
              onChange={(e) => setScriptName(e.target.value)}
            />
          </div>

          <div className="input-group" style={{ width: 140 }}>
            <span className="input-label">LANGUAGE</span>
            <select
              className="input-field"
              value={language}
              onChange={(e) => {
                const lang = e.target.value as any
                setLanguage(lang)
                if (code === DEFAULT_JS || code === DEFAULT_PYTHON) {
                  setCode(lang === 'javascript' ? DEFAULT_JS : DEFAULT_PYTHON)
                }
              }}
            >
              <option value="javascript">JavaScript (VM)</option>
              <option value="python">Python (Shell)</option>
            </select>
          </div>

          <button
            onClick={handleSave}
            className="btn btn-secondary"
            style={{
              height: '38px',
              padding: '0 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Save size={14} />
            <span>Save</span>
          </button>
        </div>

        <div className="input-group">
          <span className="input-label">DESCRIPTION (OPTIONAL)</span>
          <input
            type="text"
            placeholder="Describe what this script does..."
            className="input-field"
            value={scriptDesc}
            onChange={(e) => setScriptDesc(e.target.value)}
          />
        </div>

        {/* Code Editor */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span className="input-label">CODE EDITOR</span>
          <textarea
            style={{
              fontFamily: 'Consolas, Monaco, monospace',
              fontSize: '13px',
              padding: 12,
              background: 'rgba(0, 0, 0, 0.3)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 8,
              minHeight: '220px',
              color: '#f8f8f2',
              resize: 'vertical',
              lineHeight: 1.5,
              outline: 'none'
            }}
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
        </div>

        {/* Actions bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={handleRun}
            disabled={running}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 24px' }}
          >
            {running ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
            <span>{running ? 'Running Script...' : 'Run Script'}</span>
          </button>

          {message && (
            <span
              style={{
                fontSize: '13px',
                color: message.isError ? '#e74c3c' : '#2ecc71',
                display: 'flex',
                alignItems: 'center',
                gap: 6
              }}
            >
              <AlertTriangle size={14} />
              {message.text}
            </span>
          )}
        </div>

        {/* Console output stream */}
        <div
          style={{
            background: 'rgba(0, 0, 0, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: 8,
            padding: 14,
            fontFamily: 'Consolas, Monaco, monospace',
            fontSize: '12px',
            color: '#a9b7c6',
            minHeight: '140px',
            maxHeight: '300px',
            overflowY: 'auto'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
              paddingBottom: 6,
              marginBottom: 8,
              color: '#fff'
            }}
          >
            <Terminal size={12} />
            <span>CONSOLE OUTPUT</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {consoleLogs.map((log, index) => {
              let color = '#a9b7c6'
              if (
                log.startsWith('[ERROR]') ||
                log.startsWith('[STDERR]') ||
                log.startsWith('[CRASH]')
              ) {
                color = '#e74c3c'
              } else if (log.startsWith('[DB ERROR]')) {
                color = '#f1c40f'
              } else if (log.startsWith('[SYSTEM]')) {
                color = '#3498db'
              }
              return (
                <div key={index} style={{ color, whiteSpace: 'pre-wrap' }}>
                  {log}
                </div>
              )
            })}

            {consoleResult && (
              <div
                style={{
                  marginTop: 8,
                  paddingTop: 8,
                  borderTop: '1px dashed rgba(255,255,255,0.05)'
                }}
              >
                <span style={{ color: '#2ecc71', fontWeight: 600 }}>Return Value:</span>
                <pre style={{ margin: '4px 0 0 0', color: '#a9b7c6', whiteSpace: 'pre-wrap' }}>
                  {consoleResult}
                </pre>
              </div>
            )}

            {!running && consoleLogs.length === 0 && !consoleResult && (
              <span style={{ color: 'rgba(255,255,255,0.25)' }}>
                Console idle. Click "Run Script" to execute.
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
