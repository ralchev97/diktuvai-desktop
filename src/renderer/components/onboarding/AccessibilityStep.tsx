import React, { useState, useEffect } from 'react'
import { api } from '../../hooks/useAPI'

interface AccessibilityStepProps {
  onStatusChange?: (granted: boolean) => void
}

export default function AccessibilityStep({ onStatusChange }: AccessibilityStepProps) {
  const [accessibilityOk, setAccessibilityOk] = useState(false)

  // Poll accessibility every 1.5s
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      const perms = await api?.checkPermissions()
      if (cancelled) return
      if (perms?.accessibility) {
        setAccessibilityOk(true)
        onStatusChange?.(true)
      }
    }
    check()
    const interval = setInterval(check, 1500)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [onStatusChange])

  const openAccessibility = () => {
    api?.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility')
  }

  if (accessibilityOk) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6 bg-green-100 dark:bg-green-900/30">
          <svg className="w-10 h-10 text-brand-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Разрешението е дадено!
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
        Достъпност (Accessibility)
      </h2>
      <p className="text-gray-500 dark:text-gray-400 max-w-sm mb-6">
        DiktuvAI се нуждае от достъп до Accessibility, за да може да въвежда текст в други приложения.
      </p>

      <button
        onClick={openAccessibility}
        className="w-full max-w-md flex items-center gap-3 p-4 rounded-xl text-left transition-colors bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50"
      >
        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-300 dark:bg-gray-600">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900 dark:text-white">
            Accessibility (Достъпност)
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Кликнете за да отворите настройките
          </p>
        </div>
        <svg className="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </button>
    </div>
  )
}
