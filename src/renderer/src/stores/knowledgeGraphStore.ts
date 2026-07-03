import { create } from 'zustand'

export interface GraphNode {
  id: string
  label: string
  type:
    | 'project'
    | 'note'
    | 'task'
    | 'file'
    | 'tag'
    | 'user'
    | 'person'
    | 'organization'
    | 'place'
    | 'concept'
    | 'date'
  val: number // size weight
  color?: string
  details?: any
}

export interface GraphLink {
  source: string
  target: string
  type: string // e.g., 'belongs_to', 'tagged_with', 'references'
  weight: number
}

interface KnowledgeGraphState {
  nodes: GraphNode[]
  links: GraphLink[]
  selectedNode: GraphNode | null
  searchQuery: string
  isLoading: boolean

  loadGraph: () => Promise<void>
  setSelectedNode: (node: GraphNode | null) => void
  setSearchQuery: (query: string) => void
  addRelationship: (
    sourceId: string,
    sourceType: string,
    targetId: string,
    targetType: string,
    type: string
  ) => Promise<void>
  deleteRelationship: (sourceId: string, targetId: string) => Promise<void>
}

export const useKnowledgeGraphStore = create<KnowledgeGraphState>((set, get) => ({
  nodes: [],
  links: [],
  selectedNode: null,
  searchQuery: '',
  isLoading: false,

  loadGraph: async () => {
    set({ isLoading: true })
    try {
      const db = window.api.db

      // Fetch core database entities
      const projects = await db.query<{ id: string; name: string; color: string }>(
        'SELECT id, name, color FROM projects'
      )
      const notes = await db.query<{ id: string; title: string; project_id: string | null }>(
        'SELECT id, title, project_id FROM notes'
      )
      const tasks = await db.query<{
        id: string
        title: string
        project_id: string | null
        priority: string
      }>('SELECT id, title, project_id, priority FROM tasks')
      const files = await db.query<{
        id: string
        name: string
        type: string
        project_id: string | null
      }>('SELECT id, name, type, project_id FROM files')
      const tags = await db.query<{ id: string; name: string; color: string }>(
        'SELECT id, name, color FROM tags'
      )

      // Fetch explicit relationships from DB
      const explicitRel = await db.query<{
        source_id: string
        target_id: string
        type: string
        weight: number
      }>('SELECT source_id, target_id, type, weight FROM relationships')

      // Fetch named entities and mentions
      const entities = await db.query<{ id: string; name: string; type: string }>(
        'SELECT id, name, type FROM entities'
      )
      const mentions = await db.query<{ entity_id: string; source_id: string }>(
        'SELECT entity_id, source_id FROM entity_mentions'
      )

      // Create nodes list
      const nodesList: GraphNode[] = []
      const linksList: GraphLink[] = []

      // Add user root node
      nodesList.push({
        id: 'user_root',
        label: 'My Digital Twin',
        type: 'user',
        val: 20,
        color: '#e67e22'
      })

      // Projects
      for (const p of projects) {
        nodesList.push({
          id: p.id,
          label: p.name,
          type: 'project',
          val: 14,
          color: p.color,
          details: p
        })

        // Link project to user root
        linksList.push({
          source: 'user_root',
          target: p.id,
          type: 'contains',
          weight: 1
        })
      }

      // Notes
      for (const n of notes) {
        nodesList.push({
          id: n.id,
          label: n.title,
          type: 'note',
          val: 8,
          color: '#34495e',
          details: n
        })

        if (n.project_id) {
          linksList.push({
            source: n.id,
            target: n.project_id,
            type: 'belongs_to',
            weight: 1.5
          })
        } else {
          linksList.push({
            source: 'user_root',
            target: n.id,
            type: 'orphaned_note',
            weight: 0.5
          })
        }
      }

      // Tasks
      for (const t of tasks) {
        let taskColor = '#2ecc71'
        if (t.priority === 'High') taskColor = '#e74c3c'
        else if (t.priority === 'Medium') taskColor = '#f1c40f'

        nodesList.push({
          id: t.id,
          label: t.title,
          type: 'task',
          val: 8,
          color: taskColor,
          details: t
        })

        if (t.project_id) {
          linksList.push({
            source: t.id,
            target: t.project_id,
            type: 'assigned_to',
            weight: 1.5
          })
        } else {
          linksList.push({
            source: 'user_root',
            target: t.id,
            type: 'general_task',
            weight: 0.5
          })
        }
      }

      // Files
      for (const f of files) {
        nodesList.push({
          id: f.id,
          label: f.name,
          type: 'file',
          val: 6,
          color: '#95a5a6',
          details: f
        })

        if (f.project_id) {
          linksList.push({
            source: f.id,
            target: f.project_id,
            type: 'stored_in',
            weight: 1.5
          })
        } else {
          linksList.push({
            source: 'user_root',
            target: f.id,
            type: 'loose_file',
            weight: 0.5
          })
        }
      }

      // Tags
      for (const tag of tags) {
        nodesList.push({
          id: tag.id,
          label: `#${tag.name}`,
          type: 'tag',
          val: 10,
          color: tag.color,
          details: tag
        })

        // Query tag linkages
        const itemsTagged = await db.query<{ item_id: string }>(
          'SELECT item_id FROM item_tags WHERE tag_id = ?',
          [tag.id]
        )
        for (const item of itemsTagged) {
          linksList.push({
            source: item.item_id,
            target: tag.id,
            type: 'tagged_with',
            weight: 1
          })
        }
      }

      // Extracted Named Entities
      for (const e of entities) {
        let entityColor = '#9b59b6' // default organization purple
        if (e.type === 'person') entityColor = '#3498db'
        else if (e.type === 'place') entityColor = '#2ecc71'

        nodesList.push({
          id: e.id,
          label: e.name,
          type: e.type as any,
          val: 6,
          color: entityColor,
          details: e
        })
      }

      // Entity mentions links
      for (const m of mentions) {
        if (
          nodesList.some((nd) => nd.id === m.entity_id) &&
          nodesList.some((nd) => nd.id === m.source_id)
        ) {
          linksList.push({
            source: m.source_id,
            target: m.entity_id,
            type: 'mentions',
            weight: 0.8
          })
        }
      }

      // Explicit Relationships
      for (const rel of explicitRel) {
        // Ensure both source and target exist in nodes
        if (
          nodesList.some((nd) => nd.id === rel.source_id) &&
          nodesList.some((nd) => nd.id === rel.target_id)
        ) {
          linksList.push({
            source: rel.source_id,
            target: rel.target_id,
            type: rel.type,
            weight: rel.weight || 1
          })
        }
      }

      set({ nodes: nodesList, links: linksList, isLoading: false })
    } catch (error) {
      console.error('Failed to load knowledge graph data:', error)
      set({ isLoading: false })
    }
  },

  setSelectedNode: (selectedNode) => set({ selectedNode }),

  setSearchQuery: (searchQuery) => set({ searchQuery }),

  addRelationship: async (sourceId, sourceType, targetId, targetType, type) => {
    const id = crypto.randomUUID()
    try {
      await window.api.db.execute(
        'INSERT INTO relationships (id, source_id, source_type, target_id, target_type, type) VALUES (?, ?, ?, ?, ?, ?)',
        [id, sourceId, sourceType, targetId, targetType, type]
      )
      await get().loadGraph()
    } catch (e) {
      console.error('Failed to add relationship:', e)
    }
  },

  deleteRelationship: async (sourceId, targetId) => {
    try {
      await window.api.db.execute(
        'DELETE FROM relationships WHERE source_id = ? AND target_id = ?',
        [sourceId, targetId]
      )
      await get().loadGraph()
    } catch (e) {
      console.error('Failed to delete relationship:', e)
    }
  }
}))
