import { getDatabase } from '../database/connection'
import * as llmService from './llm.service'
import crypto from 'crypto'

export interface EmailMessage {
  id: string
  title: string
  content: string
  source: string
  date_received: string
  priority: 'Red' | 'Orange' | 'Yellow' | 'Blue' | 'Gray'
  metadata: {
    sender?: string
    draft_reply?: string
    recipient?: string
  }
}

/**
 * Triggers polling and AI triage classification for configured email accounts.
 */
export async function syncEmailAccounts(): Promise<{ success: boolean; count: number }> {
  const db = getDatabase()

  try {
    // 1. Fetch active email integration configurations
    const accounts = db
      .prepare("SELECT * FROM integration_accounts WHERE type = 'imap' AND is_active = 1")
      .all() as any[]
    if (accounts.length === 0) {
      return { success: true, count: 0 }
    }

    let ingestedCount = 0

    for (const account of accounts) {
      const config = JSON.parse(account.config_json)
      const host = config.host || 'imap.gmail.com'
      const user = account.username || 'user@gmail.com'

      // 2. Fetch new mock emails representing external sync
      const mockIncoming = generateMockIncomingEmails(user)

      for (const email of mockIncoming) {
        // Prevent duplicate syncs
        const exists = db.prepare('SELECT id FROM inbox_items WHERE id = ?').get(email.id)
        if (exists) continue

        // 3. AI Triage & Draft Response Generation locally using Qwen/Llama
        let priority = email.priority
        let draftReply = ''

        try {
          const triagePrompt = `You are a cognitive digital assistant triaging an incoming email.
Sender: ${email.metadata.sender}
Subject: ${email.title}
Body: ${email.content}

Classify priority exactly into one word: 'Red' (if action/urgent response is needed), 'Orange' (if important but not immediate), 'Yellow' (normal review). Return ONLY the priority word.`

          const classification = await llmService.summarizeText(triagePrompt)
          const cleanedClass = classification.trim().replace(/['".]/g, '')
          if (['Red', 'Orange', 'Yellow', 'Blue', 'Gray'].includes(cleanedClass)) {
            priority = cleanedClass as any
          }

          const draftPrompt = `You are writing a short reply to this email:
From: ${email.metadata.sender}
Subject: ${email.title}
Body: ${email.content}

Write a polite, 2-sentence draft reply starting with 'Hi'.`
          draftReply = await llmService.summarizeText(draftPrompt)
        } catch (llmErr) {
          console.warn('[EmailIntegration] Local LLM drafting skipped:', llmErr)
          draftReply = `Hi, thank you for the update. I have received your message regarding "${email.title}" and will follow up shortly.`
        }

        // 4. Save into database inbox_items
        const metadata = {
          sender: email.metadata.sender,
          recipient: user,
          draft_reply: draftReply
        }

        db.prepare(
          `
          INSERT INTO inbox_items (id, type, source, title, content, priority, date_received, metadata)
          VALUES (?, 'email', ?, ?, ?, ?, ?, ?)
        `
        ).run(
          email.id,
          host.includes('gmail') ? 'Gmail' : 'Outlook',
          email.title,
          email.content,
          priority,
          email.date_received,
          JSON.stringify(metadata)
        )

        ingestedCount++
      }

      // Update sync time
      db.prepare(
        "UPDATE integration_accounts SET last_synced_at = datetime('now') WHERE id = ?"
      ).run(account.id)
    }

    return { success: true, count: ingestedCount }
  } catch (error) {
    console.error('[EmailIntegration] Sync failed:', error)
    return { success: false, count: 0 }
  }
}

function generateMockIncomingEmails(username: string): EmailMessage[] {
  const hash = crypto.createHash('md5').update(username).digest('hex').substring(0, 6)

  return [
    {
      id: `mail-1-${hash}`,
      title: 'URGENT: Project Alpha Review tomorrow morning',
      content:
        'Hello, please review the final presentation slide-deck before the client sync meeting tomorrow at 9:00 AM. Let me know if any numbers are incorrect.',
      source: 'Gmail',
      date_received: new Date().toISOString(),
      priority: 'Red',
      metadata: { sender: 'manager.alpha@company.com' }
    },
    {
      id: `mail-2-${hash}`,
      title: 'Lunch team sync update',
      content:
        'Hey! We are ordering Pizza for lunch today. Let me know if you want Gluten-Free or standard pepperoni. Cheers!',
      source: 'Gmail',
      date_received: new Date().toISOString(),
      priority: 'Yellow',
      metadata: { sender: 'colleague.pizza@company.com' }
    }
  ]
}
