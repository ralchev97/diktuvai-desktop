import Store from 'electron-store'

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
  cleanupLevel: 'medium',
  microphone: 'default',
  soundEffects: true,
  openAtLogin: false,
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

export function getSettings(): AppSettings {
  return store.store
}

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return store.get(key)
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  store.set(key, value)
}

export function setSettings(settings: Partial<AppSettings>): void {
  for (const [key, value] of Object.entries(settings)) {
    store.set(key as keyof AppSettings, value)
  }
}

export default store
