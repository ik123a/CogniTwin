import { create } from 'zustand'

export interface ExpertiseDomain {
  id: string
  name: string
  score: number // 0 to 100 representing expertise level
  activity_count: number // e.g. number of related items
  last_active: string | null
  color: string
  created_at?: string
}

export interface ExpertiseAnalogy {
  id: string
  source_domain_id: string
  target_domain_id: string
  analogy_title: string
  description: string
  confidence: number // 0 to 100
  created_at?: string
  source_domain_name?: string
  target_domain_name?: string
}

interface ExpertiseState {
  domains: ExpertiseDomain[]
  analogies: ExpertiseAnalogy[]
  isLoading: boolean

  initDatabase: () => Promise<void>
  loadDomains: () => Promise<void>
  loadAnalogies: () => Promise<void>
  createDomain: (
    name: string,
    score: number,
    activityCount: number,
    color: string
  ) => Promise<ExpertiseDomain>
  updateDomain: (id: string, updates: Partial<ExpertiseDomain>) => Promise<void>
  deleteDomain: (id: string) => Promise<void>
  createAnalogy: (
    sourceDomainId: string,
    targetDomainId: string,
    title: string,
    description: string,
    confidence: number
  ) => Promise<ExpertiseAnalogy>
  deleteAnalogy: (id: string) => Promise<void>
}

export const useExpertiseStore = create<ExpertiseState>((set, get) => ({
  domains: [],
  analogies: [],
  isLoading: false,

  initDatabase: async () => {
    try {
      // 1. Create table for expertise domains
      await window.api.db.execute(`
        CREATE TABLE IF NOT EXISTS expertise_domains (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          score INTEGER DEFAULT 0,
          activity_count INTEGER DEFAULT 0,
          last_active TEXT,
          color TEXT DEFAULT '#3498db',
          created_at TEXT DEFAULT (datetime('now'))
        );
      `)

      // 2. Create table for cross-domain analogies
      await window.api.db.execute(`
        CREATE TABLE IF NOT EXISTS expertise_analogies (
          id TEXT PRIMARY KEY,
          source_domain_id TEXT NOT NULL,
          target_domain_id TEXT NOT NULL,
          analogy_title TEXT NOT NULL,
          description TEXT NOT NULL,
          confidence INTEGER DEFAULT 50,
          created_at TEXT DEFAULT (datetime('now')),
          FOREIGN KEY (source_domain_id) REFERENCES expertise_domains(id) ON DELETE CASCADE,
          FOREIGN KEY (target_domain_id) REFERENCES expertise_domains(id) ON DELETE CASCADE
        );
      `)

      // 3. Seed default domains if empty
      const existingDomains = await window.api.db.query<ExpertiseDomain>(
        'SELECT * FROM expertise_domains'
      )
      if (existingDomains.length === 0) {
        const defaultDomains = [
          {
            id: 'se',
            name: 'Software Engineering',
            score: 90,
            activity_count: 45,
            last_active: new Date().toISOString(),
            color: '#3b82f6'
          },
          {
            id: 'ai',
            name: 'Artificial Intelligence',
            score: 85,
            activity_count: 38,
            last_active: new Date().toISOString(),
            color: '#a855f7'
          },
          {
            id: 'cog',
            name: 'Cognitive Science',
            score: 70,
            activity_count: 22,
            last_active: new Date().toISOString(),
            color: '#ec4899'
          },
          {
            id: 'thermo',
            name: 'Thermodynamics',
            score: 55,
            activity_count: 12,
            last_active: new Date().toISOString(),
            color: '#f59e0b'
          },
          {
            id: 'fin',
            name: 'Finance & Markets',
            score: 65,
            activity_count: 18,
            last_active: new Date().toISOString(),
            color: '#10b981'
          },
          {
            id: 'sys',
            name: 'System Architecture',
            score: 80,
            activity_count: 29,
            last_active: new Date().toISOString(),
            color: '#6366f1'
          }
        ]

        for (const dom of defaultDomains) {
          await window.api.db.execute(
            'INSERT INTO expertise_domains (id, name, score, activity_count, last_active, color) VALUES (?, ?, ?, ?, ?, ?)',
            [dom.id, dom.name, dom.score, dom.activity_count, dom.last_active, dom.color]
          )
        }

        const defaultAnalogies = [
          {
            id: 'ana1',
            source_domain_id: 'ai',
            target_domain_id: 'cog',
            analogy_title: 'Neural Networks & Synaptic Plasticity',
            description:
              'Both artificial neural networks and biological brains adjust connection strengths (weights/synapse weights) based on feedback/experience to optimize representations.',
            confidence: 88
          },
          {
            id: 'ana2',
            source_domain_id: 'thermo',
            target_domain_id: 'fin',
            analogy_title: 'Entropy & Information Dissemination',
            description:
              'Market price diffusion behaves similarly to molecular Brownian motion. Thermodynamic entropy maps to financial market efficiency and uncertainty reduction.',
            confidence: 72
          },
          {
            id: 'ana3',
            source_domain_id: 'se',
            target_domain_id: 'cog',
            analogy_title: 'Microservices & Biological Organelles',
            description:
              'Software microservices isolate tasks within strict boundaries and communicate via standardized APIs, resembling how biological organelles execute cell actions independently.',
            confidence: 78
          }
        ]

        for (const ana of defaultAnalogies) {
          await window.api.db.execute(
            'INSERT INTO expertise_analogies (id, source_domain_id, target_domain_id, analogy_title, description, confidence) VALUES (?, ?, ?, ?, ?, ?)',
            [
              ana.id,
              ana.source_domain_id,
              ana.target_domain_id,
              ana.analogy_title,
              ana.description,
              ana.confidence
            ]
          )
        }
      }
    } catch (error) {
      console.error('Failed to initialize expertise database:', error)
    }
  },

  loadDomains: async () => {
    set({ isLoading: true })
    try {
      await get().initDatabase()
      const list = await window.api.db.query<ExpertiseDomain>(
        'SELECT * FROM expertise_domains ORDER BY score DESC'
      )
      set({ domains: list })
    } catch (error) {
      console.error('Failed to load expertise domains:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  loadAnalogies: async () => {
    set({ isLoading: true })
    try {
      await get().initDatabase()
      const list = await window.api.db.query<ExpertiseAnalogy>(`
        SELECT a.*, d1.name as source_domain_name, d2.name as target_domain_name
        FROM expertise_analogies a
        JOIN expertise_domains d1 ON a.source_domain_id = d1.id
        JOIN expertise_domains d2 ON a.target_domain_id = d2.id
        ORDER BY a.confidence DESC
      `)
      set({ analogies: list })
    } catch (error) {
      console.error('Failed to load cross-domain analogies:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  createDomain: async (name, score, activityCount, color) => {
    await get().initDatabase()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    await window.api.db.execute(
      'INSERT INTO expertise_domains (id, name, score, activity_count, last_active, color) VALUES (?, ?, ?, ?, ?, ?)',
      [id, name, score, activityCount, now, color]
    )
    const newDom: ExpertiseDomain = {
      id,
      name,
      score,
      activity_count: activityCount,
      last_active: now,
      color,
      created_at: now
    }
    set((state) => ({ domains: [...state.domains, newDom].sort((a, b) => b.score - a.score) }))
    return newDom
  },

  updateDomain: async (id, updates) => {
    await get().initDatabase()
    const current = get().domains.find((d) => d.id === id)
    if (!current) return
    const merged = { ...current, ...updates }

    await window.api.db.execute(
      'UPDATE expertise_domains SET name = ?, score = ?, activity_count = ?, last_active = ?, color = ? WHERE id = ?',
      [merged.name, merged.score, merged.activity_count, merged.last_active, merged.color, id]
    )

    set((state) => ({
      domains: state.domains
        .map((d) => (d.id === id ? merged : d))
        .sort((a, b) => b.score - a.score)
    }))
  },

  deleteDomain: async (id) => {
    await window.api.db.execute('DELETE FROM expertise_domains WHERE id = ?', [id])
    set((state) => ({
      domains: state.domains.filter((d) => d.id !== id),
      analogies: state.analogies.filter(
        (a) => a.source_domain_id !== id && a.target_domain_id !== id
      )
    }))
  },

  createAnalogy: async (sourceDomainId, targetDomainId, title, description, confidence) => {
    await get().initDatabase()
    const id = crypto.randomUUID()
    await window.api.db.execute(
      'INSERT INTO expertise_analogies (id, source_domain_id, target_domain_id, analogy_title, description, confidence) VALUES (?, ?, ?, ?, ?, ?)',
      [id, sourceDomainId, targetDomainId, title, description, confidence]
    )

    // Fetch newly created analogy with populated names
    const results = await window.api.db.query<ExpertiseAnalogy>(
      `
      SELECT a.*, d1.name as source_domain_name, d2.name as target_domain_name
      FROM expertise_analogies a
      JOIN expertise_domains d1 ON a.source_domain_id = d1.id
      JOIN expertise_domains d2 ON a.target_domain_id = d2.id
      WHERE a.id = ? LIMIT 1
    `,
      [id]
    )

    const newAna = results[0]
    set((state) => ({
      analogies: [...state.analogies, newAna].sort((a, b) => b.confidence - a.confidence)
    }))
    return newAna
  },

  deleteAnalogy: async (id) => {
    await window.api.db.execute('DELETE FROM expertise_analogies WHERE id = ?', [id])
    set((state) => ({ analogies: state.analogies.filter((a) => a.id !== id) }))
  }
}))
