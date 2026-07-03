import React, { useState, useEffect, useRef } from 'react'
import { useChatStore } from '../stores/chatStore'
import { useModalStore } from '../stores/modalStore'
import { MessageSquare, Plus, Trash2, Send, X, Bot, User, Sparkles } from 'lucide-react'

export default function AICopilotChat(): React.JSX.Element {
  const {
    sessions,
    messages,
    currentSessionId,
    isStreaming,
    loadSessions,
    selectSession,
    createSession,
    deleteSession,
    sendMessage
  } = useChatStore()

  const { closeModal } = useModalStore()
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load chat threads on mount
  useEffect(() => {
    loadSessions()
  }, [])

  // Auto scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isStreaming])

  const handleCreateSession = async () => {
    const title = `Session ${sessions.length + 1}`
    await createSession(title)
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isStreaming) return

    let activeId = currentSessionId
    if (!activeId) {
      activeId = await createSession('New Chat Session')
    }

    const text = input
    setInput('')
    await sendMessage(text)
  }

  return (
    <div className="modal-overlay" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div
        className="modal-content glass"
        style={{
          maxWidth: 900,
          width: '90vw',
          height: '80vh',
          display: 'flex',
          flexDirection: 'row',
          borderRadius: 12,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
          padding: 0
        }}
      >
        {/* Sidebar: Chat Sessions list */}
        <div
          style={{
            width: 240,
            borderRight: '1px solid var(--border-color)',
            backgroundColor: 'rgba(0, 0, 0, 0.15)',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <div
            style={{
              padding: 16,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderBottom: '1px solid var(--border-color)'
            }}
          >
            <span style={{ fontSize: '13px', fontWeight: 600, letterSpacing: '0.5px' }}>
              CHAT HISTORY
            </span>
            <button
              className="btn btn-ghost"
              style={{ padding: 4, borderRadius: 4 }}
              onClick={handleCreateSession}
              title="New Chat"
            >
              <Plus size={16} />
            </button>
          </div>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 4
            }}
          >
            {sessions.map((s) => {
              const active = s.id === currentSessionId
              return (
                <div
                  key={s.id}
                  onClick={() => selectSession(s.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderRadius: 6,
                    backgroundColor: active ? 'rgba(52, 152, 219, 0.15)' : 'transparent',
                    color: active ? 'var(--color-secondary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div
                    style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}
                  >
                    <MessageSquare size={14} style={{ flexShrink: 0 }} />
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: active ? 600 : 500,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {s.title}
                    </span>
                  </div>
                  <button
                    className="btn-ghost"
                    style={{ padding: 2, opacity: active ? 1 : 0 }}
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteSession(s.id)
                    }}
                    title="Delete Chat"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {/* Main Panel: Chat Conversation */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-app)'
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 20px',
              borderBottom: '1px solid var(--border-color)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Bot size={18} className="text-secondary" />
              <span style={{ fontSize: '14px', fontWeight: 600 }}>Local Copilot Assistant</span>
              <span
                className="font-mono text-muted"
                style={{
                  fontSize: '10px',
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  padding: '2px 6px',
                  borderRadius: 4
                }}
              >
                Qwen-2.5-1.5B
              </span>
            </div>
            <button
              className="btn-ghost"
              onClick={() => closeModal('aiQuery')}
              style={{ padding: 4 }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages Thread */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              gap: 16
            }}
          >
            {messages.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)'
                }}
              >
                <Sparkles
                  size={32}
                  style={{ marginBottom: 12, opacity: 0.3 }}
                  className="text-secondary animate-pulse"
                />
                <span style={{ fontSize: '14px', fontWeight: 600 }}>Ask your Local Copilot</span>
                <span
                  style={{ fontSize: '11px', marginTop: 4, textAlign: 'center', maxWidth: 300 }}
                >
                  Ask questions about your workbench. Copilot fetches context from your notes and
                  files securely.
                </span>
              </div>
            ) : (
              messages.map((m) => {
                const isBot = m.sender === 'assistant'
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      gap: 12,
                      alignSelf: isBot ? 'flex-start' : 'flex-end',
                      maxWidth: '80%',
                      flexDirection: isBot ? 'row' : 'row-reverse'
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        backgroundColor: isBot
                          ? 'rgba(52, 152, 219, 0.2)'
                          : 'rgba(230, 126, 34, 0.2)',
                        color: isBot ? 'var(--color-secondary)' : '#e67e22',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {isBot ? <Bot size={15} /> : <User size={15} />}
                    </div>
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: 10,
                        backgroundColor: isBot ? 'var(--bg-surface)' : 'rgba(230, 126, 34, 0.12)',
                        border: isBot
                          ? '1px solid var(--border-color)'
                          : '1px solid rgba(230, 126, 34, 0.2)',
                        fontSize: '13px',
                        lineHeight: '1.5',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      {m.content || (
                        <div style={{ display: 'flex', gap: 4, padding: '4px 0' }}>
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              backgroundColor: 'var(--color-secondary)',
                              animation: 'pulse 1s infinite'
                            }}
                          />
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              backgroundColor: 'var(--color-secondary)',
                              animation: 'pulse 1s infinite 0.2s'
                            }}
                          />
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              backgroundColor: 'var(--color-secondary)',
                              animation: 'pulse 1s infinite 0.4s'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Form Input */}
          <form
            onSubmit={handleSend}
            style={{
              padding: 16,
              borderTop: '1px solid var(--border-color)',
              display: 'flex',
              gap: 10,
              backgroundColor: 'rgba(0,0,0,0.1)'
            }}
          >
            <input
              type="text"
              className="input-field"
              placeholder="Ask Copilot anything..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isStreaming}
              style={{ flex: 1, borderRadius: 8, height: 38 }}
            />
            <button
              type="submit"
              className="btn btn-primary"
              style={{ padding: '0 16px', borderRadius: 8, height: 38 }}
              disabled={!input.trim() || isStreaming}
            >
              <Send size={16} />
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
