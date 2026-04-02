import { clipboard } from 'electron'
import { exec, execSync } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { platform } from 'os'

const execAsync = promisify(exec)

let previousClipboard: string = ''
let lastActiveApp: string = ''
let lastActiveAppBundleId: string = ''

const logFile = () => path.join(app.getPath('userData'), 'dictation.log')
function log(msg: string): void {
  fs.appendFileSync(logFile(), `[${new Date().toISOString()}] [paste] ${msg}\n`)
}

const isMac = platform() === 'darwin'
const isWin = platform() === 'win32'

/**
 * Remember which app was active before dictation starts.
 */
export async function rememberActiveApp(): Promise<void> {
  try {
    if (isMac) {
      // Get both the app name and bundle ID for more reliable activation
      const { stdout: nameOut } = await execAsync(
        'osascript -e \'tell application "System Events" to get name of first application process whose frontmost is true\''
      )
      lastActiveApp = nameOut.trim()

      // Also get bundle identifier for more reliable activation
      try {
        const { stdout: bidOut } = await execAsync(
          'osascript -e \'tell application "System Events" to get bundle identifier of first application process whose frontmost is true\''
        )
        lastActiveAppBundleId = bidOut.trim()
      } catch {
        lastActiveAppBundleId = ''
      }

      log(`Active app: "${lastActiveApp}" (bundle: ${lastActiveAppBundleId})`)
    } else if (isWin) {
      const { stdout } = await execAsync(
        'powershell -NoProfile -Command "(Get-Process | Where-Object { $_.MainWindowHandle -ne 0 } | Where-Object { $_.MainWindowTitle } | Sort-Object -Property @{Expression={[Microsoft.Win32.NativeMethods]::GetForegroundWindow()}} -ErrorAction SilentlyContinue | Select-Object -First 1).MainWindowTitle"'
      )
      lastActiveApp = stdout.trim()
      log(`Active app (Windows): "${lastActiveApp}"`)
    }
  } catch (e) {
    log(`Failed to get active app: ${e}`)
    lastActiveApp = ''
    lastActiveAppBundleId = ''
  }
}

/**
 * Wait for a specific duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Activate the target app on macOS and wait for it to be frontmost.
 */
async function activateAppMac(appName: string, bundleId: string): Promise<boolean> {
  // Strategy 1: Use bundle ID if available (more reliable)
  if (bundleId) {
    try {
      await execAsync(
        `osascript -e 'tell application id "${bundleId}" to activate'`
      )
      await sleep(300)

      // Verify it's frontmost
      const { stdout } = await execAsync(
        'osascript -e \'tell application "System Events" to get name of first application process whose frontmost is true\''
      )
      if (stdout.trim() === appName) {
        log(`App activated via bundle ID: ${appName}`)
        return true
      }
    } catch (e) {
      log(`Bundle ID activation failed: ${e}`)
    }
  }

  // Strategy 2: Use app name
  try {
    await execAsync(
      `osascript -e 'tell application "${appName}" to activate'`
    )
    await sleep(500)

    // Verify it's frontmost
    const { stdout } = await execAsync(
      'osascript -e \'tell application "System Events" to get name of first application process whose frontmost is true\''
    )
    if (stdout.trim() === appName) {
      log(`App activated via name: ${appName}`)
      return true
    }
    log(`App activation check: frontmost is "${stdout.trim()}", expected "${appName}"`)
  } catch (e) {
    log(`Name activation failed: ${e}`)
  }

  // Strategy 3: Use System Events to set frontmost
  try {
    await execAsync(
      `osascript -e 'tell application "System Events" to set frontmost of process "${appName}" to true'`
    )
    await sleep(500)
    log(`App activated via System Events frontmost`)
    return true
  } catch (e) {
    log(`System Events activation failed: ${e}`)
  }

  return false
}

/**
 * Perform Cmd+V paste on macOS using AppleScript.
 */
async function doPasteMac(): Promise<boolean> {
  // Method 1: Use System Events keystroke (most reliable when Accessibility is granted)
  try {
    await execAsync(
      'osascript -e \'tell application "System Events" to keystroke "v" using command down\''
    )
    log('Paste via System Events keystroke OK')
    return true
  } catch (e) {
    log(`Keystroke paste failed: ${e}`)
  }

  // Method 2: Use key code instead of keystroke
  try {
    await execAsync(
      'osascript -e \'tell application "System Events" to key code 9 using command down\''
    )
    log('Paste via key code OK')
    return true
  } catch (e) {
    log(`Key code paste failed: ${e}`)
  }

  // Method 3: CGEvent binary fallback
  const pasteBinary = path.join(app.getPath('userData'), 'diktuvai_paste')
  if (fs.existsSync(pasteBinary)) {
    try {
      await execAsync(`"${pasteBinary}"`)
      log('Paste via CGEvent binary OK')
      return true
    } catch (e) {
      log(`CGEvent paste failed: ${e}`)
    }
  }

  return false
}

/**
 * Perform Ctrl+V paste on Windows using PowerShell.
 */
async function doPasteWindows(): Promise<boolean> {
  try {
    await execAsync(
      'powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'^v\')"'
    )
    return true
  } catch (e) {
    log(`Windows paste failed: ${e}`)
    return false
  }
}

/**
 * Paste text into the previously active application.
 * Rock-solid implementation with retries and verification.
 */
export async function pasteText(text: string): Promise<void> {
  log(`pasteText called, text length: ${text.length}, target: "${lastActiveApp}"`)

  // Save current clipboard
  previousClipboard = clipboard.readText()

  // Write text to system clipboard using pbcopy (macOS) or electron clipboard
  if (isMac) {
    // Use pbcopy for rock-solid clipboard write
    try {
      execSync('pbcopy', { input: text, encoding: 'utf-8' })
      log('Clipboard set via pbcopy')
    } catch {
      clipboard.writeText(text)
      log('Clipboard set via Electron (pbcopy failed)')
    }
  } else {
    clipboard.writeText(text)
    log('Clipboard set via Electron')
  }

  // Verify clipboard content
  await sleep(50)
  const clipCheck = clipboard.readText()
  if (clipCheck !== text) {
    log(`WARNING: Clipboard mismatch! Expected ${text.length} chars, got ${clipCheck.length} chars`)
    // Try again
    clipboard.writeText(text)
    await sleep(100)
  }

  if (isMac) {
    await pasteOnMac(text)
  } else if (isWin) {
    await pasteOnWindows(text)
  }

  // Restore previous clipboard after a long delay (5 seconds to be safe)
  const savedClipboard = previousClipboard
  setTimeout(() => {
    try {
      clipboard.writeText(savedClipboard)
      log('Clipboard restored')
    } catch { /* ignore */ }
  }, 5000)
}

/**
 * macOS paste with retries and verification.
 */
async function pasteOnMac(text: string): Promise<void> {
  const maxRetries = 3

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    log(`Paste attempt ${attempt}/${maxRetries}`)

    // Step 1: Activate the target app
    if (lastActiveApp) {
      const activated = await activateAppMac(lastActiveApp, lastActiveAppBundleId)
      if (!activated) {
        log(`Failed to activate app on attempt ${attempt}`)
        await sleep(300)
        continue
      }
    }

    // Step 2: Extra wait for the app to be fully ready for input
    await sleep(200)

    // Step 3: Ensure clipboard still has our text (another app might have changed it)
    const currentClip = clipboard.readText()
    if (currentClip !== text) {
      log(`Clipboard was changed, re-setting`)
      try {
        execSync('pbcopy', { input: text, encoding: 'utf-8' })
      } catch {
        clipboard.writeText(text)
      }
      await sleep(50)
    }

    // Step 4: Paste
    const pasted = await doPasteMac()
    if (pasted) {
      log(`Paste command sent successfully on attempt ${attempt}`)
      // Give the app time to process the paste
      await sleep(200)
      return
    }

    log(`Paste failed on attempt ${attempt}, retrying...`)
    await sleep(500)
  }

  log('All paste attempts exhausted')
}

/**
 * Windows paste with retries.
 */
async function pasteOnWindows(text: string): Promise<void> {
  const maxRetries = 3

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    log(`Windows paste attempt ${attempt}/${maxRetries}`)

    // Activate window (best effort)
    if (lastActiveApp) {
      try {
        await execAsync(
          `powershell -NoProfile -Command "$wsh = New-Object -ComObject WScript.Shell; $wsh.AppActivate('${lastActiveApp.replace(/'/g, "''")}')" `
        )
        await sleep(300)
      } catch (e) {
        log(`Windows app activation failed: ${e}`)
      }
    }

    // Ensure clipboard
    clipboard.writeText(text)
    await sleep(100)

    const pasted = await doPasteWindows()
    if (pasted) {
      log(`Windows paste sent on attempt ${attempt}`)
      await sleep(200)
      return
    }

    await sleep(500)
  }

  log('All Windows paste attempts exhausted')
}

/**
 * Undo the last paste.
 */
export async function undoLastPaste(): Promise<void> {
  if (isMac) {
    await execAsync(
      'osascript -e \'tell application "System Events" to keystroke "z" using command down\''
    )
  } else if (isWin) {
    await execAsync(
      'powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'^z\')"'
    )
  }
}

/**
 * Get the currently selected text.
 */
export async function getSelectedText(): Promise<string> {
  const saved = clipboard.readText()
  clipboard.writeText('')

  if (isMac) {
    await execAsync(
      'osascript -e \'tell application "System Events" to keystroke "c" using command down\''
    )
  } else if (isWin) {
    await execAsync(
      'powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait(\'^c\')"'
    )
  }

  await sleep(150)
  const selected = clipboard.readText()
  clipboard.writeText(saved)
  return selected
}

/**
 * Get the name of the currently active application.
 */
export async function getActiveAppName(): Promise<string> {
  return lastActiveApp || 'Unknown'
}

/**
 * Play a system sound.
 */
export async function playSound(sound: 'start' | 'stop' | 'error'): Promise<void> {
  if (isMac) {
    const soundMap = { start: 'Tink', stop: 'Pop', error: 'Basso' }
    try {
      exec(`afplay /System/Library/Sounds/${soundMap[sound]}.aiff`)
    } catch { /* ignore */ }
  } else if (isWin) {
    const soundMap = {
      start: '[System.Media.SystemSounds]::Asterisk.Play()',
      stop: '[System.Media.SystemSounds]::Exclamation.Play()',
      error: '[System.Media.SystemSounds]::Hand.Play()'
    }
    try {
      exec(`powershell -NoProfile -Command "${soundMap[sound]}"`)
    } catch { /* ignore */ }
  }
}
