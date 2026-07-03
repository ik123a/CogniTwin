import type { LlamaModel, LlamaContext } from 'node-llama-cpp'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { getDatabase } from '../database/connection'
import * as indexingService from './indexing.service'
import crypto from 'crypto'

let llamaInstance: any = null
let modelInstance: LlamaModel | null = null
let contextInstance: LlamaContext | null = null
let LlamaChatSessionClass: any = null

// Resolve local GGUF model path
const modelPath = app.isPackaged
  ? path.join(process.resourcesPath, 'models/qwen2.5-1.5b-instruct-q4_k_m.gguf')
  : path.join(__dirname, '../../resources/models/qwen2.5-1.5b-instruct-q4_k_m.gguf')

/**
 * Initializes llama runner and loads model.
 */
async function initLLM(): Promise<{ model: LlamaModel; context: LlamaContext }> {
  if (modelInstance && contextInstance) {
    return { model: modelInstance, context: contextInstance }
  }

  try {
    if (!fs.existsSync(modelPath)) {
      throw new Error(
        `Local GGUF model file not found at: ${modelPath}. Please run download-llm script.`
      )
    }

    console.log(`Initializing local node-llama-cpp engine...`)
    const { getLlama, LlamaChatSession } = await import('node-llama-cpp')
    LlamaChatSessionClass = LlamaChatSession
    llamaInstance = await getLlama()

    console.log(`Loading GGUF model from: ${modelPath}`)
    modelInstance = await llamaInstance.loadModel({
      modelPath: modelPath
    })

    console.log(`Creating context sequence (contextSize: 2048)...`)
    contextInstance = await modelInstance!.createContext({
      contextSize: 2048
    })

    return { model: modelInstance!, context: contextInstance! }
  } catch (error) {
    console.error('Failed to initialize local LLM engine:', error)
    throw error
  }
}

/**
 * Generates chat response using local GGUF model with streaming tokens and RAG context injection.
 */
export async function generateChatResponse(
  sessionId: string,
  prompt: string,
  onToken: (token: string) => void
): Promise<string> {
  const { context } = await initLLM()
  const db = getDatabase()

  // 1. Retrieve semantic RAG context from Phase 2 vector index
  let ragContext = ''
  try {
    const searchResults = await indexingService.hybridSearch(prompt, 3)
    if (searchResults.length > 0) {
      ragContext =
        "\nHere is relevant context from the user's local workbench:\n" +
        searchResults
          .map((r, i) => `[Context ${i + 1}] Title: ${r.title}\nContent: ${r.snippet}`)
          .join('\n\n')
    }
  } catch (err) {
    console.warn('RAG context retrieval failed:', err)
  }

  // 2. Fetch conversation history from SQLite database to load chat thread memory
  const history = db
    .prepare(
      `
    SELECT sender, content FROM chat_messages 
    WHERE session_id = ? 
    ORDER BY created_at ASC 
    LIMIT 10
  `
    )
    .all(sessionId) as Array<{ sender: string; content: string }>

  // 3. Setup system prompt
  const systemPrompt = `You are CogniTwin, a local, secure AI productivity assistant and personal digital twin. 
You help organize notes, retrieve workbench knowledge, and summarize data.
Answer the user's questions clearly. Keep answers helpful and concise.
${ragContext}`

  // 4. Instantiate LlamaChatSession and feed conversation history
  const session = new LlamaChatSessionClass({
    contextSequence: context.getSequence(),
    systemPrompt: systemPrompt
  })

  // Re-load conversation history into LLM session sequence
  // We feed past messages to LLM context to build conversational memory
  // In node-llama-cpp v3, session maintains conversational state.
  // For RAG/one-shot threads we can prepend history.
  let fullPrompt = ''
  if (history.length > 0) {
    fullPrompt +=
      'Past conversation context:\n' +
      history.map((m) => `${m.sender === 'user' ? 'User' : 'Assistant'}: ${m.content}`).join('\n') +
      '\n\n'
  }
  fullPrompt += `User Question: ${prompt}`

  // Save user message in DB
  const userMsgId = crypto.randomUUID()
  db.prepare(
    `
    INSERT INTO chat_messages (id, session_id, sender, content)
    VALUES (?, ?, ?, ?)
  `
  ).run(userMsgId, sessionId, 'user', prompt)

  console.log('Generating streaming response from Qwen LLM...')

  let responseText = ''

  await session.prompt(fullPrompt, {
    onToken: (tokens: any[]) => {
      const chunk = modelInstance!.detokenize(tokens)
      responseText += chunk
      onToken(chunk)
    }
  })

  // Save assistant message in DB
  const assistantMsgId = crypto.randomUUID()
  db.prepare(
    `
    INSERT INTO chat_messages (id, session_id, sender, content)
    VALUES (?, ?, ?, ?)
  `
  ).run(assistantMsgId, sessionId, 'assistant', responseText)

  return responseText
}

/**
 * Summarizes long texts in 2 sentences locally.
 */
export async function summarizeText(text: string): Promise<string> {
  const { context } = await initLLM()

  const session = new LlamaChatSessionClass({
    contextSequence: context.getSequence(),
    systemPrompt:
      "You are an AI summarizer. Summarize the user's text in 2 clear sentences. Do not add intro or outro."
  })

  console.log('Generating summary locally...')
  const summary = await session.prompt(text)
  return summary.trim()
}

/**
 * Generates a prompt completion using a custom system prompt.
 */
export async function generateCompletion(prompt: string, systemPrompt: string): Promise<string> {
  const { context } = await initLLM()

  const session = new LlamaChatSessionClass({
    contextSequence: context.getSequence(),
    systemPrompt: systemPrompt
  })

  const response = await session.prompt(prompt)
  return response.trim()
}
