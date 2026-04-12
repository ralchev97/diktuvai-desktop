import React, { useState, useEffect, useCallback, useRef } from 'react'
import { t } from '../../i18n'
import { api } from '../../hooks/useAPI'

interface HistoryItem {
  id: string
  raw_text: string
  cleaned_text: string
  language: string
  app_name: string
  word_count: number
  duration_ms: number
  created_at: string
}

export default function HistoryPanel() {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    setLoading(true)
    const history = await api?.getHistory(100, 0)
    setItems(history || [])
    setLoading(false)
  }

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(async () => {
      if (query.trim()) {
        const results = await api?.searchHistory(query)
        setItems(results || [])
      } else {
        loadHistory()
      }
    }, 300)
  }, [])

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    }
  }, [])

  const handleCopy = async (id: string) => {
    await api?.copyHistoryItem(id)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  const handleDelete = async (id: string) => {
    await api?.deleteHistory(id)
    setItems(items.filter(i => i.id !== id))
  }

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Точно сега'
    if (minutes < 60) return `${minutes} мин`
    if (hours < 24) return `${hours} ч`
    if (days < 7) return `${days} дни`
    return date.toLocaleDateString('bg-BG')
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          {t('history.title')}
        </h2>

        {/* Search */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder={t('history.search')}
            className="w-full pl-9 pr-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue text-gray-900 dark:text-white"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-6 h-6 border-2 border-brand-blue border-t-transparent rounded-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <svg className="w-12 h-12 mb-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M12 8v4l3 3" />
              <circle cx="12" cy="12" r="10" />
            </svg>
            <p className="text-sm">{t('history.noHistory')}</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="group p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white line-clamp-2">
                    {item.cleaned_text}
                  </p>
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-gray-400">{formatTime(item.created_at)}</span>
                    {item.app_name && (
                      <span className="text-xs text-gray-400">{item.app_name}</span>
                    )}
                    <span className="text-xs text-gray-400">
                      {item.word_count} {t('history.words')}
                    </span>
                    <span className="text-xs px-1.5 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-gray-500 dark:text-gray-400">
                      {item.language === 'bg' ? 'BG' : 'EN'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleCopy(item.id)}
                    className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md transition-colors"
                    title="Copy"
                  >
                    {copiedId === item.id ? (
                      <svg className="w-4 h-4 text-brand-green" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-md transition-colors"
                    title="Delete"
                  >
                    <svg className="w-4 h-4 text-gray-500 hover:text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
