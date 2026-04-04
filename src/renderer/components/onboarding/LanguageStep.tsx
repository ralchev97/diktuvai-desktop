import React, { useState, useEffect } from 'react'
import { t } from '../../i18n'
import { api } from '../../hooks/useAPI'

export default function LanguageStep() {
  const [language, setLanguage] = useState<string>('bg')

  useEffect(() => {
    api?.getSettings().then(s => {
      if (s?.language) setLanguage(s.language)
    })
  }, [])

  const handleSelect = async (lang: string) => {
    setLanguage(lang)
    await api?.setSetting('language', lang)
  }

  const options = [
    { value: 'bg', label: t('onboarding.bulgarian'), flag: '🇧🇬', desc: 'Изберете ако говорите само на български — най-точно разпознаване' },
    { value: 'en', label: t('onboarding.english'), flag: '🇬🇧', desc: 'Choose if you only speak English — best accuracy' },
    { value: 'auto', label: t('onboarding.autoDetect'), flag: '🌐', desc: 'Препоръчително ако говорите на повече от един език' },
  ]

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {t('onboarding.languageSelection')}
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        {t('onboarding.languageSelectionDesc')}
      </p>

      <div className="w-full max-w-sm space-y-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
              language === opt.value
                ? 'border-brand-blue bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <span className="text-3xl">{opt.flag}</span>
            <div className="text-left">
              <p className={`font-medium ${
                language === opt.value ? 'text-brand-blue' : 'text-gray-900 dark:text-white'
              }`}>{opt.label}</p>
              <p className="text-xs text-gray-400">{opt.desc}</p>
            </div>
            {language === opt.value && (
              <svg className="w-5 h-5 text-brand-blue ml-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
