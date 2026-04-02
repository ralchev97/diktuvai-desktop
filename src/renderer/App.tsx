import React, { useState, useEffect } from 'react'
import { useSettings } from './hooks/useAPI'
import { setLocale } from './i18n'
import Onboarding from './components/onboarding/Onboarding'
import SettingsWindow from './components/settings/SettingsWindow'
import DictationOverlay from './components/overlay/DictationOverlay'
import HistoryPanel from './components/history/HistoryPanel'

type View = 'onboarding' | 'settings' | 'overlay' | 'history'

export default function App() {
  const { settings, loading } = useSettings()
  const [view, setView] = useState<View>('settings')

  useEffect(() => {
    if (settings) {
      setLocale(settings.uiLocale || 'bg')

      if (!settings.onboardingComplete) {
        setView('onboarding')
      }
    }

    // Check if this is the overlay window
    if (window.location.hash === '#/overlay') {
      setView('overlay')
    }

    // Listen for navigation from main process
    const handleNavigate = (event: Event) => {
      // Custom event from IPC
    }

    // Listen for hash changes
    const handleHash = () => {
      if (window.location.hash === '#/overlay') {
        setView('overlay')
      } else if (window.location.hash === '#/history') {
        setView('history')
      }
    }

    window.addEventListener('hashchange', handleHash)
    return () => window.removeEventListener('hashchange', handleHash)
  }, [settings])

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-brand-blue rounded-2xl flex items-center justify-center">
            <svg className="w-9 h-9 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          </div>
          <div className="animate-spin w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full" />
        </div>
      </div>
    )
  }

  if (view === 'overlay') {
    return <DictationOverlay />
  }

  if (view === 'onboarding') {
    return <Onboarding onComplete={() => setView('settings')} />
  }

  if (view === 'history') {
    return <HistoryPanel />
  }

  return <SettingsWindow />
}
