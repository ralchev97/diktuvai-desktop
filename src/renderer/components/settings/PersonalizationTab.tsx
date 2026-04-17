import React, { useState, useEffect, useRef } from 'react'
import { t } from '../../i18n'
import { api } from '../../hooks/useAPI'
import Toggle from '../ui/Toggle'

interface PersonalizationTabProps {
  settings: any
  onUpdate: (key: string, value: unknown) => void
}

export default function PersonalizationTab({ settings, onUpdate }: PersonalizationTabProps) {
  const [dictionary, setDictionary] = useState<any[]>([])
  const [snippets, setSnippets] = useState<any[]>([])
  const [newWord, setNewWord] = useState('')
  const [newTrigger, setNewTrigger] = useState('')
  const [newContent, setNewContent] = useState('')
  const [error, setError] = useState<string>('')
  const errorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    loadData()
    // Clean up a pending flash timer on unmount so we don't setState on an
    // unmounted component (React StrictMode warning, real bug in slow envs).
    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current)
    }
  }, [])

  const loadData = async () => {
    try {
      const dict = await api?.getDictionary()
      const snips = await api?.getSnippets()
      if (dict) setDictionary(dict)
      if (snips) setSnippets(snips)
    } catch (e) {
      setError('Не мога да заредя личните данни. Рестартирай приложението.')
    }
  }

  const flashError = (msg: string) => {
    setError(msg)
    if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current)
    errorTimeoutRef.current = setTimeout(() => {
      errorTimeoutRef.current = null
      setError('')
    }, 4000)
  }

  const handleAddWord = async () => {
    if (!newWord.trim()) return
    try {
      const word = await api?.addWord(newWord.trim())
      if (word) {
        setDictionary([...dictionary, word])
        setNewWord('')
      } else {
        flashError('Думата не беше добавена. Провери дали вече съществува.')
      }
    } catch {
      flashError('Грешка при добавяне на думата.')
    }
  }

  const handleRemoveWord = async (id: string) => {
    const prev = dictionary
    setDictionary(dictionary.filter(w => w.id !== id)) // optimistic
    try {
      await api?.removeWord(id)
    } catch {
      setDictionary(prev) // revert
      flashError('Думата не беше премахната.')
    }
  }

  const handleAddSnippet = async () => {
    if (!newTrigger.trim() || !newContent.trim()) return
    try {
      const snippet = await api?.addSnippet(newTrigger.trim(), newContent.trim())
      if (snippet) {
        setSnippets([...snippets, snippet])
        setNewTrigger('')
        setNewContent('')
      } else {
        flashError('Снипетът не беше добавен. Провери дали триггърът е уникален.')
      }
    } catch {
      flashError('Грешка при добавяне на снипета.')
    }
  }

  const handleRemoveSnippet = async (id: string) => {
    const prev = snippets
    setSnippets(snippets.filter(s => s.id !== id)) // optimistic
    try {
      await api?.removeSnippet(id)
    } catch {
      setSnippets(prev) // revert
      flashError('Снипетът не беше премахнат.')
    }
  }

  if (!settings) return null

  return (
    <div className="space-y-6 tab-content">
      {error && (
        <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300" role="alert">
          {error}
        </div>
      )}
      {/* Dictionary */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              {t('personalization.dictionary')}
            </h3>
            <p className="text-xs text-gray-400">{t('personalization.dictionaryDesc')}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">{t('personalization.autoLearn')}</span>
            <Toggle checked={settings.autoLearnDictionary} onChange={(v) => onUpdate('autoLearnDictionary', v)} />
          </div>
        </div>

        {/* Add word */}
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newWord}
            onChange={(e) => setNewWord(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddWord()}
            placeholder={t('personalization.addWord')}
            className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue text-gray-900 dark:text-white"
          />
          <button
            onClick={handleAddWord}
            className="px-4 py-2 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm rounded-lg transition-colors"
          >
            {t('common.add')}
          </button>
        </div>

        {/* Word list */}
        <div className="max-h-32 overflow-y-auto space-y-1">
          {dictionary.map((word) => (
            <div key={word.id} className="flex items-center justify-between px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <span className="text-sm text-gray-700 dark:text-gray-300">{word.word}</span>
              <button
                onClick={() => handleRemoveWord(word.id)}
                className="text-gray-400 hover:text-red-500 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
          {dictionary.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">Няма думи в речника</p>
          )}
        </div>
      </section>

      {/* Snippets */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
          {t('personalization.snippets')}
        </h3>
        <p className="text-xs text-gray-400 mb-3">{t('personalization.snippetsDesc')}</p>

        {/* Add snippet */}
        <div className="space-y-2 mb-3">
          <input
            type="text"
            value={newTrigger}
            onChange={(e) => setNewTrigger(e.target.value)}
            placeholder={t('personalization.trigger')}
            className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue text-gray-900 dark:text-white"
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder={t('personalization.content')}
            rows={2}
            className="w-full px-3 py-2 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-blue text-gray-900 dark:text-white resize-none"
          />
          <button
            onClick={handleAddSnippet}
            className="px-4 py-2 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm rounded-lg transition-colors"
          >
            {t('personalization.addSnippet')}
          </button>
        </div>

        {/* Snippet list */}
        <div className="max-h-32 overflow-y-auto space-y-1">
          {snippets.map((snippet) => (
            <div key={snippet.id} className="flex items-start justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-brand-blue">"{snippet.trigger}"</p>
                <p className="text-xs text-gray-500 truncate">{snippet.content}</p>
              </div>
              <button
                onClick={() => handleRemoveSnippet(snippet.id)}
                className="text-gray-400 hover:text-red-500 transition-colors ml-2 mt-0.5"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
          {snippets.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-2">Няма снипети</p>
          )}
        </div>
      </section>

      {/* Writing Styles */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          {t('personalization.writingStyles')}
        </h3>
        <div className="space-y-2">
          {(['work', 'personal', 'email'] as const).map((context) => (
            <div key={context} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <span className="text-sm text-gray-700 dark:text-gray-300">
                {t(`personalization.${context}` as any)}
              </span>
              <select
                value={settings.writingStyle?.[context] || 'formal'}
                onChange={(e) => onUpdate('writingStyle', { ...settings.writingStyle, [context]: e.target.value })}
                className="px-2 py-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-md text-xs text-gray-700 dark:text-gray-300 focus:outline-none"
              >
                <option value="formal">{t('personalization.formal')}</option>
                <option value="casual">{t('personalization.casual')}</option>
                <option value="very_casual">{t('personalization.veryCasual')}</option>
              </select>
            </div>
          ))}
        </div>
      </section>

      {/* Polish Instructions */}
      <section>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          {t('personalization.polishInstructions')}
        </h3>
        <div className="space-y-2">
          {([
            ['makeConcise', t('personalization.makeConcise')],
            ['clarifyMainPoint', t('personalization.clarifyMainPoint')],
            ['maintainTone', t('personalization.maintainTone')],
            ['rewordForClarity', t('personalization.rewordForClarity')],
            ['reorderForReadability', t('personalization.reorderForReadability')],
          ] as const).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
              <Toggle
                checked={settings.polishInstructions?.[key] || false}
                onChange={(v) => onUpdate('polishInstructions', { ...settings.polishInstructions, [key]: v })}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}