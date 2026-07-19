import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  createBoard, listMyBoards, deleteBoard, renameBoard, type BoardSummary,
} from '@/services/board.service'
import { login, register } from '@/services/auth.service'
import { getAccount, logout } from '@/stores/auth.store'
import { setUserName } from '@/stores/user.store'
import { t } from '@/i18n'

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
    if (!account) return
    listMyBoards().then((res) => {
      if (res.success) setBoards(res.data)
    })
  }, [account])

  async function submitAuth() {
    setError('')
    setBusy(true)
    const res = mode === 'register'
      ? await register(email, name, password)
      : await login(email, password)
    setBusy(false)
    if (!res.success) {
      setError(res.error)
      return
    }
    setUserName(res.data.user.name)
    setAccount(res.data.user)
  }

  async function newBoard() {
    const boardName = window.prompt(t('board.namePrompt'), t('board.defaultName'))
    if (boardName === null) return
    const res = await createBoard(boardName || undefined)
    if (res.success) navigate(`/board/${res.data}`)
  }

  async function guestBoard() {
    const res = await createBoard()
    if (res.success) navigate(`/board/${res.data}`)
  }

  function joinBoard() {
    const id = joinId.trim()
    if (id) navigate(`/board/${id}`)
  }

  async function remove(id: string) {
    if (!window.confirm(t('board.deleteConfirm'))) return
    const res = await deleteBoard(id)
    if (res.success) setBoards((b) => b.filter((x) => x.id !== id))
  }
  async function rename(id: string, current: string) {
    const n = window.prompt(t('board.renamePrompt'), current)
    if (!n) return
    const res = await renameBoard(id, n)
    if (res.success) setBoards((b) => b.map((x) => (x.id === id ? { ...x, name: n } : x)))
  }

  // ================= Dashboard (logged in) =================
  if (account) {
    return (
      <div className="min-h-full bg-slate-950 text-slate-100">
        <div className="max-w-3xl mx-auto px-4 py-10">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold">{t('dashboard.yourBoards')}</h1>
              <p className="text-slate-400 text-sm">{t('dashboard.signedInAs', { name: account.name })}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={newBoard} className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 font-medium">{t('dashboard.newBoard')}</button>
              <button onClick={() => { logout(); setAccount(null) }} className="rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-2">{t('dashboard.logout')}</button>
            </div>
          </div>

          <div className="flex gap-2 mb-6">
            <input value={joinId} onChange={(e) => setJoinId(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && joinBoard()} placeholder={t('dashboard.joinPlaceholder')} className="flex-1 rounded-lg bg-slate-900 border border-slate-800 px-3 py-2 outline-none focus:border-indigo-500" />
            <button onClick={joinBoard} className="rounded-lg bg-slate-800 hover:bg-slate-700 px-4 py-2">{t('dashboard.join')}</button>
          </div>

          {boards.length === 0 ? (
            <p className="text-slate-500 text-center py-16">{t('dashboard.empty')}</p>
          ) : (
            <ul className="space-y-2">
              {boards.map((b) => (
                <li key={b.id} className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                  <button onClick={() => navigate(`/board/${b.id}`)} className="flex-1 text-left">
                    <div className="font-medium">{b.name}</div>
                    <div className="text-xs text-slate-500">{t('dashboard.items', { n: b.shapeCount, date: new Date(b.updatedAt).toLocaleString() })}</div>
                  </button>
                  <button onClick={() => rename(b.id, b.name)} className="text-slate-400 hover:text-slate-100 px-2" title={t('dashboard.rename')}>✎</button>
                  <button onClick={() => remove(b.id)} className="text-slate-400 hover:text-rose-400 px-2" title={t('dashboard.delete')}>🗑️</button>
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
          <h1 className="text-3xl font-bold tracking-tight">{t('app.name')}</h1>
          <p className="text-slate-400 mt-2">{t('app.tagline')}</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex gap-1 bg-slate-800 rounded-lg p-1 text-sm">
            <button onClick={() => setMode('login')} className={`flex-1 rounded-md py-1.5 ${mode === 'login' ? 'bg-indigo-600' : ''}`}>{t('auth.login')}</button>
            <button onClick={() => setMode('register')} className={`flex-1 rounded-md py-1.5 ${mode === 'register' ? 'bg-indigo-600' : ''}`}>{t('auth.signup')}</button>
          </div>

          {mode === 'register' && (
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('auth.name')} className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 outline-none focus:border-indigo-500" />
          )}
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('auth.email')} type="email" className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 outline-none focus:border-indigo-500" />
          <input value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitAuth()} placeholder={t('auth.password')} type="password" className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 outline-none focus:border-indigo-500" />

          {error && <p className="text-rose-400 text-sm">{error}</p>}

          <button onClick={submitAuth} disabled={busy} className="w-full rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-4 py-2.5 font-medium">
            {busy ? t('auth.pleaseWait') : mode === 'register' ? t('auth.createAccount') : t('auth.login')}
          </button>

          <div className="flex items-center gap-3 text-slate-600 text-xs">
            <div className="h-px bg-slate-800 flex-1" /> {t('auth.or')} <div className="h-px bg-slate-800 flex-1" />
          </div>

          <button onClick={guestBoard} className="w-full rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2 font-medium">
            {t('auth.continueGuest')}
          </button>
        </div>

        <p className="text-center text-slate-600 text-xs mt-6">{t('app.builtWith')}</p>
      </div>
    </div>
  )
}
