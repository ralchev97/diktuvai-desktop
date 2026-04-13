import React, { useState, useEffect } from 'react'
import { t } from '../../i18n'
import { api } from '../../hooks/useAPI'

interface AccessibilityStepProps {
  onStatusChange?: (granted: boolean) => void
}

export default function AccessibilityStep({ onStatusChange }: AccessibilityStepProps) {
  const [waiting, setWaiting] = useState(false)

  const requestPermission = async () => {
    setWaiting(true)
    await api?.requestAccessibilityPermission()
  }

  // Auto-advance is disabled (sandbox breaks permission detection)
  // Users can always proceed via "Напред" button

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
        DiktuvAI се нуждае от две разрешения за да работи правилно.
      </p>

      {!waiting ? (
        <button
          onClick={requestPermission}
          className="px-6 py-3 bg-brand-blue hover:bg-brand-blue-dark text-white rounded-lg transition-colors font-medium"
        >
          Отвори Системни настройки
        </button>
      ) : (
        <div className="space-y-4 max-w-md w-full">
          {/* Accessibility */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-left">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              1. Accessibility (Достъпност)
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Privacy &amp; Security → Accessibility → Включете DiktuvAI
            </p>
            <p className="text-xs text-gray-400">
              Позволява вмъкване на текст в други приложения.
            </p>
          </div>

          {/* Input Monitoring */}
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 text-left">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
              2. Input Monitoring (Наблюдение на клавиатурата)
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Privacy &amp; Security → Input Monitoring → Включете DiktuvAI
            </p>
            <p className="text-xs text-gray-400">
              Позволява засичане на клавишната комбинация за диктуване.
            </p>
          </div>

          <button
            onClick={requestPermission}
            className="px-4 py-2 text-sm text-brand-blue hover:text-brand-blue-dark transition-colors"
          >
            Отвори настройките отново
          </button>

          <p className="text-xs text-gray-400">
            След като дадете разрешенията, натиснете Напред.
          </p>
        </div>
      )}
    </div>
  )
}
