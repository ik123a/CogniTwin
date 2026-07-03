import { getDatabase } from '../database/connection'
import * as llmService from './llm.service'
import crypto from 'crypto'

export interface WorkflowNode {
  id: string
  type: 'trigger' | 'llm_summary' | 'tag_item' | 'create_task' | 'create_reminder'
  data: Record<string, any>
}

export interface WorkflowEdge {
  source: string
  target: string
}

/**
 * Executes a DAG workflow by ID sequentially.
 */
export async function executeWorkflow(workflowId: string, initialPayload: any): Promise<any> {
  const db = getDatabase()

  try {
    const workflow = db.prepare('SELECT * FROM workflows WHERE id = ?').get(workflowId) as {
      name: string
      nodes_json: string
      edges_json: string
    }

    if (!workflow) {
      console.warn(`[WorkflowExecutor] Workflow ${workflowId} not found.`)
      return null
    }

    console.log(`[WorkflowExecutor] Running workflow: "${workflow.name}"`)

    let nodes: WorkflowNode[] = []
    try {
      nodes = JSON.parse(workflow.nodes_json)
    } catch (e) {
      console.error(`[WorkflowExecutor] Failed to parse nodes for workflow "${workflow.name}":`, e)
      return null
    }

    // Topological/sequential flow execution
    let payload = { ...initialPayload }

    for (const node of nodes) {
      console.log(`[WorkflowExecutor] Executing node: ${node.type} (${node.id})`)
      payload = await executeNode(node, payload)
    }

    console.log(`[WorkflowExecutor] Workflow "${workflow.name}" executed successfully.`)
    return payload
  } catch (error) {
    console.error(`[WorkflowExecutor] Error running workflow ${workflowId}:`, error)
    throw error
  }
}

/**
 * Evaluates individual block types.
 */
async function executeNode(node: WorkflowNode, payload: any): Promise<any> {
  const db = getDatabase()
  const nextPayload = { ...payload }

  try {
    switch (node.type) {
      case 'trigger':
        // No-op node, defines the start event payload
        break

      case 'llm_summary': {
        const textToSummarize = node.data.text || payload.description || payload.content || ''
        if (textToSummarize) {
          console.log(`[WorkflowExecutor] Summarizing text segment...`)
          const summary = await llmService.summarizeText(textToSummarize)
          nextPayload.summary = summary
          console.log(`[WorkflowExecutor] Summary output: "${summary}"`)
        }
        break
      }

      case 'tag_item': {
        const tag = node.data.tag || payload.tag
        const itemId = payload.id
        const itemType = payload.type

        if (tag && itemId && itemType) {
          const tagId = crypto.randomUUID()
          db.prepare('INSERT OR IGNORE INTO tags (id, name) VALUES (?, ?)').run(tagId, tag)
          const tagRow = db.prepare('SELECT id FROM tags WHERE name = ?').get(tag) as { id: string }

          db.prepare(
            `
            INSERT OR IGNORE INTO item_tags (tag_id, item_id, item_type)
            VALUES (?, ?, ?)
          `
          ).run(tagRow.id, itemId, itemType)
          console.log(`[WorkflowExecutor] Auto-tagged ${itemId} as "${tag}"`)
        }
        break
      }

      case 'create_task': {
        const title = node.data.title || payload.taskTitle || 'Automated Workflow Task'
        const priority = node.data.priority || 'Medium'

        const taskId = crypto.randomUUID()
        db.prepare(
          `
          INSERT INTO tasks (id, project_id, title, priority, status)
          VALUES (?, ?, ?, ?, ?)
        `
        ).run(taskId, payload.project_id || null, title, priority, 'Todo')

        nextPayload.createdTaskId = taskId
        console.log(`[WorkflowExecutor] Created task: "${title}"`)
        break
      }

      case 'create_reminder': {
        const message = node.data.message || payload.message || 'Workflow action triggered'
        const inboxId = crypto.randomUUID()
        db.prepare(
          `
          INSERT INTO inbox_items (id, type, source, title, content, priority)
          VALUES (?, ?, ?, ?, ?, ?)
        `
        ).run(inboxId, 'reminder', 'Workflow Engine', 'Automation Notice', message, 'Yellow')
        console.log(`[WorkflowExecutor] Dispatched alert notification: "${message}"`)
        break
      }

      default:
        console.warn(`[WorkflowExecutor] Unhandled node block type: ${node.type}`)
    }
  } catch (err) {
    console.error(`[WorkflowExecutor] Failed executing node ${node.id} (${node.type}):`, err)
  }

  return nextPayload
}
