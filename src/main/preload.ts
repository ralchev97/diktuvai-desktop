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

  // License
  loginWithEmail: (email: string) => ipcRenderer.invoke('license:loginWithEmail', email),
  getLicenseStatus: () => ipcRenderer.invoke('license:status'),
  logout: () => ipcRenderer.invoke('license:logout'),

  // Audio devices
  getAudioDevices: () => ipcRenderer.invoke('audio:devices'),

  // Stats
  getStats: () => ipcRenderer.invoke('stats:get'),

  // App
  getVersion: () => ipcRenderer.invoke('app:version'),
  checkForUpdates: () => ipcRenderer.invoke('app:checkUpdates'),
  openExternal: (url: string) => ipcRenderer.invoke('app:openExternal', url),
  quitApp: () => ipcRenderer.invoke('app:quit'),

  // Onboarding
  requestMicPermission: () => ipcRenderer.invoke('permissions:mic'),
  requestAccessibilityPermission: () => ipcRenderer.invoke('permissions:accessibility'),
  checkPermissions: () => ipcRenderer.invoke('permissions:check'),
  completeOnboarding: () => ipcRenderer.invoke('onboarding:complete'),

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
  }
}

export type DiktuvAPI = typeof api

contextBridge.exposeInMainWorld('diktuvai', api)
