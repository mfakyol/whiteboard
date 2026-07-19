import type { Auth } from '@/stores/auth.store'
import { saveAuth } from '@/stores/auth.store'
import type { Result } from '@/types'

// Network auth calls. On success the returned auth is persisted via the store,
// so the caller only reacts to the Result.
async function post(path: string, body: unknown): Promise<Result<Auth>> {
  try {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await res.json().catch(() => ({}))) as Auth & { message?: string }
    if (!res.ok) return { success: false, error: data.message || 'Request failed' }
    saveAuth(data)
    return { success: true, data }
  } catch {
    return { success: false, error: 'Network error' }
  }
}

export function register(
  email: string,
  name: string,
  password: string,
): Promise<Result<Auth>> {
  return post('/api/auth/register', { email, name, password })
}

export function login(email: string, password: string): Promise<Result<Auth>> {
  return post('/api/auth/login', { email, password })
}
