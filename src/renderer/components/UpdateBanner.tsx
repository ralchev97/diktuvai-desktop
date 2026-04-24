import React, { useEffect, useState } from 'react'
import { api } from '../hooks/useAPI'

/**
 * Toast-style banner that surfaces when electron-updater has finished
 * downloading a new version. It's intentionally non-blocking: the main
 * process will auto-restart when the app is idle for 2 minutes, this just
 * lets the user trigger the relaunch sooner if they like.
 */
export default function UpdateBanner() {
  const [version, setVersion] = useState<string | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    const unsub = api?.onUpdateDownloaded?.((info: { version: string }) => {
      setVersion(info.version)
    })
    return () => unsub?.()
  }, [])

  if (!version) return null

  const handleRelaunch = async () => {
    setInstalling(true)
    try {
      await api?.installUpdate?.()
    } catch {
      setInstalling(false)
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 right-4 z-50 max-w-xs bg-gray-900 dark:bg-gray-800 border border-gray-700 rounded-xl shadow-2xl p-4 animate-fadeIn"
      style={{ animation: 'fadeIn 0.2s ease-out' }}
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <svg className="w-5 h-5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">Обновено до {version}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {installing ? 'Рестартирам…' : 'Рестартирам автоматично при свободен момент'}
          </p>
          {/*
            The app will restart on its own after ~20s of no active dictation
            (see scheduleAutoInstall in main/updater.ts). We still expose a
            "restart now" button so power users don't have to wait.
          */}
          <button
            onClick={handleRelaunch}
            disabled={installing}
            className="mt-3 w-full px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-60 border border-white/20"
          >
            {installing ? 'Рестартирам…' : 'Рестартирай сега'}
          </button>
        </div>
      </div>
    </div>
  )
}
