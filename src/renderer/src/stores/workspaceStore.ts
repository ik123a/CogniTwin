import { create } from 'zustand'

export interface Workspace {
  id: string
  name: string
  path: string | null
  settings: string
  created_at: string
}

export interface Project {
  id: string
  workspace_id: string
  name: string
  description: string | null
  color: string
  icon: string
  created_at: string
}

export interface Note {
  id: string
  project_id: string | null
  title: string
  content: string | null
  raw_text: string | null
  created_at: string
  updated_at: string
}

export interface Task {
  id: string
  project_id: string | null
  title: string
  description: string | null
  due_date: string | null
  priority: 'Low' | 'Medium' | 'High'
  status: 'Todo' | 'In Progress' | 'Completed'
  created_at: string
  updated_at: string
  subtasks?: Subtask[]
}

export interface Subtask {
  id: string
  task_id: string
  title: string
  completed: number // 0 or 1
  created_at: string
}

export interface CalendarEvent {
  id: string
  project_id: string | null
  title: string
  description: string | null
  start_time: string
  end_time: string
  location: string | null
  created_at: string
}

export interface IngestedFile {
  id: string
  project_id: string | null
  name: string
  path: string
  type: string
  size_bytes: number
  raw_text: string | null
  metadata: string
  created_at: string
}

export interface Tag {
  id: string
  name: string
  color: string
}

interface WorkspaceState {
  workspaces: Workspace[]
  currentWorkspace: Workspace | null
  projects: Project[]
  currentProject: Project | null
  notes: Note[]
  tasks: Task[]
  events: CalendarEvent[]
  files: IngestedFile[]
  tags: Tag[]
  isLoading: boolean

  loadWorkspaces: () => Promise<void>
  createWorkspace: (name: string) => Promise<Workspace>
  selectWorkspace: (workspaceId: string) => Promise<void>

  loadProjects: (workspaceId: string) => Promise<void>
  createProject: (
    name: string,
    description: string,
    color: string,
    icon: string
  ) => Promise<Project>
  selectProject: (project: Project | null) => void

  loadItems: () => Promise<void>
  createNote: (title: string, content: string, rawText: string) => Promise<Note>
  updateNote: (id: string, title: string, content: string, rawText: string) => Promise<void>
  deleteNote: (id: string) => Promise<void>

  createTask: (
    title: string,
    description: string,
    due: string | null,
    priority: 'Low' | 'Medium' | 'High'
  ) => Promise<Task>
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>
  deleteTask: (id: string) => Promise<void>

  createSubtask: (taskId: string, title: string) => Promise<Subtask>
  toggleSubtask: (subtaskId: string, completed: boolean) => Promise<void>

  createEvent: (
    title: string,
    description: string,
    startTime: string,
    endTime: string,
    location: string
  ) => Promise<CalendarEvent>
  deleteEvent: (id: string) => Promise<void>

  loadTags: () => Promise<void>
  createTag: (name: string, color: string) => Promise<Tag>
  addTagToItem: (tagId: string, itemId: string, itemType: string) => Promise<void>
  removeTagFromItem: (tagId: string, itemId: string) => Promise<void>
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  currentWorkspace: null,
  projects: [],
  currentProject: null,
  notes: [],
  tasks: [],
  events: [],
  files: [],
  tags: [],
  isLoading: false,

  loadWorkspaces: async () => {
    set({ isLoading: true })
    try {
      let list = await window.api.db.query<Workspace>(
        'SELECT * FROM workspaces ORDER BY created_at DESC'
      )

      // Seed default workspace if database is empty
      if (list.length === 0) {
        const id = crypto.randomUUID()
        await window.api.db.execute(
          'INSERT INTO workspaces (id, name, settings) VALUES (?, ?, ?)',
          [id, 'My Personal Digital Twin', '{}']
        )
        list = await window.api.db.query<Workspace>('SELECT * FROM workspaces')
      }

      set({ workspaces: list, isLoading: false })

      // Auto-select first workspace if none selected
      if (list.length > 0 && !get().currentWorkspace) {
        await get().selectWorkspace(list[0].id)
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error)
      set({ isLoading: false })
    }
  },

  createWorkspace: async (name: string) => {
    const id = crypto.randomUUID()
    await window.api.db.execute('INSERT INTO workspaces (id, name, settings) VALUES (?, ?, ?)', [
      id,
      name,
      '{}'
    ])
    const newWs: Workspace = {
      id,
      name,
      path: null,
      settings: '{}',
      created_at: new Date().toISOString()
    }
    set((state) => ({ workspaces: [newWs, ...state.workspaces] }))
    return newWs
  },

  selectWorkspace: async (workspaceId: string) => {
    const ws = get().workspaces.find((w) => w.id === workspaceId) || null
    set({ currentWorkspace: ws, currentProject: null })
    if (ws) {
      await get().loadProjects(ws.id)
      await get().loadItems()
      await get().loadTags()
    }
  },

  loadProjects: async (workspaceId: string) => {
    try {
      const list = await window.api.db.query<Project>(
        'SELECT * FROM projects WHERE workspace_id = ? ORDER BY created_at DESC',
        [workspaceId]
      )
      set({ projects: list })
    } catch (error) {
      console.error('Failed to load projects:', error)
    }
  },

  createProject: async (name: string, description: string, color: string, icon: string) => {
    const ws = get().currentWorkspace
    if (!ws) throw new Error('No active workspace')

    const id = crypto.randomUUID()
    await window.api.db.execute(
      'INSERT INTO projects (id, workspace_id, name, description, color, icon) VALUES (?, ?, ?, ?, ?, ?)',
      [id, ws.id, name, description, color, icon]
    )

    const newProj: Project = {
      id,
      workspace_id: ws.id,
      name,
      description,
      color,
      icon,
      created_at: new Date().toISOString()
    }

    set((state) => ({ projects: [newProj, ...state.projects] }))
    return newProj
  },

  selectProject: (project) => {
    set({ currentProject: project })
    get().loadItems()
  },

  loadItems: async () => {
    const ws = get().currentWorkspace
    if (!ws) return

    set({ isLoading: true })
    const project = get().currentProject

    try {
      let notesQuery = 'SELECT * FROM notes WHERE project_id IS NULL ORDER BY updated_at DESC'
      let tasksQuery = 'SELECT * FROM tasks WHERE project_id IS NULL ORDER BY created_at DESC'
      let eventsQuery = 'SELECT * FROM events WHERE project_id IS NULL ORDER BY start_time ASC'
      let filesQuery = 'SELECT * FROM files WHERE project_id IS NULL ORDER BY created_at DESC'
      let params: any[] = []

      if (project) {
        notesQuery = 'SELECT * FROM notes WHERE project_id = ? ORDER BY updated_at DESC'
        tasksQuery = 'SELECT * FROM tasks WHERE project_id = ? ORDER BY created_at DESC'
        eventsQuery = 'SELECT * FROM events WHERE project_id = ? ORDER BY start_time ASC'
        filesQuery = 'SELECT * FROM files WHERE project_id = ? ORDER BY created_at DESC'
        params = [project.id]
      } else {
        // If no project selected, fetch workspace-level items or all items
        // Let's fetch all items in the workspace project list + items with NULL project
        const projectIds = get().projects.map((p) => p.id)
        if (projectIds.length > 0) {
          const placeholders = projectIds.map(() => '?').join(',')
          notesQuery = `SELECT * FROM notes WHERE project_id IN (${placeholders}) OR project_id IS NULL ORDER BY updated_at DESC`
          tasksQuery = `SELECT * FROM tasks WHERE project_id IN (${placeholders}) OR project_id IS NULL ORDER BY created_at DESC`
          eventsQuery = `SELECT * FROM events WHERE project_id IN (${placeholders}) OR project_id IS NULL ORDER BY start_time ASC`
          filesQuery = `SELECT * FROM files WHERE project_id IN (${placeholders}) OR project_id IS NULL ORDER BY created_at DESC`
          params = [...projectIds]
        }
      }

      const [notesList, tasksList, eventsList, filesList] = await Promise.all([
        window.api.db.query<Note>(notesQuery, params),
        window.api.db.query<Task>(tasksQuery, params),
        window.api.db.query<CalendarEvent>(eventsQuery, params),
        window.api.db.query<IngestedFile>(filesQuery, params)
      ])

      // Load subtasks for tasks
      for (const t of tasksList) {
        t.subtasks = await window.api.db.query<Subtask>(
          'SELECT * FROM subtasks WHERE task_id = ? ORDER BY created_at ASC',
          [t.id]
        )
      }

      set({
        notes: notesList,
        tasks: tasksList,
        events: eventsList,
        files: filesList,
        isLoading: false
      })
    } catch (error) {
      console.error('Failed to load items:', error)
      set({ isLoading: false })
    }
  },

  createNote: async (title: string, content: string, rawText: string) => {
    const project = get().currentProject
    const projectId = project ? project.id : null
    const id = crypto.randomUUID()

    await window.api.db.execute(
      'INSERT INTO notes (id, project_id, title, content, raw_text) VALUES (?, ?, ?, ?, ?)',
      [id, projectId, title, content, rawText]
    )

    const newNote: Note = {
      id,
      project_id: projectId,
      title,
      content,
      raw_text: rawText,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    set((state) => ({ notes: [newNote, ...state.notes] }))
    window.api.intelligence.indexItem(id, 'note', title, rawText).catch(console.error)
    return newNote
  },

  updateNote: async (id: string, title: string, content: string, rawText: string) => {
    const now = new Date().toISOString()
    await window.api.db.execute(
      'UPDATE notes SET title = ?, content = ?, raw_text = ?, updated_at = ? WHERE id = ?',
      [title, content, rawText, now, id]
    )
    set((state) => ({
      notes: state.notes.map((n) =>
        n.id === id ? { ...n, title, content, raw_text: rawText, updated_at: now } : n
      )
    }))
    window.api.intelligence.indexItem(id, 'note', title, rawText).catch(console.error)
  },

  deleteNote: async (id: string) => {
    await window.api.db.execute('DELETE FROM notes WHERE id = ?', [id])
    set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }))
  },

  createTask: async (
    title: string,
    description: string,
    due: string | null,
    priority: 'Low' | 'Medium' | 'High'
  ) => {
    const project = get().currentProject
    const projectId = project ? project.id : null
    const id = crypto.randomUUID()

    await window.api.db.execute(
      'INSERT INTO tasks (id, project_id, title, description, due_date, priority) VALUES (?, ?, ?, ?, ?, ?)',
      [id, projectId, title, description, due, priority]
    )

    const newTask: Task = {
      id,
      project_id: projectId,
      title,
      description,
      due_date: due,
      priority,
      status: 'Todo',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      subtasks: []
    }

    set((state) => ({ tasks: [newTask, ...state.tasks] }))
    window.api.intelligence.indexItem(id, 'task', title, description).catch(console.error)
    return newTask
  },

  updateTask: async (id: string, updates: Partial<Task>) => {
    const task = get().tasks.find((t) => t.id === id)
    if (!task) return

    const merged = { ...task, ...updates, updated_at: new Date().toISOString() }

    await window.api.db.execute(
      'UPDATE tasks SET title = ?, description = ?, due_date = ?, priority = ?, status = ?, updated_at = ? WHERE id = ?',
      [
        merged.title,
        merged.description,
        merged.due_date,
        merged.priority,
        merged.status,
        merged.updated_at,
        id
      ]
    )

    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, ...updates, updated_at: merged.updated_at } : t
      )
    }))
    window.api.intelligence
      .indexItem(id, 'task', merged.title, merged.description)
      .catch(console.error)
  },

  deleteTask: async (id: string) => {
    await window.api.db.execute('DELETE FROM tasks WHERE id = ?', [id])
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }))
  },

  createSubtask: async (taskId: string, title: string) => {
    const id = crypto.randomUUID()
    await window.api.db.execute(
      'INSERT INTO subtasks (id, task_id, title, completed) VALUES (?, ?, ?, ?)',
      [id, taskId, title, 0]
    )
    const newSub: Subtask = {
      id,
      task_id: taskId,
      title,
      completed: 0,
      created_at: new Date().toISOString()
    }
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.id === taskId) {
          return { ...t, subtasks: [...(t.subtasks || []), newSub] }
        }
        return t
      })
    }))
    return newSub
  },

  toggleSubtask: async (subtaskId: string, completed: boolean) => {
    const val = completed ? 1 : 0
    await window.api.db.execute('UPDATE subtasks SET completed = ? WHERE id = ?', [val, subtaskId])
    set((state) => ({
      tasks: state.tasks.map((t) => {
        if (t.subtasks) {
          return {
            ...t,
            subtasks: t.subtasks.map((s) => (s.id === subtaskId ? { ...s, completed: val } : s))
          }
        }
        return t
      })
    }))
  },

  createEvent: async (
    title: string,
    description: string,
    startTime: string,
    endTime: string,
    location: string
  ) => {
    const project = get().currentProject
    const projectId = project ? project.id : null
    const id = crypto.randomUUID()

    await window.api.db.execute(
      'INSERT INTO events (id, project_id, title, description, start_time, end_time, location) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, projectId, title, description, startTime, endTime, location]
    )

    const newEv: CalendarEvent = {
      id,
      project_id: projectId,
      title,
      description,
      start_time: startTime,
      end_time: endTime,
      location,
      created_at: new Date().toISOString()
    }

    set((state) => ({
      events: [...state.events, newEv].sort((a, b) => a.start_time.localeCompare(b.start_time))
    }))
    return newEv
  },

  deleteEvent: async (id: string) => {
    await window.api.db.execute('DELETE FROM events WHERE id = ?', [id])
    set((state) => ({ events: state.events.filter((e) => e.id !== id) }))
  },

  loadTags: async () => {
    try {
      const list = await window.api.db.query<Tag>('SELECT * FROM tags')
      set({ tags: list })
    } catch (e) {
      console.error(e)
    }
  },

  createTag: async (name: string, color: string) => {
    const id = crypto.randomUUID()
    await window.api.db.execute('INSERT OR IGNORE INTO tags (id, name, color) VALUES (?, ?, ?)', [
      id,
      name,
      color
    ])
    const tag = { id, name, color }
    set((state) => ({ tags: [...state.tags, tag] }))
    return tag
  },

  addTagToItem: async (tagId: string, itemId: string, itemType: string) => {
    await window.api.db.execute(
      'INSERT OR IGNORE INTO item_tags (tag_id, item_id, item_type) VALUES (?, ?, ?)',
      [tagId, itemId, itemType]
    )
  },

  removeTagFromItem: async (tagId: string, itemId: string) => {
    await window.api.db.execute('DELETE FROM item_tags WHERE tag_id = ? AND item_id = ?', [
      tagId,
      itemId
    ])
  }
}))
