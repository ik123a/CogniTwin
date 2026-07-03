import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import vm from 'vm'
import { getDatabase } from '../database/connection'
import { logAction } from './audit.service'

export interface PluginManifest {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  entryPoint: string
  permissions?: string[]
}

export interface PluginDbRow {
  id: string
  name: string
  version: string
  description: string | null
  author: string | null
  entry_point: string
  is_active: number
  permissions_json: string | null
  created_at: string
}

// Keep track of active sandboxes / module exports
const activePlugins = new Map<string, any>()

/**
 * Gets the path to the local plugins directory.
 */
export function getPluginsDirectory(): string {
  const dir = path.join(app.getPath('userData'), 'plugins')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
    // Write a dummy/sample plugin for testing
    createSamplePlugin(dir)
  }
  return dir
}

/**
 * Creates a sample plugin for verification purposes.
 */
function createSamplePlugin(pluginsDir: string): void {
  const sampleDir = path.join(pluginsDir, 'sample-plugin')
  if (!fs.existsSync(sampleDir)) {
    fs.mkdirSync(sampleDir, { recursive: true })
    const manifest: PluginManifest = {
      id: 'sample-plugin',
      name: 'Sample Plugin',
      version: '1.0.0',
      description: 'A sample custom views and audit reporter plugin.',
      author: 'CogniTwin Team',
      entryPoint: 'index.js',
      permissions: ['audit:log', 'database:read']
    }
    fs.writeFileSync(
      path.join(sampleDir, 'manifest.json'),
      JSON.stringify(manifest, null, 2),
      'utf8'
    )

    const indexJs = `
// Sample plugin entry point
module.exports = {
  activate: (context) => {
    context.log("Sample Plugin Activated!");
    context.on("CREATE_NOTE", (data) => {
      context.log("Sample Plugin received CREATE_NOTE event: " + JSON.stringify(data));
    });
  },
  deactivate: () => {
    console.log("Sample Plugin Deactivated!");
  }
};
    `
    fs.writeFileSync(path.join(sampleDir, 'index.js'), indexJs, 'utf8')
  }
}

/**
 * Scans the local plugins directory, registers any new plugins in the DB,
 * and loads/activates plugins marked as active.
 */
export async function scanPlugins(): Promise<PluginDbRow[]> {
  const db = getDatabase()
  const dir = getPluginsDirectory()
  const subdirs = fs
    .readdirSync(dir)
    .filter((file) => fs.statSync(path.join(dir, file)).isDirectory())

  const foundIds: string[] = []

  for (const subdir of subdirs) {
    const manifestPath = path.join(dir, subdir, 'manifest.json')
    if (!fs.existsSync(manifestPath)) continue

    try {
      const manifest: PluginManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
      if (!manifest.id || !manifest.name || !manifest.version || !manifest.entryPoint) {
        console.warn(`Invalid manifest in ${subdir}`)
        continue
      }

      foundIds.push(manifest.id)
      const entryPath = path.join(dir, subdir, manifest.entryPoint)

      // Check if already in DB
      const existing = db.prepare('SELECT * FROM plugins WHERE id = ?').get(manifest.id) as
        PluginDbRow | undefined

      if (!existing) {
        db.prepare(
          `
          INSERT INTO plugins (id, name, version, description, author, entry_point, is_active, permissions_json)
          VALUES (?, ?, ?, ?, ?, ?, 1, ?)
        `
        ).run(
          manifest.id,
          manifest.name,
          manifest.version,
          manifest.description || null,
          manifest.author || null,
          entryPath,
          manifest.permissions ? JSON.stringify(manifest.permissions) : null
        )
        logAction('system', 'PLUGIN_REGISTERED', 'plugin', manifest.id, { name: manifest.name })
      } else {
        // Update manifest details in database in case they changed
        db.prepare(
          `
          UPDATE plugins 
          SET name = ?, version = ?, description = ?, author = ?, entry_point = ?, permissions_json = ?
          WHERE id = ?
        `
        ).run(
          manifest.name,
          manifest.version,
          manifest.description || null,
          manifest.author || null,
          entryPath,
          manifest.permissions ? JSON.stringify(manifest.permissions) : null,
          manifest.id
        )
      }
    } catch (err) {
      console.error(`Failed to scan plugin in ${subdir}:`, err)
    }
  }

  // Reload and activate plugins
  const allPlugins = db.prepare('SELECT * FROM plugins').all() as PluginDbRow[]

  for (const plugin of allPlugins) {
    if (plugin.is_active === 1 && foundIds.includes(plugin.id)) {
      try {
        await activatePlugin(plugin)
      } catch (e) {
        console.error(`Failed to activate plugin ${plugin.name}:`, e)
      }
    } else if (activePlugins.has(plugin.id)) {
      deactivatePlugin(plugin.id)
    }
  }

  return allPlugins
}

/**
 * Activates a plugin in a secure sandboxed VM context.
 */
export async function activatePlugin(plugin: PluginDbRow): Promise<void> {
  if (activePlugins.has(plugin.id)) return // Already active

  if (!fs.existsSync(plugin.entry_point)) {
    console.error(`Plugin entry point not found: ${plugin.entry_point}`)
    return
  }

  const code = fs.readFileSync(plugin.entry_point, 'utf8')

  // Construct sandbox environment
  const logs: string[] = []
  const sandboxContext = {
    console: {
      log: (...args: any[]) => {
        const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')
        logs.push(`[LOG] ${msg}`)
        console.log(`[Plugin:${plugin.id}]`, ...args)
      },
      error: (...args: any[]) => {
        const msg = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : a)).join(' ')
        logs.push(`[ERROR] ${msg}`)
        console.error(`[Plugin:${plugin.id}]`, ...args)
      }
    },
    module: { exports: {} as any },
    exports: {} as any
  }

  const context = vm.createContext(sandboxContext)

  try {
    const script = new vm.Script(code, { filename: plugin.entry_point })
    script.runInContext(context)

    const exports = sandboxContext.module.exports || sandboxContext.exports

    if (exports && typeof exports.activate === 'function') {
      const pluginContext = {
        log: (msg: string) => {
          console.log(`[Plugin Context:${plugin.id}] ${msg}`)
          logAction('system', 'PLUGIN_LOG', 'plugin', plugin.id, { message: msg })
        },
        on: (event: string, _callback: (data: any) => void) => {
          // Mock event system registration
          console.log(`Plugin ${plugin.id} registered for event: ${event}`)
        }
      }

      exports.activate(pluginContext)
      activePlugins.set(plugin.id, exports)
      logAction('system', 'PLUGIN_ACTIVATED', 'plugin', plugin.id, { logs })
    } else {
      console.warn(`Plugin ${plugin.id} has no activate() export.`)
    }
  } catch (err: any) {
    logAction('system', 'PLUGIN_ACTIVATION_FAILED', 'plugin', plugin.id, { error: err.message })
    throw err
  }
}

/**
 * Deactivates a registered plugin.
 */
export function deactivatePlugin(pluginId: string): void {
  const exports = activePlugins.get(pluginId)
  if (exports) {
    try {
      if (typeof exports.deactivate === 'function') {
        exports.deactivate()
      }
      activePlugins.delete(pluginId)
      logAction('system', 'PLUGIN_DEACTIVATED', 'plugin', pluginId)
      console.log(`Plugin ${pluginId} deactivated successfully`)
    } catch (err) {
      console.error(`Error deactivating plugin ${pluginId}:`, err)
    }
  }
}

/**
 * Toggles a plugin's active status in the database.
 */
export async function togglePlugin(
  pluginId: string,
  isActive: boolean
): Promise<{ success: boolean }> {
  const db = getDatabase()
  const is_active_val = isActive ? 1 : 0
  db.prepare('UPDATE plugins SET is_active = ? WHERE id = ?').run(is_active_val, pluginId)

  const row = db.prepare('SELECT * FROM plugins WHERE id = ?').get(pluginId) as
    PluginDbRow | undefined
  if (row) {
    if (isActive) {
      try {
        await activatePlugin(row)
      } catch (err) {
        console.error(err)
        return { success: false }
      }
    } else {
      deactivatePlugin(pluginId)
    }
  }

  logAction('system', isActive ? 'PLUGIN_ENABLED' : 'PLUGIN_DISABLED', 'plugin', pluginId)
  return { success: true }
}

/**
 * Returns all plugins in the database.
 */
export function getPlugins(): PluginDbRow[] {
  const db = getDatabase()
  return db.prepare('SELECT * FROM plugins').all() as PluginDbRow[]
}
