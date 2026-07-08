import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import type Konva from 'konva'
import Canvas from '../components/Canvas'
import Toolbar from '../components/Toolbar'
import { getSocket } from '../lib/socket'
import { getUser } from '../lib/user'
import type { Shape, Tool, User, Cursor } from '../lib/types'

const TOP = 53
const TOOL_KEYS: Record<string, Tool> = {
  v: 'select', h: 'hand', p: 'pen', r: 'rect', o: 'ellipse', a: 'arrow', t: 'text', s: 'sticky',
}
function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

interface HistoryOp { undo: () => void; redo: () => void }
interface Editing { id: string | null; worldX: number; worldY: number; value: string }

function fileToShapeImage(file: File): Promise<{ src: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const MAX = 900
        let { width, height } = img
        const scale = Math.min(1, MAX / Math.max(width, height))
        width = Math.round(width * scale)
        height = Math.round(height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        resolve({ src: canvas.toDataURL('image/png'), width, height })
      }
      img.onerror = reject
      img.src = reader.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function BoardPage() {
  const { id: boardId = '' } = useParams()
  const user = useMemo(() => getUser(), [])
  const socket = useMemo(() => getSocket(), [])
  const stageRef = useRef<Konva.Stage | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const [shapes, setShapes] = useState<Shape[]>([])
  const shapesRef = useRef<Shape[]>([])
  useEffect(() => { shapesRef.current = shapes }, [shapes])

  const [users, setUsers] = useState<User[]>([])
  const [cursors, setCursors] = useState<Record<string, Cursor>>({})
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#0f172a')
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [editing, setEditing] = useState<Editing | null>(null)

  const selectedRef = useRef<string[]>([])
  useEffect(() => { selectedRef.current = selectedIds }, [selectedIds])
  const clipboard = useRef<Shape[]>([])
  const spacePrevTool = useRef<Tool | null>(null)

  // ---- history ----
  const undoStack = useRef<HistoryOp[]>([])
  const redoStack = useRef<HistoryOp[]>([])
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)
  const syncHistory = () => {
    setCanUndo(undoStack.current.length > 0)
    setCanRedo(redoStack.current.length > 0)
  }
  const pushOp = (op: HistoryOp) => {
    undoStack.current.push(op)
    redoStack.current = []
    syncHistory()
  }

  // ---- low-level (state + socket) ----
  const emitAdd = useCallback((s: Shape) => {
    setShapes((p) => [...p, s]); socket.emit('shape:add', { boardId, shape: s })
  }, [socket, boardId])
  const emitDelete = useCallback((shapeId: string) => {
    setShapes((p) => p.filter((x) => x.id !== shapeId)); socket.emit('shape:delete', { boardId, shapeId })
  }, [socket, boardId])
  const emitUpdate = useCallback((s: Shape) => {
    setShapes((p) => p.map((x) => (x.id === s.id ? s : x))); socket.emit('shape:update', { boardId, shape: s })
  }, [socket, boardId])
  const emitReorder = useCallback((ordered: Shape[]) => {
    setShapes(ordered); socket.emit('board:reorder', { boardId, ids: ordered.map((s) => s.id) })
  }, [socket, boardId])

  // ---- public actions (history) ----
  const addShapes = (list: Shape[]) => {
    list.forEach(emitAdd)
    pushOp({ undo: () => list.forEach((s) => emitDelete(s.id)), redo: () => list.forEach(emitAdd) })
  }
  const addShape = (s: Shape) => addShapes([s])
  const removeShapes = (ids: string[]) => {
    const list = shapesRef.current.filter((x) => ids.includes(x.id))
    if (!list.length) return
    list.forEach((s) => emitDelete(s.id))
    pushOp({ undo: () => list.forEach(emitAdd), redo: () => list.forEach((s) => emitDelete(s.id)) })
    setSelectedIds([])
  }
  // Batch move/resize: pairs of before/after, one undo step.
  const commitBatch = (pairs: { before: Shape; after: Shape }[]) => {
    if (!pairs.length) return
    pairs.forEach((p) => emitUpdate(p.after))
    pushOp({
      undo: () => pairs.forEach((p) => emitUpdate(p.before)),
      redo: () => pairs.forEach((p) => emitUpdate(p.after)),
    })
  }
  const reorder = (ordered: Shape[]) => {
    const prev = shapesRef.current
    emitReorder(ordered)
    pushOp({ undo: () => emitReorder(prev), redo: () => emitReorder(ordered) })
  }
  const bringToFront = () => {
    const sel = new Set(selectedRef.current)
    const chosen = shapesRef.current.filter((s) => sel.has(s.id))
    const others = shapesRef.current.filter((s) => !sel.has(s.id))
    if (chosen.length) reorder([...others, ...chosen])
  }
  const sendToBack = () => {
    const sel = new Set(selectedRef.current)
    const chosen = shapesRef.current.filter((s) => sel.has(s.id))
    const others = shapesRef.current.filter((s) => !sel.has(s.id))
    if (chosen.length) reorder([...chosen, ...others])
  }
  const clearBoard = () => {
    if (!window.confirm('Clear the whole board for everyone?')) return
    const snapshot = shapesRef.current
    setShapes([]); socket.emit('board:clear', { boardId })
    pushOp({ undo: () => snapshot.forEach(emitAdd), redo: () => { setShapes([]); socket.emit('board:clear', { boardId }) } })
    setSelectedIds([])
  }

  // ---- clipboard ----
  const copySelection = () => {
    clipboard.current = shapesRef.current.filter((s) => selectedRef.current.includes(s.id))
  }
  const pasteClipboard = () => {
    if (!clipboard.current.length) return
    const copies = clipboard.current.map((s) => ({
      ...s, id: uid(),
      x: s.x !== undefined ? s.x + 24 : s.x,
      y: s.y !== undefined ? s.y + 24 : s.y,
      points: s.points ? s.points.map((p, i) => (i % 2 === 0 ? p + 24 : p + 24)) : undefined,
    }))
    addShapes(copies)
    setSelectedIds(copies.map((c) => c.id))
  }
  const duplicateSelection = () => { copySelection(); pasteClipboard() }

  const undo = () => { const op = undoStack.current.pop(); if (!op) return; op.undo(); redoStack.current.push(op); syncHistory() }
  const redo = () => { const op = redoStack.current.pop(); if (!op) return; op.redo(); undoStack.current.push(op); syncHistory() }

  // ---- socket wiring ----
  useEffect(() => {
    const join = () => socket.emit('board:join', { boardId, user })
    join()
    socket.on('connect', join)
    socket.on('board:state', ({ shapes }: { shapes: Shape[] }) => setShapes(shapes))
    socket.on('shape:add', (s: Shape) => setShapes((p) => [...p, s]))
    socket.on('shape:update', (s: Shape) => setShapes((p) => p.map((x) => (x.id === s.id ? s : x))))
    socket.on('shape:delete', (id: string) => setShapes((p) => p.filter((x) => x.id !== id)))
    socket.on('board:clear', () => setShapes([]))
    socket.on('board:reorder', (ids: string[]) =>
      setShapes((p) => {
        const byId = new Map(p.map((s) => [s.id, s]))
        return ids.map((id) => byId.get(id)).filter((s): s is Shape => Boolean(s))
      }),
    )
    socket.on('presence:list', (list: User[]) => setUsers(list))
    socket.on('presence:join', (u: User) => setUsers((p) => (p.some((x) => x.id === u.id) ? p : [...p, u])))
    socket.on('presence:leave', (userId: string) => {
      setUsers((p) => p.filter((x) => x.id !== userId))
      setCursors((p) => { const n = { ...p }; delete n[userId]; return n })
    })
    socket.on('cursor:move', ({ userId, x, y }: { userId: string; x: number; y: number }) =>
      setCursors((p) => ({ ...p, [userId]: { x, y } })),
    )
    return () => {
      socket.emit('board:leave', { boardId })
      ;['connect', 'board:state', 'shape:add', 'shape:update', 'shape:delete', 'board:clear',
        'board:reorder', 'presence:list', 'presence:join', 'presence:leave', 'cursor:move',
      ].forEach((ev) => socket.off(ev))
    }
  }, [socket, boardId, user])

  // ---- keyboard ----
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA'
      if (typing) return
      const meta = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()

      if (meta && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return }
      if (meta && k === 'y') { e.preventDefault(); redo(); return }
      if (meta && k === 'c') { copySelection(); return }
      if (meta && k === 'v') { if (clipboard.current.length) { e.preventDefault(); pasteClipboard() } return }
      if (meta && k === 'd') { e.preventDefault(); duplicateSelection(); return }
      if (meta && k === 'a') { e.preventDefault(); setSelectedIds(shapesRef.current.map((s) => s.id)); return }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (selectedRef.current.length) removeShapes(selectedRef.current); return }
      if (e.key === ']') { bringToFront(); return }
      if (e.key === '[') { sendToBack(); return }
      if (e.key === 'Escape') { setSelectedIds([]); return }
      if (e.code === 'Space' && spacePrevTool.current === null) {
        spacePrevTool.current = tool; setTool('hand'); return
      }
      if (!meta && TOOL_KEYS[k]) setTool(TOOL_KEYS[k])
    }
    function onKeyUp(e: KeyboardEvent) {
      if (e.code === 'Space' && spacePrevTool.current !== null) {
        setTool(spacePrevTool.current); spacePrevTool.current = null
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tool])

  // ---- image paste ----
  useEffect(() => {
    async function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'))
      const file = item?.getAsFile()
      if (file) await addImageFromFile(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale, pos])

  const viewportCenterWorld = () => {
    const cx = window.innerWidth / 2
    const cy = (window.innerHeight - TOP) / 2
    return { x: (cx - pos.x) / scale, y: (cy - pos.y) / scale }
  }
  const addImageFromFile = async (file: File) => {
    const { src, width, height } = await fileToShapeImage(file)
    const c = viewportCenterWorld()
    addShape({ id: uid(), type: 'image', stroke: '#00000000', strokeWidth: 0, x: c.x - width / 2, y: c.y - height / 2, width, height, src })
    setTool('select')
  }

  const onCursorMove = (x: number, y: number) => socket.emit('cursor:move', { boardId, x, y })

  const zoomAround = (factor: number) => {
    const cx = window.innerWidth / 2, cy = (window.innerHeight - TOP) / 2
    const worldX = (cx - pos.x) / scale, worldY = (cy - pos.y) / scale
    const next = Math.max(0.15, Math.min(scale * factor, 6))
    setScale(next); setPos({ x: cx - worldX * next, y: cy - worldY * next })
  }
  const resetView = () => { setScale(1); setPos({ x: 0, y: 0 }) }
  const jumpToUser = (userId: string) => {
    const c = cursors[userId]; if (!c) return
    const cx = window.innerWidth / 2, cy = (window.innerHeight - TOP) / 2
    setPos({ x: cx - c.x * scale, y: cy - c.y * scale })
  }

  // ---- in-place text ----
  const startTextCreate = (worldX: number, worldY: number) => setEditing({ id: null, worldX, worldY, value: '' })
  const startTextEdit = (s: Shape) => setEditing({ id: s.id, worldX: s.x ?? 0, worldY: s.y ?? 0, value: s.text ?? '' })
  const commitText = () => {
    if (!editing) return
    const val = editing.value.trim()
    if (editing.id) {
      const before = shapesRef.current.find((x) => x.id === editing.id)
      if (before) {
        if (val) commitBatch([{ before, after: { ...before, text: val } }])
        else removeShapes([before.id])
      }
    } else if (val) {
      addShape({ id: uid(), type: 'text', stroke: color, strokeWidth: 1, x: editing.worldX, y: editing.worldY, text: val, fontSize: 22, fill: color })
    }
    setEditing(null)
  }
  const editorScreen = editing ? { left: pos.x + editing.worldX * scale, top: pos.y + editing.worldY * scale } : null

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Toolbar
        tool={tool} setTool={setTool}
        color={color} setColor={setColor}
        strokeWidth={strokeWidth} setStrokeWidth={setStrokeWidth}
        onClear={clearBoard}
        onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo}
        onPickImage={() => fileInputRef.current?.click()}
        hasSelection={selectedIds.length > 0}
        onBringToFront={bringToFront} onSendToBack={sendToBack}
        onDuplicate={duplicateSelection} onDelete={() => removeShapes(selectedIds)}
        users={users} boardId={boardId} onJumpToUser={jumpToUser}
      />

      <input ref={fileInputRef} type="file" accept="image/*" hidden
        onChange={(e) => { const f = e.target.files?.[0]; if (f) addImageFromFile(f); e.target.value = '' }} />

      <div className="flex-1 relative"
        style={{
          backgroundColor: '#f8fafc',
          backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
          backgroundSize: `${24 * scale}px ${24 * scale}px`,
          backgroundPosition: `${pos.x}px ${pos.y}px`,
        }}>
        <Canvas
          tool={tool} color={color} strokeWidth={strokeWidth}
          shapes={shapes} cursors={cursors} users={users}
          selectedIds={selectedIds} setSelectedIds={setSelectedIds}
          addShape={addShape} commitBatch={commitBatch}
          onStartText={startTextCreate} onEditText={startTextEdit}
          onCursorMove={onCursorMove} stageRef={stageRef}
          scale={scale} pos={pos} setScale={setScale} setPos={setPos}
        />

        {editing && editorScreen && (
          <textarea autoFocus value={editing.value}
            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText() }
              else if (e.key === 'Escape') setEditing(null)
            }}
            className="absolute z-10 bg-white/95 border-2 border-indigo-500 rounded px-1 outline-none resize-none shadow"
            style={{ left: editorScreen.left, top: editorScreen.top, fontSize: 22 * scale, minWidth: 120, color }} />
        )}

        <div className="absolute bottom-4 left-4 flex items-center gap-1 bg-slate-900/90 text-slate-100 rounded-lg p-1 shadow-lg select-none">
          <button onClick={() => zoomAround(1 / 1.2)} className="w-8 h-8 rounded-md hover:bg-slate-700 text-lg" title="Zoom out">−</button>
          <button onClick={resetView} className="px-2 h-8 rounded-md hover:bg-slate-700 text-xs tabular-nums min-w-[3.5rem]" title="Reset view">{Math.round(scale * 100)}%</button>
          <button onClick={() => zoomAround(1.2)} className="w-8 h-8 rounded-md hover:bg-slate-700 text-lg" title="Zoom in">+</button>
        </div>

        <div className="absolute bottom-4 right-4 text-xs text-slate-500 bg-slate-900/70 rounded px-2 py-1 select-none">
          shortcuts: v/p/r/o/a/t/s · space=pan · Ctrl+D dup · [ ] layer
        </div>
      </div>
    </div>
  )
}
