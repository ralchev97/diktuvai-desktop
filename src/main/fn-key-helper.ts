/**
 * Fn (Globe) key detection via a native Node addon.
 *
 * The Fn key is invisible to uiohook-napi and Electron's globalShortcut.
 * We use a native N-API addon (Objective-C++) that registers an
 * NSEvent.addGlobalMonitorForEvents inside the Electron process,
 * which already has Input Monitoring permission.
 *
 * The addon detects .flagsChanged events with .function modifier flag.
 */

import path from 'path'
import { app } from 'electron'

type FnKeyHandler = (down: boolean) => void

let handler: FnKeyHandler | null = null
let running = false
let fnKeyModule: any = null

function loadAddon(): any {
  if (fnKeyModule) return fnKeyModule
  // Try multiple paths: dev mode, prod mode
  const paths = [
    // Dev: project root / native/fn-key/build/Release/fn_key.node
    path.join(app.getAppPath(), 'native/fn-key/build/Release/fn_key.node'),
    // Also try __dirname based (dist/main -> ../../native)
    path.join(__dirname, '../../native/fn-key/build/Release/fn_key.node'),
    // Prod: resources/fn_key.node
    path.join(process.resourcesPath || '', 'fn_key.node'),
  ]

  for (const p of paths) {
    try {
      fnKeyModule = require(p)
      console.log('[fn-key-helper] Loaded from:', p)
      return fnKeyModule
    } catch { /* try next */ }
  }

  console.error('[fn-key-helper] Failed to load native addon from any path:', paths)
  return null
}

/**
 * Start the Fn key helper.
 * Calls handler(true) on Fn press, handler(false) on Fn release.
 */
export function startFnKeyHelper(onFnKey: FnKeyHandler): void {
  if (process.platform !== 'darwin') return // macOS only
  if (running) return // already running

  handler = onFnKey

  const addon = loadAddon()
  if (!addon) {
    console.error('[fn-key-helper] Native addon not available')
    return
  }

  const started = addon.start((down: boolean) => {
    handler?.(down)
  })

  if (started) {
    running = true
    console.log('[fn-key-helper] Started (native addon)')
  } else {
    console.warn('[fn-key-helper] Already running or failed to start')
  }
}

/**
 * Stop the Fn key helper.
 */
export function stopFnKeyHelper(): void {
  if (!running) return

  const addon = loadAddon()
  if (addon) {
    addon.stop()
  }

  running = false
  handler = null
  console.log('[fn-key-helper] Stopped')
}

/**
 * Check if the Fn key helper is running.
 */
export function isFnKeyHelperRunning(): boolean {
  return running
}
