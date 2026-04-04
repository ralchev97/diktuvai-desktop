import React, { useState, useEffect } from 'react'
import { t } from '../../i18n'
import { api } from '../../hooks/useAPI'

interface AccessibilityStepProps {
  onStatusChange?: (granted: boolean) => void
}

export default function AccessibilityStep({ onStatusChange }: AccessibilityStepProps) {
  const [granted, setGranted] = useState<boolean | null>(null)
  const [waiting, setWaiting] = useState(false)

  const checkPermission = async () => {
    const perms = await api?.checkPermissions()
    const isGranted = perms?.accessibility ?? false
    setGranted(isGranted)
    if (isGranted) onStatusChange?.(true)
  }

  // Check on mount + poll every 2s until granted
  useEffect(() => {
    checkPermission()
    const interval = setInterval(async () => {
      const perms = await api?.checkPermissions()
      if (perms?.accessibility) {
        setGranted(true)
        onStatusChange?.(true)
        clearInterval(interval)
      }
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const requestPermission = async () => {
    setWaiting(true)
    await api?.requestAccessibilityPermission()
  }

  if (granted) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 bg-green-100 dark:bg-green-900/30">
          <svg className="w-10 h-10 text-brand-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t('onboarding.accessibilityGranted')}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm">
          {t('onboarding.accessibilityGrantedDesc')}
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      {/* Shield icon */}
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 bg-amber-100 dark:bg-amber-900/30">
        <svg className="w-10 h-10 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {t('onboarding.accessibilityPermission')}
      </h2>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">
        {t('onboarding.accessibilityPermissionDesc')}
      </p>

      {!waiting ? (
        <button
          onClick={requestPermission}
          className="px-6 py-3 bg-brand-blue hover:bg-brand-blue-dark text-white rounded-lg transition-colors font-medium"
        >
          {t('onboarding.openSettings')}
        </button>
      ) : (
        <div className="space-y-4 max-w-sm">
          {/* Step-by-step instructions */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-left space-y-3">
            <div className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-blue text-white text-xs font-bold flex items-center justify-center">1</span>
              <p className="text-sm text-gray-700 dark:text-gray-300">{t('onboarding.accessibilityStep1')}</p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-blue text-white text-xs font-bold flex items-center justify-center">2</span>
              <p className="text-sm text-gray-700 dark:text-gray-300">{t('onboarding.accessibilityStep2')}</p>
            </div>
            <div className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-brand-blue text-white text-xs font-bold flex items-center justify-center">3</span>
              <p className="text-sm text-gray-700 dark:text-gray-300">{t('onboarding.accessibilityStep3')}</p>
            </div>
          </div>

          {/* Waiting indicator */}
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            {t('onboarding.waitingForAccess')}
          </div>

          {/* Retry button */}
          <button
            onClick={requestPermission}
            className="px-4 py-2 text-sm text-brand-blue hover:text-brand-blue-dark transition-colors"
          >
            {t('onboarding.reopenSettings')}
          </button>
        </div>
      )}
    </div>
  )
}
