import React, { useState, useEffect } from 'react'
import { t } from '../../i18n'
import { api } from '../../hooks/useAPI'

interface AccountTabProps {
  settings: any
  onUpdate: (key: string, value: unknown) => void
}

export default function AccountTab({ settings, onUpdate }: AccountTabProps) {
  const [license, setLicense] = useState<any>(null)
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [upgrading, setUpgrading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const licenseStatus = await api?.getLicenseStatus()
    setLicense(licenseStatus)
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

  const handleUpgrade = async (plan: 'starter' | 'pro') => {
    setUpgrading(true)
    setMsg(null)
    try {
      const result = await api?.getCheckoutUrl(plan, 'monthly')
      if (result?.url) {
        await api?.openExternal(result.url)
        setMsg('Отворих Stripe в браузъра ти. След плащането натисни „Обнови статуса".')
      } else {
        setMsg(result?.error || 'Грешка при създаване на плащане')
      }
    } finally {
      setUpgrading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    setMsg(null)
    try {
      const fresh = await api?.refreshLicense()
      setLicense(fresh)
      if (fresh?.plan === 'pro' || fresh?.plan === 'starter') {
        setMsg(`Планът ти е: ${planLabels[fresh.plan]}`)
      } else {
        setMsg('Няма активен платен план. Ако току-що плати, изчакай 10 секунди и опитай пак.')
      }
    } finally {
      setRefreshing(false)
    }
  }

  const handleManageSub = async () => {
    const result = await api?.getPortalUrl()
    if (result?.url) {
      await api?.openExternal(result.url)
    } else {
      setMsg(result?.error || 'Няма активен абонамент')
    }
  }

  if (!settings) return null

  const planKey = license?.plan || 'free'
  const isPaid = planKey === 'pro' || planKey === 'starter'
  const trialDaysLeft = license?.trialDaysLeft

  return (
    <div className="space-y-6 tab-content">
      {/* Plan */}
      <section className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mb-1">{t('account.plan')}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {planLabels[planKey] || t('account.free')}
            </p>
            {license?.email && (
              <p className="text-xs text-gray-500 mt-0.5">{license.email}</p>
            )}
            {typeof trialDaysLeft === 'number' && trialDaysLeft > 0 && (
              <p className="text-xs text-brand-blue mt-1">
                Trial: още {trialDaysLeft} {trialDaysLeft === 1 ? 'ден' : 'дни'}
              </p>
            )}
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3 py-2 bg-white/60 dark:bg-gray-800/60 hover:bg-white dark:hover:bg-gray-700 text-xs text-gray-700 dark:text-gray-300 rounded-lg transition-colors disabled:opacity-50"
          >
            {refreshing ? 'Обновявам...' : 'Обнови статуса'}
          </button>
        </div>
      </section>

      {/* Upgrade buttons */}
      {!isPaid && (
        <section>
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
            Надгради плана
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleUpgrade('starter')}
              disabled={upgrading}
              className="p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-brand-blue transition-colors text-left disabled:opacity-50"
            >
              <p className="font-semibold text-gray-900 dark:text-white">Стартов</p>
              <p className="text-xs text-gray-500 mt-1">€5/месец</p>
              <p className="text-xs text-gray-400 mt-2">10 000 думи/седмица</p>
            </button>
            <button
              onClick={() => handleUpgrade('pro')}
              disabled={upgrading}
              className="p-4 border-2 border-brand-blue rounded-xl bg-brand-blue/5 text-left disabled:opacity-50"
            >
              <p className="font-semibold text-brand-blue">Pro</p>
              <p className="text-xs text-gray-500 mt-1">€10/месец</p>
              <p className="text-xs text-gray-400 mt-2">Неограничено + команди</p>
            </button>
          </div>
          {upgrading && (
            <p className="text-xs text-gray-500 mt-2 text-center">Отварям Stripe...</p>
          )}
        </section>
      )}

      {isPaid && (
        <button
          onClick={handleManageSub}
          className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg transition-colors"
        >
          {t('account.manageSub')}
        </button>
      )}

      {msg && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 text-xs text-brand-blue rounded-lg">
          {msg}
        </div>
      )}

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
                onChange={e => setApiKeyInput(e.target.value)}
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

      {/* Sign Out */}
      <section>
        <button
          onClick={async () => {
            await api?.logout()
            onUpdate('userEmail', '')
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
