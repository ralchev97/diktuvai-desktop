import OpenAI from 'openai'
import fs from 'fs'
import { getSetting } from './store'
import { getDictionaryWords } from './db'
import https from 'https'
import FormData from 'form-data'
import path from 'path'

// Cost tracking: stores the cost estimate from the last transcription + cleanup cycle
let lastCostEstimate = 0
export function getLastCostEstimate(): number { return lastCostEstimate }
export function resetCostEstimate(): void { lastCostEstimate = 0 }

let openaiClient: OpenAI | null = null

function getServerConfig() {
  return {
    protocol: https,
    hostname: 'diktuvai.bg',
    port: 443,
  }
}

function getOpenAIClient(): OpenAI {
  const apiKey = getSetting('apiKey')
  if (!apiKey) {
    throw new Error('OpenAI API key not configured')
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

export function resetClient(): void {
  openaiClient = null
  groqClient = null
  cleanupClient = null
}

// Groq client for cleanup (used only in direct mode)
let groqClient: OpenAI | null = null
function getGroqClient(): OpenAI {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) throw new Error('GROQ_API_KEY not set — use server proxy mode')
    groqClient = new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' })
  }
  return groqClient
}

// OpenAI client for transcription + commands (used only in direct mode)
let cleanupClient: OpenAI | null = null
function getCleanupClient(): OpenAI {
  if (!cleanupClient) {
    const apiKey = getSetting('apiKey') || process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('OpenAI API key not configured — use server proxy mode')
    cleanupClient = new OpenAI({ apiKey })
  }
  return cleanupClient
}

/**
 * Transcribe audio — routes through server proxy or direct API based on settings.
 */
export async function transcribeAudio(audioFilePath: string, language?: string): Promise<string> {
  if (getSetting('useServerProxy')) {
    return transcribeViaProxy(audioFilePath, language)
  }
  return transcribeDirect(audioFilePath, language)
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    )
  ])
}

/**
 * Retry wrapper for transient API errors (HTTP 429 rate limit and 5xx server errors).
 * Exponential backoff: 1s, then 2s. Does NOT retry on 4xx errors (except 429).
 */
async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  const delays = [1000, 2000]
  let lastError: unknown

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      return await fn()
    } catch (err: unknown) {
      lastError = err
      const status = (err as { status?: number })?.status
      const isRetryable = status === 429 || (status !== undefined && status >= 500)
      if (!isRetryable || attempt >= delays.length) {
        throw err
      }
      console.log(`[${label}] Retryable error (${status}), retrying in ${delays[attempt]}ms...`)
      await new Promise(resolve => setTimeout(resolve, delays[attempt]))
    }
  }
  throw lastError
}

async function transcribeDirect(audioFilePath: string, language?: string): Promise<string> {
  const langSetting = language || getSetting('language')
  const lang = langSetting === 'auto' ? undefined : langSetting
  const prompt = lang === 'bg'
    ? 'Точна транскрипция на българска реч, дума по дума. Запази всяка дума точно както е казана, включително имена на хора. Не пропускай думи и не ги заменяй.'
    : lang === 'en'
    ? 'Accurate transcription, word by word.'
    : 'Accurate transcription, word by word. The speaker may use Bulgarian or English.'

  // Primary: OpenAI gpt-4o-transcribe (with retry for 429/5xx)
  try {
    const client = getCleanupClient()
    const transcription = await withRetry(() => withTimeout(client.audio.transcriptions.create({
      file: fs.createReadStream(audioFilePath),
      model: 'gpt-4o-transcribe',
      language: lang === 'bg' ? 'bg' : lang === 'en' ? 'en' : undefined,
      response_format: 'text',
      prompt,
    }), 30000, 'Transcription'), 'Transcription')

    // Cost: ~$0.006/min — estimate from file duration (assume 16kHz mono WAV, ~32KB/s)
    const fileSizeBytes = fs.statSync(audioFilePath).size
    const estimatedMinutes = fileSizeBytes / (32000 * 60)
    lastCostEstimate += estimatedMinutes * 0.006

    return transcription as unknown as string
  } catch (primaryErr) {
    console.warn('[Transcription] OpenAI failed, falling back to Groq whisper:', primaryErr)

    // Fallback: Groq whisper-large-v3-turbo (cheaper but less accurate)
    try {
      const groq = getGroqClient()
      const transcription = await withRetry(() => withTimeout(groq.audio.transcriptions.create({
        file: fs.createReadStream(audioFilePath),
        model: 'whisper-large-v3-turbo',
        language: lang === 'bg' ? 'bg' : lang === 'en' ? 'en' : undefined,
        response_format: 'text',
        prompt,
      }), 30000, 'Transcription-Groq-Fallback'), 'Transcription-Groq')

      // Groq whisper is free-tier / very cheap — estimate ~$0.001/min
      const fileSizeBytes = fs.statSync(audioFilePath).size
      const estimatedMinutes = fileSizeBytes / (32000 * 60)
      lastCostEstimate += estimatedMinutes * 0.001

      return transcription as unknown as string
    } catch (fallbackErr) {
      console.error('[Transcription] Groq fallback also failed:', fallbackErr)
      // Throw original error — it's more informative
      throw primaryErr
    }
  }
}

/**
 * Transcribe via server proxy at diktuvai.bg.
 */
async function transcribeViaProxy(audioFilePath: string, language?: string): Promise<string> {
  const authToken = getSetting('authToken')
  const langSetting = language || getSetting('language')

  const form = new FormData()
  form.append('audio', fs.createReadStream(audioFilePath))
  form.append('language', langSetting)
  if (authToken) {
    form.append('token', authToken)
  }

  const srv = getServerConfig()

  return new Promise((resolve, reject) => {
    const req = srv.protocol.request({
      hostname: srv.hostname,
      port: srv.port,
      path: '/api/transcribe',
      method: 'POST',
      headers: { ...form.getHeaders(), ...(authToken ? { 'Authorization': `Bearer ${authToken}` } : {}) }
    }, (res) => {
      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk.toString() })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (parsed.error) reject(new Error(parsed.error))
          else resolve(parsed.text || data)
        } catch {
          resolve(data)
        }
      })
    })

    req.on('error', reject)
    form.pipe(req)
  })
}

/**
 * Clean up transcribed text — routes through server proxy or direct API.
 */
export async function cleanupText(rawText: string, options?: {
  style?: string
  level?: 'low' | 'medium' | 'high'
  polishInstructions?: {
    makeConcise: boolean
    clarifyMainPoint: boolean
    maintainTone: boolean
    rewordForClarity: boolean
    reorderForReadability: boolean
  }
}): Promise<string> {
  if (getSetting('useServerProxy')) {
    return cleanupViaProxy(rawText, options)
  }
  const dictionaryWords = getDictionaryWords()
  const style = options?.style || 'neutral'
  const level = options?.level || getSetting('cleanupLevel')
  const instructions = buildCleanupPrompt(style, dictionaryWords, level, options?.polishInstructions)
  const messages: { role: 'system' | 'user'; content: string }[] = [
    { role: 'system', content: instructions },
    { role: 'user', content: rawText }
  ]

  // Primary: Groq llama-3.3-70b
  try {
    const client = getGroqClient()
    const response = await withRetry(() => withTimeout(client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages,
      temperature: 0.3,
      max_tokens: 4096
    }), 15000, 'Cleanup'), 'Cleanup')

    // Cost: Groq llama-3.3-70b ~$0.0006/1K tokens
    const totalTokens = response.usage?.total_tokens || Math.ceil((rawText.length + instructions.length) / 3)
    lastCostEstimate += (totalTokens / 1000) * 0.0006

    const cleaned = response.choices[0]?.message?.content?.trim() || rawText
    return formatLists(cleaned)
  } catch (groqErr) {
    console.warn('[Cleanup] Groq failed, falling back to OpenAI gpt-4o-mini:', groqErr)

    // Fallback: OpenAI gpt-4o-mini
    try {
      const openaiClient = getCleanupClient()
      const response = await withRetry(() => withTimeout(openaiClient.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.3,
        max_tokens: 4096
      }), 15000, 'Cleanup-OpenAI-Fallback'), 'Cleanup-OpenAI')

      // Cost: gpt-4o-mini ~$0.0003/1K tokens
      const totalTokens = response.usage?.total_tokens || Math.ceil((rawText.length + instructions.length) / 3)
      lastCostEstimate += (totalTokens / 1000) * 0.0003

      const cleaned = response.choices[0]?.message?.content?.trim() || rawText
      return formatLists(cleaned)
    } catch (fallbackErr) {
      console.error('[Cleanup] OpenAI fallback also failed:', fallbackErr)
      // Return raw text rather than crashing — dictation should never be lost
      return rawText
    }
  }
}

/**
 * Post-processor: detect comma-separated items and convert to bulleted lists.
 * Catches cases where the LLM ignores the list formatting instruction.
 */
function formatLists(text: string): string {
  return text.replace(
    /([.:]\s*)([^.:\n]+(?:,\s*[^,.\n]+){2,}(?:\s+(?:and|и|или|or)\s+[^,.\n]+)?)\s*\.?\s*$/gm,
    (_match, prefix: string, items: string) => {
      const parts = items
        .split(/,\s*|\s+(?:and|и|или|or)\s+/)
        .map(s => s.trim())
        .filter(Boolean)
      if (parts.length >= 3 && parts.every(p => p.length < 80)) {
        return prefix.trim() + '\n' + parts.map(p => `• ${p}`).join('\n')
      }
      return _match
    }
  )
}

/**
 * Clean up text via server proxy.
 */
async function cleanupViaProxy(rawText: string, options?: {
  style?: string
  level?: 'low' | 'medium' | 'high'
  polishInstructions?: Record<string, boolean>
}): Promise<string> {
  const authToken = getSetting('authToken')

  const body = JSON.stringify({
    text: rawText,
    token: authToken,
    style: options?.style || 'neutral',
    level: options?.level || getSetting('cleanupLevel'),
    dictionary: getDictionaryWords(),
    polishInstructions: options?.polishInstructions
  })

  return new Promise((resolve, reject) => {
    const srv = getServerConfig()
    const req = srv.protocol.request({
      hostname: srv.hostname,
      port: srv.port,
      path: '/api/cleanup',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk.toString() })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (parsed.error) reject(new Error(parsed.error))
          else resolve(parsed.text || rawText)
        } catch {
          resolve(data || rawText)
        }
      })
    })

    req.on('error', () => resolve(rawText))
    req.write(body)
    req.end()
  })
}

/**
 * Process a voice command on selected text.
 */
export async function processCommand(command: string, selectedText?: string): Promise<string> {
  if (getSetting('useServerProxy')) {
    return processCommandViaProxy(command, selectedText)
  }
  const client = getCleanupClient()

  const systemPrompt = selectedText
    ? `You are a text assistant. The user has selected text and given a voice command to transform it. Apply the command to the selected text. Return ONLY the transformed text, nothing else.`
    : `You are a text assistant. The user has given a voice command. Execute it and return ONLY the result text, nothing else.`

  const userMessage = selectedText
    ? `Selected text: "${selectedText}"\n\nCommand: ${command}`
    : `Command: ${command}`

  const response = await withTimeout(client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    temperature: 0.3,
    max_tokens: 4096
  }), 15000, 'Command')

  return response.choices[0]?.message?.content?.trim() || ''
}

async function processCommandViaProxy(command: string, selectedText?: string): Promise<string> {
  const authToken = getSetting('authToken')

  const body = JSON.stringify({
    command,
    selectedText,
    token: authToken
  })

  return new Promise((resolve, reject) => {
    const srv = getServerConfig()
    const req = srv.protocol.request({
      hostname: srv.hostname,
      port: srv.port,
      path: '/api/command',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = ''
      res.on('data', (chunk: Buffer) => { data += chunk.toString() })
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data)
          if (parsed.error) reject(new Error(parsed.error))
          else resolve(parsed.text || '')
        } catch {
          resolve(data || '')
        }
      })
    })

    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

function buildCleanupPrompt(
  style: string,
  dictionaryWords: string[],
  level: string,
  polishInstructions?: {
    makeConcise: boolean
    clarifyMainPoint: boolean
    maintainTone: boolean
    rewordForClarity: boolean
    reorderForReadability: boolean
  }
): string {
  let prompt = `You are a Bulgarian language expert and text editor for voice dictation. Clean up the following transcription.
CRITICAL: You MUST use correct Bulgarian grammar and spelling. Pay special attention to:
- Verb forms: "допуснеш" (not "допуснаш"), "кажеш" (not "кажаш"), "направиш" (not "направиш")
- Second person singular: always use "е" not "а" in present tense (пишеш, четеш, видиш)
- Preserve the speaker's exact words — do NOT remove content words or replace them with synonyms
- Only remove obvious filler words (ъъъ, ааа, um, uh) and false starts where the speaker restarts a sentence
- NEVER remove words that carry meaning, even if they seem unusual in context`

  if (level === 'low') {
    prompt += `
- Fix only major spelling errors
- Keep the text mostly as spoken`
  } else if (level === 'medium') {
    prompt += `
- Fix grammar, spelling, and punctuation
- Format naturally (capitalize sentences, add periods)
- Remove repeated words and stutters`
  } else {
    prompt += `
- Fix grammar, spelling, and punctuation thoroughly
- Format naturally with proper paragraphs
- Restructure awkward phrasing
- Remove all filler words (ъъъ, ааа, um, uh, значи, нали, като цяло, така, де)`
  }

  prompt += `
- Keep the speaker's intent and meaning exactly
- If the text is in Bulgarian, keep it in Bulgarian. If in English, keep in English.
- When the speaker mentions 3 or more items (e.g. "bread, milk, potatoes" or "first X, second Y, third Z"), ALWAYS format them as a bulleted list with "•" on separate lines, even if the speaker didn't explicitly say "list"
- Apply ${style} tone`

  if (polishInstructions) {
    const active: string[] = []
    if (polishInstructions.makeConcise) active.push('Make the text more concise')
    if (polishInstructions.clarifyMainPoint) active.push('Clarify the main point')
    if (polishInstructions.maintainTone) active.push('Maintain the original tone')
    if (polishInstructions.rewordForClarity) active.push('Reword phrases for better clarity')
    if (polishInstructions.reorderForReadability) active.push('Reorder sentences for better readability')
    if (active.length > 0) {
      prompt += '\n- Additional instructions: ' + active.join('. ')
    }
  }

  if (dictionaryWords.length > 0) {
    prompt += `\n- These custom words should be preserved exactly: ${dictionaryWords.join(', ')}`
  }

  prompt += '\n\nReturn ONLY the cleaned text, nothing else.'

  return prompt
}
