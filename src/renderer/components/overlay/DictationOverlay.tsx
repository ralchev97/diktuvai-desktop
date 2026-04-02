import React from 'react'
import { t } from '../../i18n'
import { useDictationState } from '../../hooks/useAPI'

export default function DictationOverlay() {
  const { state } = useDictationState()

  if (state === 'idle') return null

  const stateConfig = {
    recording: {
      bg: 'from-red-500 to-red-600',
      text: t('overlay.listening'),
      icon: (
        <div className="animate-pulse-recording">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" fill="none" stroke="currentColor" strokeWidth="2" />
          </svg>
        </div>
      )
    },
    transcribing: {
      bg: 'from-yellow-500 to-amber-500',
      text: t('overlay.transcribing'),
      icon: (
        <svg className="w-5 h-5 text-white animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12a9 9 0 11-6.219-8.56" />
        </svg>
      )
    },
    processing: {
      bg: 'from-blue-500 to-indigo-500',
      text: t('overlay.processing'),
      icon: (
        <svg className="w-5 h-5 text-white animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      )
    },
    pasting: {
      bg: 'from-green-500 to-emerald-500',
      text: '...',
      icon: (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      )
    },
    error: {
      bg: 'from-red-600 to-red-700',
      text: t('overlay.error'),
      icon: (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      )
    }
  }

  const config = stateConfig[state as keyof typeof stateConfig]
  if (!config) return null

  return (
    <div className="h-screen w-screen flex items-start justify-center pt-2">
      <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-gradient-to-r ${config.bg} shadow-lg animate-fadeIn`}>
        {config.icon}
        <span className="text-white text-sm font-medium">{config.text}</span>
      </div>
    </div>
  )
}
