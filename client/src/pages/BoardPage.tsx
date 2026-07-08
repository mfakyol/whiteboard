import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import type Konva from 'konva'
import Canvas from '../components/Canvas'
import Toolbar from '../components/Toolbar'
import { getSocket } from '../lib/socket'
import { getUser } from '../lib/user'
import type { Shape, Tool, User, Cursor } from '../lib/types'

const TOP = 53
function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

interface HistoryOp {
  undo: () => void
  redo: () => void
}

interface Editing {
  id: string | null
  worldX: number
  worldY: number
  value: string
}

// Downscale big images so the base64 we store/broadcast stays reasonable.
function fileToShapeImage(
  file: File,
): Promise<{ src: string; width: number; height: number }> {
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
  useEffect(() => {
    shapesRef.current = shapes
  }, [shapes])

  const [users, setUsers] = useState<User[]>([])
  const [cursors, setCursors] = useState<Record<string, Cursor>>({})
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#0f172a')
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [editing, setEditing] = useState<Editing | null>(null)

  // ---- history (per-client, operation based) ----
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

  // ---- low-level (state + socket, no history) ----
  const emitAdd = useCallback(
    (s: Shape) => {
      setShapes((p) => [...p, s])
      socket.emit('shape:add', { boardId, shape: s })
    },
    [socket, boardId],
  )
  const emitDelete = useCallback(
    (shapeId: string) => {
      setShapes((p) => p.filter((x) => x.id !== shapeId))
      socket.emit('shape:delete', { boardId, shapeId })
    },
    [socket, boardId],
  )
  const emitUpdate = useCallback(
    (s: Shape) => {
      setShapes((p) => p.map((x) => (x.id === s.id ? s : x)))
      socket.emit('shape:update', { boardId, shape: s })
    },
    [socket, boardId],
  )

  // ---- public actions (record history) ----
  const addShape = (s: Shape) => {
    emitAdd(s)
    pushOp({ undo: () => emitDelete(s.id), redo: () => emitAdd(s) })
  }
  const removeShape = (shapeId: string) => {
    const s = shapesRef.current.find((x) => x.id === shapeId)
    if (!s) return
    emitDelete(shapeId)
    pushOp({ undo: () => emitAdd(s), redo: () => emitDelete(shapeId) })
    if (selectedId === shapeId) setSelectedId(null)
  }
  const commitShape = (before: Shape, after: Shape) => {
    emitUpdate(after)
    pushOp({ undo: () => emitUpdate(before), redo: () => emitUpdate(after) })
  }
  const clearBoard = () => {
    if (!window.confirm('Clear the whole board for everyone?')) return
    const snapshot = shapesRef.current
    setShapes([])
    socket.emit('board:clear', { boardId })
    pushOp({
      undo: () => snapshot.forEach(emitAdd),
      redo: () => {
        setShapes([])
        socket.emit('board:clear', { boardId })
      },
    })
  }

  const undo = () => {
    const op = undoStack.current.pop()
    if (!op) return
    op.undo()
    redoStack.current.push(op)
    syncHistory()
  }
  const redo = () => {
    const op = redoStack.current.pop()
    if (!op) return
    op.redo()
    undoStack.current.push(op)
    syncHistory()
  }

  // ---- socket wiring ----
  useEffect(() => {
    const join = () => socket.emit('board:join', { boardId, user })
    join()
    socket.on('connect', join)

    socket.on('board:state', ({ shapes }: { shapes: Shape[] }) => setShapes(shapes))
    socket.on('shape:add', (s: Shape) => setShapes((p) => [...p, s]))
    socket.on('shape:update', (s: Shape) =>
      setShapes((p) => p.map((x) => (x.id === s.id ? s : x))),
    )
    socket.on('shape:delete', (id: string) =>
      setShapes((p) => p.filter((x) => x.id !== id)),
    )
    socket.on('board:clear', () => setShapes([]))

    socket.on('presence:list', (list: User[]) => setUsers(list))
    socket.on('presence:join', (u: User) =>
      setUsers((p) => (p.some((x) => x.id === u.id) ? p : [...p, u])),
    )
    socket.on('presence:leave', (userId: string) => {
      setUsers((p) => p.filter((x) => x.id !== userId))
      setCursors((p) => {
        const next = { ...p }
        delete next[userId]
        return next
      })
    })
    socket.on('cursor:move', ({ userId, x, y }: { userId: string; x: number; y: number }) =>
      setCursors((p) => ({ ...p, [userId]: { x, y } })),
    )

    return () => {
      socket.emit('board:leave', { boardId })
      socket.off('connect', join)
      socket.off('board:state')
      socket.off('shape:add')
      socket.off('shape:update')
      socket.off('shape:delete')
      socket.off('board:clear')
      socket.off('presence:list')
      socket.off('presence:join')
      socket.off('presence:leave')
      socket.off('cursor:move')
    }
  }, [socket, boardId, user])

  // ---- keyboard: delete / undo / redo ----
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      const meta = e.ctrlKey || e.metaKey
      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      } else if (meta && e.key.toLowerCase() === 'y') {
        e.preventDefault()
        redo()
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        removeShape(selectedId)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // ---- image paste ----
  useEffect(() => {
    async function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) =>
        i.type.startsWith('image/'),
      )
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
    addShape({
      id: uid(), type: 'image', stroke: '#00000000', strokeWidth: 0,
      x: c.x - width / 2, y: c.y - height / 2, width, height, src,
    })
    setTool('select')
  }

  const onCursorMove = (x: number, y: number) =>
    socket.emit('cursor:move', { boardId, x, y })

  // ---- viewport helpers ----
  const zoomAround = (factor: number) => {
    const cx = window.innerWidth / 2
    const cy = (window.innerHeight - TOP) / 2
    const worldX = (cx - pos.x) / scale
    const worldY = (cy - pos.y) / scale
    const next = Math.max(0.15, Math.min(scale * factor, 6))
    setScale(next)
    setPos({ x: cx - worldX * next, y: cy - worldY * next })
  }
  const resetView = () => {
    setScale(1)
    setPos({ x: 0, y: 0 })
  }
  const jumpToUser = (userId: string) => {
    const c = cursors[userId]
    if (!c) return
    const cx = window.innerWidth / 2
    const cy = (window.innerHeight - TOP) / 2
    setPos({ x: cx - c.x * scale, y: cy - c.y * scale })
  }

  // ---- in-place text editor ----
  const startTextCreate = (worldX: number, worldY: number) =>
    setEditing({ id: null, worldX, worldY, value: '' })
  const startTextEdit = (s: Shape) =>
    setEditing({ id: s.id, worldX: s.x ?? 0, worldY: s.y ?? 0, value: s.text ?? '' })
  const commitText = () => {
    if (!editing) return
    const val = editing.value.trim()
    if (editing.id) {
      const before = shapesRef.current.find((x) => x.id === editing.id)
      if (before) {
        if (val) commitShape(before, { ...before, text: val })
        else removeShape(before.id)
      }
    } else if (val) {
      addShape({
        id: uid(), type: 'text', stroke: color, strokeWidth: 1,
        x: editing.worldX, y: editing.worldY, text: val, fontSize: 22, fill: color,
      })
    }
    setEditing(null)
  }

  const editorScreen = editing
    ? { left: pos.x + editing.worldX * scale, top: pos.y + editing.worldY * scale }
    : null

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Toolbar
        tool={tool} setTool={setTool}
        color={color} setColor={setColor}
        strokeWidth={strokeWidth} setStrokeWidth={setStrokeWidth}
        onClear={clearBoard}
        onUndo={undo} onRedo={redo} canUndo={canUndo} canRedo={canRedo}
        onPickImage={() => fileInputRef.current?.click()}
        users={users} boardId={boardId} onJumpToUser={jumpToUser}
      />

      <input
        ref={fileInputRef} type="file" accept="image/*" hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) addImageFromFile(f)
          e.target.value = ''
        }}
      />

      <div
        className="flex-1 relative"
        style={{
          backgroundColor: '#f8fafc',
          backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
          backgroundSize: `${24 * scale}px ${24 * scale}px`,
          backgroundPosition: `${pos.x}px ${pos.y}px`,
        }}
      >
        <Canvas
          tool={tool} color={color} strokeWidth={strokeWidth}
          shapes={shapes} cursors={cursors} users={users}
          selectedId={selectedId} setSelectedId={setSelectedId}
          addShape={addShape} commitShape={commitShape}
          onStartText={startTextCreate} onEditText={startTextEdit}
          onCursorMove={onCursorMove} stageRef={stageRef}
          scale={scale} pos={pos} setScale={setScale} setPos={setPos}
        />

        {editing && editorScreen && (
          <textarea
            autoFocus
            value={editing.value}
            onChange={(e) => setEditing({ ...editing, value: e.target.value })}
            onBlur={commitText}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                commitText()
              } else if (e.key === 'Escape') {
                setEditing(null)
              }
            }}
            className="absolute z-10 bg-white/95 border-2 border-indigo-500 rounded px-1 outline-none resize-none shadow"
            style={{
              left: editorScreen.left,
              top: editorScreen.top,
              fontSize: 22 * scale,
              minWidth: 120,
              color,
            }}
          />
        )}

        {/* Zoom controls */}
        <div className="absolute bottom-4 left-4 flex items-center gap-1 bg-slate-900/90 text-slate-100 rounded-lg p-1 shadow-lg select-none">
          <button onClick={() => zoomAround(1 / 1.2)} className="w-8 h-8 rounded-md hover:bg-slate-700 text-lg" title="Zoom out">−</button>
          <button onClick={resetView} className="px-2 h-8 rounded-md hover:bg-slate-700 text-xs tabular-nums min-w-[3.5rem]" title="Reset view">{Math.round(scale * 100)}%</button>
          <button onClick={() => zoomAround(1.2)} className="w-8 h-8 rounded-md hover:bg-slate-700 text-lg" title="Zoom in">+</button>
        </div>

        <div className="absolute bottom-4 right-4 text-xs text-slate-500 bg-slate-900/70 rounded px-2 py-1 select-none">
          ✋ pan · Ctrl+scroll zoom · double-click text to edit
        </div>
      </div>
    </div>
  )
}
