import React from 'react'
import { t } from '../../i18n'
import Toggle from '../ui/Toggle'

interface PrivacyTabProps {
  settings: any
  onUpdate: (key: string, value: unknown) => void
}

export default function PrivacyTab({ settings, onUpdate }: PrivacyTabProps) {
  if (!settings) return null

  return (
    <div className="space-y-4 tab-content">
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl mb-6">
        <p className="text-sm text-blue-700 dark:text-blue-300">
          DiktuvAI обработва аудиото чрез OpenAI API. Аудио файловете не се съхраняват на сървърите ни след обработката.
        </p>
      </div>

      {/* Context Awareness */}
      <div className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
        <div className="flex-1 mr-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            {t('privacy.contextAwareness')}
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            {t('privacy.contextAwarenessDesc')}
          </p>
        </div>
        <Toggle checked={settings.contextAwareness} onChange={(v) => onUpdate('contextAwareness', v)} />
      </div>

      {/* Share Usage Data */}
      <div className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
        <div className="flex-1 mr-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            {t('privacy.shareUsage')}
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            {t('privacy.shareUsageDesc')}
          </p>
        </div>
        <Toggle checked={settings.shareUsageData} onChange={(v) => onUpdate('shareUsageData', v)} />
      </div>

      {/* Privacy Mode */}
      <div className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
        <div className="flex-1 mr-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
            {t('privacy.privacyMode')}
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            {t('privacy.privacyModeDesc')}
          </p>
        </div>
        <Toggle checked={settings.privacyMode} onChange={(v) => onUpdate('privacyMode', v)} />
      </div>

      {/* Data info */}
      <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
        <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
          Какво се съхранява локално
        </h4>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-brand-green flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            История на диктуване (само на вашия компютър)
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-brand-green flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Личен речник и снипети
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-brand-green flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Настройки на приложението
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-4 h-4 text-red-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            Аудио записи НЕ се съхраняват
          </li>
        </ul>
      </div>
    </div>
  )
}