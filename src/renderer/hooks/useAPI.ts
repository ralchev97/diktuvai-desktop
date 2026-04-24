import { useState, useEffect, useCallback } from 'react'

// Type for the API exposed via preload
declare global {
  interface Window {
    diktuvai: {
      getSettings: () => Promise<any>
      setSetting: (key: string, value: unknown) => Promise<boolean>
      startDictation: () => Promise<boolean>
      stopDictation: () => Promise<boolean>
      cancelDictation: () => Promise<boolean>
      getHistory: (limit?: number, offset?: number) => Promise<any[]>
      searchHistory: (query: string) => Promise<any[]>
      deleteHistory: (id: string) => Promise<boolean>
      copyHistoryItem: (id: string) => Promise<boolean>
      getDictionary: () => Promise<any[]>
      addWord: (word: string) => Promise<any>
      removeWord: (id: string) => Promise<boolean>
      updateWord: (id: string, word: string) => Promise<boolean>
      getSnippets: () => Promise<any[]>
      addSnippet: (trigger: string, content: string) => Promise<any>
      removeSnippet: (id: string) => Promise<boolean>
      updateSnippet: (id: string, trigger: string, content: string) => Promise<boolean>
      requestCode: (email: string) => Promise<{ success: boolean; error?: string }>
      verifyCode: (email: string, code: string) => Promise<any>
      getLicenseStatus: () => Promise<any>
      refreshLicense: () => Promise<any>
      getCheckoutUrl: (plan?: 'starter' | 'pro', interval?: 'monthly' | 'annual') => Promise<{ url?: string; error?: string }>
      getPortalUrl: () => Promise<{ url?: string; error?: string }>
      logout: () => Promise<boolean>
      exportUserData: () => Promise<{ success?: boolean; path?: string; canceled?: boolean; error?: string }>
      deleteAccount: (reason?: string) => Promise<{ success?: boolean; canceled?: boolean; error?: string }>
      getAudioDevices: () => Promise<string[]>
      getPlatform: () => 'darwin' | 'win32' | 'linux'
      getVersion: () => Promise<string>
      checkForUpdates: () => Promise<boolean>
      openExternal: (url: string) => Promise<boolean>
      quitApp: () => Promise<void>
      requestMicPermission: () => Promise<boolean>
      requestAccessibilityPermission: () => Promise<boolean>
      checkPermissions: () => Promise<{ microphone: boolean; accessibility: boolean }>
      completeOnboarding: () => Promise<boolean>
      getStats: () => Promise<any>
      upgradeFromLimit: (plan?: 'starter' | 'pro') => Promise<{ url?: string; error?: string }>
      installUpdate: () => Promise<boolean>
      onDictationState: (callback: (state: string, data?: unknown) => void) => () => void
      onStats: (callback: (stats: unknown) => void) => () => void
      onAudioLevel: (callback: (level: number) => void) => () => void
      onUpdateDownloaded: (callback: (info: { version: string }) => void) => () => void
      onUpdateProgress: (callback: (info: { percent: number }) => void) => () => void
      onLicenseUpdated: (callback: (payload: { reason: string; license: any }) => void) => () => void
    }
  }
}

const api = typeof window !== 'undefined' ? window.diktuvai : null

export function useSettings() {
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api?.getSettings().then(s => {
      setSettings(s)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const updateSetting = useCallback(async (key: string, value: unknown) => {
    await api?.setSetting(key, value)
    setSettings((prev: any) => prev ? { ...prev, [key]: value } : prev)
  }, [])

  return { settings, loading, updateSetting }
}

export function useDictationState() {
  const [state, setState] = useState<string>('idle')
  const [data, setData] = useState<unknown>(null)

  useEffect(() => {
    const cleanup = api?.onDictationState((newState, newData) => {
      setState(newState)
      setData(newData)
    })
    return cleanup
  }, [])

  return { state, data }
}

export function useStats() {
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    const cleanup = api?.onStats((newStats) => {
      setStats(newStats)
    })
    return cleanup
  }, [])

  return stats
}

export function useAudioLevel() {
  const [level, setLevel] = useState(0)

  useEffect(() => {
    const cleanup = api?.onAudioLevel?.((newLevel) => {
      setLevel(newLevel)
    })
    return cleanup
  }, [])

  return level
}

export { api }
