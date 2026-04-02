import { uIOhook, UiohookKey } from 'uiohook-napi'
import { getSetting } from './store'

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

// Key code for Right Option (Alt) key — same as WisprFlow's default
const KEY_RIGHT_ALT = UiohookKey.AltRight   // 3640
const KEY_LEFT_ALT = UiohookKey.Alt          // 56
const KEY_ESCAPE = UiohookKey.Escape         // 1
const KEY_FN = 0x00FF                        // Fn key (macOS specific, code 255)
const KEY_RIGHT_CTRL = UiohookKey.CtrlRight  // 3613

/**
 * Get the configured hotkey code.
 */
function getHotkeyCode(): number {
  const hotkey = getSetting('hotkey')
  const mapping: Record<string, number> = {
    'RightAlt': KEY_RIGHT_ALT,
    'LeftAlt': KEY_LEFT_ALT,
    'RightOption': KEY_RIGHT_ALT,
    'LeftOption': KEY_LEFT_ALT,
    'Option': KEY_RIGHT_ALT,
    'RightCtrl': KEY_RIGHT_CTRL,
    'Fn': KEY_FN,
  }
  return mapping[hotkey] || KEY_RIGHT_ALT
}

function getCommandKeyCode(): number {
  return KEY_RIGHT_CTRL
}

/**
 * Register hold-to-talk shortcuts using uiohook for keydown + keyup detection.
 */
export function registerShortcuts(h: HoldToTalkHandlers): void {
  handlers = h

  if (started) {
    // Already running, just update handlers
    return
  }

  const hotkeyCode = getHotkeyCode()
  const commandKeyCode = getCommandKeyCode()

  uIOhook.on('keydown', (e) => {
    // Dictation: hold to talk
    if (e.keycode === hotkeyCode && !isHolding && !isCommandHolding) {
      isHolding = true
      handlers?.onHoldStart()
    }

    // Command mode
    if (e.keycode === commandKeyCode && !isHolding && !isCommandHolding) {
      isCommandHolding = true
      handlers?.onCommand()
    }

    // Escape: cancel
    if (e.keycode === KEY_ESCAPE) {
      if (isHolding || isCommandHolding) {
        isHolding = false
        isCommandHolding = false
        handlers?.onCancel()
      }
    }
  })

  uIOhook.on('keyup', (e) => {
    // Release dictation key → stop & process
    if (e.keycode === hotkeyCode && isHolding) {
      isHolding = false
      handlers?.onHoldStop()
    }

    // Release command key → stop & process command
    if (e.keycode === commandKeyCode && isCommandHolding) {
      isCommandHolding = false
      handlers?.onCommandStop()
    }
  })

  uIOhook.start()
  started = true

  console.log(`Hold-to-talk registered: keycode ${hotkeyCode} (${getSetting('hotkey')})`)
  console.log(`Command mode: keycode ${commandKeyCode}`)
  console.log('Press and HOLD the key to dictate, release to process.')
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
  isHolding = false
  isCommandHolding = false
}

export function isShortcutRegistered(): boolean {
  return started
}
