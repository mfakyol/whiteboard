import { en, type TranslationKey } from '@/i18n/en'

// Single-locale for now; the shape is ready for more locales later.
const messages = en

// Translate a key, interpolating `{token}` params. Typed so unknown keys fail
// at compile time.
export function t(
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const template = messages[key]
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in params ? String(params[name]) : `{${name}}`,
  )
}
