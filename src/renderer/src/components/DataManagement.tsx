import React, { useState, useEffect } from 'react'
import { useDataManagementStore } from '../stores/dataManagementStore'
import {
  Download,
  Upload,
  Copy,
  Shield,
  CheckCircle,
  AlertTriangle,
  Trash2,
  HelpCircle
} from 'lucide-react'

export const DataManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'export' | 'import' | 'dedup' | 'integrity'>('export')
  const store = useDataManagementStore()

  // Export tab state
  const [exportFormat, setExportFormat] = useState<'json' | 'csv' | 'markdown'>('json')
  const [exportScope, setExportScope] = useState('') // Empty = All, otherwise projectId
  const [exportMessage, setExportMessage] = useState('')

  // Import tab state
  const [importFilePath, setImportFilePath] = useState('')
  const [detectedFormat, setDetectedFormat] = useState('')
  const [importStatus, setImportStatus] = useState('')

  // Deduplication tab state
  const [dedupStatus, setDedupStatus] = useState('')
  const [mergePrimaryMap, setMergePrimaryMap] = useState<Record<string, string>>({}) // groupId -> memberId

  // Integrity tab state
  const [repairStatus, setRepairStatus] = useState('')
  const [validationResults, setValidationResults] = useState<{
    orphans: any[]
    brokenLinks: any[]
  } | null>(null)

  useEffect(() => {
    store.fetchDuplicateGroups()
    store.fetchTransferHistory()
    store.fetchBackupHistory()
  }, [])

  const handleExport = async () => {
    setExportMessage('Generating export file...')
    try {
      let res
      if (exportFormat === 'json') {
        res = await window.api.dataExport.toJSON(exportScope || undefined)
        setExportMessage(`Export complete! Saved to:\n${res.filePath}`)
      } else if (exportFormat === 'csv') {
        res = await window.api.dataExport.toCSV('note', exportScope || undefined)
        setExportMessage(`Notes CSV exported successfully! Saved to:\n${res.filePath}`)
      } else if (exportFormat === 'markdown') {
        res = await window.api.dataExport.toMarkdown()
        setExportMessage(`Notes markdown folder exported! Saved to:\n${res.filePath}`)
      }
      store.fetchTransferHistory()
    } catch (e: any) {
      setExportMessage(`Export failed: ${e.message}`)
    }
  }

  const handleImportDetect = async (path: string) => {
    if (!path.trim()) return
    try {
      const res = await window.api.dataImport.detect(path)
      setDetectedFormat(res.format)
    } catch {
      setDetectedFormat('unknown')
    }
  }

  const handleImport = async () => {
    if (!importFilePath.trim()) return
    setImportStatus('Running import task...')
    try {
      let res
      if (detectedFormat === 'json') {
        res = await window.api.dataImport.fromJSON(importFilePath)
        setImportStatus(`Successfully imported ${res.imported} items!`)
      } else if (detectedFormat === 'markdown_folder') {
        res = await window.api.dataImport.fromMarkdown(importFilePath)
        setImportStatus(`Successfully imported ${res.imported} markdown notes!`)
      } else {
        setImportStatus(
          'Format not supported for auto-import. Choose structured JSON or Markdown Folder.'
        )
      }
      store.fetchTransferHistory()
    } catch (e: any) {
      setImportStatus(`Import failed: ${e.message}`)
    }
  }

  const handleScanDuplicates = async () => {
    setDedupStatus('Scanning...')
    await store.scanForDuplicates()
    setDedupStatus('Scan completed.')
  }

  const handleMerge = async (groupId: string) => {
    const primaryId = mergePrimaryMap[groupId]
    const group = store.duplicateGroups.find((g) => g.id === groupId)
    if (!group) return

    const finalPrimaryId =
      primaryId || group.members.find((m) => m.isPrimary === 1)?.id || group.members[0].id
    const res = await store.mergeDuplicates(groupId, finalPrimaryId)
    if (res) {
      alert('Duplicates merged successfully.')
    } else {
      alert('Merge failed.')
    }
  }

  const handleRunIntegrity = async () => {
    await store.runIntegrityCheck()
  }

  const handleRunValidation = async () => {
    const res = await store.validateReferences()
    setValidationResults(res)
  }

  const handleRepairAll = async () => {
    setRepairStatus('Repairing referential integrity...')
    const issuesToRepair: any[] = []

    if (store.integrityReport?.mismatches) {
      issuesToRepair.push(...store.integrityReport.mismatches)
    }
    if (validationResults?.orphans) {
      issuesToRepair.push(...validationResults.orphans)
    }
    if (validationResults?.brokenLinks) {
      issuesToRepair.push(...validationResults.brokenLinks)
    }

    if (issuesToRepair.length === 0) {
      setRepairStatus('No issues found to repair.')
      return
    }

    const res = await store.repairIntegrityIssues(issuesToRepair)
    setRepairStatus(`Repaired ${res.repaired} records. Failed: ${res.failed}.`)
    setValidationResults(null)
  }

  return (
    <div
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        color: '#fff',
        display: 'flex',
        flexDirection: 'column',
        height: '100%'
      }}
    >
      {/* Tabs Header */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {(['export', 'import', 'dedup', 'integrity'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              background: activeTab === tab ? 'rgba(255,255,255,0.04)' : 'transparent',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #667eea' : 'none',
              color: activeTab === tab ? '#fff' : '#a0aec0',
              padding: '14px',
              cursor: 'pointer',
              fontWeight: 500,
              fontSize: '0.9rem',
              textTransform: 'capitalize',
              transition: 'all 0.2s ease'
            }}
          >
            {tab === 'dedup' ? 'Deduplication' : tab}
          </button>
        ))}
      </div>

      {/* Tabs Content */}
      <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>
        {/* EXPORT TAB */}
        {activeTab === 'export' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 500 }}>
              Export Workbench Data
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#a0aec0', lineHeight: 1.4 }}>
              Backup or sync notes, tasks, and project models to a variety of standard open formats.
            </p>

            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {/* Format selection */}
              <div
                style={{
                  flex: 1,
                  minWidth: '200px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <label style={{ fontSize: '0.8rem', color: '#a0aec0' }}>Export Format</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['json', 'csv', 'markdown'] as const).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setExportFormat(fmt)}
                      style={{
                        flex: 1,
                        background: exportFormat === fmt ? '#667eea' : 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '6px',
                        color: '#fff',
                        padding: '10px',
                        cursor: 'pointer',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        textTransform: 'uppercase'
                      }}
                    >
                      {fmt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Project select */}
              <div
                style={{
                  flex: 1,
                  minWidth: '200px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}
              >
                <label style={{ fontSize: '0.8rem', color: '#a0aec0' }}>Project Scope</label>
                <select
                  value={exportScope}
                  onChange={(e) => setExportScope(e.target.value)}
                  style={{
                    background: '#1a1a2e',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '10px',
                    fontSize: '0.85rem'
                  }}
                >
                  <option value="">All Workspaces & Projects</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleExport}
              style={{
                background: 'linear-gradient(135deg, #667eea, #764ba2)',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                padding: '12px 24px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: 'fit-content'
              }}
            >
              <Download size={16} />
              Run Export Action
            </button>

            {exportMessage && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  padding: '12px',
                  fontSize: '0.85rem',
                  fontFamily: 'monospace',
                  whiteSpace: 'pre-wrap',
                  color: '#cbd5e0'
                }}
              >
                {exportMessage}
              </div>
            )}
          </div>
        )}

        {/* IMPORT TAB */}
        {activeTab === 'import' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 500 }}>Import Data</h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#a0aec0', lineHeight: 1.4 }}>
              Drag-and-drop or select an exported JSON file, CSV, or Markdown folder to restore
              database entries.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.8rem', color: '#a0aec0' }}>
                Absolute File/Folder Path
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="C:\Users\...\CogniTwin-Exports\export.json"
                  value={importFilePath}
                  onChange={(e) => {
                    setImportFilePath(e.target.value)
                    handleImportDetect(e.target.value)
                  }}
                  style={{
                    flex: 1,
                    background: '#1a1a2e',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    color: '#fff',
                    padding: '10px 12px',
                    fontSize: '0.85rem'
                  }}
                />
              </div>
            </div>

            {detectedFormat && (
              <div
                style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.85rem' }}
              >
                <span style={{ color: '#a0aec0' }}>Detected Format:</span>
                <span
                  style={{
                    background: 'rgba(52,152,219,0.15)',
                    color: '#3498db',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    fontSize: '0.75rem'
                  }}
                >
                  {detectedFormat}
                </span>
              </div>
            )}

            <button
              onClick={handleImport}
              disabled={!importFilePath || detectedFormat === 'unknown'}
              style={{
                background: 'linear-gradient(135deg, #2ecc71, #27ae60)',
                border: 'none',
                borderRadius: '6px',
                color: '#fff',
                padding: '12px 24px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: 'fit-content',
                opacity: !importFilePath || detectedFormat === 'unknown' ? 0.5 : 1
              }}
            >
              <Upload size={16} />
              Run Import Action
            </button>

            {importStatus && (
              <div
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  padding: '12px',
                  fontSize: '0.85rem',
                  color: '#cbd5e0'
                }}
              >
                {importStatus}
              </div>
            )}
          </div>
        )}

        {/* DEDUPLICATION TAB */}
        {activeTab === 'dedup' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 500 }}>
                  Fuzzy Deduplication Scan
                </h4>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#a0aec0' }}>
                  Scans notes and tasks for highly similar names/contents to merge redundancies.
                </p>
              </div>
              <button
                onClick={handleScanDuplicates}
                style={{
                  background: '#667eea',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#white',
                  padding: '10px 20px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Scan Database
              </button>
            </div>

            {dedupStatus && (
              <div style={{ fontSize: '0.85rem', color: '#cbd5e0' }}>{dedupStatus}</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {store.duplicateGroups.length === 0 ? (
                <div
                  style={{
                    padding: '30px',
                    textAlign: 'center',
                    color: '#a0aec0',
                    fontSize: '0.85rem'
                  }}
                >
                  No duplicate clusters detected. Run a scan to discover duplicates.
                </div>
              ) : (
                store.duplicateGroups.map((group) => (
                  <div
                    key={group.id}
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: '8px',
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '12px'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f1c40f' }}>
                        Match confidence: {(group.similarityScore * 100).toFixed(0)}% (
                        {group.entityType})
                      </span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleMerge(group.id)}
                          style={{
                            background: '#2ecc71',
                            border: 'none',
                            borderRadius: '4px',
                            color: '#fff',
                            padding: '4px 10px',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          Merge Selected
                        </button>
                        <button
                          onClick={() => store.dismissDuplicateGroup(group.id)}
                          style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '4px',
                            color: '#cbd5e0',
                            padding: '4px 10px',
                            fontSize: '0.75rem',
                            cursor: 'pointer'
                          }}
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>

                    {/* Member comparison */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      {group.members.map((member) => (
                        <div
                          key={member.id}
                          onClick={() =>
                            setMergePrimaryMap({ ...mergePrimaryMap, [group.id]: member.id })
                          }
                          style={{
                            background:
                              mergePrimaryMap[group.id] === member.id ||
                              (!mergePrimaryMap[group.id] && member.isPrimary === 1)
                                ? 'rgba(102,126,234,0.15)'
                                : 'rgba(0,0,0,0.1)',
                            border:
                              mergePrimaryMap[group.id] === member.id ||
                              (!mergePrimaryMap[group.id] && member.isPrimary === 1)
                                ? '1px solid #667eea'
                                : '1px solid rgba(255,255,255,0.03)',
                            borderRadius: '6px',
                            padding: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              marginBottom: '6px'
                            }}
                          >
                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                              {member.title}
                            </span>
                            {(mergePrimaryMap[group.id] === member.id ||
                              (!mergePrimaryMap[group.id] && member.isPrimary === 1)) && (
                              <span
                                style={{
                                  background: '#667eea',
                                  color: '#fff',
                                  fontSize: '0.65rem',
                                  padding: '1px 4px',
                                  borderRadius: '3px'
                                }}
                              >
                                KEEP / PRIMARY
                              </span>
                            )}
                          </div>
                          <p
                            style={{
                              margin: 0,
                              fontSize: '0.75rem',
                              color: '#cbd5e0',
                              fontStyle: 'italic',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden'
                            }}
                          >
                            {member.details || 'No additional content'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* INTEGRITY TAB */}
        {activeTab === 'integrity' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <h4 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 500 }}>
              System Integrity Diagnostics
            </h4>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#a0aec0', lineHeight: 1.4 }}>
              Verify checksum bounds, trace invalid relations, detect database leaks or orphan
              items.
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleRunIntegrity}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '10px 16px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Verify File Checksums
              </button>
              <button
                onClick={handleRunValidation}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '10px 16px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Validate References
              </button>
              <button
                onClick={handleRepairAll}
                style={{
                  background: 'linear-gradient(135deg, #e74c3c, #c0392b)',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  padding: '10px 16px',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer'
                }}
              >
                Auto-Repair Mismatches
              </button>
            </div>

            {repairStatus && (
              <div style={{ fontSize: '0.85rem', color: '#e74c3c', fontWeight: 500 }}>
                {repairStatus}
              </div>
            )}

            {/* Checksum reports */}
            {store.integrityReport && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h5 style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e0' }}>Checksum Report</h5>
                <div
                  style={{
                    display: 'flex',
                    gap: '16px',
                    fontSize: '0.85rem',
                    background: 'rgba(0,0,0,0.1)',
                    padding: '10px',
                    borderRadius: '6px'
                  }}
                >
                  <div>
                    Total items verified: <strong>{store.integrityReport.total}</strong>
                  </div>
                  <div>
                    Valid checksums: <strong>{store.integrityReport.valid}</strong>
                  </div>
                  <div
                    style={{
                      color: store.integrityReport.mismatches.length > 0 ? '#e74c3c' : '#2ecc71'
                    }}
                  >
                    Mismatches: <strong>{store.integrityReport.mismatches.length}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Validation reports */}
            {validationResults && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <h5 style={{ margin: 0, fontSize: '0.9rem', color: '#cbd5e0' }}>
                  Referential Validation Report
                </h5>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    fontSize: '0.85rem'
                  }}
                >
                  <div
                    style={{ color: validationResults.orphans.length > 0 ? '#f1c40f' : '#2ecc71' }}
                  >
                    Orphaned records found: <strong>{validationResults.orphans.length}</strong>
                  </div>
                  <div
                    style={{
                      color: validationResults.brokenLinks.length > 0 ? '#e74c3c' : '#2ecc71'
                    }}
                  >
                    Broken relationships/links:{' '}
                    <strong>{validationResults.brokenLinks.length}</strong>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
