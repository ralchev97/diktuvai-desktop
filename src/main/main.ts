import { app, BrowserWindow, globalShortcut, shell, screen } from 'electron'
import { platform } from 'os'

// Prevent EPIPE crashes in dev mode
process.stdout?.on?.('error', () => {})
process.stderr?.on?.('error', () => {})
import { join } from 'path'

const isMac = platform() === 'darwin'
const isWin = platform() === 'win32'
import { initDatabase, closeDatabase, getUsageStats } from './db'
import { getSettings, getSetting, setSetting } from './store'
import { createTray, destroyTray, updateTrayMenu, updateTrayIcon } from './tray'
import { registerShortcuts, unregisterAll } from './shortcuts'
import {
  initDictation, setOverlayWindow,
  startDictationSession, stopDictationSession, cancelDictationSession,
  undoDictation, startCommandMode, stopCommandMode, getState
} from './dictation'
import { registerIpcHandlers } from './ipc'
import { initAutoUpdater, checkForUpdates } from './updater'
import { cleanupTempFiles } from './audio'

let settingsWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let isDictating = false
let isCommandMode = false

// Single instance lock
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
}

app.on('second-instance', () => {
  if (settingsWindow) {
    if (settingsWindow.isMinimized()) settingsWindow.restore()
    settingsWindow.show()
    settingsWindow.focus()
  }
})

function createSettingsWindow(): BrowserWindow {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize

  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: 720,
    height: 600,
    minWidth: 600,
    minHeight: 500,
    show: false,
    title: 'DiktuvAI - Настройки',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  }

  // macOS-specific window options
  if (isMac) {
    windowOptions.titleBarStyle = 'hiddenInset'
    windowOptions.trafficLightPosition = { x: 15, y: 15 }
    // vibrancy disabled — causes blank window in dev mode
    // windowOptions.vibrancy = 'sidebar'
    windowOptions.backgroundColor = '#ffffff'
  }

  settingsWindow = new BrowserWindow(windowOptions)

  // Show window when content is ready (only if onboarding not done)
  settingsWindow.once('ready-to-show', () => {
    if (!getSetting('onboardingComplete')) {
      settingsWindow?.show()
    }
  })

  // Load renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    settingsWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    settingsWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Open devtools in dev to debug
  if (process.env.ELECTRON_RENDERER_URL) {
    // settingsWindow.webContents.openDevTools({ mode: 'detach' })
    settingsWindow.webContents.on('did-fail-load', (_e, code, desc) => {
      console.error('Failed to load renderer:', code, desc)
      // Retry after 1 second
      setTimeout(() => {
        if (settingsWindow && !settingsWindow.isDestroyed()) {
          settingsWindow.loadURL(process.env.ELECTRON_RENDERER_URL!)
        }
      }, 1000)
    })
  }

  settingsWindow.on('close', (e) => {
    // Don't quit, just hide
    e.preventDefault()
    settingsWindow?.hide()
  })

  return settingsWindow
}

function createOverlayWindow(): BrowserWindow {
  const { width: screenWidth } = screen.getPrimaryDisplay().workAreaSize

  const { height: screenHeight } = screen.getPrimaryDisplay().size
  overlayWindow = new BrowserWindow({
    width: 100,
    height: 28,
    x: Math.round(screenWidth / 2 - 50),
    y: screenHeight - 120,
    show: false,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: true,
    resizable: false,
    focusable: false,
    roundedCorners: true,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
    }
  })

  overlayWindow.setIgnoreMouseEvents(true, { forward: true })
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (process.env.ELECTRON_RENDERER_URL) {
    overlayWindow.loadURL(process.env.ELECTRON_RENDERER_URL + '#/overlay')
  } else {
    overlayWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/overlay' })
  }

  return overlayWindow
}

function setupShortcuts(): void {
  registerShortcuts({
    onHoldStart: () => {
      // Key pressed down → start recording
      if (!isDictating && !isCommandMode) {
        isDictating = true
        startDictationSession()
        updateTrayIcon(true)
      }
    },
    onHoldStop: () => {
      // Key released → stop recording & process
      if (isDictating) {
        isDictating = false
        stopDictationSession()
        updateTrayIcon(false)
      }
    },
    onCancel: () => {
      isDictating = false
      isCommandMode = false
      cancelDictationSession()
      updateTrayIcon(false)
    },
    onCommand: () => {
      if (!isDictating && !isCommandMode) {
        isCommandMode = true
        startCommandMode()
        updateTrayIcon(true)
      }
    },
    onCommandStop: () => {
      if (isCommandMode) {
        isCommandMode = false
        stopCommandMode()
        updateTrayIcon(false)
      }
    }
  })
}

app.whenReady().then(async () => {
  // Don't show in dock if setting is enabled (macOS only)
  if (isMac && getSetting('hideFromDock')) {
    app.dock?.hide()
  }

  // Initialize database
  initDatabase()

  // Register IPC handlers
  registerIpcHandlers()

  // Create windows
  const settings = createSettingsWindow()
  const overlay = createOverlayWindow()

  // Initialize dictation
  initDictation(settings, overlay)
  setOverlayWindow(overlay)

  // Create tray
  const trayCallbacks = {
    onShowSettings: () => {
      settingsWindow?.show()
      settingsWindow?.focus()
    },
    onShowHistory: () => {
      if (settingsWindow && !settingsWindow.isDestroyed()) {
        settingsWindow.show()
        settingsWindow.focus()
        if (!settingsWindow.webContents.isDestroyed()) {
          settingsWindow.webContents.send('navigate', '/history')
        }
      }
    },
    onQuit: () => {
      destroyTray()
      unregisterAll()
      closeDatabase()
      cleanupTempFiles()
      app.exit(0)
    }
  }

  createTray(settings, trayCallbacks)

  // Register shortcuts
  setupShortcuts()

  // Auto-updater
  initAutoUpdater(settings)

  // Only show settings on first launch (onboarding)
  if (!getSetting('onboardingComplete')) {
    settingsWindow?.show()
  }

  // Check for updates after a delay (only in production)
  if (app.isPackaged) {
    setTimeout(() => {
      checkForUpdates()
    }, 5000)
  }

  // Send stats periodically (only if window exists and is not destroyed)
  setInterval(() => {
    try {
      if (settingsWindow && !settingsWindow.isDestroyed() && settingsWindow.webContents && !settingsWindow.webContents.isDestroyed()) {
        const stats = getUsageStats()
        settingsWindow.webContents.send('stats:update', stats)
      }
    } catch { /* ignore */ }
  }, 30000)

  // Auto-launch at login
  const loginSettings: Electron.Settings = {
    openAtLogin: getSetting('openAtLogin')
  }
  if (isMac) {
    loginSettings.openAsHidden = true
  }
  app.setLoginItemSettings(loginSettings)
})

app.on('will-quit', () => {
  unregisterAll()
  closeDatabase()
  cleanupTempFiles()
})

app.on('window-all-closed', () => {
  // Don't quit — keep running in tray on all platforms
})

app.on('activate', () => {
  // Only show settings if not currently dictating
  if (!isDictating && !isCommandMode) {
    settingsWindow?.show()
  }
})
