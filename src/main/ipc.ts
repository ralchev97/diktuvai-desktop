import { ipcMain, app, shell, systemPreferences, BrowserWindow } from 'electron'
import { getSettings, getSetting, setSetting, setSettings } from './store'
import { startDictationSession, stopDictationSession, cancelDictationSession } from './dictation'
import {
  getHistory, searchHistory, deleteDictation,
  getDictionary, addWord, removeWord, updateWord,
  getSnippets, addSnippet, removeSnippet, updateSnippet,
  getUsageStats
} from './db'
import { getAudioDevices } from './audio'
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
import { clipboard } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export function registerIpcHandlers(): void {
  // Settings
  ipcMain.handle('settings:get', () => {
    return getSettings()
  })

  ipcMain.handle('settings:set', (_event, key: string, value: unknown) => {
    setSetting(key as any, value as any)
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
    const items = getHistory(1000, 0)
    const item = items.find(i => i.id === id)
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
      // On macOS, we need to check accessibility permissions
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
