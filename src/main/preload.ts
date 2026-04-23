import { contextBridge, ipcRenderer } from 'electron'

const api = {
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (key: string, value: unknown) => ipcRenderer.invoke('settings:set', key, value),

  // Dictation
  startDictation: () => ipcRenderer.invoke('dictation:start'),
  stopDictation: () => ipcRenderer.invoke('dictation:stop'),
  cancelDictation: () => ipcRenderer.invoke('dictation:cancel'),

  // History
  getHistory: (limit?: number, offset?: number) => ipcRenderer.invoke('history:get', limit, offset),
  searchHistory: (query: string) => ipcRenderer.invoke('history:search', query),
  deleteHistory: (id: string) => ipcRenderer.invoke('history:delete', id),
  copyHistoryItem: (id: string) => ipcRenderer.invoke('history:copy', id),

  // Dictionary
  getDictionary: () => ipcRenderer.invoke('dictionary:get'),
  addWord: (word: string) => ipcRenderer.invoke('dictionary:add', word),
  removeWord: (id: string) => ipcRenderer.invoke('dictionary:remove', id),
  updateWord: (id: string, word: string) => ipcRenderer.invoke('dictionary:update', id, word),

  // Snippets
  getSnippets: () => ipcRenderer.invoke('snippets:get'),
  addSnippet: (trigger: string, content: string) => ipcRenderer.invoke('snippets:add', trigger, content),
  removeSnippet: (id: string) => ipcRenderer.invoke('snippets:remove', id),
  updateSnippet: (id: string, trigger: string, content: string) => ipcRenderer.invoke('snippets:update', id, trigger, content),

  // License / Auth
  requestCode: (email: string) => ipcRenderer.invoke('license:requestCode', email),
  verifyCode: (email: string, code: string) => ipcRenderer.invoke('license:verifyCode', email, code),
  getLicenseStatus: () => ipcRenderer.invoke('license:status'),
  refreshLicense: () => ipcRenderer.invoke('license:refresh'),
  getCheckoutUrl: (plan?: 'starter' | 'pro', interval?: 'monthly' | 'annual') =>
    ipcRenderer.invoke('license:checkoutUrl', plan, interval),
  getPortalUrl: () => ipcRenderer.invoke('license:portalUrl'),
  logout: () => ipcRenderer.invoke('license:logout'),

  // Audio devices
  getAudioDevices: () => ipcRenderer.invoke('audio:devices'),

  // Stats
  getStats: () => ipcRenderer.invoke('stats:get'),

  // Platform
  getPlatform: () => process.platform as 'darwin' | 'win32' | 'linux',

  // App
  getVersion: () => ipcRenderer.invoke('app:version'),
  checkForUpdates: () => ipcRenderer.invoke('app:checkUpdates'),
  installUpdate: () => ipcRenderer.invoke('app:installUpdate'),
  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
  quitApp: () => ipcRenderer.invoke('app:quit'),

  // Onboarding
  requestMicPermission: () => ipcRenderer.invoke('permissions:mic'),
  requestAccessibilityPermission: () => ipcRenderer.invoke('permissions:accessibility'),
  checkPermissions: () => ipcRenderer.invoke('permissions:check'),
  completeOnboarding: () => ipcRenderer.invoke('onboarding:complete'),

  // Limit overlay
  upgradeFromLimit: (plan?: 'starter' | 'pro') => ipcRenderer.invoke('limit:upgrade', plan || 'pro'),

  // Events from main process
  onDictationState: (callback: (state: string, data?: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: string, data?: unknown) => callback(state, data)
    ipcRenderer.on('dictation:state', handler)
    return () => ipcRenderer.removeListener('dictation:state', handler)
  },

  onStats: (callback: (stats: unknown) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, stats: unknown) => callback(stats)
    ipcRenderer.on('stats:update', handler)
    return () => ipcRenderer.removeListener('stats:update', handler)
  },

  onAudioLevel: (callback: (level: number) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, level: number) => callback(level)
    ipcRenderer.on('audio:level', handler)
    return () => ipcRenderer.removeListener('audio:level', handler)
  },

  onUpdateDownloaded: (callback: (info: { version: string }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: { version: string }) => callback(info)
    ipcRenderer.on('update:downloaded', handler)
    return () => ipcRenderer.removeListener('update:downloaded', handler)
  },

  onUpdateProgress: (callback: (info: { percent: number }) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: { percent: number }) => callback(info)
    ipcRenderer.on('update:progress', handler)
    return () => ipcRenderer.removeListener('update:progress', handler)
  },

  /**
   * Emitted after the main process refreshes the license in response to a
   * `diktuvai://` deep link (typically the Stripe checkout return flow).
   * The renderer uses this to re-render the Account tab and show a toast.
   */
  onLicenseUpdated: (callback: (payload: { reason: string; license: unknown }) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: { reason: string; license: unknown }
    ) => callback(payload)
    ipcRenderer.on('license:updated', handler)
    return () => ipcRenderer.removeListener('license:updated', handler)
  },
}

export type DiktuvAPI = typeof api

contextBridge.exposeInMainWorld('diktuvai', api)
