// Same-origin API. In dev, Vite proxies /api to the backend; in production the
// client nginx does. So a relative base works everywhere.
export async function createBoard(): Promise<string> {
  const res = await fetch('/api/boards', { method: 'POST' })
  if (!res.ok) throw new Error('Could not create board')
  const data = (await res.json()) as { id: string }
  return data.id
}

export async function boardExists(id: string): Promise<boolean> {
  const res = await fetch(`/api/boards/${id}`)
  return res.ok
}
