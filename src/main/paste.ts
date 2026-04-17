import { clipboard } from 'electron'
import { exec, execSync } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { platform } from 'os'

const execAsync = promisify(exec)

let previousClipboard: { text: string; html: string } = { text: '', html: '' }

// ---------------------------------------------------------------------------
// Native macOS helper binary
// ---------------------------------------------------------------------------
// A tiny Swift binary that handles two things much faster than osascript:
//   1. `paste`      — sends Cmd+V via CGEvent (≈3–8 ms, vs 90–1100 ms for
//                     osascript). Eliminates the dev/prod latency gap caused
//                     by System Events serialization in production.
//   2. `frontmost`  — prints the frontmost app's name + bundle id via
//                     NSWorkspace. ~5 ms vs ~180 ms for two osascript calls.
// Compiled on first use; cached in userData. Falls back to osascript if
// compilation or execution fails for any reason.

const HELPER_SWIFT_SOURCE = `import Cocoa

let args = CommandLine.arguments
guard args.count >= 2 else {
    fputs("Usage: diktuvai_helper <paste|frontmost>\\n", stderr)
    exit(2)
}

switch args[1] {
case "paste":
    // Key code 9 = V (ANSI layout, physical key — layout independent)
    let src = CGEventSource(stateID: .hidSystemState)
    guard let down = CGEvent(keyboardEventSource: src, virtualKey: 9, keyDown: true),
          let up   = CGEvent(keyboardEventSource: src, virtualKey: 9, keyDown: false) else {
        fputs("ERROR: CGEvent create failed\\n", stderr)
        exit(1)
    }
    down.flags = .maskCommand
    up.flags = .maskCommand
    down.post(tap: .cghidEventTap)
    up.post(tap: .cghidEventTap)
    exit(0)

case "frontmost":
    if let app = NSWorkspace.shared.frontmostApplication {
        print(app.localizedName ?? "")
        print(app.bundleIdentifier ?? "")
        exit(0)
    }
    exit(1)

default:
    fputs("Unknown command: \\(args[1])\\n", stderr)
    exit(2)
}
`

let helperBinaryPath: string | null = null
let helperUnavailable = false

async function ensureHelperCompiled(): Promise<string | null> {
  if (!isMac) return null
  if (helperUnavailable) return null
  if (helperBinaryPath && fs.existsSync(helperBinaryPath)) return helperBinaryPath

  const binaryPath = path.join(app.getPath('userData'), 'diktuvai_helper')
  if (fs.existsSync(binaryPath)) {
    helperBinaryPath = binaryPath
    return binaryPath
  }

  const sourcePath = path.join(app.getPath('userData'), 'diktuvai_helper.swift')
  try {
    fs.writeFileSync(sourcePath, HELPER_SWIFT_SOURCE)
    await execAsync(`swiftc -O -o "${binaryPath}" "${sourcePath}"`, { timeout: 30000 })
    helperBinaryPath = binaryPath
    log('Native helper compiled OK')
    return binaryPath
  } catch (e) {
    log(`Helper compilation failed, falling back to osascript: ${e}`)
    helperUnavailable = true
    return null
  }
}

/** Kick off helper compilation in the background. Safe to call multiple times. */
export function warmHelper(): void {
  ensureHelperCompiled().catch(() => {})
}

/**
 * Convert cleaned-up text (with • bullets, newlines) to simple HTML
 * so rich-text apps paste formatted content.
 */
function textToHtml(text: string): string {
  const lines = text.split('\n')
  const htmlParts: string[] = []
  let inList = false

  for (const line of lines) {
    const trimmed = line.trim()

    // Bullet list item
    if (/^[•\-\*]\s+/.test(trimmed)) {
      if (!inList) {
        htmlParts.push('<ul style="margin:0;padding-left:24px">')
        inList = true
      }
      const content = trimmed.replace(/^[•\-\*]\s+/, '')
      htmlParts.push(`<li>${escapeHtml(content)}</li>`)
      continue
    }

    // Close list if we were in one
    if (inList) {
      htmlParts.push('</ul>')
      inList = false
    }

    if (trimmed === '') {
      htmlParts.push('<br>')
    } else {
      htmlParts.push(`<p style="margin:0">${escapeHtml(trimmed)}</p>`)
    }
  }

  if (inList) htmlParts.push('</ul>')
  return htmlParts.join('')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}
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
      // Fast path: native helper returns name + bundle id in a single call (~5 ms)
      const helper = await ensureHelperCompiled()
      if (helper) {
        try {
          const { stdout } = await execAsync(`"${helper}" frontmost`, { timeout: 2000 })
          const [name, bundle] = stdout.split('\n')
          lastActiveApp = (name ?? '').trim()
          lastActiveAppBundleId = (bundle ?? '').trim()
          log(`Active app: "${lastActiveApp}" (bundle: ${lastActiveAppBundleId}) [native]`)
          return
        } catch (e) {
          log(`Native frontmost failed, falling back to osascript: ${e}`)
          // fall through to osascript below
        }
      }

      // Fallback: osascript (2 calls, ~180 ms, but resilient)
      const { stdout: nameOut } = await execAsync(
        'osascript -e \'tell application "System Events" to get name of first application process whose frontmost is true\''
      )
      lastActiveApp = nameOut.trim()

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
 * Perform Cmd+V paste on macOS using AppleScript.
 *
 * Key decisions:
 *   1. Does NOT activate any specific app — paste goes to whichever app is
 *      currently frontmost. Removing the activation step fixes the "text
 *      lands in the previous app" bug while letting the OS-level Cmd+V
 *      shortcut do its job.
 *
 *   2. Uses `key code 9 using command down` (the physical V key + Cmd),
 *      NOT `keystroke "v" using command down`. The `keystroke` form asks
 *      AppleScript to type the character "v", which is *layout-dependent*:
 *      on Cyrillic BDS / Phonetic layouts the result is a Cyrillic character
 *      and some apps (notably Facebook Messenger in a browser) then
 *      interpret Cmd+<that char> as a completely different shortcut —
 *      reports included Cmd+2 tab-switch and Cmd+C "copy". Raw `key code 9`
 *      is a hardware-level event and always means "V" to macOS regardless
 *      of the active input source, so the OS's own Cmd+V → paste mapping
 *      fires reliably.
 */
async function doPasteMac(): Promise<boolean> {
  // Note: native CGEvent paste was tried but requires Accessibility permission
  // on the helper binary itself (not inherited from the parent Electron process
  // on first launch), which fails silently. Stick with osascript — it uses
  // System Events, which the user has already authorized.
  try {
    await execAsync(
      'osascript -e \'tell application "System Events" to key code 9 using {command down}\''
    )
    log('Paste via osascript key code 9 (Cmd+V) OK')
    return true
  } catch (e) {
    log(`osascript paste failed: ${e}`)
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

  // Save current clipboard (both formats)
  previousClipboard = { text: clipboard.readText(), html: clipboard.readHTML() }

  // Convert to HTML for rich-text apps
  const html = textToHtml(text)

  // Write both plain text and HTML to clipboard
  // Rich-text apps (Docs, Notes, Word, Slack) will use HTML; plain editors use text
  clipboard.write({ text, html })
  log(`Clipboard set with text (${text.length} chars) + html (${html.length} chars)`)

  // Quick clipboard verification
  const clipCheck = clipboard.readText()
  if (clipCheck !== text) {
    log(`WARNING: Clipboard mismatch! Expected ${text.length} chars, got ${clipCheck.length} chars`)
    clipboard.write({ text, html })
  }

  if (isMac) {
    await pasteOnMac(text)
  } else if (isWin) {
    await pasteOnWindows(text)
  }

  // Restore previous clipboard quickly so dictated text is not left on Cmd+V.
  // 800 ms is long enough for Cmd+V synthesis + target app's paste handler to
  // complete in virtually all scenarios, while still feeling "instant" to the user.
  const saved = { ...previousClipboard }
  setTimeout(() => {
    try {
      // Only restore if our dictated text is still on the clipboard — otherwise
      // the user has already copied something new and we must not overwrite it.
      if (clipboard.readText() !== text) {
        log('Clipboard changed since paste; skipping restore')
        return
      }
      if (saved.html) {
        clipboard.write({ text: saved.text, html: saved.html })
      } else {
        clipboard.writeText(saved.text)
      }
      log('Clipboard restored')
    } catch { /* ignore */ }
  }, 800)
}

/**
 * macOS paste with retries and verification.
 */
async function pasteOnMac(text: string): Promise<void> {
  const maxRetries = 3

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    log(`Paste attempt ${attempt}/${maxRetries}`)

    // Ensure clipboard still has our text
    const currentClip = clipboard.readText()
    if (currentClip !== text) {
      log(`Clipboard was changed, re-setting`)
      const html = textToHtml(text)
      clipboard.write({ text, html })
    }

    // Paste into whichever app is currently frontmost
    const pasted = await doPasteMac()
    if (pasted) {
      log(`Paste command sent successfully on attempt ${attempt}`)
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

    // Ensure clipboard still has our text
    clipboard.writeText(text)
    await sleep(50)

    // Paste into whichever window is currently focused (no activation —
    // the user's cursor is where they want the text to land).
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
let musicWasPaused = false

export async function muteMusic(): Promise<void> {
  if (!isMac) return
  try {
    // Check if Spotify or Apple Music is playing, then pause
    const script = `
      set didPause to false
      try
        tell application "System Events"
          if exists (process "Spotify") then
            tell application "Spotify"
              if player state is playing then
                pause
                set didPause to true
              end if
            end tell
          end if
        end tell
      end try
      try
        tell application "System Events"
          if exists (process "Music") then
            tell application "Music"
              if player state is playing then
                pause
                set didPause to true
              end if
            end tell
          end if
        end tell
      end try
      return didPause
    `
    const { stdout } = await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`)
    musicWasPaused = stdout.trim() === 'true'
  } catch { /* ignore */ }
}

export async function unmuteMusic(): Promise<void> {
  if (!isMac || !musicWasPaused) return
  musicWasPaused = false
  try {
    const script = `
      try
        tell application "System Events"
          if exists (process "Spotify") then
            tell application "Spotify"
              play
            end tell
          end if
        end tell
      end try
      try
        tell application "System Events"
          if exists (process "Music") then
            tell application "Music"
              play
            end tell
          end if
        end tell
      end try
    `
    await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`)
  } catch { /* ignore */ }
}

/**
 * Resolve the bundled sounds directory in both dev and packaged builds.
 * In dev:      <projectRoot>/resources/sounds/
 * In prod:     <app>.app/Contents/Resources/sounds/
 */
function soundsDir(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'sounds')
  }
  return path.join(app.getAppPath(), 'resources', 'sounds')
}

export async function playSound(sound: 'start' | 'stop' | 'error'): Promise<void> {
  if (isMac) {
    // Custom Tink variants: pitched down 2 semitones + low-pass + small reverb
    // for a softer, slightly deeper feel. Volume kept calm.
    const volumes = { start: 0.45, stop: 0.45, error: 0.5 }
    const customFiles: Record<typeof sound, string> = {
      start: path.join(soundsDir(), 'start.wav'),
      stop: path.join(soundsDir(), 'stop.wav'),
      // No custom error sound — fall back to system Basso.
      error: '/System/Library/Sounds/Basso.aiff'
    }
    try {
      exec(`afplay -v ${volumes[sound]} "${customFiles[sound]}"`)
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
