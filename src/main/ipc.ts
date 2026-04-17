import { ipcMain, app, shell, systemPreferences, BrowserWindow } from 'electron'
import { getSettings, getSetting, setSetting, setSettings } from './store'
import { startDictationSession, stopDictationSession, cancelDictationSession } from './dictation'
import {
  getHistory, searchHistory, deleteDictation, getDictationById,
  getDictionary, addWord, removeWord, updateWord,
  getSnippets, addSnippet, removeSnippet, updateSnippet,
  getUsageStats
} from './db'
import { getAudioDevices } from './audio'
import { resetClient } from './api'
import {
  requestCode,
  verifyCode,
  refreshLicense,
  getLicenseStatus,
  clearLicense,
  createCheckoutUrl,
  createPortalUrl,
} from './license'
import { checkForUpdates, installDownloadedUpdate } from './updater'
import { refreshFnHelper } from './shortcuts'
import { clipboard } from 'electron'

// Settings the renderer is allowed to modify
const ALLOWED_SETTINGS = new Set([
  'language', 'hotkey', 'commandHotkey', 'dismissHotkey', 'undoHotkey', 'polishPasteHotkey',
  'aiFormatting', 'cleanupLevel', 'microphone', 'soundEffects',
  'muteMusic', 'openAtLogin', 'hideFromDock', 'uiLocale',
  'autoLearnDictionary', 'writingStyle', 'polishInstructions',
  'contextAwareness', 'shareUsageData', 'privacyMode',
  'useServerProxy', 'apiKey', 'userEmail'
])

export function registerIpcHandlers(): void {
  // Settings
  ipcMain.handle('settings:get', () => {
    const settings = getSettings()
    // Don't expose secrets to renderer — mask actual values, provide boolean flags
    return { ...settings, authToken: '', apiKey: settings.apiKey ? '••••••••' : '', hasApiKey: !!settings.apiKey }
  })

  ipcMain.handle('settings:set', (_event, key: string, value: unknown) => {
    if (typeof key !== 'string' || !ALLOWED_SETTINGS.has(key)) {
      throw new Error(`Setting "${key}" is not allowed from renderer`)
    }
    // Defensive length cap for string values — a misbehaving renderer (or
    // malicious one in a CVE scenario) shouldn't be able to write megabytes
    // of data into electron-store. The 64 KB ceiling is generous for
    // anything we actually persist (API keys, hotkey strings, etc.).
    if (typeof value === 'string' && value.length > 65_536) {
      throw new Error(`Setting "${key}" value is too large`)
    }
    setSetting(key as any, value as any)
    if (key === 'hotkey' || key === 'commandHotkey' || key === 'dismissHotkey') {
      refreshFnHelper()
    }
    if (key === 'apiKey') {
      resetClient()
    }
    if (key === 'openAtLogin') {
      // Keep the OS-level login item in sync with the store — otherwise
      // toggling this setting in the UI silently diverges from reality.
      try {
        app.setLoginItemSettings({
          openAtLogin: !!value,
          openAsHidden: process.platform === 'darwin',
        })
      } catch { /* best-effort */ }
    }
    if (key === 'hideFromDock' && process.platform === 'darwin') {
      // Apply the Dock visibility change immediately so the user sees the
      // toggle take effect without a restart.
      try {
        if (value) app.dock?.hide()
        else app.dock?.show()
      } catch { /* best-effort */ }
    }
    return true
  })

  // Dictation
  ipcMain.handle('dictation:start', async () => {
    await startDictationSession()
    return true
  })

  ipcMain.handle('dictation:stop', async () => {
    await stopDictationSession()
    return true
  })

  ipcMain.handle('dictation:cancel', () => {
    cancelDictationSession()
    return true
  })

  // History
  ipcMain.handle('history:get', (_event, limit?: number, offset?: number) => {
    return getHistory(limit, offset)
  })

  ipcMain.handle('history:search', (_event, query: string) => {
    if (typeof query !== 'string') return []
    // Query is used in a LIKE clause; very long input is both useless and
    // expensive. Clip to a reasonable upper bound.
    return searchHistory(query.slice(0, 500))
  })

  ipcMain.handle('history:delete', (_event, id: string) => {
    deleteDictation(id)
    return true
  })

  ipcMain.handle('history:copy', (_event, id: string) => {
    const item = getDictationById(id)
    if (item) {
      clipboard.writeText(item.cleaned_text)
    }
    return true
  })

  // Dictionary
  ipcMain.handle('dictionary:get', () => {
    return getDictionary()
  })

  ipcMain.handle('dictionary:add', (_event, word: string) => {
    if (typeof word !== 'string') throw new Error('Invalid word')
    const clean = word.trim()
    if (!clean) throw new Error('Empty word')
    if (clean.length > 100) throw new Error('Дума е твърде дълга (макс. 100 символа)')
    return addWord(clean)
  })

  ipcMain.handle('dictionary:remove', (_event, id: string) => {
    removeWord(id)
    return true
  })

  ipcMain.handle('dictionary:update', (_event, id: string, word: string) => {
    updateWord(id, word)
    return true
  })

  // Snippets
  ipcMain.handle('snippets:get', () => {
    return getSnippets()
  })

  ipcMain.handle('snippets:add', (_event, trigger: string, content: string) => {
    if (typeof trigger !== 'string' || typeof content !== 'string') {
      throw new Error('Invalid snippet')
    }
    const t = trigger.trim()
    const c = content.trim()
    if (!t || !c) throw new Error('Empty snippet')
    if (t.length > 50) throw new Error('Тригерът е твърде дълъг (макс. 50 символа)')
    if (c.length > 10_000) throw new Error('Съдържанието е твърде дълго (макс. 10 000 символа)')
    return addSnippet(t, c)
  })

  ipcMain.handle('snippets:remove', (_event, id: string) => {
    removeSnippet(id)
    return true
  })

  ipcMain.handle('snippets:update', (_event, id: string, trigger: string, content: string) => {
    updateSnippet(id, trigger, content)
    return true
  })

  // License / Auth
  ipcMain.handle('license:requestCode', async (_event, email: string) => {
    return requestCode(email)
  })

  ipcMain.handle('license:verifyCode', async (_event, email: string, code: string) => {
    return verifyCode(email, code)
  })

  ipcMain.handle('license:status', async () => {
    return getLicenseStatus()
  })

  ipcMain.handle('license:refresh', async () => {
    return refreshLicense()
  })

  ipcMain.handle('license:checkoutUrl', async (_event, plan?: 'starter' | 'pro', interval?: 'monthly' | 'annual') => {
    return createCheckoutUrl(plan, interval)
  })

  ipcMain.handle('license:portalUrl', async () => {
    return createPortalUrl()
  })

  ipcMain.handle('license:logout', () => {
    clearLicense()
    return true
  })

  // Audio devices
  ipcMain.handle('audio:devices', async () => {
    return getAudioDevices()
  })

  // App
  ipcMain.handle('app:version', () => {
    return app.getVersion()
  })

  ipcMain.handle('app:checkUpdates', () => {
    checkForUpdates()
    return true
  })

  ipcMain.handle('app:installUpdate', () => {
    return installDownloadedUpdate()
  })

  ipcMain.handle('app:openExternal', (_event, url: string) => {
    try {
      const parsed = new URL(url)
      const allowed = ['https:', 'http:', 'x-apple.systempreferences:']
      if (!allowed.includes(parsed.protocol)) {
        throw new Error('URL protocol not allowed')
      }
    } catch (e) {
      if (e instanceof TypeError) throw new Error('Invalid URL')
      throw e
    }
    shell.openExternal(url)
    return true
  })

  ipcMain.handle('app:quit', () => {
    app.quit()
  })

  // DEV ONLY: simulate word limit reached for testing — never register in production
  if (!app.isPackaged) {
    ipcMain.handle('dev:simulateLimit', () => {
      const wins = BrowserWindow.getAllWindows()
      for (const w of wins) {
        if (!w.isDestroyed()) w.webContents.send('dictation:state', 'limit')
      }
      return true
    })
  }

  ipcMain.handle('limit:upgrade', async (_event, plan: 'starter' | 'pro' = 'pro') => {
    const { createCheckoutUrl } = await import('./license')
    const result = await createCheckoutUrl(plan, 'monthly')
    if (result.url) {
      shell.openExternal(result.url)
    }
    return result
  })

  // Permissions
  ipcMain.handle('permissions:mic', async () => {
    try {
      const status = await systemPreferences.askForMediaAccess('microphone')
      return status
    } catch {
      return false
    }
  })

  ipcMain.handle('permissions:accessibility', async () => {
    try {
      const trusted = systemPreferences.isTrustedAccessibilityClient(true)
      return trusted
    } catch {
      return false
    }
  })

  ipcMain.handle('permissions:check', () => {
    const mic = systemPreferences.getMediaAccessStatus('microphone')
    let accessibility = false
    try {
      accessibility = systemPreferences.isTrustedAccessibilityClient(false)
    } catch { /* not available */ }

    return {
      microphone: mic === 'granted',
      accessibility
    }
  })

  ipcMain.handle('onboarding:complete', () => {
    setSetting('onboardingComplete', true)

    // Once the user finishes onboarding they know the app lives in the
    // menu bar — keeping a Dock icon around is just clutter for an
    // always-on utility (Wispr Flow / Superwhisper behave the same way).
    // They can always flip `hideFromDock` back off in General settings.
    // Only apply this if the user hasn't already explicitly set the value.
    if (process.platform === 'darwin' && !getSetting('hideFromDock')) {
      setSetting('hideFromDock', true)
      try {
        app.dock?.hide()
      } catch { /* ignore */ }
    }
    return true
  })

  // Stats
  ipcMain.handle('stats:get', () => {
    return getUsageStats()
  })
}
