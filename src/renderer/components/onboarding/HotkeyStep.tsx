import React, { useState, useEffect } from 'react'
import { t } from '../../i18n'
import { api } from '../../hooks/useAPI'

export default function HotkeyStep() {
  const [hotkey, setHotkey] = useState<string>('Option')

  useEffect(() => {
    api?.getSettings().then(s => {
      if (s?.hotkey) setHotkey(s.hotkey)
    })
  }, [])

  const handleSelect = async (key: string) => {
    setHotkey(key)
    await api?.setSetting('hotkey', key)
  }

  const options = [
    { value: 'Option', label: 'Option (Alt)', desc: 'Задръжте Option за диктуване', keys: ['⌥'] },
    { value: 'Fn', label: 'Fn', desc: 'Задръжте Fn за диктуване', keys: ['fn'] },
    { value: 'Control+Option', label: 'Control + Option', desc: 'Задръжте двата клавиша', keys: ['⌃', '⌥'] },
  ]

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {t('onboarding.hotkeyConfig')}
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        {t('onboarding.hotkeyConfigDesc')}
      </p>

      <div className="w-full max-w-sm space-y-3">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
            className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all ${
              hotkey === opt.value
                ? 'border-brand-blue bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div className="flex gap-1">
              {opt.keys.map((k, i) => (
                <kbd key={i} className="px-2.5 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-md text-sm font-mono font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
                  {k}
                </kbd>
              ))}
            </div>
            <div className="text-left flex-1">
              <p className={`font-medium ${
                hotkey === opt.value ? 'text-brand-blue' : 'text-gray-900 dark:text-white'
              }`}>{opt.label}</p>
              <p className="text-xs text-gray-400">{opt.desc}</p>
            </div>
            {hotkey === opt.value && (
              <svg className="w-5 h-5 text-brand-blue" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
