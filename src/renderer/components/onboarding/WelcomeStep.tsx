import React from 'react'
import { t } from '../../i18n'

export default function WelcomeStep() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center">
      {/* Logo / Icon */}
      <div className="w-24 h-24 bg-brand-blue rounded-3xl flex items-center justify-center mb-8 shadow-lg">
        <svg className="w-14 h-14 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </svg>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        {t('onboarding.welcome')}
      </h1>
      <p className="text-xl text-brand-blue font-medium mb-4">
        {t('app.nameBg')}
      </p>
      <p className="text-lg text-gray-500 dark:text-gray-400 max-w-md">
        {t('app.tagline')}
      </p>

      {/* Feature highlights */}
      <div className="mt-10 grid grid-cols-3 gap-6 max-w-lg">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center mx-auto mb-2">
            <svg className="w-6 h-6 text-brand-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">Гласово диктуване</p>
        </div>
        <div className="text-center">
          <div className="w-12 h-12 bg-green-50 dark:bg-green-900/30 rounded-xl flex items-center justify-center mx-auto mb-2">
            <svg className="w-6 h-6 text-brand-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">AI обработка</p>
        </div>
        <div className="text-center">
          <div className="w-12 h-12 bg-purple-50 dark:bg-purple-900/30 rounded-xl flex items-center justify-center mx-auto mb-2">
            <svg className="w-6 h-6 text-purple-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6h16M4 12h16M4 18h12" />
            </svg>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400">Навсякъде</p>
        </div>
      </div>
    </div>
  )
}
