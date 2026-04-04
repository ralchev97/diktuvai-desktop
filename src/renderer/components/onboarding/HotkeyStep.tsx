import React, { useState, useEffect } from 'react'
import { t } from '../../i18n'
import { api } from '../../hooks/useAPI'

const isMac = api?.getPlatform() === 'darwin'

function displayValue(v: string): string {
  if (isMac) {
    return v
      .replace('RightOption', '⌥ Option')
      .replace('LeftOption', '⌥ Option')
      .replace('RightCtrl', '⌃ Control')
      .replace('LeftCtrl', '⌃ Control')
      .replace('RightAlt', '⌥ Option')
      .replace('LeftAlt', '⌥ Option')
  }
  return v
    .replace('RightOption', 'Alt')
    .replace('LeftOption', 'Alt')
    .replace('RightCtrl', 'Ctrl')
    .replace('LeftCtrl', 'Ctrl')
    .replace('RightAlt', 'Alt')
    .replace('LeftAlt', 'Alt')
}

function keyEventToSettingValue(e: React.KeyboardEvent): string | null {
  e.preventDefault()
  e.stopPropagation()
  if (e.key === 'Alt') return e.location === 2 ? 'RightOption' : 'LeftOption'
  if (e.key === 'Control') return e.location === 2 ? 'RightCtrl' : 'LeftCtrl'
  return null
}

export default function HotkeyStep() {
  const [hotkey, setHotkey] = useState<string>('RightOption')
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    api?.getSettings().then(s => {
      if (s?.hotkey) setHotkey(s.hotkey)
    })
  }, [])

  const handleClick = () => {
    setEditing(true)
  }

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    const newValue = keyEventToSettingValue(e)
    if (newValue) {
      setHotkey(newValue)
      await api?.setSetting('hotkey', newValue)
      setEditing(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {t('onboarding.hotkeyConfig')}
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8">
        {t('onboarding.hotkeyConfigDesc')}
      </p>

      <button
        onClick={handleClick}
        onKeyDown={editing ? handleKeyDown : undefined}
        onBlur={() => setEditing(false)}
        className={`w-full max-w-sm flex items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all outline-none ${
          editing
            ? 'border-brand-blue bg-blue-50 dark:bg-blue-900/20 animate-pulse'
            : 'border-gray-200 dark:border-gray-700 hover:border-brand-blue'
        }`}
      >
        {editing ? (
          <p className="text-brand-blue font-medium">
            {isMac ? t('onboarding.pressNewKeyMac') : t('onboarding.pressNewKeyWin')}
          </p>
        ) : (
          <>
            <kbd className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-lg font-mono font-medium text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-600">
              {displayValue(hotkey)}
            </kbd>
            <span className="text-xs text-gray-400">{t('onboarding.clickToChange')}</span>
          </>
        )}
      </button>
    </div>
  )
}
