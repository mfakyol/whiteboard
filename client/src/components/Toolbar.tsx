import { useState } from 'react'
import type { Tool, User } from '../lib/types'
import PresenceBar from './PresenceBar'

const TOOLS: { id: Tool; label: string; icon: string }[] = [
  { id: 'select', label: 'Select / move', icon: '↖' },
  { id: 'hand', label: 'Pan (drag canvas)', icon: '✋' },
  { id: 'pen', label: 'Pen', icon: '✏️' },
  { id: 'rect', label: 'Rectangle', icon: '▭' },
  { id: 'ellipse', label: 'Ellipse', icon: '◯' },
  { id: 'arrow', label: 'Arrow', icon: '↗' },
  { id: 'text', label: 'Text', icon: 'T' },
  { id: 'sticky', label: 'Sticky note', icon: '🗒️' },
]

const COLORS = ['#0f172a', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899']

interface Props {
  tool: Tool
  setTool: (t: Tool) => void
  color: string
  setColor: (c: string) => void
  strokeWidth: number
  setStrokeWidth: (n: number) => void
  onClear: () => void
  onUndo: () => void
  onRedo: () => void
  canUndo: boolean
  canRedo: boolean
  onPickImage: () => void
  users: User[]
  boardId: string
  onJumpToUser: (id: string) => void
}

export default function Toolbar({
  tool, setTool, color, setColor, strokeWidth, setStrokeWidth,
  onClear, onUndo, onRedo, canUndo, canRedo, onPickImage,
  users, boardId, onJumpToUser,
}: Props) {
  const [copied, setCopied] = useState(false)

  function copyLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 border-b border-slate-800 text-slate-100">
      <div className="font-bold text-indigo-400 hidden sm:block">🎨 Collabo</div>

      {/* Tools */}
      <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            title={t.label}
            onClick={() => setTool(t.id)}
            className={`w-9 h-9 rounded-md text-base flex items-center justify-center transition ${
              tool === t.id ? 'bg-indigo-600 text-white' : 'hover:bg-slate-700'
            }`}
          >
            {t.icon}
          </button>
        ))}
        <button title="Add image" onClick={onPickImage} className="w-9 h-9 rounded-md text-base flex items-center justify-center hover:bg-slate-700">🖼️</button>
      </div>

      {/* Undo / redo */}
      <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
        <button title="Undo (Ctrl+Z)" onClick={onUndo} disabled={!canUndo} className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-slate-700 disabled:opacity-30">↶</button>
        <button title="Redo (Ctrl+Shift+Z)" onClick={onRedo} disabled={!canRedo} className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-slate-700 disabled:opacity-30">↷</button>
      </div>

      {/* Colors */}
      <div className="flex items-center gap-1">
        {COLORS.map((c) => (
          <button
            key={c}
            title={c}
            onClick={() => setColor(c)}
            className={`w-6 h-6 rounded-full border-2 transition ${
              color === c ? 'border-white scale-110' : 'border-transparent'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      {/* Stroke width */}
      <label className="flex items-center gap-2 text-xs text-slate-400">
        <input type="range" min={1} max={20} value={strokeWidth} onChange={(e) => setStrokeWidth(Number(e.target.value))} className="w-24 accent-indigo-500" />
        <span className="w-6 text-right">{strokeWidth}</span>
      </label>

      <div className="flex-1" />

      <PresenceBar users={users} onJumpToUser={onJumpToUser} />

      <div className="flex items-center gap-2">
        <button onClick={copyLink} title={`Board: ${boardId}`} className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-sm">
          {copied ? '✓ Copied' : '🔗 Share'}
        </button>
        <button onClick={onClear} className="rounded-lg bg-rose-600/80 hover:bg-rose-600 px-3 py-1.5 text-sm">Clear</button>
      </div>
    </div>
  )
}
