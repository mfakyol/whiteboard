import { useEffect, useRef, useState } from 'react'
import {
  Stage, Layer, Line, Rect, Ellipse, Arrow, Text, Group, Circle,
  Transformer, Image as KonvaImage,
} from 'react-konva'
import type Konva from 'konva'
import type { Shape, Tool, User, Cursor } from '@/types'

const TOP_OFFSET = 53
const MIN_SCALE = 0.15
const MAX_SCALE = 6

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
function toggle(list: string[], id: string): string[] {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id]
}
function rectsIntersect(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y)
}

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

// In-place text editor state. Geometry is stored in world units + the shape's
// own attributes, so the DOM overlay is derived from the shape and follows
// pan / zoom / rotation instead of being positioned by hand.
interface EditorState {
  id: string | null // null = creating new text
  type: 'text' | 'sticky'
  worldX: number
  worldY: number
  rotation: number
  baseFontSize: number
  basePadding: number
  baseWidth?: number
  baseHeight?: number
  color: string
  background?: string
  value: string
}

interface Props {
  tool: Tool
  color: string
  strokeWidth: number
  shapes: Shape[]
  cursors: Record<string, Cursor>
  users: User[]
  selectedIds: string[]
  setSelectedIds: (ids: string[]) => void
  addShape: (s: Shape) => void
  commitBatch: (pairs: { before: Shape; after: Shape }[]) => void
  removeShapes: (ids: string[]) => void
  onCursorMove: (x: number, y: number) => void
  stageRef: React.RefObject<Konva.Stage | null>
  scale: number
  pos: { x: number; y: number }
  setScale: (s: number) => void
  setPos: (p: { x: number; y: number }) => void
  readOnly?: boolean
}

export default function Canvas({
  tool, color, strokeWidth, shapes, cursors, users, selectedIds,
  setSelectedIds, addShape, commitBatch, removeShapes,
  onCursorMove, stageRef, scale, pos, setScale, setPos, readOnly = false,
}: Props) {
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight - TOP_OFFSET })
  const [draft, setDraft] = useState<Shape | null>(null)
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null)
  const [editor, setEditor] = useState<EditorState | null>(null)
  const drawing = useRef(false)
  const lastCursor = useRef(0)
  const trRef = useRef<Konva.Transformer | null>(null)
  const marqueeStart = useRef<{ x: number; y: number } | null>(null)
  const marqueeAdd = useRef(false)
  // Active group-drag: ids + each node's starting position.
  const dragRef = useRef<{ ids: string[]; start: Record<string, { x: number; y: number }> } | null>(null)

  useEffect(() => {
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight - TOP_OFFSET })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Resize/rotate transformer only for a single, non-stroke selection.
  useEffect(() => {
    const tr = trRef.current
    const stage = stageRef.current
    if (!tr || !stage) return
    if (tool === 'select' && selectedIds.length === 1) {
      const s = shapes.find((x) => x.id === selectedIds[0])
      if (s && s.type !== 'pen' && s.type !== 'arrow') {
        const node = stage.findOne('#' + s.id)
        if (node) { tr.nodes([node]); tr.getLayer()?.batchDraw(); return }
      }
    }
    tr.nodes([])
  }, [selectedIds, tool, shapes, stageRef])

  function pointer(): { x: number; y: number } {
    const p = stageRef.current?.getRelativePointerPosition()
    return p ?? { x: 0, y: 0 }
  }

  // ---- in-place text editing (Konva overlay) ----
  // Open on the next frame so the click that placed the editor finishes first —
  // otherwise that same click blurs the freshly-focused textarea and onBlur
  // commits an empty value, closing it before you can type.
  const openEditor = (next: EditorState) => requestAnimationFrame(() => setEditor(next))

  function startTextCreate() {
    const { x, y } = pointer()
    openEditor({
      id: null, type: 'text', worldX: x, worldY: y, rotation: 0,
      baseFontSize: 22, basePadding: 2, color, value: '',
    })
  }

  function startEdit(s: Shape) {
    const shared = { id: s.id, worldX: s.x ?? 0, worldY: s.y ?? 0, rotation: s.rotation ?? 0, value: s.text ?? '' }
    if (s.type === 'sticky') {
      openEditor({
        ...shared, type: 'sticky',
        baseWidth: s.width ?? 160, baseHeight: s.height ?? 120,
        baseFontSize: 16, basePadding: 12, color: '#1f2937', background: s.fill ?? '#fde68a',
      })
    } else {
      openEditor({ ...shared, type: 'text', baseFontSize: s.fontSize ?? 22, basePadding: 2, color: s.fill ?? s.stroke })
    }
  }

  function commitEditor() {
    if (!editor) return
    const val = editor.value.trim()
    if (editor.id) {
      const before = shapes.find((x) => x.id === editor.id)
      if (before) {
        if (val) commitBatch([{ before, after: { ...before, text: val } }])
        else removeShapes([before.id])
      }
    } else if (val) {
      addShape({ id: uid(), type: 'text', stroke: editor.color, strokeWidth: 1, x: editor.worldX, y: editor.worldY, text: val, fontSize: 22, fill: editor.color })
    }
    setEditor(null)
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
    if (readOnly || tool === 'hand') return
    if (tool === 'select') {
      const onEmpty = e.target === e.target.getStage()
      if (onEmpty) {
        if (!e.evt.shiftKey) setSelectedIds([])
        marqueeAdd.current = e.evt.shiftKey
        const p = pointer()
        marqueeStart.current = p
        setMarquee({ x: p.x, y: p.y, w: 0, h: 0 })
      }
      return
    }
    const { x, y } = pointer()
    const base = { id: uid(), stroke: color, strokeWidth }
    if (tool === 'pen') { setDraft({ ...base, type: 'pen', points: [x, y] }); drawing.current = true }
    else if (tool === 'arrow') { setDraft({ ...base, type: 'arrow', points: [x, y, x, y] }); drawing.current = true }
    else if (tool === 'rect' || tool === 'ellipse') { setDraft({ ...base, type: tool, x, y, width: 0, height: 0 }); drawing.current = true }
    else if (tool === 'text') { startTextCreate() }
    else if (tool === 'sticky') { addShape({ ...base, type: 'sticky', x: x - 80, y: y - 60, width: 160, height: 120, text: 'Note', fill: '#fde68a', stroke: '#00000000' }) }
  }

  function handleMouseMove() {
    const { x, y } = pointer()
    const now = Date.now()
    if (now - lastCursor.current > 40) { lastCursor.current = now; onCursorMove(x, y) }

    if (marqueeStart.current) {
      const s = marqueeStart.current
      setMarquee({ x: s.x, y: s.y, w: x - s.x, h: y - s.y })
      return
    }
    if (!drawing.current || !draft) return
    if (draft.type === 'pen') setDraft({ ...draft, points: [...(draft.points ?? []), x, y] })
    else if (draft.type === 'arrow') { const p = draft.points ?? [x, y, x, y]; setDraft({ ...draft, points: [p[0], p[1], x, y] }) }
    else if (draft.type === 'rect' || draft.type === 'ellipse') setDraft({ ...draft, width: x - (draft.x ?? 0), height: y - (draft.y ?? 0) })
  }

  function handleMouseUp() {
    // Finish marquee selection.
    if (marqueeStart.current) {
      const m = marquee
      marqueeStart.current = null
      setMarquee(null)
      if (m) {
        const box = { x: Math.min(m.x, m.x + m.w), y: Math.min(m.y, m.y + m.h), w: Math.abs(m.w), h: Math.abs(m.h) }
        const stage = stageRef.current
        if (stage && (box.w > 3 || box.h > 3)) {
          const hit = shapes.filter((s) => {
            const node = stage.findOne('#' + s.id)
            if (!node) return false
            const r = node.getClientRect({ relativeTo: stage })
            return rectsIntersect(box, { x: r.x, y: r.y, w: r.width, h: r.height })
          }).map((s) => s.id)
          setSelectedIds(marqueeAdd.current ? Array.from(new Set([...selectedIds, ...hit])) : hit)
        }
      }
      return
    }
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

  const selectable = tool === 'select' && !readOnly

  function afterFromNode(before: Shape, node: Konva.Node): Shape {
    if (before.type === 'pen' || before.type === 'arrow') {
      const dx = node.x(), dy = node.y()
      const pts = (before.points ?? []).map((p, i) => (i % 2 === 0 ? p + dx : p + dy))
      node.position({ x: 0, y: 0 })
      return { ...before, points: pts }
    }
    if (before.type === 'ellipse') {
      return { ...before, x: node.x() - (before.width ?? 0) / 2, y: node.y() - (before.height ?? 0) / 2 }
    }
    return { ...before, x: node.x(), y: node.y() }
  }

  function onDragStartShape(s: Shape) {
    const ids = selectedIds.includes(s.id) ? selectedIds : [s.id]
    if (!selectedIds.includes(s.id)) setSelectedIds([s.id])
    const stage = stageRef.current
    const start: Record<string, { x: number; y: number }> = {}
    ids.forEach((id) => {
      const n = stage?.findOne('#' + id)
      if (n) start[id] = { x: n.x(), y: n.y() }
    })
    dragRef.current = { ids, start }
  }
  function onDragMoveShape(s: Shape, e: Konva.KonvaEventObject<DragEvent>) {
    const d = dragRef.current
    if (!d || d.ids.length < 2) return
    const dx = e.target.x() - (d.start[s.id]?.x ?? 0)
    const dy = e.target.y() - (d.start[s.id]?.y ?? 0)
    const stage = stageRef.current
    d.ids.forEach((id) => {
      if (id === s.id) return
      const n = stage?.findOne('#' + id)
      const st = d.start[id]
      if (n && st) n.position({ x: st.x + dx, y: st.y + dy })
    })
  }
  function onDragEndShape(s: Shape) {
    const d = dragRef.current
    const ids = d?.ids ?? [s.id]
    const stage = stageRef.current
    const pairs: { before: Shape; after: Shape }[] = []
    ids.forEach((id) => {
      const before = shapes.find((x) => x.id === id)
      const node = stage?.findOne('#' + id)
      if (before && node) pairs.push({ before, after: afterFromNode(before, node) })
    })
    dragRef.current = null
    commitBatch(pairs)
  }
  function onTransformEndShape(s: Shape, e: Konva.KonvaEventObject<Event>) {
    const node = e.target
    const sx = node.scaleX(), sy = node.scaleY()
    node.scaleX(1); node.scaleY(1)
    const rotation = node.rotation()
    let after: Shape
    if (s.type === 'ellipse') {
      const w = Math.max(5, (s.width ?? 0) * sx), h = Math.max(5, (s.height ?? 0) * sy)
      after = { ...s, width: w, height: h, rotation, x: node.x() - w / 2, y: node.y() - h / 2 }
    } else if (s.type === 'text') {
      after = { ...s, x: node.x(), y: node.y(), rotation, fontSize: Math.max(6, (s.fontSize ?? 22) * sy) }
    } else {
      after = { ...s, x: node.x(), y: node.y(), rotation, width: Math.max(5, (s.width ?? 0) * sx), height: Math.max(5, (s.height ?? 0) * sy) }
    }
    commitBatch([{ before: s, after }])
  }

  function renderShape(s: Shape, isDraft = false) {
    const selected = !isDraft && selectedIds.includes(s.id)
    const common = {
      id: s.id,
      rotation: s.rotation,
      draggable: selectable && !isDraft,
      onClick: (e: Konva.KonvaEventObject<MouseEvent>) => {
        if (!selectable) return
        setSelectedIds(e.evt.shiftKey ? toggle(selectedIds, s.id) : [s.id])
      },
      onDblClick: () => { if (!readOnly && (s.type === 'text' || s.type === 'sticky')) startEdit(s) },
      onDragStart: () => onDragStartShape(s),
      onDragMove: (e: Konva.KonvaEventObject<DragEvent>) => onDragMoveShape(s, e),
      onDragEnd: () => onDragEndShape(s),
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

  const editorScreen = editor
    ? { left: pos.x + editor.worldX * scale, top: pos.y + editor.worldY * scale }
    : null

  return (
    <>
    <Stage
      ref={stageRef}
      width={size.w} height={size.h}
      x={pos.x} y={pos.y} scaleX={scale} scaleY={scale}
      draggable={readOnly || tool === 'hand'}
      onWheel={handleWheel}
      onDragEnd={(e) => { if (e.target === e.target.getStage()) setPos({ x: e.target.x(), y: e.target.y() }) }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      style={{ cursor: readOnly || tool === 'hand' ? 'grab' : selectable ? 'default' : 'crosshair' }}
    >
      <Layer>
        {shapes.map((s) => renderShape(s))}
        {draft && renderShape(draft, true)}
        {marquee && (
          <Rect
            x={Math.min(marquee.x, marquee.x + marquee.w)}
            y={Math.min(marquee.y, marquee.y + marquee.h)}
            width={Math.abs(marquee.w)} height={Math.abs(marquee.h)}
            fill="#6366f133" stroke="#6366f1" strokeWidth={1 / scale} listening={false}
          />
        )}
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

    {editor && editorScreen && (
      <textarea
        autoFocus
        value={editor.value}
        onChange={(e) => setEditor({ ...editor, value: e.target.value })}
        onBlur={commitEditor}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitEditor() }
          else if (e.key === 'Escape') setEditor(null)
        }}
        className={
          editor.type === 'sticky'
            ? 'absolute z-10 rounded-md outline-none resize-none shadow-lg leading-snug'
            : 'absolute z-10 bg-white/95 border-2 border-indigo-500 rounded px-1 outline-none resize-none shadow'
        }
        style={{
          left: editorScreen.left,
          top: editorScreen.top,
          width: editor.baseWidth ? editor.baseWidth * scale : undefined,
          height: editor.baseHeight ? editor.baseHeight * scale : undefined,
          minWidth: editor.type === 'text' ? 120 : undefined,
          fontSize: editor.baseFontSize * scale,
          padding: editor.basePadding * scale,
          color: editor.color,
          background: editor.background,
          transform: editor.rotation ? `rotate(${editor.rotation}deg)` : undefined,
          transformOrigin: 'top left',
        }}
      />
    )}
    </>
  )
}
