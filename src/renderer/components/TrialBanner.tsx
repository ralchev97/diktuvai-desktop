import React, { useEffect, useState } from 'react'
import { api } from '../hooks/useAPI'

type BannerKind =
  | 'trial-ending'      // trialDaysLeft <= 3, still on trial
  | 'trial-expired'     // was trial, subscription.status = trial_expired
  | 'subscription-expired' // paid sub ended
  | 'past-due'          // payment failed, card needs updating
  | 'payment-success'   // toast after Stripe return
  | null

interface BannerState {
  kind: BannerKind
  daysLeft?: number
  plan?: string
}

/**
 * Cross-view banner that surfaces trial/subscription lifecycle events so
 * users don't have to open the Account tab to learn their trial is ending
 * (or that their plan quietly dropped to free). Polls the cached license
 * status every minute and reacts immediately when the main process pushes
 * a fresh refresh via `license:updated` (e.g. after Stripe checkout).
 */
export default function TrialBanner() {
  const [banner, setBanner] = useState<BannerState>({ kind: null })
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())
  const [upgrading, setUpgrading] = useState(false)

  const computeBanner = (lic: any): BannerState => {
    if (!lic) return { kind: null }
    const plan = lic.plan as string
    const status = lic.subscriptionStatus as string | null
    const days = lic.trialDaysLeft as number | null

    // Past-due paid plan has highest priority — user is about to lose access.
    if (status === 'past_due') return { kind: 'past-due', plan }
    // Expired paid subscription.
    if (status === 'expired' || (status === 'canceled' && plan === 'free')) {
      return { kind: 'subscription-expired', plan }
    }
    // Expired trial (server downgraded to free).
    if (status === 'trial_expired' && plan === 'free') {
      return { kind: 'trial-expired', plan }
    }
    // Active trial, within 3 days of expiry.
    if (status === 'trialing' && typeof days === 'number' && days <= 3 && days >= 0) {
      return { kind: 'trial-ending', daysLeft: days, plan }
    }
    return { kind: null }
  }

  useEffect(() => {
    let cancelled = false

    const pull = async () => {
      try {
        const lic = await api?.getLicenseStatus()
        if (!cancelled) setBanner(computeBanner(lic))
      } catch {
        /* ignore — network blip, try again next tick */
      }
    }

    pull()
    const interval = setInterval(pull, 60_000)

    const unsubLicense = api?.onLicenseUpdated?.(async ({ reason, license }) => {
      if (reason === 'deep-link') {
        // Post-checkout return. Show a success toast for 8 seconds, then
        // fall back to whatever the normal banner logic says.
        setBanner({ kind: 'payment-success' })
        setTimeout(() => {
          if (cancelled) return
          setBanner(computeBanner(license))
        }, 8000)
      } else {
        setBanner(computeBanner(license))
      }
    })

    return () => {
      cancelled = true
      clearInterval(interval)
      unsubLicense?.()
    }
  }, [])

  const handleUpgrade = async (plan: 'starter' | 'pro') => {
    setUpgrading(true)
    try {
      const result = await api?.getCheckoutUrl(plan, 'monthly')
      if (result?.url) await api?.openExternal(result.url)
    } finally {
      setUpgrading(false)
    }
  }

  const handleManage = async () => {
    try {
      const result = await api?.getPortalUrl()
      if (result?.url) await api?.openExternal(result.url)
    } catch {
      /* silent */
    }
  }

  if (!banner.kind) return null

  // Allow dismissing the "3 days left" gentle nudge — but not the hard
  // ones (expired, past-due), which should stay visible until resolved.
  const canDismiss = banner.kind === 'trial-ending' || banner.kind === 'payment-success'
  const dismissKey =
    banner.kind === 'trial-ending' ? `trial-ending-${banner.daysLeft}` : banner.kind
  if (canDismiss && dismissed.has(dismissKey || '')) return null

  const palette: Record<Exclude<BannerKind, null>, string> = {
    'trial-ending': 'bg-blue-600',
    'trial-expired': 'bg-amber-600',
    'subscription-expired': 'bg-amber-600',
    'past-due': 'bg-red-600',
    'payment-success': 'bg-green-600',
  }

  const renderContent = () => {
    switch (banner.kind) {
      case 'trial-ending': {
        const d = banner.daysLeft ?? 0
        const word = d === 1 ? 'ден' : 'дни'
        return (
          <>
            <p className="text-sm font-semibold">
              Trial-ът ти изтича {d === 0 ? 'днес' : `след ${d} ${word}`}
            </p>
            <p className="text-xs opacity-90 mt-0.5">
              След това ще паднеш на безплатния план (1 000 думи/седмица).
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleUpgrade('pro')}
                disabled={upgrading}
                className="px-3 py-1.5 bg-white text-blue-700 text-xs font-semibold rounded-md hover:bg-gray-100 disabled:opacity-60"
              >
                Pro €10/мес
              </button>
              <button
                onClick={() => handleUpgrade('starter')}
                disabled={upgrading}
                className="px-3 py-1.5 bg-blue-500 text-white text-xs font-semibold rounded-md hover:bg-blue-400 disabled:opacity-60"
              >
                Starter €5/мес
              </button>
            </div>
          </>
        )
      }
      case 'trial-expired':
        return (
          <>
            <p className="text-sm font-semibold">Trial-ът ти приключи</p>
            <p className="text-xs opacity-90 mt-0.5">
              Акаунтът ти е на безплатния план. Надгради за пълни възможности.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleUpgrade('pro')}
                disabled={upgrading}
                className="px-3 py-1.5 bg-white text-amber-700 text-xs font-semibold rounded-md hover:bg-gray-100 disabled:opacity-60"
              >
                Pro €10/мес
              </button>
              <button
                onClick={() => handleUpgrade('starter')}
                disabled={upgrading}
                className="px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-md hover:bg-amber-400 disabled:opacity-60"
              >
                Starter €5/мес
              </button>
            </div>
          </>
        )
      case 'subscription-expired':
        return (
          <>
            <p className="text-sm font-semibold">Абонаментът ти изтече</p>
            <p className="text-xs opacity-90 mt-0.5">
              Акаунтът ти е на безплатния план. Възобнови, за да продължиш с Pro.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleUpgrade('pro')}
                disabled={upgrading}
                className="px-3 py-1.5 bg-white text-amber-700 text-xs font-semibold rounded-md hover:bg-gray-100 disabled:opacity-60"
              >
                Възобнови Pro
              </button>
            </div>
          </>
        )
      case 'past-due':
        return (
          <>
            <p className="text-sm font-semibold">Плащането ти не успя</p>
            <p className="text-xs opacity-90 mt-0.5">
              Обнови картата си, за да запазиш Pro. Акаунтът скоро ще падне на free.
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleManage}
                className="px-3 py-1.5 bg-white text-red-700 text-xs font-semibold rounded-md hover:bg-gray-100"
              >
                Обнови картата
              </button>
            </div>
          </>
        )
      case 'payment-success':
        return (
          <>
            <p className="text-sm font-semibold">Плащането е успешно!</p>
            <p className="text-xs opacity-90 mt-0.5">
              Новият план е активен. Приятно диктуване.
            </p>
          </>
        )
      default:
        return null
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-4 right-4 z-40 max-w-xs ${palette[banner.kind]} text-white rounded-xl shadow-2xl p-4 animate-fadeIn`}
      style={{ animation: 'fadeIn 0.2s ease-out' }}
    >
      {canDismiss && (
        <button
          onClick={() => setDismissed(prev => new Set(prev).add(dismissKey || ''))}
          aria-label="Затвори"
          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20 text-white/80 hover:text-white"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
      <div className="pr-6">{renderContent()}</div>
    </div>
  )
}
