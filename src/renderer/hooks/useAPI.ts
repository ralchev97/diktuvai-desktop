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
      validateLicense: (key: string) => Promise<any>
      getLicenseStatus: () => Promise<any>
      getAudioDevices: () => Promise<string[]>
      getVersion: () => Promise<string>
      checkForUpdates: () => Promise<boolean>
      openExternal: (url: string) => Promise<boolean>
      quitApp: () => Promise<void>
      requestMicPermission: () => Promise<boolean>
      requestAccessibilityPermission: () => Promise<boolean>
      checkPermissions: () => Promise<{ microphone: boolean; accessibility: boolean }>
      completeOnboarding: () => Promise<boolean>
      onDictationState: (callback: (state: string, data?: unknown) => void) => () => void
      onStats: (callback: (stats: unknown) => void) => () => void
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

export { api }
