import { autoUpdater, UpdateInfo } from 'electron-updater'
import { BrowserWindow } from 'electron'
import { getState } from './dictation'

/**
 * Broadcast a message to all open renderer windows (settings + overlay).
 * Keeps the updater decoupled from any specific window lifecycle.
 */
function broadcast(channel: string, payload: unknown): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed() || win.webContents.isDestroyed()) continue
    try {
      win.webContents.send(channel, payload)
    } catch { /* ignore */ }
  }
}

let lastDownloadedVersion: string | null = null
let autoInstallTimer: ReturnType<typeof setTimeout> | null = null

/**
 * Once an update is downloaded we want it applied as quickly as possible
 * without interrupting active dictation. Strategy:
 *   1. Immediately broadcast the event so the UI can show a "relaunch" banner.
 *   2. Poll the dictation state machine; as soon as it's idle for 2 minutes
 *      straight, quit-and-install. This gives users enough time to finish
 *      what they're doing but doesn't require them to notice the banner.
 *   3. electron-updater's built-in `autoInstallOnAppQuit` also applies the
 *      update on any manual quit — belt and braces.
 */
function scheduleAutoInstall(): void {
  if (autoInstallTimer) return // already scheduled

  const IDLE_THRESHOLD_MS = 2 * 60 * 1000
  let idleSince = Date.now()

  const tick = () => {
    const state = getState()
    const isBusy = state !== 'idle' && state !== 'error'
    if (isBusy) {
      idleSince = Date.now() // reset idle clock
      autoInstallTimer = setTimeout(tick, 10_000)
      return
    }
    if (Date.now() - idleSince >= IDLE_THRESHOLD_MS) {
      try {
        autoUpdater.quitAndInstall(false, true) // silent, forceRunAfter
      } catch (err) {
        console.error('[updater] quitAndInstall failed:', err)
      }
      return
    }
    autoInstallTimer = setTimeout(tick, 10_000)
  }

  autoInstallTimer = setTimeout(tick, 10_000)
}

export function initAutoUpdater(_window: BrowserWindow): void {
  // Auto-download: users shouldn't have to click through a confirmation
  // dialog every time there's a patch release. We still expose the progress
  // via broadcast events so the UI can reflect it.
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.allowDowngrade = false

  autoUpdater.on('checking-for-update', () => {
    console.log('[updater] checking for updates')
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    console.log('[updater] update available:', info.version)
    broadcast('update:available', { version: info.version })
  })

  autoUpdater.on('update-not-available', () => {
    console.log('[updater] no updates available')
  })

  autoUpdater.on('download-progress', (p) => {
    broadcast('update:progress', { percent: Math.round(p.percent || 0) })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    console.log('[updater] downloaded:', info.version)
    lastDownloadedVersion = info.version
    broadcast('update:downloaded', { version: info.version })
    scheduleAutoInstall()
  })

  autoUpdater.on('error', (err) => {
    console.error('[updater] error:', err?.message || err)
    broadcast('update:error', { message: err?.message || String(err) })
  })
}

export function checkForUpdates(): void {
  try {
    autoUpdater.checkForUpdates()
  } catch (err) {
    console.error('[updater] Failed to check for updates:', err)
  }
}

/**
 * Force-install the downloaded update now. Called by the renderer when the
 * user clicks "Relaunch" in the update banner.
 */
export function installDownloadedUpdate(): boolean {
  if (!lastDownloadedVersion) return false
  try {
    // isSilent=false so electron-updater uses its standard relaunch UX,
    // forceRunAfter=true so we come back up immediately after the install.
    autoUpdater.quitAndInstall(false, true)
    return true
  } catch (err) {
    console.error('[updater] manual install failed:', err)
    return false
  }
}

export function getDownloadedUpdateVersion(): string | null {
  return lastDownloadedVersion
}
