import React, { useState, useEffect } from 'react'
import { t } from '../../i18n'
import { api } from '../../hooks/useAPI'

export default function MicPermissionStep() {
  const [granted, setGranted] = useState<boolean | null>(null)

  useEffect(() => {
    checkPermission()
  }, [])

  const checkPermission = async () => {
    const perms = await api?.checkPermissions()
    setGranted(perms?.microphone ?? false)
  }

  const requestPermission = async () => {
    const result = await api?.requestMicPermission()
    setGranted(result ?? false)
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 ${
        granted ? 'bg-green-100 dark:bg-green-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
      }`}>
        <svg className={`w-10 h-10 ${granted ? 'text-brand-green' : 'text-brand-blue'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {t('onboarding.micPermission')}
      </h2>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-8">
        {t('onboarding.micPermissionDesc')}
      </p>

      {granted === null && (
        <button
          onClick={checkPermission}
          className="px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
        >
          {t('onboarding.checkPermission')}
        </button>
      )}

      {granted === false && (
        <button
          onClick={requestPermission}
          className="px-6 py-3 bg-brand-blue hover:bg-brand-blue-dark text-white rounded-lg transition-colors font-medium"
        >
          {t('onboarding.grantPermission')}
        </button>
      )}

      {granted === true && (
        <div className="flex items-center gap-2 text-brand-green font-medium">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {t('onboarding.micGranted')}
        </div>
      )}
    </div>
  )
}
