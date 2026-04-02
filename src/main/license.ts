import https from 'https'
import { getSetting, setSetting } from './store'

export interface LicenseStatus {
  valid: boolean
  plan: 'free' | 'trial' | 'starter' | 'pro'
  email: string | null
  expiresAt: string | null
  features: {
    commandMode: boolean
    unlimitedDictations: boolean
    customStyles: boolean
    snippets: boolean
    snippetLimit: number
    dictionaryLimit: number
    weeklyWordLimit: number
    priority: boolean
  }
}

const FREE_STATUS: LicenseStatus = {
  valid: true,
  plan: 'free',
  email: null,
  expiresAt: null,
  features: {
    commandMode: false,
    unlimitedDictations: false,
    customStyles: false,
    snippets: false,
    snippetLimit: 0,
    dictionaryLimit: 20,
    weeklyWordLimit: 1000,
    priority: false
  }
}

const STARTER_FEATURES: LicenseStatus['features'] = {
  commandMode: false,
  unlimitedDictations: false,
  customStyles: false,
  snippets: true,
  snippetLimit: 10,
  dictionaryLimit: 200,
  weeklyWordLimit: 10000,
  priority: false
}

const PRO_FEATURES: LicenseStatus['features'] = {
  commandMode: true,
  unlimitedDictations: true,
  customStyles: true,
  snippets: true,
  snippetLimit: -1, // unlimited
  dictionaryLimit: -1, // unlimited
  weeklyWordLimit: -1, // unlimited
  priority: true
}

let cachedStatus: LicenseStatus | null = null
let lastCheck: number = 0
const CHECK_INTERVAL = 3600000 // 1 hour

function featuresForPlan(plan: string): LicenseStatus['features'] {
  switch (plan) {
    case 'pro': return PRO_FEATURES
    case 'starter': return STARTER_FEATURES
    default: return FREE_STATUS.features
  }
}

/**
 * Login with email — checks subscription on the server.
 */
export async function loginWithEmail(email: string): Promise<LicenseStatus & { error?: string }> {
  const os = await import('os')
  const deviceId = getSetting('deviceId') || `${os.hostname()}-${os.platform()}-${os.arch()}`
  // Persist deviceId for consistency
  if (!getSetting('deviceId')) {
    setSetting('deviceId', deviceId)
  }
  const body = JSON.stringify({
    email,
    deviceId,
    deviceName: os.hostname(),
    platform: `${os.platform()} ${os.arch()}`
  })

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'diktuvai.bg',
      path: '/api/license/verify',
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
          if (parsed.valid) {
            const plan = parsed.plan || 'free'
            cachedStatus = {
              valid: true,
              plan,
              email,
              expiresAt: null,
              features: featuresForPlan(plan)
            }
            lastCheck = Date.now()
            setSetting('userEmail', email)
            setSetting('authToken', email) // use email as auth token for API calls
            resolve(cachedStatus!)
          } else {
            resolve({ ...FREE_STATUS, valid: false, error: parsed.error || 'Акаунтът не е намерен' })
          }
        } catch {
          resolve({ ...FREE_STATUS, valid: false, error: 'Грешка при свързване' })
        }
      })
    })

    req.on('error', () => {
      // If server is unreachable during dev, allow as free
      resolve({ ...FREE_STATUS, valid: false, error: 'Няма връзка със сървъра' })
    })

    req.write(body)
    req.end()
  })
}

/**
 * Get current license status — checks cached or re-verifies with server.
 */
export async function getLicenseStatus(): Promise<LicenseStatus> {
  // Return cached if recent
  if (cachedStatus && Date.now() - lastCheck < CHECK_INTERVAL) {
    return cachedStatus
  }

  const email = getSetting('userEmail')
  if (!email) {
    return FREE_STATUS
  }

  try {
    const result = await loginWithEmail(email as string)
    return result.valid ? result : FREE_STATUS
  } catch {
    return cachedStatus || FREE_STATUS
  }
}

export function clearLicense(): void {
  cachedStatus = null
  lastCheck = 0
  setSetting('userEmail', '')
  setSetting('authToken', '')
}
