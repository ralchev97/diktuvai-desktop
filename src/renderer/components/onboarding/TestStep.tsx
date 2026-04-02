import React, { useState } from 'react'
import { t } from '../../i18n'
import { api, useDictationState } from '../../hooks/useAPI'

export default function TestStep() {
  const { state } = useDictationState()
  const [result, setResult] = useState<string>('')
  const [isHolding, setIsHolding] = useState(false)

  const handleMouseDown = async () => {
    setIsHolding(true)
    setResult('')
    await api?.startDictation()
  }

  const handleMouseUp = async () => {
    setIsHolding(false)
    await api?.stopDictation()
  }

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {t('onboarding.testDictation')}
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-10">
        {t('onboarding.testDictationDesc')}
      </p>

      {/* Big mic button */}
      <button
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { if (isHolding) handleMouseUp() }}
        className={`w-28 h-28 rounded-full flex items-center justify-center transition-all shadow-lg ${
          isHolding || state === 'recording'
            ? 'bg-red-500 scale-110 shadow-red-200 dark:shadow-red-900/30'
            : state === 'transcribing' || state === 'processing'
            ? 'bg-yellow-500 shadow-yellow-200 dark:shadow-yellow-900/30'
            : 'bg-brand-blue hover:bg-brand-blue-dark shadow-blue-200 dark:shadow-blue-900/30'
        }`}
      >
        {state === 'recording' ? (
          <div className="animate-pulse-recording">
            <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
          </div>
        ) : state === 'transcribing' || state === 'processing' ? (
          <svg className="w-10 h-10 text-white animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 11-6.219-8.56" />
          </svg>
        ) : (
          <svg className="w-12 h-12 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
        )}
      </button>

      <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">
        {state === 'recording' ? t('overlay.listening')
          : state === 'transcribing' ? t('overlay.transcribing')
          : state === 'processing' ? t('overlay.processing')
          : t('onboarding.holdToSpeak')}
      </p>

      {/* Result */}
      {result && (
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl max-w-sm w-full">
          <p className="text-sm text-gray-700 dark:text-gray-300">{result}</p>
        </div>
      )}
    </div>
  )
}
