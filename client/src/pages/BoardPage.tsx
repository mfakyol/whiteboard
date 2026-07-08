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

  const exportPng = () => {
    const uri = stageRef.current?.toDataURL({ pixelRatio: 2 })
    if (!uri) return
    const link = document.createElement('a')
    link.download = `board-${boardId}.png`
    link.href = uri
    link.click()
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <Toolbar
        tool={tool} setTool={setTool}
        color={color} setColor={setColor}
        strokeWidth={strokeWidth} setStrokeWidth={setStrokeWidth}
        onClear={clearBoard} onExport={exportPng}
        users={users} boardId={boardId}
      />
      <div className="flex-1 relative">
        <Canvas
          tool={tool} color={color} strokeWidth={strokeWidth}
          shapes={shapes} cursors={cursors} users={users}
          selectedId={selectedId} setSelectedId={setSelectedId}
          addShape={addShape} updateShape={updateShape}
          onCursorMove={onCursorMove} stageRef={stageRef}
        />
      </div>
    </div>
  )
}
