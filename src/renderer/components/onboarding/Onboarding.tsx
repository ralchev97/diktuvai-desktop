import React, { useState } from 'react'
import { t } from '../../i18n'
import { api } from '../../hooks/useAPI'
import WelcomeStep from './WelcomeStep'
import MicPermissionStep from './MicPermissionStep'
import AccessibilityStep from './AccessibilityStep'
import LanguageStep from './LanguageStep'
import HotkeyStep from './HotkeyStep'
import TestStep from './TestStep'
import LoginStep from './LoginStep'

interface OnboardingProps {
  onComplete: () => void
}

const STEPS = [
  'welcome',
  'mic',
  'accessibility',
  'language',
  'hotkey',
  'test',
  'login'
] as const

type Step = typeof STEPS[number]

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState<number>(0)
  const step = STEPS[currentStep]

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleFinish()
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleFinish = async () => {
    await api?.completeOnboarding()
    onComplete()
  }

  const renderStep = () => {
    switch (step) {
      case 'welcome': return <WelcomeStep />
      case 'mic': return <MicPermissionStep />
      case 'accessibility': return <AccessibilityStep />
      case 'language': return <LanguageStep />
      case 'hotkey': return <HotkeyStep />
      case 'test': return <TestStep />
      case 'login': return <LoginStep />
    }
  }

  return (
    <div className="h-screen flex flex-col bg-white dark:bg-gray-900">
      {/* Progress bar */}
      <div className="pt-12 px-8">
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= currentStep ? 'bg-brand-blue' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-8 py-6 overflow-y-auto no-drag">
        <div className="animate-fadeIn">
          {renderStep()}
        </div>
      </div>

      {/* Navigation */}
      <div className="px-8 py-6 flex justify-between items-center border-t border-gray-100 dark:border-gray-800 no-drag">
        <button
          onClick={handleBack}
          className={`px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors ${
            currentStep === 0 ? 'invisible' : ''
          }`}
        >
          {t('onboarding.back')}
        </button>

        <div className="flex gap-3">
          {step === 'login' && (
            <button
              onClick={handleFinish}
              className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 transition-colors"
            >
              {t('onboarding.skipForNow')}
            </button>
          )}
          <button
            onClick={step === 'login' ? handleFinish : handleNext}
            className="px-6 py-2 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-medium rounded-lg transition-colors"
          >
            {step === 'login' ? t('onboarding.finish') : t('onboarding.next')}
          </button>
        </div>
      </div>
    </div>
  )
}
