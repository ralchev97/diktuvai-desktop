import React, { useState, useRef, useEffect } from 'react'
import { api } from '../../hooks/useAPI'

type Step = 'email' | 'code' | 'success'

export default function LoginStep() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const codeInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === 'code' && codeInputRef.current) {
      codeInputRef.current.focus()
    }
  }, [step])

  const handleRequestCode = async () => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !trimmed.includes('@')) return
    setLoading(true)
    setErrorMsg('')
    try {
      const result = await api?.requestCode(trimmed)
      if (result?.success) {
        setEmail(trimmed)
        setStep('code')
      } else {
        setErrorMsg(result?.error || 'Грешка при изпращане на код')
      }
    } catch {
      setErrorMsg('Грешка при свързване със сървъра')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyCode = async () => {
    const trimmed = code.trim()
    if (trimmed.length !== 6) return
    setLoading(true)
    setErrorMsg('')
    try {
      const result = await api?.verifyCode(email, trimmed)
      if (result?.valid) {
        setStep('success')
      } else {
        setErrorMsg(result?.error || 'Грешен код')
      }
    } catch {
      setErrorMsg('Грешка при свързване със сървъра')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setStep('email')
    setCode('')
    setErrorMsg('')
  }

  return (
    <div className="flex flex-col items-center justify-center h-full">
      {step === 'email' && (
        <>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Влез в DiktuvAI
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm text-center">
            Въведи имейла си — ще ти пратим 6-цифрен код за вход.
            <br />
            <span className="text-brand-blue">Нов потребител? Получаваш 14 дни безплатен Pro trial.</span>
          </p>

          <div className="w-full max-w-sm space-y-4">
            <input
              type="email"
              value={email}
              onChange={e => {
                setEmail(e.target.value)
                setErrorMsg('')
              }}
              placeholder="tvoyat@email.com"
              onKeyDown={e => e.key === 'Enter' && handleRequestCode()}
              autoFocus
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center focus:outline-none focus:ring-2 focus:ring-brand-blue"
            />
            {errorMsg && (
              <p className="text-xs text-red-500 text-center">{errorMsg}</p>
            )}
            <button
              onClick={handleRequestCode}
              disabled={!email.trim() || !email.includes('@') || loading}
              className="w-full py-3 bg-brand-blue hover:bg-brand-blue-dark text-white rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Изпращам...' : 'Изпрати код'}
            </button>
          </div>
        </>
      )}

      {step === 'code' && (
        <>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Провери имейла си
          </h2>
          <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-sm text-center">
            Изпратихме 6-цифрен код на <strong className="text-gray-900 dark:text-white">{email}</strong>.
            Въведи го тук.
          </p>

          <div className="w-full max-w-sm space-y-4">
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={e => {
                const digits = e.target.value.replace(/\D/g, '')
                setCode(digits)
                setErrorMsg('')
                if (digits.length === 6) {
                  // Auto-submit when 6 digits entered
                  setTimeout(() => {
                    const btn = document.getElementById('verify-code-btn') as HTMLButtonElement | null
                    btn?.click()
                  }, 100)
                }
              }}
              placeholder="000000"
              onKeyDown={e => e.key === 'Enter' && handleVerifyCode()}
              className="w-full px-4 py-4 border border-gray-200 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-center text-3xl font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-brand-blue"
            />
            {errorMsg && (
              <p className="text-xs text-red-500 text-center">{errorMsg}</p>
            )}
            <button
              id="verify-code-btn"
              onClick={handleVerifyCode}
              disabled={code.length !== 6 || loading}
              className="w-full py-3 bg-brand-blue hover:bg-brand-blue-dark text-white rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {loading ? 'Проверявам...' : 'Потвърди'}
            </button>
            <button
              onClick={handleBack}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
            >
              ← Смени имейла
            </button>
          </div>
        </>
      )}

      {step === 'success' && (
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-brand-green"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-brand-green font-medium text-lg">Готово! Влязъл си.</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Pro планът ти е активен за 14 дни — без нужда от карта.
          </p>
        </div>
      )}
    </div>
  )
}
