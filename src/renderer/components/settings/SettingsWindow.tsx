import React, { useState } from 'react'
import { t } from '../../i18n'
import { useSettings } from '../../hooks/useAPI'
import GeneralTab from './GeneralTab'
import PersonalizationTab from './PersonalizationTab'
import AccountTab from './AccountTab'
import PrivacyTab from './PrivacyTab'

type Tab = 'general' | 'personalization' | 'account' | 'privacy'

export default function SettingsWindow() {
  const [activeTab, setActiveTab] = useState<Tab>('general')
  const { settings, loading, updateSetting } = useSettings()

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'general',
      label: t('nav.general'),
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
      )
    },
    {
      id: 'personalization',
      label: t('nav.personalization'),
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      )
    },
    {
      id: 'account',
      label: t('nav.account'),
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="5" width="20" height="14" rx="2" />
          <line x1="2" y1="10" x2="22" y2="10" />
        </svg>
      )
    },
    {
      id: 'privacy',
      label: t('nav.privacy'),
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
      )
    }
  ]

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-brand-blue border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
      {/* Title bar area */}
      <div className="h-12 flex items-center justify-center shrink-0">
        <h1 className="text-sm font-semibold text-gray-900 dark:text-white">
          {t('app.name')}
        </h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div className="w-48 bg-gray-50/80 dark:bg-gray-800/50 p-3 space-y-0.5 shrink-0 no-drag">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                activeTab === tab.id
                  ? 'bg-brand-blue text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200/60 dark:hover:bg-gray-700/50'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 no-drag">
          {activeTab === 'general' && <GeneralTab settings={settings} onUpdate={updateSetting} />}
          {activeTab === 'personalization' && <PersonalizationTab settings={settings} onUpdate={updateSetting} />}
          {activeTab === 'account' && <AccountTab settings={settings} onUpdate={updateSetting} />}
          {activeTab === 'privacy' && <PrivacyTab settings={settings} onUpdate={updateSetting} />}
        </div>
      </div>
    </div>
  )
}
