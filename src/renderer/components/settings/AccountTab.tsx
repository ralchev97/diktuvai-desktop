import React, { useState, useEffect } from 'react'
import { t } from '../../i18n'
import { api, useStats } from '../../hooks/useAPI'

interface AccountTabProps {
  settings: any
  onUpdate: (key: string, value: unknown) => void
}

export default function AccountTab({ settings, onUpdate }: AccountTabProps) {
  const [license, setLicense] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const licenseStatus = await api?.getLicenseStatus()
    setLicense(licenseStatus)

    // Get stats via IPC
    const s = await (window as any).diktuvai?.getSettings()
    // Stats would be fetched separately
  }

  const planLabels: Record<string, string> = {
    free: t('account.free'),
    trial: t('account.trial'),
    starter: t('account.starter'),
    pro: t('account.pro'),
  }

  const handleSaveApiKey = async () => {
    await onUpdate('apiKey', apiKeyInput)
    await onUpdate('useServerProxy', false)
  }

  const handleUseProxy = async () => {
    await onUpdate('useServerProxy', true)
    await onUpdate('apiKey', '')
    setApiKeyInput('')
  }

  if (!settings) return null

  return (
    <div className="space-y-6 tab-content">
      {/* Plan */}
      <section className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">{t('account.plan')}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {planLabels[license?.plan || 'free'] || t('account.free')}
            </p>
            {license?.plan === 'trial' && license?.trialDaysLeft && (
              <p className="text-xs text-brand-blue mt-1">
                {license.trialDaysLeft} {t('account.trialDaysLeft')}
              </p>
            )}
          </div>
          <button
            onClick={() => api?.openExternal('https://diktuvai.bg/pricing')}
            className="px-4 py-2 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm rounded-lg transition-colors"
          >
            {t('account.upgrade')}
          </button>
        </div>
      </section>

      {/* Usage Stats */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          {t('account.usage')}
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label={t('account.wordsToday')} value={stats?.words_today || 0} />
          <StatCard label={t('account.wordsWeek')} value={stats?.words_week || 0} />
          <StatCard label={t('account.wordsTotal')} value={stats?.words_total || 0} />
          <StatCard label={t('account.dictationsToday')} value={stats?.dictations_today || 0} />
          <StatCard label={t('account.avgWpm')} value={stats?.avg_wpm || 0} />
          <StatCard label={t('account.streak')} value={`${stats?.streak_days || 0} ${t('account.streak').toLowerCase().includes('дни') ? '' : ''}`} />
        </div>
      </section>

      {/* API Key Configuration */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
          {t('account.enterApiKey')}
        </h3>
        <p className="text-xs text-gray-400 mb-3">{t('account.apiKeyDesc')}</p>

        <div className="flex gap-2 mb-3">
          <button
            onClick={handleUseProxy}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              settings.useServerProxy
                ? 'bg-brand-blue text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            {t('account.useProxy')}
          </button>
          <button
            onClick={() => onUpdate('useServerProxy', false)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              !settings.useServerProxy
                ? 'bg-brand-blue text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            {t('account.useOwnKey')}
          </button>
        </div>

        {!settings.useServerProxy && (
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={apiKeyVisible ? 'text' : 'password'}
                value={apiKeyInput || settings.apiKey}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="sk-..."
                className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-brand-blue text-gray-900 dark:text-white pr-10"
              />
              <button
                onClick={() => setApiKeyVisible(!apiKeyVisible)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  {apiKeyVisible ? (
                    <>
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </>
                  ) : (
                    <>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </>
                  )}
                </svg>
              </button>
            </div>
            <button
              onClick={handleSaveApiKey}
              className="px-4 py-2 bg-brand-green hover:bg-green-600 text-white text-sm rounded-lg transition-colors"
            >
              {t('common.save')}
            </button>
          </div>
        )}
      </section>

      {/* Manage / Sign Out */}
      <section className="space-y-2">
        <button
          onClick={() => api?.openExternal('https://diktuvai.bg/pricing')}
          className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors text-left"
        >
          {t('account.manageSub')}
        </button>
        <button
          onClick={async () => {
            await api?.logout()
            onUpdate('userEmail', '')
            onUpdate('apiKey', '')
            loadData()
          }}
          className="w-full px-4 py-2.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-lg transition-colors text-left"
        >
          {t('account.signOut')}
        </button>
      </section>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl text-center">
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-400 mt-0.5">{label}</p>
    </div>
  )
}
