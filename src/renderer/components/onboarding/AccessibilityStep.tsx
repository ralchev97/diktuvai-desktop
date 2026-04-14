import React, { useState, useEffect } from 'react'
import { api } from '../../hooks/useAPI'

interface AccessibilityStepProps {
  onStatusChange?: (granted: boolean) => void
}

export default function AccessibilityStep({ onStatusChange }: AccessibilityStepProps) {
  const [granted, setGranted] = useState(false)
  const [opened, setOpened] = useState(false)

  // Open Settings automatically on mount
  useEffect(() => {
    api?.requestAccessibilityPermission()
    setOpened(true)
  }, [])

  // Poll every 1.5s to detect when permission is granted
  useEffect(() => {
    const interval = setInterval(async () => {
      const perms = await api?.checkPermissions()
      if (perms?.accessibility) {
        setGranted(true)
        onStatusChange?.(true)
        clearInterval(interval)
      }
    }, 1500)
    return () => clearInterval(interval)
  }, [])

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
          Разрешенията са дадени!
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm">
          DiktuvAI има достъп. Натиснете Напред за да продължите.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 bg-amber-100 dark:bg-amber-900/30">
        <svg className="w-10 h-10 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Разрешения за работа
      </h2>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">
        DiktuvAI се нуждае от разрешения за да улавя клавишни комбинации и да вмъква текст.
      </p>

      <div className="space-y-4 max-w-md w-full">
        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-left">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            1. Accessibility (Достъпност)
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            В отворения прозорец намерете "DiktuvAI" и включете превключвателя.
          </p>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-left">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
            2. Input Monitoring (Наблюдение на клавиатура)
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Privacy &amp; Security → Input Monitoring → Включете DiktuvAI
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          Чакам да разрешите достъпа...
        </div>

        <button
          onClick={() => api?.requestAccessibilityPermission()}
          className="px-4 py-2 text-sm text-brand-blue hover:text-brand-blue-dark transition-colors"
        >
          Отвори настройките отново
        </button>
      </div>
    </div>
  )
}
