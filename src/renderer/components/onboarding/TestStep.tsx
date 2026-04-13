import React, { useState, useEffect, useRef } from 'react'
import { t } from '../../i18n'
import { api } from '../../hooks/useAPI'

export default function TestStep() {
  const [dictState, setDictState] = useState<string>('idle')
  const [result, setResult] = useState<string>('')
  const [tested, setTested] = useState(false)
  const [recording, setRecording] = useState(false)
  const recordingRef = useRef(false)

  useEffect(() => {
    const cleanup = api?.onDictationState((state, data) => {
      setDictState(state)
      if (state === 'recording') {
        recordingRef.current = true
        setRecording(true)
      }
      if (state === 'idle' && recordingRef.current) {
        if (data && typeof data === 'object' && (data as any).text) {
          setResult((data as any).text)
        } else {
          setResult('Микрофонът работи! Влезте в акаунта си за пълна диктовка.')
        }
        setTested(true)
        recordingRef.current = false
        setRecording(false)
      }
      if (state === 'error') {
        setResult('Микрофонът работи! Влезте в акаунта си за пълна диктовка.')
        setTested(true)
        recordingRef.current = false
        setRecording(false)
      }
    })
    return cleanup
  }, [])

  const handleClick = async () => {
    if (recording || dictState === 'recording') {
      recordingRef.current = false
      setRecording(false)
      await api?.stopDictation()
    } else {
      setResult('')
      setTested(false)
      recordingRef.current = true
      setRecording(true)
      await api?.startDictation()
    }
  }

  const isRecording = recording || dictState === 'recording'
  const isProcessing = dictState === 'transcribing' || dictState === 'processing' || dictState === 'pasting'

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {t('onboarding.testDictation')}
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        {tested
          ? t('onboarding.testSuccess')
          : t('onboarding.testDictationDesc')}
      </p>

      {tested && result ? (
        <div className="flex flex-col items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
            <svg className="w-10 h-10 text-brand-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl max-w-sm w-full">
            <p className="text-sm text-gray-700 dark:text-gray-300 text-center">{result}</p>
          </div>

          <button
            onClick={() => { setTested(false); setResult('') }}
            className="text-sm text-brand-blue hover:text-brand-blue-dark transition-colors"
          >
            {t('onboarding.tryAgain')}
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={handleClick}
            disabled={isProcessing}
            className={`w-28 h-28 rounded-full flex items-center justify-center transition-all shadow-lg ${
              isRecording
                ? 'bg-red-500 scale-110 shadow-red-200 dark:shadow-red-900/30'
                : isProcessing
                ? 'bg-yellow-500 shadow-yellow-200 dark:shadow-yellow-900/30'
                : 'bg-brand-blue hover:bg-brand-blue-dark shadow-blue-200 dark:shadow-blue-900/30'
            }`}
          >
            {isRecording ? (
              <svg className="w-12 h-12 text-white animate-pulse" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              </svg>
            ) : isProcessing ? (
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
            {isRecording ? t('onboarding.clickToStop')
              : isProcessing ? t('overlay.processing')
              : t('onboarding.clickToRecord')}
          </p>

          <p className="mt-2 text-xs text-gray-400">
            {t('onboarding.testHotkeyHint')}
          </p>
        </>
      )}
    </div>
  )
}
