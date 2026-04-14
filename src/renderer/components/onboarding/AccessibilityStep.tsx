import React, { useState, useEffect } from 'react'
import { api } from '../../hooks/useAPI'

interface AccessibilityStepProps {
  onStatusChange?: (granted: boolean) => void
}

export default function AccessibilityStep({ onStatusChange }: AccessibilityStepProps) {
  const [accessibilityOk, setAccessibilityOk] = useState(false)
  const [inputMonitoringOk, setInputMonitoringOk] = useState(false)

  // Poll accessibility every 1.5s
  useEffect(() => {
    const check = async () => {
      const perms = await api?.checkPermissions()
      if (perms?.accessibility) setAccessibilityOk(true)
    }
    check()
    const interval = setInterval(check, 1500)
    return () => clearInterval(interval)
  }, [])

  // Notify parent when both are done
  useEffect(() => {
    if (accessibilityOk && inputMonitoringOk) {
      onStatusChange?.(true)
    }
  }, [accessibilityOk, inputMonitoringOk])

  const openAccessibility = () => {
    api?.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility')
  }

  const openInputMonitoring = () => {
    api?.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent')
  }

  const allDone = accessibilityOk && inputMonitoringOk

  if (allDone) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 bg-green-100 dark:bg-green-900/30">
          <svg className="w-10 h-10 text-brand-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Всички разрешения са дадени!
        </h2>
        <p className="text-gray-500 dark:text-gray-400 max-w-sm">
          Натиснете Напред за да продължите.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4 bg-amber-100 dark:bg-amber-900/30">
        <svg className="w-8 h-8 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>

      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Разрешения за работа
      </h2>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">
        Кликнете върху всяко разрешение, за да го настроите.
      </p>

      <div className="space-y-3 max-w-md w-full">
        {/* Accessibility */}
        <button
          onClick={openAccessibility}
          className={`w-full flex items-center gap-3 p-4 rounded-xl text-left transition-colors ${
            accessibilityOk
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50'
          }`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            accessibilityOk ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}>
            {accessibilityOk ? (
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Accessibility (Достъпност)
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {accessibilityOk ? 'Разрешено' : 'Кликнете за да отворите настройките'}
            </p>
          </div>
          {!accessibilityOk && (
            <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          )}
        </button>

        {/* Input Monitoring */}
        <button
          onClick={inputMonitoringOk ? undefined : openInputMonitoring}
          className={`w-full flex items-center gap-3 p-4 rounded-xl text-left transition-colors ${
            inputMonitoringOk
              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
              : 'bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50'
          }`}
        >
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
            inputMonitoringOk ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
          }`}>
            {inputMonitoringOk ? (
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">
              Input Monitoring (Клавиатура)
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {inputMonitoringOk ? 'Разрешено' : 'Кликнете за да отворите настройките'}
            </p>
          </div>
          {!inputMonitoringOk && (
            <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          )}
        </button>

        {/* Manual confirm for Input Monitoring (no API to detect it) */}
        {accessibilityOk && !inputMonitoringOk && (
          <button
            onClick={() => setInputMonitoringOk(true)}
            className="w-full mt-2 px-4 py-3 bg-brand-blue hover:bg-brand-blue-dark text-white rounded-lg text-sm font-medium transition-colors"
          >
            Направих го — продължи
          </button>
        )}
      </div>
    </div>
  )
}
