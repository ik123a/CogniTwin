import { create } from 'zustand'

export interface LlmSession {
  id: string
  title: string
  created_at: string
}

export interface LlmMessage {
  id: string
  session_id: string
  sender: 'user' | 'assistant'
  content: string
  created_at: string
}

interface ChatState {
  sessions: LlmSession[]
  messages: LlmMessage[]
  currentSessionId: string | null
  isStreaming: boolean

  loadSessions: () => Promise<void>
  selectSession: (sessionId: string) => Promise<void>
  createSession: (title: string) => Promise<string>
  deleteSession: (sessionId: string) => Promise<void>
  sendMessage: (prompt: string) => Promise<void>
}

export const useChatStore = create<ChatState>((set, get) => ({
  sessions: [],
  messages: [],
  currentSessionId: null,
  isStreaming: false,

  loadSessions: async () => {
    try {
      const list = await window.api.llm.getSessions()
      set({ sessions: list })

      // Auto-select first session if exists and none selected
      if (list.length > 0 && !get().currentSessionId) {
        await get().selectSession(list[0].id)
      }
    } catch (e) {
      console.error('Failed to load chat sessions:', e)
    }
  },

  selectSession: async (sessionId) => {
    set({ currentSessionId: sessionId, messages: [] })
    try {
      const history = await window.api.llm.getMessages(sessionId)
      set({ messages: history })
    } catch (e) {
      console.error(`Failed to load messages for session ${sessionId}:`, e)
    }
  },

  createSession: async (title) => {
    try {
      const session = await window.api.llm.createSession(title)
      set((state) => ({
        sessions: [session, ...state.sessions],
        currentSessionId: session.id,
        messages: []
      }))
      return session.id
    } catch (e) {
      console.error('Failed to create chat session:', e)
      throw e
    }
  },

  deleteSession: async (sessionId) => {
    try {
      await window.api.llm.deleteSession(sessionId)
      set((state) => {
        const remaining = state.sessions.filter((s) => s.id !== sessionId)
        const nextActive =
          state.currentSessionId === sessionId ? remaining[0]?.id || null : state.currentSessionId

        return {
          sessions: remaining,
          currentSessionId: nextActive
        }
      })

      const nextActiveId = get().currentSessionId
      if (nextActiveId) {
        await get().selectSession(nextActiveId)
      } else {
        set({ messages: [] })
      }
    } catch (e) {
      console.error('Failed to delete session:', e)
    }
  },

  sendMessage: async (prompt) => {
    const sessionId = get().currentSessionId
    if (!sessionId || !prompt.trim() || get().isStreaming) return

    const userMsgId = crypto.randomUUID()
    const assistantMsgId = crypto.randomUUID()

    // Prepend user message and placeholder assistant message in state
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: userMsgId,
          session_id: sessionId,
          sender: 'user',
          content: prompt,
          created_at: new Date().toISOString()
        },
        {
          id: assistantMsgId,
          session_id: sessionId,
          sender: 'assistant',
          content: '',
          created_at: new Date().toISOString()
        }
      ],
      isStreaming: true
    }))

    try {
      // Trigger streaming inference from main process
      await window.api.llm.sendMessage(sessionId, prompt)
      set({ isStreaming: false })
    } catch (error) {
      console.error('Failed to stream response:', error)
      set({ isStreaming: false })

      // Update assistant message with error notice
      set((state) => ({
        messages: state.messages.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                content:
                  '⚠️ local LLM inference encountered an error. Please verify model files and try again.'
              }
            : m
        )
      }))
    }
  }
}))

// Listen globally to streaming token events from preload context bridge
if (typeof window !== 'undefined' && window.api && window.api.llm) {
  window.api.llm.onToken(({ sessionId, token }) => {
    const activeSessionId = useChatStore.getState().currentSessionId
    if (activeSessionId === sessionId) {
      useChatStore.setState((state) => {
        const msgs = [...state.messages]
        const lastMsg = msgs[msgs.length - 1]
        if (lastMsg && lastMsg.sender === 'assistant') {
          lastMsg.content += token
        }
        return { messages: msgs }
      })
    }
  })
}
