import { authHeader } from './auth'

// Same-origin API. In dev, Vite proxies /api to the backend; in production the
// client nginx does. So a relative base works everywhere.

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

export async function createBoard(name?: string): Promise<string> {
  const res = await fetch('/api/boards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) throw new Error('Could not create board')
  const data = (await res.json()) as { id: string }
  return data.id
}

export async function getBoard(id: string): Promise<BoardMeta | null> {
  const res = await fetch(`/api/boards/${id}`)
  if (!res.ok) return null
  return (await res.json()) as BoardMeta
}

export async function listMyBoards(): Promise<BoardSummary[]> {
  const res = await fetch('/api/boards', { headers: { ...authHeader() } })
  if (!res.ok) return []
  return (await res.json()) as BoardSummary[]
}

export async function renameBoard(id: string, name: string): Promise<void> {
  await fetch(`/api/boards/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ name }),
  })
}

export async function deleteBoard(id: string): Promise<void> {
  await fetch(`/api/boards/${id}`, { method: 'DELETE', headers: { ...authHeader() } })
}
