import { bg, Translations } from './bg'
import { en } from './en'

const locales: Record<string, Translations> = { bg, en }

let currentLocale: string = 'bg'

export function setLocale(locale: string): void {
  if (locales[locale]) {
    currentLocale = locale
  }
}

export function getLocale(): string {
  return currentLocale
}

export function t(path: string): string {
  const keys = path.split('.')
  let result: any = locales[currentLocale]

  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key]
    } else {
      // Fallback to bg
      let fallback: any = locales['bg']
      for (const k of keys) {
        if (fallback && typeof fallback === 'object' && k in fallback) {
          fallback = fallback[k]
        } else {
          return path
        }
      }
      return typeof fallback === 'string' ? fallback : path
    }
  }

  return typeof result === 'string' ? result : path
}

export function useTranslations() {
  return { t, locale: currentLocale, setLocale }
}

export type { Translations }
