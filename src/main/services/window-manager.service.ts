import { BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

const secondaryWindows = new Map<number, BrowserWindow>()

/**
 * Creates an auxiliary secondary window for user experience features.
 * @param route The renderer router path (e.g. 'drafts', 'history')
 * @returns The window ID
 */
export function createSecondaryWindow(route: string): number {
  const secondaryWindow = new BrowserWindow({
    width: 900,
    height: 650,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  const windowId = secondaryWindow.id
  secondaryWindows.set(windowId, secondaryWindow)

  secondaryWindow.on('ready-to-show', () => {
    secondaryWindow.show()
  })

  secondaryWindow.on('closed', () => {
    secondaryWindows.delete(windowId)
  })

  // Target index.html with hashed route
  const hashRoute = route.startsWith('/') ? route : `/${route}`

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    secondaryWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${hashRoute}`)
  } else {
    secondaryWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: hashRoute })
  }

  return windowId
}

/**
 * Closes a secondary window by its ID.
 * @param windowId The window ID
 */
export function closeSecondaryWindow(windowId: number): boolean {
  const win = secondaryWindows.get(windowId)
  if (win) {
    win.close()
    return true
  }
  return false
}
