import React, { useEffect, useRef, useState } from 'react'
import { useQuickCaptureStore } from '../stores/quickCaptureStore'
import { useWorkspaceStore } from '../stores/workspaceStore'
import { Sparkles, CornerDownLeft, X, CheckCircle } from 'lucide-react'

export default function QuickCapture(): React.JSX.Element | null {
  const { isOpen, close, toggle } = useQuickCaptureStore()
  const { createNote, loadItems } = useWorkspaceStore()
  const [noteText, setNoteText] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Global trigger Ctrl+Shift+Space
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent): void => {
      // Check for Ctrl+Shift+Space (Cmd+Shift+Space on macOS)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [toggle])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      if (inputRef.current) {
        inputRef.current.focus()
      }
      setNoteText('')
      setShowSuccess(false)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSave = async (): Promise<void> => {
    const text = noteText.trim()
    if (!text) return

    // Create a title from the first 40 characters
    const title = text.length > 40 ? `${text.substring(0, 40)}...` : text

    try {
      await createNote(title, text, text)
      // Trigger a reload of items to make sure it is updated in workspace/dashboard
      await loadItems()

      setShowSuccess(true)
      setNoteText('')
      setTimeout(() => {
        close()
      }, 800)
    } catch (err) {
      console.error('Failed to quick-capture note:', err)
      alert('Failed to save note. See developer console.')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      close()
    }
  }

  return (
    <div
      className="modal-overlay"
      style={{
        alignItems: 'flex-start',
        paddingTop: '6vh',
        zIndex: 9999,
        backgroundColor: 'rgba(10, 10, 12, 0.45)',
        backdropFilter: 'blur(6px)'
      }}
      onClick={close}
    >
      <div
        className="modal-content glass"
        style={{
          maxWidth: 600,
          width: '100%',
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          backgroundColor: 'var(--bg-card)',
          padding: '16px 20px'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              borderRadius: 8,
              backgroundColor: 'rgba(52, 152, 219, 0.12)',
              color: 'var(--color-secondary)'
            }}
          >
            <Sparkles size={18} className="animate-pulse" />
          </div>

          <div style={{ flex: 1 }}>
            <input
              ref={inputRef}
              type="text"
              className="input-field"
              placeholder={
                showSuccess
                  ? 'Note captured successfully!'
                  : 'Type quick note and hit Enter to capture...'
              }
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={showSuccess}
              style={{
                border: 'none',
                background: 'transparent',
                fontSize: '15px',
                padding: 0,
                width: '100%',
                outline: 'none',
                boxShadow: 'none',
                color: showSuccess ? 'var(--color-success)' : 'var(--text-main)',
                fontWeight: 500
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {showSuccess ? (
              <CheckCircle size={18} style={{ color: 'var(--color-success)' }} />
            ) : (
              <>
                <button
                  onClick={handleSave}
                  disabled={!noteText.trim()}
                  className="btn btn-primary"
                  style={{
                    padding: '6px 12px',
                    fontSize: '11px',
                    borderRadius: 6,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4
                  }}
                >
                  <span>Capture</span>
                  <CornerDownLeft size={10} />
                </button>
                <button
                  onClick={close}
                  className="btn-ghost"
                  style={{ padding: 4, borderRadius: 4 }}
                >
                  <X size={16} />
                </button>
              </>
            )}
          </div>
        </div>

        {!showSuccess && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginTop: 10,
              paddingTop: 8,
              borderTop: '1px solid rgba(255,255,255,0.04)',
              fontSize: '10px',
              color: 'var(--text-muted)'
            }}
          >
            <span>Captures thoughts directly into your default workspace note index.</span>
            <span>ESC to cancel • ↵ to save</span>
          </div>
        )}
      </div>
    </div>
  )
}
