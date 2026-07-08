import type { User } from './types'

const KEY = 'wb_user'

const COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#06b6d4',
]

const ADJECTIVES = ['Swift', 'Bright', 'Calm', 'Bold', 'Keen', 'Cool', 'Neat']
const ANIMALS = ['Fox', 'Owl', 'Cat', 'Wolf', 'Bear', 'Hawk', 'Lynx']

function randomOf<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function uid(): string {
  return Math.random().toString(36).slice(2, 10)
}

export function getUser(): User {
  const raw = localStorage.getItem(KEY)
  if (raw) {
    try {
      return JSON.parse(raw) as User
    } catch {
      /* fall through to recreate */
    }
  }
  const user: User = {
    id: uid(),
    name: `${randomOf(ADJECTIVES)} ${randomOf(ANIMALS)}`,
    color: randomOf(COLORS),
  }
  localStorage.setItem(KEY, JSON.stringify(user))
  return user
}

export function setUserName(name: string): User {
  const user = { ...getUser(), name: name.trim() || getUser().name }
  localStorage.setItem(KEY, JSON.stringify(user))
  return user
}
