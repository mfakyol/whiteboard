import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import type Konva from 'konva'
import Canvas from '../components/Canvas'
import Toolbar from '../components/Toolbar'
import { getSocket } from '../lib/socket'
import { getUser } from '../lib/user'
import type { Shape, Tool, User, Cursor } from '../lib/types'

export default function BoardPage() {
  const { id: boardId = '' } = useParams()
  const user = useMemo(() => getUser(), [])
  const socket = useMemo(() => getSocket(), [])
  const stageRef = useRef<Konva.Stage | null>(null)

  const [shapes, setShapes] = useState<Shape[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [cursors, setCursors] = useState<Record<string, Cursor>>({})
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#0f172a')
  const [strokeWidth, setStrokeWidth] = useState(3)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scale, setScale] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })

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

  // Delete selected shape with keyboard.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId) {
        deleteShape(selectedId)
        setSelectedId(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const addShape = (s: Shape) => {
    setShapes((p) => [...p, s])
    socket.emit('shape:add', { boardId, shape: s })
  }
  const updateShape = (s: Shape, persist = true) => {
    setShapes((p) => p.map((x) => (x.id === s.id ? s : x)))
    if (persist) socket.emit('shape:update', { boardId, shape: s })
  }
  const deleteShape = (shapeId: string) => {
    setShapes((p) => p.filter((x) => x.id !== shapeId))
    socket.emit('shape:delete', { boardId, shapeId })
  }
  const clearBoard = () => {
    if (!window.confirm('Clear the whole board for everyone?')) return
    setShapes([])
    socket.emit('board:clear', { boardId })
  }
  const onCursorMove = (x: number, y: number) =>
    socket.emit('cursor:move', { boardId, x, y })

  const zoomAround = (factor: number) => {
    const cx = window.innerWidth / 2
    const cy = (window.innerHeight - 53) / 2
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

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Toolbar
        tool={tool} setTool={setTool}
        color={color} setColor={setColor}
        strokeWidth={strokeWidth} setStrokeWidth={setStrokeWidth}
        onClear={clearBoard}
        users={users} boardId={boardId}
      />
      <div className="flex-1 relative">
        <Canvas
          tool={tool} color={color} strokeWidth={strokeWidth}
          shapes={shapes} cursors={cursors} users={users}
          selectedId={selectedId} setSelectedId={setSelectedId}
          addShape={addShape} updateShape={updateShape}
          onCursorMove={onCursorMove} stageRef={stageRef}
          scale={scale} pos={pos} setScale={setScale} setPos={setPos}
        />

        {/* Zoom controls */}
        <div className="absolute bottom-4 left-4 flex items-center gap-1 bg-slate-900/90 text-slate-100 rounded-lg p-1 shadow-lg select-none">
          <button
            onClick={() => zoomAround(1 / 1.2)}
            className="w-8 h-8 rounded-md hover:bg-slate-700 text-lg"
            title="Zoom out"
          >
            −
          </button>
          <button
            onClick={resetView}
            className="px-2 h-8 rounded-md hover:bg-slate-700 text-xs tabular-nums min-w-[3.5rem]"
            title="Reset view"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={() => zoomAround(1.2)}
            className="w-8 h-8 rounded-md hover:bg-slate-700 text-lg"
            title="Zoom in"
          >
            +
          </button>
        </div>

        <div className="absolute bottom-4 right-4 text-xs text-slate-500 bg-slate-900/70 rounded px-2 py-1 select-none">
          ✋ pan · Ctrl+scroll zoom
        </div>
      </div>
    </div>
  )
}
