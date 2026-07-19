import { nanoid } from 'nanoid'
import { Board, type Shape } from '../models/Board'
import { AppError } from '../errors/AppError'

// Cap persisted shapes so a client can't grow one board unboundedly.
export const MAX_SHAPES_PER_BOARD = 5000

// ---- REST (dashboard / metadata / lifecycle) ----------------------------

export async function createBoard(name: string | undefined, ownerId: string | null) {
  const id = nanoid(10)
  const boardName = name?.trim() || 'Untitled board'
  await Board.create({ _id: id, name: boardName, ownerId, shapes: [] })
  return { id }
}

export async function listBoards(ownerId: string) {
  const boards = await Board.find({ ownerId }).sort({ updatedAt: -1 }).lean()
  return boards.map((b) => ({
    id: b._id,
    name: b.name,
    updatedAt: b.updatedAt,
    shapeCount: (b.shapes as unknown[]).length,
  }))
}

export async function getBoardMeta(id: string) {
  const b = await Board.findById(id).lean()
  if (!b) throw new AppError(404, 'Board not found')
  return {
    id: b._id,
    name: b.name,
    ownerId: b.ownerId,
    shapeCount: (b.shapes as unknown[]).length,
  }
}

async function requireOwnedBoard(id: string, requesterId: string) {
  const b = await Board.findById(id)
  if (!b) throw new AppError(404, 'Not found')
  if (b.ownerId !== requesterId) throw new AppError(403, 'Forbidden')
  return b
}

export async function renameBoard(id: string, name: string, requesterId: string) {
  const b = await requireOwnedBoard(id, requesterId)
  b.name = name.trim() || b.name
  await b.save()
  return { id: b._id, name: b.name }
}

export async function deleteBoard(id: string, requesterId: string) {
  const b = await requireOwnedBoard(id, requesterId)
  await b.deleteOne()
  return { ok: true }
}

// ---- Realtime (called from socket handlers) -----------------------------

export async function getOrCreateBoard(boardId: string) {
  let board = await Board.findById(boardId)
  if (!board) board = await Board.create({ _id: boardId, shapes: [] })
  return board
}

export async function addShape(boardId: string, shape: Shape) {
  // Only push while under the cap — atomic, race-safe via $expr on shapes size.
  const res = await Board.updateOne(
    { _id: boardId, $expr: { $lt: [{ $size: '$shapes' }, MAX_SHAPES_PER_BOARD] } },
    { $push: { shapes: shape } },
  )
  if (res.matchedCount === 0) throw new AppError(409, 'Board is full')
}

export async function updateShape(boardId: string, shape: Shape) {
  await Board.updateOne(
    { _id: boardId, 'shapes.id': shape.id },
    { $set: { 'shapes.$': shape } },
  )
}

export async function deleteShape(boardId: string, shapeId: string) {
  await Board.updateOne({ _id: boardId }, { $pull: { shapes: { id: shapeId } } })
}

export async function clearBoard(boardId: string) {
  await Board.updateOne({ _id: boardId }, { $set: { shapes: [] } })
}

export async function reorderShapes(boardId: string, ids: string[]) {
  const board = await Board.findById(boardId)
  if (!board) return
  const byId = new Map((board.shapes as Shape[]).map((s) => [s.id, s]))
  board.shapes = ids.map((id) => byId.get(id)).filter((s): s is Shape => Boolean(s))
  board.markModified('shapes')
  await board.save()
}
