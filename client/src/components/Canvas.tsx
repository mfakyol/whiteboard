import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Line, Rect, Ellipse, Arrow, Text, Group, Circle } from 'react-konva'
import type Konva from 'konva'
import type { Shape, Tool, User, Cursor } from '../lib/types'

const TOP_OFFSET = 53 // toolbar height
const MIN_SCALE = 0.15
const MAX_SCALE = 6

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

interface Props {
  tool: Tool
  color: string
  strokeWidth: number
  shapes: Shape[]
  cursors: Record<string, Cursor>
  users: User[]
  selectedId: string | null
  setSelectedId: (id: string | null) => void
  addShape: (s: Shape) => void
  updateShape: (s: Shape, persist?: boolean) => void
  onCursorMove: (x: number, y: number) => void
  stageRef: React.RefObject<Konva.Stage | null>
  // Viewport transform (infinite canvas pan/zoom).
  scale: number
  pos: { x: number; y: number }
  setScale: (s: number) => void
  setPos: (p: { x: number; y: number }) => void
}

export default function Canvas({
  tool, color, strokeWidth, shapes, cursors, users, selectedId,
  setSelectedId, addShape, updateShape, onCursorMove, stageRef,
  scale, pos, setScale, setPos,
}: Props) {
  const [size, setSize] = useState({
    w: window.innerWidth,
    h: window.innerHeight - TOP_OFFSET,
  })
  const [draft, setDraft] = useState<Shape | null>(null)
  const drawing = useRef(false)
  const lastCursor = useRef(0)

  useEffect(() => {
    const onResize = () =>
      setSize({ w: window.innerWidth, h: window.innerHeight - TOP_OFFSET })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Pointer in world (canvas) coordinates — accounts for pan + zoom.
  function pointer(): { x: number; y: number } {
    const p = stageRef.current?.getRelativePointerPosition()
    return p ?? { x: 0, y: 0 }
  }

  // Ctrl/⌘+wheel (or trackpad pinch) = zoom toward the cursor; plain wheel = pan.
  function handleWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault()
    const stage = stageRef.current
    if (!stage) return

    if (e.evt.ctrlKey || e.evt.metaKey) {
      const screen = stage.getPointerPosition()
      if (!screen) return
      const worldX = (screen.x - pos.x) / scale
      const worldY = (screen.y - pos.y) / scale
      const factor = 1.08
      let next = e.evt.deltaY > 0 ? scale / factor : scale * factor
      next = Math.max(MIN_SCALE, Math.min(next, MAX_SCALE))
      setScale(next)
      setPos({ x: screen.x - worldX * next, y: screen.y - worldY * next })
    } else {
      setPos({ x: pos.x - e.evt.deltaX, y: pos.y - e.evt.deltaY })
    }
  }

  function handleMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (tool === 'hand') return // stage handles panning
    // Clicking empty canvas in select mode clears selection.
    if (tool === 'select') {
      if (e.target === e.target.getStage()) setSelectedId(null)
      return
    }
    const { x, y } = pointer()
    const base = { id: uid(), stroke: color, strokeWidth }

    if (tool === 'pen') {
      setDraft({ ...base, type: 'pen', points: [x, y] })
      drawing.current = true
    } else if (tool === 'arrow') {
      setDraft({ ...base, type: 'arrow', points: [x, y, x, y] })
      drawing.current = true
    } else if (tool === 'rect' || tool === 'ellipse') {
      setDraft({ ...base, type: tool, x, y, width: 0, height: 0 })
      drawing.current = true
    } else if (tool === 'text') {
      const text = window.prompt('Text:')?.trim()
      if (text) addShape({ ...base, type: 'text', x, y, text, fontSize: 22, fill: color })
    } else if (tool === 'sticky') {
      const text = window.prompt('Sticky note:')?.trim()
      if (text)
        addShape({ ...base, type: 'sticky', x: x - 80, y: y - 60, width: 160, height: 120, text, fill: '#fde68a', stroke: '#00000000' })
    }
  }

  function handleMouseMove() {
    const { x, y } = pointer()

    // Live cursor broadcast (throttled) — world coords, so everyone sees it in
    // the right place regardless of their own pan/zoom.
    const now = Date.now()
    if (now - lastCursor.current > 40) {
      lastCursor.current = now
      onCursorMove(x, y)
    }

    if (!drawing.current || !draft) return
    if (draft.type === 'pen') {
      setDraft({ ...draft, points: [...(draft.points ?? []), x, y] })
    } else if (draft.type === 'arrow') {
      const p = draft.points ?? [x, y, x, y]
      setDraft({ ...draft, points: [p[0], p[1], x, y] })
    } else if (draft.type === 'rect' || draft.type === 'ellipse') {
      setDraft({ ...draft, width: x - (draft.x ?? 0), height: y - (draft.y ?? 0) })
    }
  }

  function handleMouseUp() {
    if (!drawing.current || !draft) {
      drawing.current = false
      return
    }
    drawing.current = false
    let s = draft
    // Normalize negative-size boxes so x,y is top-left.
    if (s.type === 'rect' || s.type === 'ellipse') {
      let { x = 0, y = 0, width = 0, height = 0 } = s
      if (width < 0) { x += width; width = -width }
      if (height < 0) { y += height; height = -height }
      if (width < 3 && height < 3) { setDraft(null); return }
      s = { ...s, x, y, width, height }
    }
    if (s.type === 'pen' && (s.points?.length ?? 0) < 4) { setDraft(null); return }
    addShape(s)
    setDraft(null)
  }

  const selectable = tool === 'select'

  function renderShape(s: Shape, isDraft = false) {
    const selected = !isDraft && s.id === selectedId
    const common = {
      draggable: selectable && !isDraft,
      onClick: () => selectable && setSelectedId(s.id),
      onTap: () => selectable && setSelectedId(s.id),
      shadowColor: '#6366f1',
      shadowBlur: selected ? 12 : 0,
      opacity: isDraft ? 0.8 : 1,
    }
    const bakePoints = (e: Konva.KonvaEventObject<DragEvent>) => {
      const node = e.target
      const dx = node.x()
      const dy = node.y()
      const pts = (s.points ?? []).map((p, i) => (i % 2 === 0 ? p + dx : p + dy))
      node.position({ x: 0, y: 0 })
      updateShape({ ...s, points: pts })
    }
    const movePos = (e: Konva.KonvaEventObject<DragEvent>) =>
      updateShape({ ...s, x: e.target.x(), y: e.target.y() })

    switch (s.type) {
      case 'pen':
        return (
          <Line key={s.id} {...common} points={s.points} stroke={s.stroke}
            strokeWidth={s.strokeWidth} lineCap="round" lineJoin="round"
            tension={0.4} hitStrokeWidth={20} onDragEnd={bakePoints} />
        )
      case 'arrow':
        return (
          <Arrow key={s.id} {...common} points={s.points ?? []} stroke={s.stroke}
            fill={s.stroke} strokeWidth={s.strokeWidth} pointerLength={10}
            pointerWidth={10} hitStrokeWidth={20} onDragEnd={bakePoints} />
        )
      case 'rect':
        return (
          <Rect key={s.id} {...common} x={s.x} y={s.y} width={s.width}
            height={s.height} stroke={s.stroke} strokeWidth={s.strokeWidth}
            onDragEnd={movePos} />
        )
      case 'ellipse':
        return (
          <Ellipse key={s.id} {...common}
            x={(s.x ?? 0) + (s.width ?? 0) / 2} y={(s.y ?? 0) + (s.height ?? 0) / 2}
            radiusX={Math.abs(s.width ?? 0) / 2} radiusY={Math.abs(s.height ?? 0) / 2}
            stroke={s.stroke} strokeWidth={s.strokeWidth}
            onDragEnd={(e) =>
              updateShape({ ...s, x: e.target.x() - (s.width ?? 0) / 2, y: e.target.y() - (s.height ?? 0) / 2 })
            } />
        )
      case 'text':
        return (
          <Text key={s.id} {...common} x={s.x} y={s.y} text={s.text}
            fontSize={s.fontSize ?? 22} fill={s.fill ?? s.stroke} onDragEnd={movePos} />
        )
      case 'sticky':
        return (
          <Group key={s.id} {...common} x={s.x} y={s.y} onDragEnd={movePos}>
            <Rect width={s.width} height={s.height} fill={s.fill ?? '#fde68a'}
              cornerRadius={6} shadowColor="#000" shadowBlur={selected ? 12 : 6}
              shadowOpacity={0.25} />
            <Text text={s.text} width={s.width} height={s.height} padding={12}
              fontSize={16} fill="#1f2937" />
          </Group>
        )
      default:
        return null
    }
  }

  // World-space rectangle covering the current viewport (keeps a solid
  // background under any pan/zoom, and makes PNG exports non-transparent).
  const bg = {
    x: -pos.x / scale,
    y: -pos.y / scale,
    w: size.w / scale,
    h: size.h / scale,
  }

  return (
    <Stage
      ref={stageRef}
      width={size.w}
      height={size.h}
      x={pos.x}
      y={pos.y}
      scaleX={scale}
      scaleY={scale}
      draggable={tool === 'hand'}
      onWheel={handleWheel}
      onDragEnd={(e) => {
        if (e.target === e.target.getStage())
          setPos({ x: e.target.x(), y: e.target.y() })
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{
        background: '#eef2f7',
        cursor: tool === 'hand' ? 'grab' : selectable ? 'default' : 'crosshair',
      }}
    >
      <Layer>
        <Rect x={bg.x} y={bg.y} width={bg.w} height={bg.h} fill="#f8fafc" listening={false} />
        {shapes.map((s) => renderShape(s))}
        {draft && renderShape(draft, true)}
      </Layer>

      {/* Remote cursors (non-interactive). Counter-scaled so they stay a
          constant on-screen size at any zoom level. */}
      <Layer listening={false}>
        {Object.entries(cursors).map(([userId, c]) => {
          const u = users.find((x) => x.id === userId)
          if (!u) return null
          return (
            <Group key={userId} x={c.x} y={c.y} scaleX={1 / scale} scaleY={1 / scale}>
              <Circle radius={5} fill={u.color} />
              <Rect x={8} y={8} width={u.name.length * 7 + 12} height={18}
                fill={u.color} cornerRadius={4} />
              <Text x={12} y={11} text={u.name} fontSize={11} fill="#fff" />
            </Group>
          )
        })}
      </Layer>
    </Stage>
  )
}
