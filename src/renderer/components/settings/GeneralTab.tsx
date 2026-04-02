import React, { useState, useEffect } from 'react'
import { t } from '../../i18n'
import { api } from '../../hooks/useAPI'

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
          <ShortcutRow label={t('settings.commandMode')} value={settings.commandHotkey} settingKey="commandHotkey" onUpdate={onUpdate} />
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
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                settings.language === lang
                  ? 'bg-brand-blue text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {lang === 'bg' ? '🇧🇬 Български' : lang === 'en' ? '🇬🇧 English' : '🌐 Auto'}
            </button>
          ))}
        </div>
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

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors ${
        checked ? 'bg-brand-blue' : 'bg-gray-300 dark:bg-gray-600'
      }`}
    >
      <div className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`} />
    </button>
  )
}

function ShortcutRow({ label, value, settingKey, onUpdate }: { label: string; value: string; settingKey: string; onUpdate: (key: string, value: unknown) => void }) {
  const [editing, setEditing] = useState(false)

  const displayValue = (v: string) => {
    return v
      .replace('CommandOrControl', '⌘')
      .replace('Control', '⌃')
      .replace('Option', '⌥')
      .replace('Alt', '⌥')
      .replace('Shift', '⇧')
      .replace('Escape', 'ESC')
      .replace('+', ' + ')
  }

  return (
    <div className="flex items-center justify-between py-2 px-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
      <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
      <kbd className="px-2.5 py-1 bg-white dark:bg-gray-700 rounded-md text-xs font-mono text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 shadow-sm">
        {displayValue(value)}
      </kbd>
    </div>
  )
}
