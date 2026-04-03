import OpenAI from 'openai'
import fs from 'fs'
import { getSetting } from './store'
import { getDictionaryWords } from './db'
import https from 'https'
import http from 'http'
import FormData from 'form-data'
import path from 'path'

let openaiClient: OpenAI | null = null

function getServerConfig() {
  const isDev = !require('electron').app.isPackaged
  return {
    protocol: isDev ? http : https,
    hostname: isDev ? 'localhost' : 'diktuvai.bg',
    port: isDev ? 3000 : 443,
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
}

// Groq client for Whisper STT (8.5x cheaper)
let groqClient: OpenAI | null = null
function getGroqClient(): OpenAI {
  if (!groqClient) {
    // In dev mode, use hardcoded key; in prod, use server proxy
    const apiKey = process.env.GROQ_API_KEY || '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'
    groqClient = new OpenAI({ apiKey, baseURL: 'https://api.groq.com/openai/v1' })
  }
  return groqClient
}

// OpenAI client for text cleanup (GPT-4o-mini)
let cleanupClient: OpenAI | null = null
function getCleanupClient(): OpenAI {
  if (!cleanupClient) {
    const apiKey = getSetting('apiKey') || process.env.OPENAI_API_KEY || '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'
    cleanupClient = new OpenAI({ apiKey })
  }
  return cleanupClient
}

/**
 * Transcribe audio using Groq Whisper API (direct, no proxy).
 */
export async function transcribeAudio(audioFilePath: string, language?: string): Promise<string> {
  const client = getCleanupClient() // OpenAI client for gpt-4o-transcribe
  const langSetting = language || getSetting('language')
  const lang = langSetting === 'auto' ? undefined : langSetting

  const transcription = await client.audio.transcriptions.create({
    file: fs.createReadStream(audioFilePath),
    model: 'gpt-4o-transcribe',
    language: lang === 'bg' ? 'bg' : lang === 'en' ? 'en' : undefined,
    response_format: 'text',
    prompt: lang === 'bg'
      ? 'Точна транскрипция на българска реч, дума по дума. Запази всяка дума точно както е казана, включително имена на хора. Не пропускай думи и не ги заменяй.'
      : undefined,
  })

  return transcription as unknown as string
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
 * Clean up transcribed text using GPT-4o.
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
  // Use Groq for cleanup too — much faster inference than OpenAI
  const client = getGroqClient()
  const dictionaryWords = getDictionaryWords()
  const style = options?.style || 'neutral'
  const level = options?.level || getSetting('cleanupLevel')

  let instructions = buildCleanupPrompt(style, dictionaryWords, level, options?.polishInstructions)

  const response = await client.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: instructions },
      { role: 'user', content: rawText }
    ],
    temperature: 0.3,
    max_tokens: 4096
  })

  return response.choices[0]?.message?.content?.trim() || rawText
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
  const client = getCleanupClient()

  const systemPrompt = selectedText
    ? `You are a text assistant. The user has selected text and given a voice command to transform it. Apply the command to the selected text. Return ONLY the transformed text, nothing else.`
    : `You are a text assistant. The user has given a voice command. Execute it and return ONLY the result text, nothing else.`

  const userMessage = selectedText
    ? `Selected text: "${selectedText}"\n\nCommand: ${command}`
    : `Command: ${command}`

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ],
    temperature: 0.3,
    max_tokens: 4096
  })

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
