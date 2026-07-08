import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createBoard } from '../lib/api'
import { getUser, setUserName } from '../lib/user'

export default function HomePage() {
  const navigate = useNavigate()
  const [name, setName] = useState(getUser().name)
  const [joinId, setJoinId] = useState('')
  const [creating, setCreating] = useState(false)

  async function handleCreate() {
    setUserName(name)
    setCreating(true)
    try {
      const id = await createBoard()
      navigate(`/board/${id}`)
    } finally {
      setCreating(false)
    }
  }

  function handleJoin() {
    const id = joinId.trim()
    if (!id) return
    setUserName(name)
    navigate(`/board/${id}`)
  }

  return (
    <div className="min-h-full flex items-center justify-center bg-slate-950 text-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎨</div>
          <h1 className="text-3xl font-bold tracking-tight">Collabo Board</h1>
          <p className="text-slate-400 mt-2">
            Real-time collaborative whiteboard. Create a board and share the
            link — draw together, see each other's cursors live.
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <label className="block">
            <span className="text-sm text-slate-400">Your name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 outline-none focus:border-indigo-500"
              placeholder="Your name"
            />
          </label>

          <button
            onClick={handleCreate}
            disabled={creating}
            className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-4 py-2.5 font-medium transition"
          >
            {creating ? 'Creating…' : 'Create a new board'}
          </button>

          <div className="flex items-center gap-3 text-slate-600 text-xs">
            <div className="h-px bg-slate-800 flex-1" />
            OR JOIN EXISTING
            <div className="h-px bg-slate-800 flex-1" />
          </div>

          <div className="flex gap-2">
            <input
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 outline-none focus:border-indigo-500"
              placeholder="Board ID"
            />
            <button
              onClick={handleJoin}
              className="rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2 font-medium transition"
            >
              Join
            </button>
          </div>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">
          Built with React, react-konva, Socket.io &amp; MongoDB
        </p>
      </div>
    </div>
  )
}
