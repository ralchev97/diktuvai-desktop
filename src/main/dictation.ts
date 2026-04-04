import { BrowserWindow, app } from 'electron'
import { startRecording, stopRecording, cancelRecording, isRecording, cleanupTempFiles } from './audio'
import { transcribeAudio, cleanupText, processCommand } from './api'
import { pasteText, undoLastPaste, getSelectedText, getActiveAppName, playSound, rememberActiveApp } from './paste'
import { saveDictation, getSnippets } from './db'
import { getSetting } from './store'
import fs from 'fs'
import path from 'path'

const logFile = path.join(app.getPath('userData'), 'dictation.log')
function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}\n`
  fs.appendFileSync(logFile, line)
}

export type DictationState = 'idle' | 'recording' | 'transcribing' | 'processing' | 'pasting' | 'error'

let currentState: DictationState = 'idle'
let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let lastPastedText: string = ''
let dictationStartTime: number = 0
let audioLevelInterval: ReturnType<typeof setInterval> | null = null

function startAudioLevelUpdates(): void {
  stopAudioLevelUpdates()
  audioLevelInterval = setInterval(() => {
    try {
      if (overlayWindow && !overlayWindow.isDestroyed() && !overlayWindow.webContents.isDestroyed()) {
        // Send a simulated audio level (0-1) — organic variation
        const t = Date.now() / 200
        const level = 0.3 + Math.sin(t) * 0.2 + Math.sin(t * 2.3) * 0.15 + Math.random() * 0.25
        overlayWindow.webContents.send('audio:level', Math.min(1, Math.max(0, level)))
      }
    } catch { /* ignore */ }
  }, 50) // 20fps updates
}

function stopAudioLevelUpdates(): void {
  if (audioLevelInterval) {
    clearInterval(audioLevelInterval)
    audioLevelInterval = null
  }
}

export function initDictation(main: BrowserWindow, overlay: BrowserWindow | null): void {
  mainWindow = main
  overlayWindow = overlay
}

export function setOverlayWindow(overlay: BrowserWindow | null): void {
  overlayWindow = overlay
}

function setState(state: DictationState, data?: unknown): void {
  currentState = state
  console.log(`[Dictation] State: ${state}`, data || '')

  // Safely notify renderer windows
  try {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.webContents.isDestroyed()) {
      mainWindow.webContents.send('dictation:state', state, data)
    }
  } catch { /* ignore */ }

  try {
    if (overlayWindow && !overlayWindow.isDestroyed() && !overlayWindow.webContents.isDestroyed()) {
      overlayWindow.webContents.send('dictation:state', state, data)
    }
  } catch { /* ignore */ }

  // Show/hide overlay — use showInactive() to avoid activating the app and stealing focus
  if (state === 'recording' || state === 'transcribing' || state === 'processing') {
    try {
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.showInactive()
      }
    } catch { /* ignore */ }
  } else {
    setTimeout(() => {
      try {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.hide()
        }
      } catch { /* ignore */ }
    }, 300)
  }
}

export function getState(): DictationState {
  return currentState
}

/**
 * Start a dictation session.
 */
export async function startDictationSession(): Promise<void> {
  if (currentState !== 'idle') return

  try {
    dictationStartTime = Date.now()

    // Start recording FIRST — before anything else
    startRecording(getSetting('microphone')).catch(err => log(`Recording error: ${err}`))

    // Then sound + UI + active app (non-blocking)
    playSound('start').catch(() => {})
    setState('recording')
    startAudioLevelUpdates()
    rememberActiveApp().catch(() => {})
    log('Recording started OK')
  } catch (err) {
    log(`Failed to start dictation: ${err}`)
    setState('error', { message: 'Неуспешно стартиране на записа' })
    setTimeout(() => setState('idle'), 2000)
  }
}

/**
 * Stop recording and process the dictation.
 */
export async function stopDictationSession(): Promise<void> {
  if (currentState !== 'recording') return

  try {
    setState('transcribing')
    stopAudioLevelUpdates()
    log('Stopping recording...')

    const result = await stopRecording()
    log(`Stop result: ${result ? `${result.durationMs}ms, ${result.buffer.length} bytes, ${result.filePath}` : 'null'}`)

    if (!result || result.durationMs < 300) {
      log('Too short or no result, ignoring')
      setState('idle')
      cleanupTempFiles()
      return
    }

    // Transcribe
    log(`Transcribing ${result.filePath}...`)
    const rawText = await transcribeAudio(result.filePath)
    log(`Raw transcript: "${rawText}"`)

    if (!rawText || rawText.trim().length === 0) {
      log('Empty transcript, ignoring')
      setState('idle')
      cleanupTempFiles()
      return
    }

    // Check for snippets first
    const snippets = getSnippets()
    const snippet = snippets.find(s => rawText.toLowerCase().trim() === s.trigger.toLowerCase())
    if (snippet) {
      setState('pasting')
      await pasteText(snippet.content)
      lastPastedText = snippet.content
      const appName = await getActiveAppName()
      saveDictation(rawText, snippet.content, getSetting('language'), appName, result.durationMs)
      setState('idle', { text: snippet.content })
      cleanupTempFiles()
      return
    }

    // AI Cleanup — skip for 'low' level (gpt-4o-transcribe is already clean)
    let cleanedText = rawText.trim()
    const cleanupLevel = getSetting('cleanupLevel')
    if (getSetting('aiFormatting') && cleanupLevel !== 'low') {
      setState('processing')
      cleanedText = await cleanupText(rawText, {
        level: cleanupLevel,
        polishInstructions: getSetting('polishInstructions')
      })
    } else {
      // Basic cleanup: trim whitespace, ensure ends with punctuation
      cleanedText = cleanedText.replace(/^\s+|\s+$/g, '')
      if (cleanedText && !/[.!?]$/.test(cleanedText)) {
        cleanedText += '.'
      }
    }

    // Paste
    log(`Pasting: "${cleanedText}"`)
    setState('pasting')
    await pasteText(cleanedText)
    lastPastedText = cleanedText
    log('Paste done')

    playSound('stop').catch(() => {})
    setState('idle', { text: cleanedText })

    // Save to history in background (non-blocking)
    const appName = await getActiveAppName()
    saveDictation(rawText, cleanedText, getSetting('language'), appName, result.durationMs)
    cleanupTempFiles()
  } catch (err) {
    log(`DICTATION ERROR: ${err instanceof Error ? err.stack : err}`)
    const soundEffects = getSetting('soundEffects')
    if (soundEffects) {
      playSound('error').catch(() => {})
    }
    setState('error', { message: err instanceof Error ? err.message : 'Грешка при обработка' })
    setTimeout(() => setState('idle'), 3000)
    cleanupTempFiles()
  }
}

/**
 * Cancel the current dictation.
 */
export function cancelDictationSession(): void {
  cancelRecording()
  setState('idle')
  cleanupTempFiles()
}

/**
 * Undo the last paste.
 */
export async function undoDictation(): Promise<void> {
  if (lastPastedText) {
    await undoLastPaste()
    lastPastedText = ''
  }
}

/**
 * Start command mode — process a voice command, optionally on selected text.
 */
export async function startCommandMode(): Promise<void> {
  if (currentState !== 'idle') return

  try {
    // Get selected text first
    const selectedText = await getSelectedText()

    const soundEffects = getSetting('soundEffects')
    if (soundEffects) {
      playSound('start').catch(() => {})
    }

    dictationStartTime = Date.now()
    setState('recording')
    startRecording(getSetting('microphone'))

    // Store selected text for when recording stops
    ;(global as any).__selectedTextForCommand = selectedText
  } catch (err) {
    console.error('Failed to start command mode:', err)
    setState('error', { message: 'Неуспешно стартиране' })
    setTimeout(() => setState('idle'), 2000)
  }
}

/**
 * Stop command mode recording and process.
 */
export async function stopCommandMode(): Promise<void> {
  if (currentState !== 'recording') return

  try {
    setState('transcribing')

    const result = await stopRecording()
    if (!result || result.durationMs < 300) {
      setState('idle')
      cleanupTempFiles()
      return
    }

    const command = await transcribeAudio(result.filePath)
    if (!command || command.trim().length === 0) {
      setState('idle')
      cleanupTempFiles()
      return
    }

    setState('processing')

    const selectedText = (global as any).__selectedTextForCommand || ''
    delete (global as any).__selectedTextForCommand

    const resultText = await processCommand(command, selectedText || undefined)

    if (resultText) {
      setState('pasting')
      await pasteText(resultText)
      lastPastedText = resultText

      const appName = await getActiveAppName()
      saveDictation(command, resultText, getSetting('language'), appName, result.durationMs)
    }

    const soundEffects = getSetting('soundEffects')
    if (soundEffects) {
      playSound('stop').catch(() => {})
    }

    setState('idle')
    cleanupTempFiles()
  } catch (err) {
    console.error('Command mode error:', err)
    setState('error', { message: err instanceof Error ? err.message : 'Грешка при обработка' })
    setTimeout(() => setState('idle'), 3000)
    cleanupTempFiles()
  }
}
