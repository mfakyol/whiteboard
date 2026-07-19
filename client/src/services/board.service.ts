import { authHeader } from '@/stores/auth.store'
import type { Result } from '@/types'

// Same-origin API. In dev, Vite proxies /api to the backend; in production the
// client nginx does. So a relative base works everywhere. Every call returns a
// discriminated Result so callers handle failure explicitly.

export interface BoardSummary {
  id: string
  name: string
  updatedAt: string
  shapeCount: number
}
export interface BoardMeta {
  id: string
  name: string
  ownerId: string | null
  shapeCount: number
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  parse: (res: Response) => Promise<T> = (r) => r.json() as Promise<T>,
): Promise<Result<T>> {
  try {
    const res = await fetch(path, init)
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string }
      return { success: false, error: body.message ?? `Request failed (${res.status})` }
    }
    return { success: true, data: await parse(res) }
  } catch {
    return { success: false, error: 'Network error' }
  }
}

const jsonHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  ...authHeader(),
})

export function createBoard(name?: string): Promise<Result<string>> {
  return request(
    '/api/boards',
    { method: 'POST', headers: jsonHeaders(), body: JSON.stringify({ name }) },
    async (res) => ((await res.json()) as { id: string }).id,
  )
}

export function getBoard(id: string): Promise<Result<BoardMeta>> {
  return request<BoardMeta>(`/api/boards/${id}`)
}

export function listMyBoards(): Promise<Result<BoardSummary[]>> {
  return request<BoardSummary[]>('/api/boards', { headers: authHeader() })
}

export function renameBoard(id: string, name: string): Promise<Result<void>> {
  return request<void>(
    `/api/boards/${id}`,
    { method: 'PATCH', headers: jsonHeaders(), body: JSON.stringify({ name }) },
    async () => undefined,
  )
}

export function deleteBoard(id: string): Promise<Result<void>> {
  return request<void>(
    `/api/boards/${id}`,
    { method: 'DELETE', headers: authHeader() },
    async () => undefined,
  )
}
