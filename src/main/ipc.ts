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
import { checkForUpdates } from './updater'
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
    if (!ALLOWED_SETTINGS.has(key)) {
      throw new Error(`Setting "${key}" is not allowed from renderer`)
    }
    setSetting(key as any, value as any)
    if (key === 'hotkey' || key === 'commandHotkey' || key === 'dismissHotkey') {
      refreshFnHelper()
    }
    if (key === 'apiKey') {
      resetClient()
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
    return searchHistory(query)
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
    return addWord(word)
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
    return addSnippet(trigger, content)
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
    return true
  })

  // Stats
  ipcMain.handle('stats:get', () => {
    return getUsageStats()
  })
}
