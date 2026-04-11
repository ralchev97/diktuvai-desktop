import https from 'https'
import os from 'os'
import { getSetting, setSetting } from './store'

const API_HOST = 'diktuvai.bg'
const CHECK_INTERVAL = 60 * 60 * 1000 // 1 hour

export interface LicenseStatus {
  valid: boolean
  plan: 'free' | 'trial' | 'starter' | 'pro'
  email: string | null
  expiresAt: string | null
  trialDaysLeft?: number | null
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
    priority: false,
  },
}

const STARTER_FEATURES: LicenseStatus['features'] = {
  commandMode: false,
  unlimitedDictations: false,
  customStyles: false,
  snippets: true,
  snippetLimit: 10,
  dictionaryLimit: 200,
  weeklyWordLimit: 10000,
  priority: false,
}

const PRO_FEATURES: LicenseStatus['features'] = {
  commandMode: true,
  unlimitedDictations: true,
  customStyles: true,
  snippets: true,
  snippetLimit: -1,
  dictionaryLimit: -1,
  weeklyWordLimit: -1,
  priority: true,
}

let cachedStatus: LicenseStatus | null = null
let lastCheck: number = 0

function featuresForPlan(plan: string): LicenseStatus['features'] {
  switch (plan) {
    case 'pro':
      return PRO_FEATURES
    case 'starter':
      return STARTER_FEATURES
    default:
      return FREE_STATUS.features
  }
}

function getDeviceId(): string {
  let deviceId = getSetting('deviceId') as string | undefined
  if (!deviceId) {
    deviceId = `${os.hostname()}-${os.platform()}-${os.arch()}-${Math.random().toString(36).slice(2, 10)}`
    setSetting('deviceId', deviceId)
  }
  return deviceId
}

interface ApiResponse<T = unknown> {
  ok: boolean
  status: number
  data: T
}

function apiRequest<T = unknown>(
  path: string,
  options: {
    method?: string
    body?: unknown
    token?: string
  } = {}
): Promise<ApiResponse<T>> {
  const { method = 'POST', body, token } = options
  const bodyStr = body ? JSON.stringify(body) : undefined

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }
  if (bodyStr) headers['Content-Length'] = String(Buffer.byteLength(bodyStr))
  if (token) headers['Authorization'] = `Bearer ${token}`

  return new Promise(resolve => {
    const req = https.request(
      { hostname: API_HOST, path, method, headers },
      res => {
        let data = ''
        res.on('data', (chunk: Buffer) => {
          data += chunk.toString()
        })
        res.on('end', () => {
          let parsed: T
          try {
            parsed = JSON.parse(data) as T
          } catch {
            parsed = {} as T
          }
          resolve({ ok: (res.statusCode || 0) < 400, status: res.statusCode || 0, data: parsed })
        })
      }
    )
    req.on('error', () => {
      resolve({ ok: false, status: 0, data: {} as T })
    })
    if (bodyStr) req.write(bodyStr)
    req.end()
  })
}

/**
 * Step 1 of login: ask server to send a 6-digit code to this email.
 */
export async function requestCode(email: string): Promise<{ success: boolean; error?: string }> {
  const res = await apiRequest<{ success?: boolean; error?: string }>('/api/auth/request-code', {
    body: { email },
  })
  if (res.ok && res.data.success) {
    return { success: true }
  }
  return { success: false, error: res.data.error || (res.status === 0 ? 'Няма връзка със сървъра' : 'Грешка при изпращане на код') }
}

/**
 * Step 2 of login: exchange email + code for a JWT, store it, and load license.
 */
export async function verifyCode(
  email: string,
  code: string
): Promise<LicenseStatus & { error?: string }> {
  const res = await apiRequest<{
    success?: boolean
    token?: string
    user?: { id: string; email: string; plan: string }
    isNewUser?: boolean
    error?: string
  }>('/api/auth/verify-code', {
    body: { email, code },
  })

  if (!res.ok || !res.data.success || !res.data.token) {
    return { ...FREE_STATUS, valid: false, error: res.data.error || 'Грешен код' }
  }

  // Store token + email
  setSetting('authToken', res.data.token)
  setSetting('userEmail', res.data.user?.email || email)

  // Fetch full license status
  const status = await refreshLicense()
  return status
}

/**
 * Re-fetches the current plan and usage via /api/license/verify, using the
 * stored Bearer JWT. Used at startup, every hour, and after Stripe upgrade.
 */
export async function refreshLicense(): Promise<LicenseStatus> {
  const token = getSetting('authToken') as string | undefined
  if (!token) {
    cachedStatus = FREE_STATUS
    return FREE_STATUS
  }

  const deviceId = getDeviceId()
  const res = await apiRequest<{
    valid: boolean
    plan?: string
    email?: string
    trialDaysLeft?: number | null
    error?: string
  }>('/api/license/verify', {
    token,
    body: {
      deviceId,
      deviceName: os.hostname(),
      platform: `${os.platform()} ${os.arch()}`,
    },
  })

  if (res.status === 401) {
    // Token expired or invalid — clear it
    clearLicense()
    return FREE_STATUS
  }

  if (!res.ok || !res.data.valid) {
    // Network error — keep stale cache if any
    return cachedStatus || FREE_STATUS
  }

  const plan = (res.data.plan as LicenseStatus['plan']) || 'free'
  cachedStatus = {
    valid: true,
    plan,
    email: res.data.email || (getSetting('userEmail') as string) || null,
    expiresAt: null,
    trialDaysLeft: res.data.trialDaysLeft ?? null,
    features: featuresForPlan(plan),
  }
  lastCheck = Date.now()
  return cachedStatus
}

/**
 * Returns cached status if fresh, otherwise re-fetches.
 */
export async function getLicenseStatus(): Promise<LicenseStatus> {
  if (cachedStatus && Date.now() - lastCheck < CHECK_INTERVAL) {
    return cachedStatus
  }
  return refreshLicense()
}

/**
 * Creates a Stripe Checkout session and returns the URL. Caller should open
 * it in the system browser.
 */
export async function createCheckoutUrl(
  plan: 'starter' | 'pro' = 'pro',
  interval: 'monthly' | 'annual' = 'monthly'
): Promise<{ url?: string; error?: string }> {
  const token = getSetting('authToken') as string | undefined
  if (!token) return { error: 'Не си влязъл в акаунт' }

  const res = await apiRequest<{ url?: string; error?: string }>('/api/stripe/checkout', {
    token,
    body: { plan, interval },
  })

  if (res.ok && res.data.url) return { url: res.data.url }
  return { error: res.data.error || 'Грешка при създаване на сесия за плащане' }
}

/**
 * Opens the Stripe Billing Portal where the user can manage/cancel subscription.
 */
export async function createPortalUrl(): Promise<{ url?: string; error?: string }> {
  const token = getSetting('authToken') as string | undefined
  if (!token) return { error: 'Не си влязъл в акаунт' }

  const res = await apiRequest<{ url?: string; error?: string }>('/api/stripe/portal', {
    token,
    body: {},
  })
  if (res.ok && res.data.url) return { url: res.data.url }
  return { error: res.data.error || 'Грешка при отваряне на портала' }
}

export function clearLicense(): void {
  cachedStatus = null
  lastCheck = 0
  setSetting('userEmail', '')
  setSetting('authToken', '')
}

export function getAuthToken(): string | null {
  const token = getSetting('authToken') as string | undefined
  return token || null
}
