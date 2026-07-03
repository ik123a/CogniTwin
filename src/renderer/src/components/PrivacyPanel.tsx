import React, { useEffect, useState } from 'react'
import { usePrivacyStore } from '../stores/privacyStore'
import { Shield, EyeOff, Plus, Trash2, ShieldAlert } from 'lucide-react'

export const PrivacyPanel: React.FC = () => {
  const { privacyMode, rules, loading, togglePrivacy, fetchRules, addRule, removeRule } =
    usePrivacyStore()
  const [patternInput, setPatternInput] = useState('')
  const [replacementInput, setReplacementInput] = useState('███')
  const [previewText, setPreviewText] = useState(
    'My secret API key is secret_key_12345 and email is john.doe@email.com'
  )
  const [redactedPreview, setRedactedPreview] = useState('')

  useEffect(() => {
    fetchRules()
  }, [])

  useEffect(() => {
    const applyRedaction = async () => {
      if (previewText) {
        const res = await window.api.privacy.redact(previewText)
        setRedactedPreview(res)
      } else {
        setRedactedPreview('')
      }
    }
    applyRedaction()
  }, [previewText, rules])

  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!patternInput.trim()) return
    await addRule(patternInput, replacementInput)
    setPatternInput('')
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
        gap: '20px'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
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
            <Shield size={20} color="#3498db" />
            Privacy Mode & Redaction Rules
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#a0aec0' }}>
            Configure terms to hide automatically while working in workspaces.
          </p>
        </div>

        {/* Toggle Switch */}
        <button
          onClick={togglePrivacy}
          style={{
            background: privacyMode
              ? 'linear-gradient(135deg, #e74c3c, #c0392b)'
              : 'linear-gradient(135deg, #2ecc71, #27ae60)',
            border: 'none',
            borderRadius: '24px',
            color: '#fff',
            padding: '8px 20px',
            cursor: 'pointer',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
            transition: 'all 0.3s ease'
          }}
        >
          {privacyMode ? <EyeOff size={16} /> : <EyeOff size={16} />}
          {privacyMode ? 'Disable Privacy Mode' : 'Enable Privacy Mode'}
        </button>
      </div>

      {/* Grid container */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Rules column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#cbd5e0', fontWeight: 500 }}>
            Active Redaction Rules
          </h4>

          <div
            style={{
              background: 'rgba(0,0,0,0.15)',
              borderRadius: '8px',
              border: '1px solid rgba(255,255,255,0.05)',
              maxHeight: '200px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            {loading ? (
              <div style={{ padding: '16px', color: '#a0aec0', fontSize: '0.85rem' }}>
                Loading rules...
              </div>
            ) : rules.length === 0 ? (
              <div
                style={{
                  padding: '16px',
                  color: '#a0aec0',
                  fontSize: '0.85rem',
                  textAlign: 'center'
                }}
              >
                No active redaction rules. Add patterns below.
              </div>
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    borderBottom: '1px solid rgba(255,255,255,0.04)'
                  }}
                >
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <code
                      style={{
                        background: 'rgba(255,255,255,0.08)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        color: '#e2e8f0'
                      }}
                    >
                      {rule.pattern}
                    </code>
                    <span style={{ fontSize: '0.8rem', color: '#a0aec0' }}>→</span>
                    <span style={{ fontSize: '0.8rem', color: '#f1c40f', fontWeight: 600 }}>
                      {rule.replacement}
                    </span>
                  </div>
                  <button
                    onClick={() => removeRule(rule.id)}
                    style={
                      {
                        background: 'transparent',
                        border: 'none',
                        color: '#a0aec0',
                        cursor: 'pointer',
                        hover: { color: '#e74c3c' }
                      } as any
                    }
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Add Rule Form */}
          <form onSubmit={handleAddRule} style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              placeholder="Keyword/Regex (e.g. secret_.*)"
              value={patternInput}
              onChange={(e) => setPatternInput(e.target.value)}
              style={{
                flex: 2,
                background: '#1a1a2e',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: '#fff',
                padding: '8px 12px',
                fontSize: '0.85rem'
              }}
            />
            <input
              type="text"
              placeholder="Replacement"
              value={replacementInput}
              onChange={(e) => setReplacementInput(e.target.value)}
              style={{
                flex: 1,
                background: '#1a1a2e',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '6px',
                color: '#fff',
                padding: '8px 12px',
                fontSize: '0.85rem'
              }}
            />
            <button
              type="submit"
              style={{
                background: '#667eea',
                border: 'none',
                borderRadius: '6px',
                color: '#white',
                padding: '8px 16px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Plus size={16} />
            </button>
          </form>
        </div>

        {/* Live Redaction Preview Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <h4 style={{ margin: 0, fontSize: '0.95rem', color: '#cbd5e0', fontWeight: 500 }}>
            Live Redaction Preview
          </h4>
          <textarea
            value={previewText}
            onChange={(e) => setPreviewText(e.target.value)}
            style={{
              background: '#1a1a2e',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              color: '#cbd5e0',
              padding: '12px',
              fontSize: '0.85rem',
              resize: 'none',
              height: '80px',
              fontFamily: 'monospace'
            }}
          />
          <div
            style={{
              background: 'rgba(0,0,0,0.2)',
              border: '1px solid rgba(255,255,255,0.05)',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '0.85rem',
              fontFamily: 'monospace',
              minHeight: '80px',
              color: '#2ecc71',
              wordBreak: 'break-all'
            }}
          >
            {redactedPreview || (
              <span style={{ color: '#a0aec0', fontStyle: 'italic' }}>
                Redacted text output will appear here...
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Info warning alert */}
      <div
        style={{
          background: 'rgba(231, 76, 60, 0.08)',
          border: '1px solid rgba(231, 76, 60, 0.2)',
          borderRadius: '8px',
          padding: '16px',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start'
        }}
      >
        <ShieldAlert size={20} color="#e74c3c" style={{ flexShrink: 0, marginTop: '2px' }} />
        <div>
          <h5 style={{ margin: 0, fontSize: '0.9rem', color: '#e74c3c', fontWeight: 600 }}>
            Secure Deletion Warning
          </h5>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: '#cbd5e0', lineHeight: 1.4 }}>
            When notes, tasks, or files are deleted via "Secure Delete", CogniTwin uses a 3-pass
            overwrite procedure that writes random data blocks over the record before deleting it,
            followed by a database VACUUM to physically scrub the sectors. This action is
            irreversible.
          </p>
        </div>
      </div>
    </div>
  )
}
