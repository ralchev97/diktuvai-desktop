import React, { useState, useEffect } from 'react'
import { t } from '../../i18n'
import { api } from '../../hooks/useAPI'

export default function AccessibilityStep() {
  const [granted, setGranted] = useState<boolean | null>(null)

  useEffect(() => {
    checkPermission()
  }, [])

  const checkPermission = async () => {
    const perms = await api?.checkPermissions()
    setGranted(perms?.accessibility ?? false)
  }

  const requestPermission = async () => {
    await api?.requestAccessibilityPermission()
    // Check again after a delay since the user needs to manually enable it
    setTimeout(checkPermission, 2000)
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 ${
        granted ? 'bg-green-100 dark:bg-green-900/30' : 'bg-blue-100 dark:bg-blue-900/30'
      }`}>
        <svg className={`w-10 h-10 ${granted ? 'text-brand-green' : 'text-brand-blue'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4l2 2" />
          <path d="M8.5 2.5L6 1" />
          <path d="M15.5 2.5L18 1" />
        </svg>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {t('onboarding.accessibilityPermission')}
      </h2>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-8">
        {t('onboarding.accessibilityPermissionDesc')}
      </p>

      {granted === false && (
        <div className="space-y-3">
          <button
            onClick={requestPermission}
            className="px-6 py-3 bg-brand-blue hover:bg-brand-blue-dark text-white rounded-lg transition-colors font-medium"
          >
            {t('onboarding.grantPermission')}
          </button>
          <p className="text-xs text-gray-400 max-w-xs">
            {t('onboarding.accessibilityDenied')}
          </p>
          <button
            onClick={checkPermission}
            className="px-4 py-2 text-sm text-brand-blue hover:text-brand-blue-dark transition-colors"
          >
            {t('onboarding.checkPermission')}
          </button>
        </div>
      )}

      {granted === true && (
        <div className="flex items-center gap-2 text-brand-green font-medium">
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {t('onboarding.accessibilityGranted')}
        </div>
      )}

      {granted === null && (
        <button
          onClick={checkPermission}
          className="px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
        >
          {t('onboarding.checkPermission')}
        </button>
      )}
    </div>
  )
}
