import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron'
import path from 'path'
import { platform } from 'os'
import { getState } from './dictation'
import { getUsageStats } from './db'

const isMac = platform() === 'darwin'

let tray: Tray | null = null

/**
 * Create the system tray icon and menu.
 */
export function createTray(
  settingsWindow: BrowserWindow,
  callbacks: {
    onShowSettings: () => void
    onShowHistory: () => void
    onQuit: () => void
  }
): Tray {
  // Create a simple tray icon using a template image
  const icon = createTrayIcon()
  tray = new Tray(icon)

  tray.setToolTip('DiktuvAI - Гласово диктуване')
  updateTrayMenu(callbacks)

  tray.on('click', () => {
    callbacks.onShowSettings()
  })

  return tray
}

function createTrayIcon(): nativeImage {
  // Create a 22x22 template image for the menu bar (macOS standard)
  // This creates a simple microphone icon
  const size = 22
  const canvas = Buffer.alloc(size * size * 4, 0)

  // Draw a simple mic shape using pixels
  // Head of microphone (circle-ish at top)
  for (let y = 3; y <= 10; y++) {
    for (let x = 8; x <= 14; x++) {
      const dx = x - 11
      const dy = y - 6.5
      if (dx * dx / 9 + dy * dy / 12.25 <= 1) {
        const idx = (y * size + x) * 4
        canvas[idx] = 0      // R
        canvas[idx + 1] = 0  // G
        canvas[idx + 2] = 0  // B
        canvas[idx + 3] = 255 // A
      }
    }
  }

  // Stem
  for (let y = 10; y <= 14; y++) {
    for (let x = 10; x <= 12; x++) {
      const idx = (y * size + x) * 4
      canvas[idx] = 0
      canvas[idx + 1] = 0
      canvas[idx + 2] = 0
      canvas[idx + 3] = 255
    }
  }

  // Arc around mic
  for (let y = 5; y <= 12; y++) {
    for (let x = 6; x <= 16; x++) {
      const dx = x - 11
      const dy = y - 8
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist >= 5.5 && dist <= 6.5 && y >= 8) {
        const idx = (y * size + x) * 4
        canvas[idx] = 0
        canvas[idx + 1] = 0
        canvas[idx + 2] = 0
        canvas[idx + 3] = 255
      }
    }
  }

  // Stand line
  for (let y = 14; y <= 16; y++) {
    const x = 11
    const idx = (y * size + x) * 4
    canvas[idx] = 0
    canvas[idx + 1] = 0
    canvas[idx + 2] = 0
    canvas[idx + 3] = 255
  }

  // Base
  for (let x = 8; x <= 14; x++) {
    const y = 17
    const idx = (y * size + x) * 4
    canvas[idx] = 0
    canvas[idx + 1] = 0
    canvas[idx + 2] = 0
    canvas[idx + 3] = 255
  }

  const image = nativeImage.createFromBuffer(canvas, { width: size, height: size })
  if (isMac) {
    image.setTemplateImage(true)
  }
  return image
}

export function updateTrayMenu(callbacks: {
  onShowSettings: () => void
  onShowHistory: () => void
  onQuit: () => void
}): void {
  if (!tray) return

  const state = getState()
  const stateLabel = state === 'recording' ? '🔴 Записвам...'
    : state === 'transcribing' ? '⏳ Транскрибирам...'
    : state === 'processing' ? '✨ Обработвам...'
    : '⏸ Готов за диктуване'

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'DiktuvAI',
      type: 'normal',
      enabled: false
    },
    { type: 'separator' },
    {
      label: stateLabel,
      type: 'normal',
      enabled: false
    },
    { type: 'separator' },
    {
      label: 'Настройки...',
      click: callbacks.onShowSettings
    },
    {
      label: 'История',
      click: callbacks.onShowHistory
    },
    { type: 'separator' },
    {
      label: 'Излез',
      click: callbacks.onQuit
    }
  ])

  tray.setContextMenu(contextMenu)
}

export function updateTrayIcon(recording: boolean): void {
  if (!tray) return

  if (recording) {
    tray.setToolTip('DiktuvAI - Записвам...')
  } else {
    tray.setToolTip('DiktuvAI - Гласово диктуване')
  }
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy()
    tray = null
  }
}
