// Auth/account state, persisted in localStorage. The network calls live in
// services/auth.service.ts; this module only owns the stored token + account.

export interface Account {
  id: string
  email: string
  name: string
}

export interface Auth {
  token: string
  user: Account
}

const KEY = 'wb_auth'

export function getAuth(): Auth | null {
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as Auth
  } catch {
    return null
  }
}

export function getAccount(): Account | null {
  return getAuth()?.user ?? null
}

export function authHeader(): Record<string, string> {
  const token = getAuth()?.token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export function saveAuth(auth: Auth): void {
  localStorage.setItem(KEY, JSON.stringify(auth))
}

export function logout(): void {
  localStorage.removeItem(KEY)
}
