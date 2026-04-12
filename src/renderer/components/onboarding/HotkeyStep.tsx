import React, { useState, useEffect } from 'react'
import { t } from '../../i18n'
import { api } from '../../hooks/useAPI'

const isMac = api?.getPlatform() === 'darwin'

function displayValue(v: string): string {
  if (isMac) {
    return v
      .replace(/RightOption|LeftOption/g, '⌥ Option')
      .replace(/RightCtrl|LeftCtrl/g, '⌃ Control')
      .replace(/RightAlt|LeftAlt/g, '⌥ Option')
      .replace(/RightShift|LeftShift/g, '⇧ Shift')
      .replace(/Fn/g, '🌐 Fn')
      .replace(/\+/g, ' + ')
  }
  return v
    .replace(/RightOption|LeftOption/g, 'Alt')
    .replace(/RightCtrl|LeftCtrl/g, 'Ctrl')
    .replace(/RightAlt|LeftAlt/g, 'Alt')
    .replace(/RightShift|LeftShift/g, 'Shift')
    .replace(/Fn/g, 'Fn')
    .replace(/\+/g, ' + ')
}

const MODIFIER_NAMES: Record<string, (location: number) => string> = {
  'Alt': (loc) => loc === 2 ? 'RightOption' : 'LeftOption',
  'Control': (loc) => loc === 2 ? 'RightCtrl' : 'LeftCtrl',
  'Shift': (loc) => loc === 2 ? 'RightShift' : 'LeftShift',
}

function keyEventToSettingValue(e: React.KeyboardEvent, currentParts: string[]): { value: string | null; parts: string[] } {
  e.preventDefault()
  e.stopPropagation()
  const mapper = MODIFIER_NAMES[e.key]
  if (mapper) {
    const part = mapper(e.location)
    const newParts = [...currentParts]
    if (!newParts.includes(part)) {
      newParts.push(part)
    }
    return { value: newParts.join('+'), parts: newParts }
  }
  return { value: null, parts: currentParts }
}

export default function HotkeyStep() {
  const [hotkey, setHotkey] = useState<string>('RightOption')
  const [editing, setEditing] = useState(false)
  const [comboParts, setComboParts] = useState<string[]>([])
  const [comboTimer, setComboTimer] = useState<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    api?.getSettings().then(s => {
      if (s?.hotkey) setHotkey(s.hotkey)
    })
  }, [])

  const handleClick = () => {
    setComboParts([])
    setEditing(true)
  }

  const saveHotkey = (value: string) => {
    setHotkey(value)
    api?.setSetting('hotkey', value)
    setEditing(false)
    setComboParts([])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const { value: newValue, parts } = keyEventToSettingValue(e, comboParts)
    if (newValue) {
      setComboParts(parts)
      if (comboTimer) clearTimeout(comboTimer)
      const timer = setTimeout(() => saveHotkey(newValue), 500)
      setComboTimer(timer)
    }
  }

  const handleFnClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (comboTimer) clearTimeout(comboTimer)
    const newParts = [...comboParts]
    if (!newParts.some(p => p === 'Fn')) {
      newParts.unshift('Fn')
    }
    setComboParts(newParts)
    const timer = setTimeout(() => saveHotkey(newParts.join('+')), 500)
    setComboTimer(timer)
  }

  const handleBlur = () => {
    if (comboTimer) clearTimeout(comboTimer)
    if (comboParts.length > 0) {
      saveHotkey(comboParts.join('+'))
    } else {
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
        onBlur={handleBlur}
        className={`w-full max-w-sm flex flex-col items-center justify-center gap-3 p-6 rounded-xl border-2 transition-all outline-none ${
          editing
            ? 'border-brand-blue bg-blue-50 dark:bg-blue-900/20 animate-pulse'
            : 'border-gray-200 dark:border-gray-700 hover:border-brand-blue'
        }`}
      >
        {editing ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-brand-blue font-medium">
              {comboParts.length > 0
                ? displayValue(comboParts.join('+')) + ' ...'
                : (isMac ? t('onboarding.pressNewKeyMac') : t('onboarding.pressNewKeyWin'))}
            </p>
            {isMac && (
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={handleFnClick}
                className="px-3 py-1.5 bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded-lg text-xs font-mono text-gray-700 dark:text-gray-200 transition-colors"
              >
                🌐 Fn
              </button>
            )}
          </div>
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
