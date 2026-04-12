import { uIOhook, UiohookKey } from 'uiohook-napi'
import { getSetting } from './store'
import { startFnKeyHelper, stopFnKeyHelper } from './fn-key-helper'

interface HoldToTalkHandlers {
  onHoldStart: () => void   // key pressed down → start recording
  onHoldStop: () => void    // key released → stop recording & process
  onCancel: () => void      // escape → cancel
  onCommand: () => void     // command mode key down
  onCommandStop: () => void // command mode key up
}

let handlers: HoldToTalkHandlers | null = null
let isHolding = false
let isCommandHolding = false
let started = false

// Track which modifier keys are currently pressed (for combo detection)
const pressedKeys = new Set<number>()
// Track Fn key state from Swift helper
let fnKeyDown = false

// Cached parsed hotkeys — invalidated by refreshHotkeyCache()
let cachedHotkey: { keycodes: number[]; needsFn: boolean } | null = null
let cachedCommandHotkey: { keycodes: number[]; needsFn: boolean } | null = null
let cachedDismissCode: number = UiohookKey.Escape

function getHotkey() {
  if (!cachedHotkey) cachedHotkey = parseHotkey(getSetting('hotkey'))
  return cachedHotkey
}
function getCommandHotkey() {
  if (!cachedCommandHotkey) cachedCommandHotkey = parseHotkey(getSetting('commandHotkey'))
  return cachedCommandHotkey
}
function getDismissCode() { return cachedDismissCode }

export function refreshHotkeyCache(): void {
  cachedHotkey = parseHotkey(getSetting('hotkey'))
  cachedCommandHotkey = parseHotkey(getSetting('commandHotkey'))
  cachedDismissCode = KEY_MAPPING[getSetting('dismissHotkey')] || KEY_ESCAPE
}

const KEY_ESCAPE = UiohookKey.Escape // 1

/** Maps a single key name to a uiohook keycode. */
const KEY_MAPPING: Record<string, number> = {
  'RightAlt': UiohookKey.AltRight,
  'LeftAlt': UiohookKey.Alt,
  'RightOption': UiohookKey.AltRight,
  'LeftOption': UiohookKey.Alt,
  'Option': UiohookKey.AltRight,
  'RightCtrl': UiohookKey.CtrlRight,
  'LeftCtrl': UiohookKey.Ctrl,
  'Ctrl': UiohookKey.Ctrl,
  'RightShift': UiohookKey.ShiftRight,
  'LeftShift': UiohookKey.Shift,
  'Shift': UiohookKey.Shift,
  'RightCmd': UiohookKey.MetaRight,
  'LeftCmd': UiohookKey.Meta,
  'Cmd': UiohookKey.Meta,
}

/**
 * Parse a hotkey setting string into its parts.
 * Supports: "RightOption", "Fn", "Ctrl+Shift", "Fn+Shift", etc.
 * Returns { keycodes: number[], needsFn: boolean }
 */
function parseHotkey(setting: string): { keycodes: number[]; needsFn: boolean } {
  const parts = setting.split('+').map(s => s.trim())
  const keycodes: number[] = []
  let needsFn = false

  for (const part of parts) {
    if (part === 'Fn') {
      needsFn = true
    } else if (KEY_MAPPING[part]) {
      keycodes.push(KEY_MAPPING[part])
    }
  }

  return { keycodes, needsFn }
}

/**
 * Check if a hotkey combo is currently fully pressed.
 */
function isHotkeyActive(parsed: { keycodes: number[]; needsFn: boolean }): boolean {
  if (parsed.needsFn && !fnKeyDown) return false
  for (const kc of parsed.keycodes) {
    if (!pressedKeys.has(kc)) return false
  }
  return true
}

/**
 * Check if the given keycode or Fn release breaks this hotkey combo.
 * Returns true if the released key is part of the combo.
 */
function isPartOfHotkey(parsed: { keycodes: number[]; needsFn: boolean }, releasedKeycode?: number, fnReleased?: boolean): boolean {
  if (fnReleased && parsed.needsFn) return true
  if (releasedKeycode !== undefined && parsed.keycodes.includes(releasedKeycode)) return true
  return false
}

/**
 * Check if the Fn key helper should be running based on current settings.
 */
function settingsNeedFn(): boolean {
  const hotkey = getSetting('hotkey')
  const commandHotkey = getSetting('commandHotkey')
  return hotkey.includes('Fn') || commandHotkey.includes('Fn')
}

/**
 * Register hold-to-talk shortcuts using uiohook for keydown + keyup detection.
 * Supports single keys (RightOption), Fn key, and modifier combos (Ctrl+Shift).
 */
export function registerShortcuts(h: HoldToTalkHandlers): void {
  handlers = h

  if (started) {
    // Already running, just update handlers
    return
  }

  uIOhook.on('keydown', (e) => {
    pressedKeys.add(e.keycode)

    const hotkey = getHotkey()
    const commandHotkey = getCommandHotkey()

    // Dictation: hold to talk
    if (!isHolding && !isCommandHolding && isHotkeyActive(hotkey)) {
      isHolding = true
      handlers?.onHoldStart()
    }

    // Command mode
    if (!isHolding && !isCommandHolding && isHotkeyActive(commandHotkey)) {
      isCommandHolding = true
      handlers?.onCommand()
    }

    // Escape/dismiss: cancel
    const dismissCode = getDismissCode()
    if (e.keycode === dismissCode) {
      if (isHolding || isCommandHolding) {
        isHolding = false
        isCommandHolding = false
        handlers?.onCancel()
      }
    }
  })

  uIOhook.on('keyup', (e) => {
    const hotkey = getHotkey()
    const commandHotkey = getCommandHotkey()

    // Release dictation key → stop & process
    if (isHolding && isPartOfHotkey(hotkey, e.keycode)) {
      isHolding = false
      handlers?.onHoldStop()
    }

    // Release command key → stop & process command
    if (isCommandHolding && isPartOfHotkey(commandHotkey, e.keycode)) {
      isCommandHolding = false
      handlers?.onCommandStop()
    }

    pressedKeys.delete(e.keycode)
  })

  uIOhook.start()
  started = true

  // Start Fn key helper if needed
  if (settingsNeedFn()) {
    startFnKeyHelper((down) => {
      fnKeyDown = down

      if (down) {
        const hotkey = parseHotkey(getSetting('hotkey'))
        const commandHotkey = parseHotkey(getSetting('commandHotkey'))

        if (!isHolding && !isCommandHolding && isHotkeyActive(hotkey)) {
          isHolding = true
          handlers?.onHoldStart()
        }
        if (!isHolding && !isCommandHolding && isHotkeyActive(commandHotkey)) {
          isCommandHolding = true
          handlers?.onCommand()
        }
      } else {
        // Fn released
        const hotkey = parseHotkey(getSetting('hotkey'))
        const commandHotkey = parseHotkey(getSetting('commandHotkey'))

        if (isHolding && isPartOfHotkey(hotkey, undefined, true)) {
          isHolding = false
          handlers?.onHoldStop()
        }
        if (isCommandHolding && isPartOfHotkey(commandHotkey, undefined, true)) {
          isCommandHolding = false
          handlers?.onCommandStop()
        }
      }
    })
  }

  console.log(`Hold-to-talk registered: ${getSetting('hotkey')}`)
  console.log(`Command mode: ${getSetting('commandHotkey')}`)
  console.log('Press and HOLD the key to dictate, release to process.')
}

/**
 * Ensure the Fn helper is started/stopped based on current settings.
 * Call this after a hotkey setting changes.
 */
/**
 * Refresh hotkey config after settings change.
 */
export function refreshFnHelper(): void {
  refreshHotkeyCache()
  if (settingsNeedFn()) {
    if (!fnKeyDown) {
      // Re-check: helper might already be running
      startFnKeyHelper((down) => {
        fnKeyDown = down

        if (down) {
          const hotkey = parseHotkey(getSetting('hotkey'))
          const commandHotkey = parseHotkey(getSetting('commandHotkey'))

          if (!isHolding && !isCommandHolding && isHotkeyActive(hotkey)) {
            isHolding = true
            handlers?.onHoldStart()
          }
          if (!isHolding && !isCommandHolding && isHotkeyActive(commandHotkey)) {
            isCommandHolding = true
            handlers?.onCommand()
          }
        } else {
          const hotkey = parseHotkey(getSetting('hotkey'))
          const commandHotkey = parseHotkey(getSetting('commandHotkey'))

          if (isHolding && isPartOfHotkey(hotkey, undefined, true)) {
            isHolding = false
            handlers?.onHoldStop()
          }
          if (isCommandHolding && isPartOfHotkey(commandHotkey, undefined, true)) {
            isCommandHolding = false
            handlers?.onCommandStop()
          }
        }
      })
    }
  } else {
    stopFnKeyHelper()
    fnKeyDown = false
  }
}

/**
 * Unregister all shortcuts.
 */
export function unregisterAll(): void {
  if (started) {
    try {
      uIOhook.stop()
    } catch { /* ignore */ }
    started = false
  }
  stopFnKeyHelper()
  isHolding = false
  isCommandHolding = false
  fnKeyDown = false
  pressedKeys.clear()
}

export function isShortcutRegistered(): boolean {
  return started
}
