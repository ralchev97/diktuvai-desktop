import React, { useState } from 'react'
import { t } from '../../i18n'
import { api } from '../../hooks/useAPI'

export default function LoginStep() {
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'email' | 'verifying' | 'success' | 'error'>('email')
  const [errorMsg, setErrorMsg] = useState('')

  const handleLogin = async () => {
    if (!email.trim() || !email.includes('@')) return
    setStep('verifying')
    try {
      const result = await api?.loginWithEmail(email.trim())
      if (result?.valid) {
        setStep('success')
      } else {
        setStep('error')
        setErrorMsg(result?.error || 'Акаунтът не е намерен. Регистрирай се на diktuvai.bg')
      }
    } catch {
      setStep('error')
      setErrorMsg('Грешка при свързване със сървъра')
    }
  }

  const handleOpenRegister = () => {
    api?.openExternal('https://diktuvai.bg/register')
  }

  return (
    <div className="flex flex-col items-center justify-center h-full">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {t('onboarding.loginTitle')}
      </h2>
      <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm text-center">
        Влез с имейла си и планът ти ще се активира автоматично.
      </p>

      {step === 'success' ? (
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-brand-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-brand-green font-medium">Готово! Планът ти е активиран.</p>
        </div>
      ) : (
        <div className="w-full max-w-sm space-y-4">
          {/* Email input */}
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setStep('email') }}
              placeholder="tvoyat@email.com"
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-brand-blue"
            />
            {step === 'error' && (
              <p className="text-xs text-red-500 mt-2 text-center">{errorMsg}</p>
            )}
          </div>

          <button
            onClick={handleLogin}
            disabled={!email.trim() || !email.includes('@') || step === 'verifying'}
            className="w-full py-3 bg-brand-blue hover:bg-brand-blue-dark text-white rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {step === 'verifying' ? 'Проверявам...' : 'Влез с имейл'}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
            <span className="text-xs text-gray-400">или</span>
            <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700" />
          </div>

          <button
            onClick={handleOpenRegister}
            className="w-full py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
          >
            Нямам акаунт — регистрация
          </button>

          <p className="text-xs text-gray-400 text-center">
            Регистрирай се на diktuvai.bg, после влез тук с имейла си.
            Планът ти се синхронизира автоматично.
          </p>
        </div>
      )}
    </div>
  )
}
