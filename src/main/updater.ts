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
 * Once an update is downloaded we apply it as soon as the user is idle.
 * Strategy:
 *   1. Immediately broadcast the event so the UI can show a status banner
 *      ("обновено до X.Y.Z, рестартирам автоматично…").
 *   2. Poll the dictation state machine; as soon as it's idle for 20 s
 *      straight, quit-and-install. Dictation sessions almost always take
 *      under 20 s, so this won't cut anyone off mid-sentence — but it's
 *      short enough that the restart feels automatic from the user's
 *      perspective (no more "I saw the banner, I forgot about it, it
 *      still hasn't restarted" confusion).
 *   3. electron-updater's built-in `autoInstallOnAppQuit` also applies
 *      the update on any manual quit — belt and braces.
 */
function scheduleAutoInstall(): void {
  if (autoInstallTimer) return // already scheduled

  // 20 s is intentionally short. A typical dictation takes 2–8 s; even a
  // long command-mode edit rarely runs past 15 s. The state-machine gate
  // below means we'll still wait if the user is actively mid-dictation,
  // so there's no risk of killing a live session.
  const IDLE_THRESHOLD_MS = 20 * 1000
  const TICK_MS = 2_000 // check more often so we pick up the idle window fast
  let idleSince = Date.now()

  const tick = () => {
    const state = getState()
    const isBusy = state !== 'idle' && state !== 'error'
    if (isBusy) {
      idleSince = Date.now() // reset idle clock
      autoInstallTimer = setTimeout(tick, TICK_MS)
      return
    }
    if (Date.now() - idleSince >= IDLE_THRESHOLD_MS) {
      try {
        autoUpdater.quitAndInstall(true, true) // silent, forceRunAfter
      } catch (err) {
        console.error('[updater] quitAndInstall failed:', err)
      }
      return
    }
    autoInstallTimer = setTimeout(tick, TICK_MS)
  }

  autoInstallTimer = setTimeout(tick, TICK_MS)
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
    // isSilent=true: skip electron-updater's interactive installer dialog,
    // which on macOS can get stuck waiting for a user gesture that never
    // arrives and leaves the tray icon + app half-quit. Silent install
    // replaces the bundle in-place and re-launches cleanly.
    // forceRunAfter=true: bring the new version back up immediately.
    autoUpdater.quitAndInstall(true, true)
    return true
  } catch (err) {
    console.error('[updater] manual install failed:', err)
    return false
  }
}

export function getDownloadedUpdateVersion(): string | null {
  return lastDownloadedVersion
}
