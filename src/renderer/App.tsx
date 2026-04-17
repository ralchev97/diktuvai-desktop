import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react'
import { useSettings } from './hooks/useAPI'
import { setLocale } from './i18n'
import Onboarding from './components/onboarding/Onboarding'
import SettingsWindow from './components/settings/SettingsWindow'
import DictationOverlay from './components/overlay/DictationOverlay'
import HistoryPanel from './components/history/HistoryPanel'
import UpdateBanner from './components/UpdateBanner'

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('React ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-white dark:bg-gray-900">
          <div className="flex flex-col items-center gap-4 text-center px-6">
            <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center">
              <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">Нещо се обърка. Моля, презаредете приложението.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm rounded-lg transition-colors"
            >
              Презареди
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

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
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
    document.body.className = ''
    return <DictationOverlay />
  }

  const content = view === 'onboarding'
    ? <Onboarding onComplete={() => setView('settings')} />
    : view === 'history'
    ? <HistoryPanel />
    : <SettingsWindow />

  return (
    <ErrorBoundary>
      {content}
      <UpdateBanner />
    </ErrorBoundary>
  )
}
