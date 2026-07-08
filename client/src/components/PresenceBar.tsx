import type { User } from '../lib/types'

export default function PresenceBar({ users }: { users: User[] }) {
  return (
    <div className="flex items-center -space-x-2">
      {users.map((u) => (
        <div
          key={u.id}
          title={u.name}
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ring-2 ring-slate-900"
          style={{ backgroundColor: u.color }}
        >
          {u.name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
        </div>
      ))}
      <span className="pl-4 text-sm text-slate-400">
        {users.length} online
      </span>
    </div>
  )
}
