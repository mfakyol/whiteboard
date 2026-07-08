export interface Account {
  id: string
  email: string
  name: string
}

interface Auth {
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

function setAuth(a: Auth) {
  localStorage.setItem(KEY, JSON.stringify(a))
}

export function logout() {
  localStorage.removeItem(KEY)
}

async function post(path: string, body: unknown): Promise<Auth> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.message || 'Request failed')
  setAuth(data as Auth)
  return data as Auth
}

export function register(email: string, name: string, password: string) {
  return post('/api/auth/register', { email, name, password })
}
export function login(email: string, password: string) {
  return post('/api/auth/login', { email, password })
}
