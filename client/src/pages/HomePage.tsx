import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createBoard, listMyBoards, deleteBoard, renameBoard, type BoardSummary } from '../lib/api'
import { getAccount, login, register, logout } from '../lib/auth'
import { setUserName } from '../lib/user'

export default function HomePage() {
  const navigate = useNavigate()
  const [account, setAccount] = useState(getAccount())

  // ---- logged-out: auth form ----
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // ---- logged-in: boards ----
  const [boards, setBoards] = useState<BoardSummary[]>([])
  const [joinId, setJoinId] = useState('')

  useEffect(() => {
    if (account) listMyBoards().then(setBoards)
  }, [account])

  async function submitAuth() {
    setError('')
    setBusy(true)
    try {
      const auth = mode === 'register'
        ? await register(email, name, password)
        : await login(email, password)
      setUserName(auth.user.name)
      setAccount(auth.user)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function newBoard() {
    const boardName = window.prompt('Board name:', 'Untitled board')
    if (boardName === null) return
    const id = await createBoard(boardName || undefined)
    navigate(`/board/${id}`)
  }

  async function guestBoard() {
    const id = await createBoard()
    navigate(`/board/${id}`)
  }

  function joinBoard() {
    const id = joinId.trim()
    if (id) navigate(`/board/${id}`)
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this board?')) return
    await deleteBoard(id)
    setBoards((b) => b.filter((x) => x.id !== id))
  }
  async function rename(id: string, current: string) {
    const n = window.prompt('Rename board:', current)
    if (!n) return
    await renameBoard(id, n)
    setBoards((b) => b.map((x) => (x.id === id ? { ...x, name: n } : x)))
  }

  // ================= Dashboard (logged in) =================
  if (account) {
    return (
      <div className="min-h-full bg-slate-950 text-slate-100">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold">🎨 Your boards</h1>
              <p className="text-slate-400 text-sm">Signed in as {account.name}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={newBoard} className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 font-medium">+ New board</button>
              <button onClick={() => { logout(); setAccount(null) }} className="rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-2">Log out</button>
            </div>
          </div>

          <div className="flex gap-2 mb-6">
            <input value={joinId} onChange={(e) => setJoinId(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && joinBoard()} placeholder="Join a board by ID" className="flex-1 rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 outline-none focus:border-indigo-500" />
            <button onClick={joinBoard} className="rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-2">Join</button>
          </div>

          {boards.length === 0 ? (
            <p className="text-slate-500 text-center py-16">No boards yet — create your first one.</p>
          ) : (
            <ul className="space-y-2">
              {boards.map((b) => (
                <li key={b.id} className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                  <button onClick={() => navigate(`/board/${b.id}`)} className="flex-1 text-left">
                    <div className="font-medium">{b.name}</div>
                    <div className="text-xs text-slate-500">{b.shapeCount} items · {new Date(b.updatedAt).toLocaleString()}</div>
                  </button>
                  <button onClick={() => rename(b.id, b.name)} className="text-slate-400 hover:text-slate-100 px-2" title="Rename">✎</button>
                  <button onClick={() => remove(b.id)} className="text-slate-400 hover:text-rose-400 px-2" title="Delete">🗑️</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }

  // ================= Auth (logged out) =================
  return (
    <div className="min-h-full flex items-center justify-center bg-slate-950 text-slate-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🎨</div>
          <h1 className="text-3xl font-bold tracking-tight">Collabo Board</h1>
          <p className="text-slate-400 mt-2">Real-time collaborative whiteboard. Sign in to keep your boards, or jump in as a guest.</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex gap-1 bg-slate-800 rounded-lg p-1 text-sm">
            <button onClick={() => setMode('login')} className={`flex-1 rounded-md py-1.5 ${mode === 'login' ? 'bg-indigo-600' : ''}`}>Log in</button>
            <button onClick={() => setMode('register')} className={`flex-1 rounded-md py-1.5 ${mode === 'register' ? 'bg-indigo-600' : ''}`}>Sign up</button>
          </div>

          {mode === 'register' && (
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 outline-none focus:border-indigo-500" />
          )}
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 outline-none focus:border-indigo-500" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitAuth()} placeholder="Password (6+ chars)" type="password" className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 outline-none focus:border-indigo-500" />

          {error && <p className="text-rose-400 text-sm">{error}</p>}

          <button onClick={submitAuth} disabled={busy} className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-4 py-2.5 font-medium">
            {busy ? 'Please wait…' : mode === 'register' ? 'Create account' : 'Log in'}
          </button>

          <div className="flex items-center gap-3 text-slate-600 text-xs">
            <div className="h-px bg-slate-800 flex-1" /> OR <div className="h-px bg-slate-800 flex-1" />
          </div>

          <button onClick={guestBoard} className="w-full rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2 font-medium">
            Continue as guest → new board
          </button>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">Built with React, react-konva, Socket.io &amp; MongoDB</p>
      </div>
    </div>
  )
}
