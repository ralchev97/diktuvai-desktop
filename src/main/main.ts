import { app, BrowserWindow, globalShortcut, shell, screen, session } from 'electron'
import { platform } from 'os'

// Prevent EPIPE crashes in dev mode
process.stdout?.on?.('error', () => {})
process.stderr?.on?.('error', () => {})

// Global crash handlers — log and recover instead of silent death
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err)
})
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason)
})
import { join } from 'path'

const isMac = platform() === 'darwin'
const isWin = platform() === 'win32'
import { initDatabase, closeDatabase, getUsageStats } from './db'
import { getSettings, getSetting, setSetting, migrateSecretsToEncrypted } from './store'
import { createTray, destroyTray, updateTrayMenu, updateTrayIcon } from './tray'
import { registerShortcuts, unregisterAll } from './shortcuts'
import {
  initDictation, setOverlayWindow,
  startDictationSession, stopDictationSession, cancelDictationSession,
  undoDictation, startCommandMode, stopCommandMode, getState
} from './dictation'
import { warmHelper } from './paste'
import { isWordLimitReached, getLicenseStatus } from './license'
import { registerIpcHandlers } from './ipc'
import { initAutoUpdater, checkForUpdates } from './updater'
import { cleanupTempFiles } from './audio'

let settingsWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let isDictating = false
let isCommandMode = false
let statsIntervalId: ReturnType<typeof setInterval> | null = null
let limitOverlayTimeoutId: ReturnType<typeof setTimeout> | null = null

/**
 * Shared helper for the word-limit overlay. Tracking the timeout lets a
 * second hotkey press within the 5 s window reset the countdown instead of
 * racing two independent timers that can cause the overlay to flicker or
 * disappear early.
 */
// Vertical gap between the pill and the dock (just enough breathing room)
const PILL_DOCK_GAP = 8

/**
 * Calculate overlay bounds so the pill sits PILL_DOCK_GAP px above the dock,
 * using the work area (which already excludes the dock + menu bar).
 */
function overlayBounds(width: number, height: number) {
  const { workArea } = screen.getPrimaryDisplay()
  return {
    width,
    height,
    x: Math.round(workArea.x + workArea.width / 2 - width / 2),
    y: workArea.y + workArea.height - height - PILL_DOCK_GAP
  }
}

function showLimitOverlay(expanded: boolean): void {
  if (!overlayWindow || overlayWindow.isDestroyed()) return

  if (expanded) {
    overlayWindow.setBounds(overlayBounds(240, 80))
  }
  overlayWindow.setIgnoreMouseEvents(false)
  overlayWindow.webContents.send('dictation:state', 'limit')
  overlayWindow.showInactive()

  if (limitOverlayTimeoutId) clearTimeout(limitOverlayTimeoutId)
  limitOverlayTimeoutId = setTimeout(() => {
    limitOverlayTimeoutId = null
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.setBounds(overlayBounds(140, 44))
      overlayWindow.setIgnoreMouseEvents(true, { forward: true })
      overlayWindow.hide()
      overlayWindow.webContents.send('dictation:state', 'idle')
    }
  }, 5000)
}

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
      sandbox: true
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

  // Open devtools in dev to debug (never in packaged builds — DevTools bypasses contextIsolation)
  if (process.env.ELECTRON_RENDERER_URL && !app.isPackaged) {
    settingsWindow.webContents.openDevTools({ mode: 'detach' })
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

  let isQuitting = false
  app.on('before-quit', () => { isQuitting = true })

  settingsWindow.on('close', (e) => {
    if (isQuitting) return // Allow quit from Dock/Cmd+Q
    e.preventDefault()
    settingsWindow?.hide()
  })

  return settingsWindow
}

function createOverlayWindow(): BrowserWindow {
  const bounds = overlayBounds(140, 44)
  overlayWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    resizable: false,
    focusable: false,
    roundedCorners: false,
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  overlayWindow.setIgnoreMouseEvents(true, { forward: true })
  overlayWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  // Use 'screen-saver' level to ensure overlay is above all other windows
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')

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
        // Check word limit before recording
        if (isWordLimitReached()) {
          showLimitOverlay(true)
          if (settingsWindow && !settingsWindow.isDestroyed()) {
            settingsWindow.webContents.send('dictation:state', 'limit')
          }
          return
        }
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
        if (isWordLimitReached()) {
          showLimitOverlay(false)
          return
        }
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
  // Apply Content Security Policy via HTTP headers. In packaged builds we
  // restrict scripts to self only; in dev we leave it open so Vite's HMR
  // (which relies on inline scripts + eval) continues to work.
  if (app.isPackaged) {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
              "script-src 'self'; " +
              "style-src 'self' 'unsafe-inline'; " +
              "img-src 'self' data: blob:; " +
              "font-src 'self' data:; " +
              "connect-src 'self' https://diktuvai.bg https://api.openai.com https://api.groq.com; " +
              "object-src 'none'; " +
              "base-uri 'self'; " +
              "frame-ancestors 'none';",
          ],
        },
      })
    })
  }

  // Don't show in dock if setting is enabled (macOS only)
  if (isMac && getSetting('hideFromDock')) {
    app.dock?.hide()
  }

  // Upgrade any legacy plaintext secrets (apiKey, authToken) to OS-keychain-encrypted form.
  // Idempotent — only touches entries that aren't already encrypted.
  migrateSecretsToEncrypted()

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

  // Pre-compile the native paste helper in the background so the first
  // dictation doesn't pay the one-time swiftc cost.
  warmHelper()

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

  // Show settings window on first launch (onboarding) or always in dev mode
  if (!getSetting('onboardingComplete') || !app.isPackaged) {
    settingsWindow?.show()
    settingsWindow?.focus()
    if (isMac && !getSetting('hideFromDock')) app.dock?.show()
  }

  // Check for updates after a delay (only in production).
  // electron-updater will auto-download and emit `update:downloaded` to the
  // renderer; see main/updater.ts for the idle-detection auto-install loop.
  if (app.isPackaged) {
    setTimeout(() => checkForUpdates(), 5000)
    // Re-check every 4 hours so long-running sessions don't miss patches.
    setInterval(() => checkForUpdates(), 4 * 60 * 60 * 1000)
  }

  // Send stats periodically (only if window exists and is not destroyed).
  // Kept in a module-level ref so we can clear it on shutdown — an orphan
  // interval keeps the event loop alive and defeats the graceful exit below.
  statsIntervalId = setInterval(() => {
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
  if (statsIntervalId) { clearInterval(statsIntervalId); statsIntervalId = null }
  if (limitOverlayTimeoutId) { clearTimeout(limitOverlayTimeoutId); limitOverlayTimeoutId = null }
  unregisterAll()
  closeDatabase()
  cleanupTempFiles()
  // uiohook-napi keeps a native thread alive that prevents clean exit.
  // Force exit after cleanup to avoid the app hanging.
  // 1500ms is a margin for slow systems; 500ms was occasionally too short.
  setTimeout(() => process.exit(0), 1500)
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
