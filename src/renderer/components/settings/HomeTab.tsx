import React, { useEffect, useState } from 'react'
import { t } from '../../i18n'
import { api } from '../../hooks/useAPI'

interface Stats {
  words_today: number
  words_week: number
  words_total: number
  dictations_today: number
  dictations_total: number
  avg_wpm: number
  streak_days: number
}

export default function HomeTab() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    api?.getStats?.()
      .then((s: Stats) => { if (!cancelled) { setStats(s); setLoading(false) } })
      .catch(() => { if (!cancelled) setLoading(false) })
    // Also listen for live updates
    const unsub = api?.onStats?.((s: unknown) => {
      if (!cancelled) { setStats(s as Stats); setLoading(false) }
    })
    return () => { cancelled = true; unsub?.() }
  }, [])

  const avgTypingWpm = 40
  const speedMultiplier = stats?.avg_wpm && stats.avg_wpm > 0
    ? (stats.avg_wpm / avgTypingWpm).toFixed(1)
    : '0'

  // Estimate time saved: total words / typing speed - total words / speaking speed (in minutes)
  const totalWords = stats?.words_total || 0
  const timeSavedMin = totalWords > 0 && stats?.avg_wpm
    ? Math.round(totalWords / avgTypingWpm - totalWords / stats.avg_wpm)
    : 0

  const formatNumber = (n: number) => {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K'
    return n.toString()
  }

  // Show skeleton tiles while the first stats response is pending so the UI
  // doesn't momentarily display zeros (which look like "you've done nothing"
  // to the user even when they have thousands of dictations).
  if (loading && !stats) {
    return (
      <div className="space-y-6 tab-content">
        <div className="grid grid-cols-2 gap-4" aria-busy="true">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl animate-pulse">
              <div className="w-9 h-9 rounded-lg bg-gray-200 dark:bg-gray-700 mb-3" />
              <div className="h-7 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 tab-content">
      {/* Main stats */}
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          value={formatNumber(totalWords)}
          label={t('home.totalWords' as any)}
          icon={
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" />
            </svg>
          }
          color="blue"
        />
        <StatCard
          value={stats?.dictations_total?.toString() || '0'}
          label={t('home.dictations' as any)}
          icon={
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            </svg>
          }
          color="purple"
        />
        <StatCard
          value={`${stats?.avg_wpm || 0}`}
          label={t('home.avgSpeed' as any)}
          sublabel={t('home.wpm' as any)}
          icon={
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          }
          color="yellow"
        />
        <StatCard
          value={`${stats?.streak_days || 0}`}
          label={t('home.streak' as any)}
          icon={
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          }
          color="green"
        />
      </div>

      {/* Speed comparison */}
      {stats?.avg_wpm && stats.avg_wpm > 0 ? (
        <div className="p-4 bg-gradient-to-r from-brand-blue/10 to-purple-500/10 dark:from-brand-blue/20 dark:to-purple-500/20 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">{speedMultiplier}x</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('home.fasterThanTyping' as any)}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{timeSavedMin}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('home.timeSaved' as any)} ({t('home.minutes' as any)})</p>
            </div>
          </div>
        </div>
      ) : null}

      {/* Today / This week */}
      <div className="grid grid-cols-2 gap-4">
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <p className="text-xs text-gray-400 mb-1">{t('home.wordsToday' as any)}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats?.words_today || 0}</p>
        </div>
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <p className="text-xs text-gray-400 mb-1">{t('home.wordsThisWeek' as any)}</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{formatNumber(stats?.words_week || 0)}</p>
        </div>
      </div>
    </div>
  )
}

function StatCard({ value, label, sublabel, icon, color }: {
  value: string
  label: string
  sublabel?: string
  icon: React.ReactNode
  color: 'blue' | 'purple' | 'yellow' | 'green'
}) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 text-blue-500',
    purple: 'bg-purple-50 dark:bg-purple-900/20 text-purple-500',
    yellow: 'bg-amber-50 dark:bg-amber-900/20 text-amber-500',
    green: 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-500',
  }

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${colors[color]}`}>
        {icon}
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-xs text-gray-400">
        {label}{sublabel ? ` (${sublabel})` : ''}
      </p>
    </div>
  )
}
