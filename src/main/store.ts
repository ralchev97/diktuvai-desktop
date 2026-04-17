import Store from 'electron-store'
import crypto from 'crypto'
import os from 'os'
// safeStorage is imported *only* so we can migrate v1.6.0 `enc:` blobs
// forward without data loss. Users who ran v1.6.0 already granted Keychain
// access ("Always Allow"), so calls here are silent for them. v1.6.1+ never
// writes new safeStorage blobs — this import is read-only legacy support.
import { safeStorage } from 'electron'

export interface AppSettings {
  // General
  language: 'bg' | 'en' | 'auto'
  hotkey: string
  commandHotkey: string
  dismissHotkey: string
  undoHotkey: string
  polishPasteHotkey: string
  aiFormatting: boolean
  cleanupLevel: 'low' | 'medium' | 'high'
  microphone: string
  soundEffects: boolean
  muteMusic: boolean
  openAtLogin: boolean
  hideFromDock: boolean

  // Personalization
  autoLearnDictionary: boolean
  writingStyle: {
    work: 'formal' | 'casual' | 'very_casual'
    personal: 'formal' | 'casual' | 'very_casual'
    email: 'formal' | 'casual' | 'very_casual'
  }
  polishInstructions: {
    makeConcise: boolean
    clarifyMainPoint: boolean
    maintainTone: boolean
    rewordForClarity: boolean
    reorderForReadability: boolean
  }

  // Account
  apiKey: string
  authToken: string
  userEmail: string
  deviceId: string
  useServerProxy: boolean

  // Privacy
  contextAwareness: boolean
  shareUsageData: boolean
  privacyMode: boolean

  // Internal
  onboardingComplete: boolean
  uiLocale: 'bg' | 'en'
}

const defaults: AppSettings = {
  language: 'bg',
  hotkey: 'RightOption',
  commandHotkey: 'RightCtrl',
  dismissHotkey: 'Escape',
  undoHotkey: 'CommandOrControl+Z',
  polishPasteHotkey: 'CommandOrControl+Shift+V',
  aiFormatting: true,
  cleanupLevel: 'low',
  microphone: 'default',
  soundEffects: true,
  muteMusic: false,
  openAtLogin: true,
  hideFromDock: false,

  autoLearnDictionary: true,
  writingStyle: {
    work: 'formal',
    personal: 'casual',
    email: 'formal'
  },
  polishInstructions: {
    makeConcise: true,
    clarifyMainPoint: false,
    maintainTone: true,
    rewordForClarity: false,
    reorderForReadability: false
  },

  apiKey: '',
  authToken: '',
  userEmail: '',
  deviceId: '',
  useServerProxy: true,

  contextAwareness: false,
  shareUsageData: false,
  privacyMode: false,

  onboardingComplete: false,
  uiLocale: 'bg'
}

const store = new Store<AppSettings>({
  name: 'diktuvai-settings',
  defaults
})

// ============================================================================
// At-rest secret encryption — silent, no OS prompts.
// ============================================================================
//
// Previous (v1.6.0) versions used Electron's `safeStorage`, which routes
// through the macOS Keychain and triggers an "enter your login password"
// dialog on first use. Consumers found that terrifying. We now derive a
// per-machine AES-256-GCM key from stable local identifiers (hostname,
// username, platform) and encrypt with node's built-in crypto.
//
// Security posture:
//   + Protects against someone copying diktuvai-settings.json to another
//     machine — the derived key changes, ciphertext becomes unreadable.
//   + Protects against casual inspection / screen sharing where the JSON
//     contents are visible.
//   – Does NOT protect against an attacker who can execute code as the
//     same user on the same machine — they can re-derive the key from the
//     same identifiers. For that threat model, only the OS keychain
//     (with its prompt) helps, and we've consciously traded it for UX.
//
// Token lifetime is 90 days server-side and every request is rate-limited
// and device-bound, so the practical value of a stolen token is small.
// ============================================================================

const SECRET_KEYS: ReadonlySet<keyof AppSettings> = new Set(['apiKey', 'authToken'])

const ENC_PREFIX_OLD = 'enc:'      // v1.6.0 safeStorage payloads — now unreadable
const ENC_PREFIX_V2 = 'encv2:'     // v1.6.1+ machine-key AES-256-GCM payloads

let cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (cachedKey) return cachedKey
  // Stable-per-machine inputs. Including platform guards against a scenario
  // where we someday run this code under a different OS kernel with the
  // same home dir contents (e.g. a mounted external volume).
  const material = [
    os.hostname() || 'diktuvai-host',
    os.userInfo().username || 'diktuvai-user',
    process.platform,
  ].join('\x1f')
  // scrypt is intentionally slow but we compute this once per process.
  cachedKey = crypto.scryptSync(material, 'diktuvai:secret:v1', 32)
  return cachedKey
}

function encryptString(plain: string): string {
  if (!plain) return plain
  try {
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv)
    const ct = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
    const tag = cipher.getAuthTag()
    return (
      ENC_PREFIX_V2 +
      iv.toString('base64') + ':' +
      ct.toString('base64') + ':' +
      tag.toString('base64')
    )
  } catch {
    return plain
  }
}

function decryptOldSafeStorage(stored: string): string | null {
  // v1.6.0 format: "enc:<base64-safeStorage-blob>". We try to read it using
  // the OS keychain. For users who already clicked "Always Allow" in v1.6.0
  // this is silent; for a fresh install that never had safeStorage there's
  // nothing to decrypt anyway, so we fail gracefully.
  try {
    if (!safeStorage.isEncryptionAvailable()) return null
    const buf = Buffer.from(stored.slice(ENC_PREFIX_OLD.length), 'base64')
    return safeStorage.decryptString(buf)
  } catch {
    return null
  }
}

function decryptString(stored: string): string {
  if (!stored) return stored
  if (stored.startsWith(ENC_PREFIX_V2)) {
    try {
      const [ivB64, ctB64, tagB64] = stored.slice(ENC_PREFIX_V2.length).split(':')
      const iv = Buffer.from(ivB64, 'base64')
      const ct = Buffer.from(ctB64, 'base64')
      const tag = Buffer.from(tagB64, 'base64')
      const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv)
      decipher.setAuthTag(tag)
      return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8')
    } catch {
      // Key rotation, corrupted payload, or migration between machines.
      return ''
    }
  }
  if (stored.startsWith(ENC_PREFIX_OLD)) {
    // v1.6.0 safeStorage blob — try to decrypt via OS keychain (silent for
    // users who already granted access). Returns '' only if that genuinely
    // fails, in which case the login/API-key flow will kick in.
    return decryptOldSafeStorage(stored) ?? ''
  }
  return stored
}

function isSecretKey(key: string): boolean {
  return SECRET_KEYS.has(key as keyof AppSettings)
}

// ============================================================================

export function getSettings(): AppSettings {
  const raw = store.store
  const out = { ...raw }
  for (const key of SECRET_KEYS) {
    const v = out[key]
    if (typeof v === 'string') {
      ;(out as Record<string, unknown>)[key] = decryptString(v)
    }
  }
  return out
}

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  const v = store.get(key)
  if (isSecretKey(key as string) && typeof v === 'string') {
    return decryptString(v) as AppSettings[K]
  }
  return v
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  if (isSecretKey(key as string) && typeof value === 'string') {
    store.set(key, encryptString(value) as AppSettings[K])
    return
  }
  store.set(key, value)
}

export function setSettings(settings: Partial<AppSettings>): void {
  for (const [key, value] of Object.entries(settings)) {
    setSetting(key as keyof AppSettings, value as never)
  }
}

/**
 * Re-encrypt any plaintext secrets on disk and purge unreadable
 * legacy (`enc:` safeStorage) payloads. Safe to call on every boot —
 * already-migrated entries are left alone.
 */
export function migrateSecretsToEncrypted(): void {
  for (const key of SECRET_KEYS) {
    const v = store.get(key)
    if (typeof v !== 'string' || !v) continue
    if (v.startsWith(ENC_PREFIX_V2)) continue // already in the current format
    if (v.startsWith(ENC_PREFIX_OLD)) {
      // v1.6.0 safeStorage blob. Decrypt via OS keychain (silent for users
      // who already clicked "Always Allow") and re-encrypt with the new
      // machine-derived key so we don't need the keychain going forward.
      const plain = decryptOldSafeStorage(v)
      if (plain) {
        try {
          store.set(key, encryptString(plain) as never)
        } catch {
          /* leave legacy blob in place; decryptString will still try it */
        }
      }
      // If we couldn't decrypt (fresh machine, permission denied, etc.) we
      // leave the legacy value on disk — it does no harm, and we don't want
      // to silently nuke the user's saved credential just because we're
      // running on a host that lacks keychain access.
      continue
    }
    // Plaintext secret from pre-v1.6.0 — encrypt in place.
    try {
      store.set(key, encryptString(v) as never)
    } catch {
      /* leave as plaintext if somehow encryption fails */
    }
  }
}

export default store
