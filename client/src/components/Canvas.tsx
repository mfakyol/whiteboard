import { useEffect, useRef, useState } from 'react'
import {
  Stage, Layer, Line, Rect, Ellipse, Arrow, Text, Group, Circle,
  Transformer, Image as KonvaImage,
} from 'react-konva'
import type Konva from 'konva'
import type { Shape, Tool, User, Cursor } from '../lib/types'

const TOP_OFFSET = 53
const MIN_SCALE = 0.15
const MAX_SCALE = 6

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

// Loads an image src into a Konva Image node.
function ImageShape({ src, nodeProps }: { src?: string; nodeProps: Record<string, unknown> }) {
  const [img, setImg] = useState<HTMLImageElement>()
  useEffect(() => {
    if (!src) return
    const im = new window.Image()
    im.onload = () => setImg(im)
    im.src = src
  }, [src])
  return <KonvaImage {...nodeProps} image={img} />
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
  commitShape: (before: Shape, after: Shape) => void
  onStartText: (worldX: number, worldY: number) => void
  onEditText: (s: Shape) => void
  onCursorMove: (x: number, y: number) => void
  stageRef: React.RefObject<Konva.Stage | null>
  scale: number
  pos: { x: number; y: number }
  setScale: (s: number) => void
  setPos: (p: { x: number; y: number }) => void
}

export default function Canvas({
  tool, color, strokeWidth, shapes, cursors, users, selectedId,
  setSelectedId, addShape, commitShape, onStartText, onEditText,
  onCursorMove, stageRef, scale, pos, setScale, setPos,
}: Props) {
  const [size, setSize] = useState({
    w: window.innerWidth,
    h: window.innerHeight - TOP_OFFSET,
  })
  const [draft, setDraft] = useState<Shape | null>(null)
  const drawing = useRef(false)
  const lastCursor = useRef(0)
  const trRef = useRef<Konva.Transformer | null>(null)

  useEffect(() => {
    const onResize = () =>
      setSize({ w: window.innerWidth, h: window.innerHeight - TOP_OFFSET })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Attach the resize/rotate transformer to the selected (non-stroke) shape.
  useEffect(() => {
    const tr = trRef.current
    const stage = stageRef.current
    if (!tr || !stage) return
    const s = shapes.find((x) => x.id === selectedId)
    if (tool === 'select' && s && s.type !== 'pen' && s.type !== 'arrow') {
      const node = stage.findOne('#' + selectedId)
      if (node) {
        tr.nodes([node])
        tr.getLayer()?.batchDraw()
        return
      }
    }
    tr.nodes([])
  }, [selectedId, tool, shapes, stageRef])

  function pointer(): { x: number; y: number } {
    const p = stageRef.current?.getRelativePointerPosition()
    return p ?? { x: 0, y: 0 }
  }

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
    if (tool === 'hand') return
    if (tool === 'select') {
      if (e.target === e.target.getStage()) setSelectedId(null)
      return
    }
    const { x, y } = pointer()
    const base = { id: uid(), stroke: color, strokeWidth }

    if (tool === 'pen') {
      setDraft({ ...base, type: 'pen', points: [x, y] }); drawing.current = true
    } else if (tool === 'arrow') {
      setDraft({ ...base, type: 'arrow', points: [x, y, x, y] }); drawing.current = true
    } else if (tool === 'rect' || tool === 'ellipse') {
      setDraft({ ...base, type: tool, x, y, width: 0, height: 0 }); drawing.current = true
    } else if (tool === 'text') {
      onStartText(x, y)
    } else if (tool === 'sticky') {
      addShape({ ...base, type: 'sticky', x: x - 80, y: y - 60, width: 160, height: 120, text: 'Note', fill: '#fde68a', stroke: '#00000000' })
    }
  }

  function handleMouseMove() {
    const { x, y } = pointer()
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
    if (!drawing.current || !draft) { drawing.current = false; return }
    drawing.current = false
    let s = draft
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

  // Move committed to history (before = current s, after = new position).
  function onDragEndShape(s: Shape, e: Konva.KonvaEventObject<DragEvent>) {
    const node = e.target
    let after: Shape
    if (s.type === 'pen' || s.type === 'arrow') {
      const dx = node.x(), dy = node.y()
      const pts = (s.points ?? []).map((p, i) => (i % 2 === 0 ? p + dx : p + dy))
      node.position({ x: 0, y: 0 })
      after = { ...s, points: pts }
    } else if (s.type === 'ellipse') {
      after = { ...s, x: node.x() - (s.width ?? 0) / 2, y: node.y() - (s.height ?? 0) / 2 }
    } else {
      after = { ...s, x: node.x(), y: node.y() }
    }
    commitShape(s, after)
  }

  // Resize / rotate committed to history.
  function onTransformEndShape(s: Shape, e: Konva.KonvaEventObject<Event>) {
    const node = e.target
    const sx = node.scaleX(), sy = node.scaleY()
    node.scaleX(1); node.scaleY(1)
    const rotation = node.rotation()
    let after: Shape
    if (s.type === 'ellipse') {
      const w = Math.max(5, (s.width ?? 0) * sx)
      const h = Math.max(5, (s.height ?? 0) * sy)
      after = { ...s, width: w, height: h, rotation, x: node.x() - w / 2, y: node.y() - h / 2 }
    } else if (s.type === 'text') {
      after = { ...s, x: node.x(), y: node.y(), rotation, fontSize: Math.max(6, (s.fontSize ?? 22) * sy) }
    } else {
      after = {
        ...s, x: node.x(), y: node.y(), rotation,
        width: Math.max(5, (s.width ?? 0) * sx),
        height: Math.max(5, (s.height ?? 0) * sy),
      }
    }
    commitShape(s, after)
  }

  function renderShape(s: Shape, isDraft = false) {
    const selected = !isDraft && s.id === selectedId
    const common = {
      id: s.id,
      rotation: s.rotation,
      draggable: selectable && !isDraft,
      onClick: () => selectable && setSelectedId(s.id),
      onTap: () => selectable && setSelectedId(s.id),
      onDblClick: () => (s.type === 'text' || s.type === 'sticky') && onEditText(s),
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => onDragEndShape(s, e),
      onTransformEnd: (e: Konva.KonvaEventObject<Event>) => onTransformEndShape(s, e),
      shadowColor: '#6366f1',
      shadowBlur: selected ? 12 : 0,
      opacity: isDraft ? 0.8 : 1,
    }

    switch (s.type) {
      case 'pen':
        return <Line key={s.id} {...common} points={s.points} stroke={s.stroke} strokeWidth={s.strokeWidth} lineCap="round" lineJoin="round" tension={0.4} hitStrokeWidth={20} />
      case 'arrow':
        return <Arrow key={s.id} {...common} points={s.points ?? []} stroke={s.stroke} fill={s.stroke} strokeWidth={s.strokeWidth} pointerLength={10} pointerWidth={10} hitStrokeWidth={20} />
      case 'rect':
        return <Rect key={s.id} {...common} x={s.x} y={s.y} width={s.width} height={s.height} stroke={s.stroke} strokeWidth={s.strokeWidth} />
      case 'ellipse':
        return <Ellipse key={s.id} {...common} x={(s.x ?? 0) + (s.width ?? 0) / 2} y={(s.y ?? 0) + (s.height ?? 0) / 2} radiusX={Math.abs(s.width ?? 0) / 2} radiusY={Math.abs(s.height ?? 0) / 2} stroke={s.stroke} strokeWidth={s.strokeWidth} />
      case 'text':
        return <Text key={s.id} {...common} x={s.x} y={s.y} text={s.text} fontSize={s.fontSize ?? 22} fill={s.fill ?? s.stroke} />
      case 'image':
        return <ImageShape key={s.id} src={s.src} nodeProps={{ ...common, x: s.x, y: s.y, width: s.width, height: s.height }} />
      case 'sticky':
        return (
          <Group key={s.id} {...common} x={s.x} y={s.y}>
            <Rect width={s.width} height={s.height} fill={s.fill ?? '#fde68a'} cornerRadius={6} shadowColor="#000" shadowBlur={selected ? 12 : 6} shadowOpacity={0.25} />
            <Text text={s.text} width={s.width} height={s.height} padding={12} fontSize={16} fill="#1f2937" />
          </Group>
        )
      default:
        return null
    }
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
        if (e.target === e.target.getStage()) setPos({ x: e.target.x(), y: e.target.y() })
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ cursor: tool === 'hand' ? 'grab' : selectable ? 'default' : 'crosshair' }}
    >
      <Layer>
        {shapes.map((s) => renderShape(s))}
        {draft && renderShape(draft, true)}
        <Transformer ref={trRef} rotateEnabled ignoreStroke keepRatio={false} anchorSize={8} borderStroke="#6366f1" anchorStroke="#6366f1" />
      </Layer>

      <Layer listening={false}>
        {Object.entries(cursors).map(([userId, c]) => {
          const u = users.find((x) => x.id === userId)
          if (!u) return null
          return (
            <Group key={userId} x={c.x} y={c.y} scaleX={1 / scale} scaleY={1 / scale}>
              <Circle radius={5} fill={u.color} />
              <Rect x={8} y={8} width={u.name.length * 7 + 12} height={18} fill={u.color} cornerRadius={4} />
              <Text x={12} y={11} text={u.name} fontSize={11} fill="#fff" />
            </Group>
          )
        })}
      </Layer>
    </Stage>
  )
}
