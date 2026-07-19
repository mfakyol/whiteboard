import type { User } from '@/types'
import { t } from '@/i18n'

interface Props {
  users: User[]
  onJumpToUser?: (id: string) => void
}

export default function PresenceBar({ users, onJumpToUser }: Props) {
  return (
    <div className="flex items-center -space-x-2">
      {users.map((u) => (
        <button
          key={u.id}
          title={t('presence.jumpTo', { name: u.name })}
          onClick={() => onJumpToUser?.(u.id)}
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2 ring-slate-900 hover:scale-110 transition"
          style={{ backgroundColor: u.color }}
        >
          {u.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
        </button>
      ))}
      <span className="pl-4 text-sm text-slate-400">
        {t('presence.online', { n: users.length })}
      </span>
    </div>
  )
}
