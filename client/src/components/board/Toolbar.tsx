import { useState } from 'react'
import type { Tool, User } from '@/types'
import { t } from '@/i18n'
import PresenceBar from '@/components/board/PresenceBar'

const TOOLS: { id: Tool; labelKey: Parameters<typeof t>[0]; icon: string }[] = [
  { id: 'select', labelKey: 'toolbar.select', icon: '↖' },
  { id: 'hand', labelKey: 'toolbar.hand', icon: '✋' },
  { id: 'pen', labelKey: 'toolbar.pen', icon: '✏️' },
  { id: 'rect', labelKey: 'toolbar.rect', icon: '▭' },
  { id: 'ellipse', labelKey: 'toolbar.ellipse', icon: '◯' },
  { id: 'arrow', labelKey: 'toolbar.arrow', icon: '↗' },
  { id: 'text', labelKey: 'toolbar.text', icon: 'T' },
  { id: 'sticky', labelKey: 'toolbar.sticky', icon: '🗒️' },
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
  hasSelection: boolean
  onBringToFront: () => void
  onSendToBack: () => void
  onDuplicate: () => void
  onDelete: () => void
  users: User[]
  boardId: string
  onJumpToUser: (id: string) => void
  boardName: string
  canRename: boolean
  onRename: () => void
  readOnly: boolean
}

export default function Toolbar({
  tool, setTool, color, setColor, strokeWidth, setStrokeWidth,
  onClear, onUndo, onRedo, canUndo, canRedo, onPickImage,
  hasSelection, onBringToFront, onSendToBack, onDuplicate, onDelete,
  users, boardId, onJumpToUser, boardName, canRename, onRename, readOnly,
}: Props) {
  const [copied, setCopied] = useState<'' | 'edit' | 'view'>('')

  function copy(kind: 'edit' | 'view') {
    const base = window.location.origin + window.location.pathname
    navigator.clipboard.writeText(kind === 'view' ? `${base}?view=1` : base)
    setCopied(kind)
    setTimeout(() => setCopied(''), 1500)
  }

  if (readOnly) {
    return (
      <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 border-b border-slate-800 text-slate-100">
        <div className="font-bold text-indigo-400">🎨 Collabo</div>
        <span className="font-medium truncate max-w-[200px]">{boardName}</span>
        <span className="text-xs bg-slate-700 rounded px-2 py-0.5">{t('board.readOnly')}</span>
        <div className="flex-1" />
        <PresenceBar users={users} onJumpToUser={onJumpToUser} />
        <a href={window.location.pathname} className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-sm">{t('board.openEditable')}</a>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-slate-900 border-b border-slate-800 text-slate-100">
      <div className="font-bold text-indigo-400 hidden sm:block">🎨</div>
      <button
        onClick={() => canRename && onRename()}
        disabled={!canRename}
        title={canRename ? t('board.renameHint') : boardName}
        className="text-sm font-medium text-slate-200 hover:text-white disabled:cursor-default max-w-[150px] truncate"
      >
        {boardName}{canRename && ' ✎'}
      </button>

      {/* Tools */}
      <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
        {TOOLS.map((tl) => (
          <button
            key={tl.id}
            title={t(tl.labelKey)}
            onClick={() => setTool(tl.id)}
            className={`w-9 h-9 rounded-md text-base flex items-center justify-center transition ${
              tool === tl.id ? 'bg-indigo-600 text-white' : 'hover:bg-slate-700'
            }`}
          >
            {tl.icon}
          </button>
        ))}
        <button title={t('toolbar.image')} onClick={onPickImage} className="w-9 h-9 rounded-md text-base flex items-center justify-center hover:bg-slate-700">🖼️</button>
      </div>

      {/* Undo / redo */}
      <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
        <button title={t('toolbar.undo')} onClick={onUndo} disabled={!canUndo} className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-slate-700 disabled:opacity-30">↶</button>
        <button title={t('toolbar.redo')} onClick={onRedo} disabled={!canRedo} className="w-9 h-9 rounded-md flex items-center justify-center hover:bg-slate-700 disabled:opacity-30">↷</button>
      </div>

      {/* Selection actions */}
      {hasSelection && (
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          <button title={t('toolbar.duplicate')} onClick={onDuplicate} className="w-9 h-9 rounded-md hover:bg-slate-700">⧉</button>
          <button title={t('toolbar.bringToFront')} onClick={onBringToFront} className="w-9 h-9 rounded-md hover:bg-slate-700">⬆</button>
          <button title={t('toolbar.sendToBack')} onClick={onSendToBack} className="w-9 h-9 rounded-md hover:bg-slate-700">⬇</button>
          <button title={t('toolbar.deleteSel')} onClick={onDelete} className="w-9 h-9 rounded-md hover:bg-slate-700">🗑️</button>
        </div>
      )}

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
        <button onClick={() => copy('edit')} title={t('board.shareHint', { id: boardId })} className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-sm">
          {copied === 'edit' ? t('board.copied') : t('board.share')}
        </button>
        <button onClick={() => copy('view')} title={t('board.viewHint')} className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1.5 text-sm">
          {copied === 'view' ? t('board.copied') : t('board.view')}
        </button>
        <button onClick={onClear} className="rounded-lg bg-rose-600/80 hover:bg-rose-600 px-3 py-1.5 text-sm">{t('board.clear')}</button>
      </div>
    </div>
  )
}
