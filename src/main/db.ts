import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

let db: Database.Database

export interface DictationRecord {
  id: string
  raw_text: string
  cleaned_text: string
  language: string
  app_name: string
  word_count: number
  duration_ms: number
  created_at: string
}

export interface DictionaryWord {
  id: string
  word: string
  created_at: string
}

export interface Snippet {
  id: string
  trigger: string
  content: string
  created_at: string
}

export interface UsageStats {
  words_today: number
  words_week: number
  words_total: number
  dictations_today: number
  dictations_total: number
  avg_wpm: number
  streak_days: number
}

export function initDatabase(): void {
  const dbPath = path.join(app.getPath('userData'), 'diktuvai.db')
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS dictations (
      id TEXT PRIMARY KEY,
      raw_text TEXT NOT NULL,
      cleaned_text TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'bg',
      app_name TEXT DEFAULT '',
      word_count INTEGER DEFAULT 0,
      duration_ms INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS dictionary (
      id TEXT PRIMARY KEY,
      word TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS snippets (
      id TEXT PRIMARY KEY,
      trigger TEXT NOT NULL UNIQUE,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS usage_daily (
      date TEXT PRIMARY KEY,
      word_count INTEGER DEFAULT 0,
      dictation_count INTEGER DEFAULT 0,
      total_duration_ms INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_dictations_created ON dictations(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_dictations_text ON dictations(cleaned_text);
  `)
}

// Dictation History
export function saveDictation(raw: string, cleaned: string, language: string, appName: string, durationMs: number): DictationRecord {
  const id = uuidv4()
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length
  const now = new Date().toISOString()

  db.prepare(`
    INSERT INTO dictations (id, raw_text, cleaned_text, language, app_name, word_count, duration_ms, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, raw, cleaned, language, appName, wordCount, durationMs, now)

  // Update daily usage
  const today = new Date().toISOString().split('T')[0]
  db.prepare(`
    INSERT INTO usage_daily (date, word_count, dictation_count, total_duration_ms)
    VALUES (?, ?, 1, ?)
    ON CONFLICT(date) DO UPDATE SET
      word_count = word_count + ?,
      dictation_count = dictation_count + 1,
      total_duration_ms = total_duration_ms + ?
  `).run(today, wordCount, durationMs, wordCount, durationMs)

  return { id, raw_text: raw, cleaned_text: cleaned, language, app_name: appName, word_count: wordCount, duration_ms: durationMs, created_at: now }
}

export function getHistory(limit = 50, offset = 0): DictationRecord[] {
  return db.prepare('SELECT * FROM dictations ORDER BY created_at DESC LIMIT ? OFFSET ?').all(limit, offset) as DictationRecord[]
}

export function searchHistory(query: string): DictationRecord[] {
  return db.prepare("SELECT * FROM dictations WHERE cleaned_text LIKE ? OR raw_text LIKE ? ORDER BY created_at DESC LIMIT 100")
    .all(`%${query}%`, `%${query}%`) as DictationRecord[]
}

export function deleteDictation(id: string): void {
  db.prepare('DELETE FROM dictations WHERE id = ?').run(id)
}

// Dictionary
export function getDictionary(): DictionaryWord[] {
  return db.prepare('SELECT * FROM dictionary ORDER BY word ASC').all() as DictionaryWord[]
}

export function addWord(word: string): DictionaryWord {
  const id = uuidv4()
  const now = new Date().toISOString()
  db.prepare('INSERT OR IGNORE INTO dictionary (id, word, created_at) VALUES (?, ?, ?)').run(id, word, now)
  return { id, word, created_at: now }
}

export function removeWord(id: string): void {
  db.prepare('DELETE FROM dictionary WHERE id = ?').run(id)
}

export function updateWord(id: string, word: string): void {
  db.prepare('UPDATE dictionary SET word = ? WHERE id = ?').run(word, id)
}

export function getDictionaryWords(): string[] {
  return (db.prepare('SELECT word FROM dictionary ORDER BY word ASC').all() as { word: string }[]).map(r => r.word)
}

// Snippets
export function getSnippets(): Snippet[] {
  return db.prepare('SELECT * FROM snippets ORDER BY trigger ASC').all() as Snippet[]
}

export function addSnippet(trigger: string, content: string): Snippet {
  const id = uuidv4()
  const now = new Date().toISOString()
  db.prepare('INSERT INTO snippets (id, trigger, content, created_at) VALUES (?, ?, ?, ?)').run(id, trigger, content, now)
  return { id, trigger, content, created_at: now }
}

export function removeSnippet(id: string): void {
  db.prepare('DELETE FROM snippets WHERE id = ?').run(id)
}

export function updateSnippet(id: string, trigger: string, content: string): void {
  db.prepare('UPDATE snippets SET trigger = ?, content = ? WHERE id = ?').run(trigger, content, id)
}

// Usage Stats
export function getUsageStats(): UsageStats {
  const today = new Date().toISOString().split('T')[0]
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const todayStats = db.prepare('SELECT word_count, dictation_count, total_duration_ms FROM usage_daily WHERE date = ?').get(today) as
    { word_count: number; dictation_count: number; total_duration_ms: number } | undefined

  const weekStats = db.prepare('SELECT SUM(word_count) as words, SUM(dictation_count) as dictations FROM usage_daily WHERE date >= ?').get(weekAgo) as
    { words: number | null; dictations: number | null }

  const totalStats = db.prepare('SELECT SUM(word_count) as words, SUM(dictation_count) as dictations, SUM(total_duration_ms) as duration FROM usage_daily').get() as
    { words: number | null; dictations: number | null; duration: number | null }

  // Calculate streak
  let streak = 0
  const days = db.prepare('SELECT date FROM usage_daily WHERE dictation_count > 0 ORDER BY date DESC').all() as { date: string }[]
  if (days.length > 0) {
    let checkDate = new Date()
    for (const day of days) {
      const dayDate = new Date(day.date)
      const diff = Math.floor((checkDate.getTime() - dayDate.getTime()) / (1000 * 60 * 60 * 24))
      if (diff <= 1) {
        streak++
        checkDate = dayDate
      } else {
        break
      }
    }
  }

  const totalDurationMin = (totalStats.duration || 0) / 60000
  const totalWords = totalStats.words || 0
  const avgWpm = totalDurationMin > 0 ? Math.round(totalWords / totalDurationMin) : 0

  return {
    words_today: todayStats?.word_count || 0,
    words_week: weekStats.words || 0,
    words_total: totalWords,
    dictations_today: todayStats?.dictation_count || 0,
    dictations_total: totalStats.dictations || 0,
    avg_wpm: avgWpm,
    streak_days: streak
  }
}

export function closeDatabase(): void {
  if (db) db.close()
}
