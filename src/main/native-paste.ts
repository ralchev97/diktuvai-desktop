/**
 * In-process native paste via CGEventPost (macOS only).
 *
 * Wraps the `paste()` N-API method exposed by `native/fn-key/fn_key.mm`.
 * Lives in the same native addon as the Fn key detector because both run
 * CGEvent code inside the Electron main process (which already has the
 * Accessibility TCC grant the user authorized on first launch).
 *
 * This is the "fast path" — ~3–8 ms versus ~90–1100 ms for the osascript
 * fallback. The JS caller should always fall back to osascript if
 * `nativePaste()` returns false, never throw — that way paste always
 * succeeds even if the native addon is somehow missing or broken on a
 * specific machine (macOS update, TCC reset, permissions wiped, etc.).
 */

import path from 'path'
import { app } from 'electron'

let cachedModule: any = null
let loadAttempted = false

function loadAddon(): any {
  if (cachedModule) return cachedModule
  if (loadAttempted) return null // don't spam require() failures every paste
  loadAttempted = true

  // Same path resolution fn-key-helper uses — duplicated rather than shared
  // to keep the two modules independent. If one refactors its loader the
  // other keeps working.
  const paths = [
    path.join(app.getAppPath(), 'native/fn-key/build/Release/fn_key.node'),
    path.join(__dirname, '../../native/fn-key/build/Release/fn_key.node'),
    path.join(process.resourcesPath || '', 'fn_key.node'),
  ]

  for (const p of paths) {
    try {
      cachedModule = require(p)
      return cachedModule
    } catch {
      /* try next */
    }
  }
  return null
}

/**
 * Post Cmd+V via CGEventPost. Returns true on success, false if the native
 * addon isn't loaded or the CGEvent call failed. Callers MUST treat false
 * as "fall back to osascript" and keep working — never throw on false.
 */
export function nativePaste(): boolean {
  if (process.platform !== 'darwin') return false
  const addon = loadAddon()
  if (!addon || typeof addon.paste !== 'function') return false
  try {
    return addon.paste() === true
  } catch {
    return false
  }
}
