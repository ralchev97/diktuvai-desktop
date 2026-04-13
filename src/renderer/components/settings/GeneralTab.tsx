import React, { useState, useEffect } from 'react'
import { t } from '../../i18n'
import { api } from '../../hooks/useAPI'
import Toggle from '../ui/Toggle'

interface GeneralTabProps {
  settings: any
  onUpdate: (key: string, value: unknown) => void
}

export default function GeneralTab({ settings, onUpdate }: GeneralTabProps) {
  const [devices, setDevices] = useState<string[]>(['default'])

  useEffect(() => {
    api?.getAudioDevices().then(d => setDevices(d))
  }, [])

  if (!settings) return null

  return (
    <div className="space-y-6 tab-content">
      {/* Shortcuts */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          {t('settings.shortcuts')}
        </h3>
        <div className="space-y-2">
          <ShortcutRow label={t('settings.pushToTalk')} value={settings.hotkey} settingKey="hotkey" onUpdate={onUpdate} />
          <ShortcutRow label={t('settings.commandMode')} value={settings.commandHotkey} settingKey="commandHotkey" onUpdate={onUpdate} hint='Маркирай текст, задръж бутона, кажи команда (напр. "преведи", "съкрати")' />
          <ShortcutRow label={t('settings.dismiss')} value={settings.dismissHotkey} settingKey="dismissHotkey" onUpdate={onUpdate} />
          <ShortcutRow label={t('settings.undo')} value={settings.undoHotkey} settingKey="undoHotkey" onUpdate={onUpdate} />
          <ShortcutRow label={t('settings.polishPaste')} value={settings.polishPasteHotkey} settingKey="polishPasteHotkey" onUpdate={onUpdate} />
        </div>
      </section>

      {/* Language */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          {t('settings.language')}
        </h3>
        <div className="flex gap-2">
          {(['bg', 'en', 'auto'] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => onUpdate('language', lang)}
              className={`flex flex-col items-center px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                settings.language === lang
                  ? 'bg-brand-blue text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <span>{lang === 'bg' ? '🇧🇬 Български' : lang === 'en' ? '🇬🇧 English' : '🌐 Auto'}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {settings.language === 'bg'
            ? t('settings.languageBgDesc' as any)
            : settings.language === 'en'
            ? t('settings.languageEnDesc' as any)
            : t('settings.languageAutoDesc' as any)}
        </p>
      </section>

      {/* AI Formatting */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {t('settings.aiFormatting')}
            </h3>
            <p className="text-xs text-gray-400">{t('settings.aiFormattingDesc')}</p>
          </div>
          <Toggle checked={settings.aiFormatting} onChange={(v) => onUpdate('aiFormatting', v)} />
        </div>

        {settings.aiFormatting && (
          <div className="mt-3">
            <label className="text-xs text-gray-500 mb-1 block">{t('settings.cleanupLevel')}</label>
            <div className="flex gap-2">
              {(['low', 'medium', 'high'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => onUpdate('cleanupLevel', level)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    settings.cleanupLevel === level
                      ? 'bg-brand-blue text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {t(`settings.cleanup${level.charAt(0).toUpperCase() + level.slice(1)}` as any)}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Microphone */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">
          {t('settings.microphone')}
        </h3>
        <select
          value={settings.microphone}
          onChange={(e) => onUpdate('microphone', e.target.value)}
          className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-blue"
        >
          {devices.map((d) => (
            <option key={d} value={d}>{d === 'default' ? 'По подразбиране' : d}</option>
          ))}
        </select>
      </section>

      {/* Toggles */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">{t('settings.soundEffects')}</span>
          <Toggle checked={settings.soundEffects} onChange={(v) => onUpdate('soundEffects', v)} />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-gray-700 dark:text-gray-300">{t('settings.muteMusic' as any)}</span>
            <p className="text-xs text-gray-400">{t('settings.muteMusicDesc' as any)}</p>
          </div>
          <Toggle checked={settings.muteMusic} onChange={(v) => onUpdate('muteMusic', v)} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">{t('settings.openAtLogin')}</span>
          <Toggle checked={settings.openAtLogin} onChange={(v) => onUpdate('openAtLogin', v)} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-700 dark:text-gray-300">{t('settings.hideFromDock')}</span>
          <Toggle checked={settings.hideFromDock} onChange={(v) => onUpdate('hideFromDock', v)} />
        </div>
      </section>
    </div>
  )
}

// Whether this shortcut key is a hold-to-talk style (modifiers only, including combos and Fn)
const HOLD_TO_TALK_KEYS = new Set(['hotkey', 'commandHotkey'])

// Modifier keys that can be part of a hold-to-talk combo
const MODIFIER_NAMES: Record<string, (location: number) => string> = {
  'Alt': (loc) => loc === 2 ? 'RightOption' : 'LeftOption',
  'Control': (loc) => loc === 2 ? 'RightCtrl' : 'LeftCtrl',
  'Shift': (loc) => loc === 2 ? 'RightShift' : 'LeftShift',
}

const isMac = navigator.userAgent.includes('Mac')

/**
 * Convert a keyboard event to a hotkey setting value.
 * For hold-to-talk keys: supports single modifiers, modifier combos, and Fn.
 * For combo keys: supports modifier+key combinations.
 */
function keyEventToSettingValue(e: React.KeyboardEvent, settingKey: string, currentParts: string[]): { value: string | null; parts: string[] } {
  e.preventDefault()
  e.stopPropagation()

  const isHoldToTalk = HOLD_TO_TALK_KEYS.has(settingKey)

  // For hold-to-talk shortcuts (push-to-talk, command mode)
  if (isHoldToTalk) {
    const mapper = MODIFIER_NAMES[e.key]
    if (mapper) {
      const part = mapper(e.location)
      // Build combo: add this modifier if not already present
      const newParts = [...currentParts]
      if (!newParts.includes(part)) {
        newParts.push(part)
      }
      return { value: newParts.join('+'), parts: newParts }
    }
    // Ignore non-modifier keys
    return { value: null, parts: currentParts }
  }

  // For combo shortcuts (undo, dismiss, polishPaste)
  if (e.key === 'Escape') return { value: 'Escape', parts: [] }

  const parts: string[] = []
  if (e.metaKey) parts.push('CommandOrControl')
  if (e.ctrlKey && !e.metaKey) parts.push('Control')
  if (e.shiftKey) parts.push('Shift')
  if (e.altKey) parts.push('Alt')

  const key = e.key
  if (['Meta', 'Control', 'Shift', 'Alt', 'Fn'].includes(key)) return { value: null, parts: [] }

  parts.push(key.length === 1 ? key.toUpperCase() : key)
  return { value: parts.join('+'), parts: [] }
}

function displayValue(v: string): string {
  if (!v) return ''
  return v
    .replace(/CommandOrControl/g, isMac ? '⌘' : 'Ctrl')
    .replace(/RightCtrl|LeftCtrl/g, '⌃')
    .replace(/Ctrl/g, '⌃')
    .replace(/RightOption|LeftOption/g, '⌥')
    .replace(/RightAlt|LeftAlt|Alt/g, '⌥')
    .replace(/RightShift|LeftShift/g, '⇧')
    .replace(/Shift/g, '⇧')
    .replace(/RightCmd|LeftCmd|Cmd/g, '⌘')
    .replace(/Escape/g, 'ESC')
    .replace(/\+/g, ' + ')
}

function ShortcutRow({ label, value, settingKey, onUpdate, hint }: { label: string; value: string; settingKey: string; onUpdate: (key: string, value: unknown) => void; hint?: string }) {
  const [editing, setEditing] = useState(false)
  const [comboParts, setComboParts] = useState<string[]>([])
  const [comboTimer, setComboTimer] = useState<ReturnType<typeof setTimeout> | null>(null)
  const isHoldToTalk = HOLD_TO_TALK_KEYS.has(settingKey)

  const startEditing = () => {
    setComboParts([])
    setEditing(true)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    const { value: newValue, parts } = keyEventToSettingValue(e, settingKey, comboParts)

    if (!isHoldToTalk) {
      // Combo shortcuts: save immediately when a non-modifier key is pressed
      if (newValue) {
        onUpdate(settingKey, newValue)
        setEditing(false)
      }
      return
    }

    // Hold-to-talk: accumulate modifier keys, save after 500ms of no new keys
    if (newValue) {
      setComboParts(parts)
      if (comboTimer) clearTimeout(comboTimer)
      const timer = setTimeout(() => {
        onUpdate(settingKey, newValue)
        setEditing(false)
        setComboParts([])
      }, 500)
      setComboTimer(timer)
    }
  }

  const handleBlur = () => {
    if (comboTimer) clearTimeout(comboTimer)
    // If we have accumulated parts, save them
    if (comboParts.length > 0) {
      onUpdate(settingKey, comboParts.join('+'))
    }
    setEditing(false)
    setComboParts([])
  }

  const editingDisplay = comboParts.length > 0
    ? displayValue(comboParts.join('+')) + ' ...'
    : (isHoldToTalk ? 'Натисни клавиш...' : 'Натисни комбинация...')

  return (
    <div
      className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
      onClick={() => !editing && startEditing()}
    >
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <div className="flex items-center gap-1.5">
        {editing ? (
          <kbd
            tabIndex={0}
            autoFocus
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            ref={(el) => el?.focus()}
            className="px-2.5 py-1 bg-brand-blue/20 dark:bg-brand-blue/30 rounded-md text-xs font-mono text-brand-blue border border-brand-blue shadow-sm animate-pulse outline-none min-w-[80px] text-center"
          >
            {editingDisplay}
          </kbd>
        ) : (
          <kbd className="px-2.5 py-1 bg-white dark:bg-gray-700 rounded-md text-xs font-mono text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 shadow-sm">
            {displayValue(value)}
          </kbd>
        )}
      </div>
    </div>
  )
}
