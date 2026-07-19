import type { Server, Socket } from 'socket.io'
import type { ZodType } from 'zod'
import {
  addShape,
  clearBoard,
  deleteShape,
  getOrCreateBoard,
  reorderShapes,
  updateShape,
} from '../services/board.service'
import { AppError } from '../errors/AppError'
import {
  boardClearSchema,
  cursorSchema,
  joinSchema,
  reorderSchema,
  shapeAddSchema,
  shapeDeleteSchema,
  shapeUpdateSchema,
  type PresenceUser,
} from '../schemas/socket.schema'

interface SocketData {
  boardId?: string
  user?: PresenceUser
}

// In-memory presence: boardId -> (socketId -> user). Presence is ephemeral
// (who is here right now); the drawing itself is persisted in MongoDB.
// NOTE: per-process — needs a shared store (Redis) to scale beyond one instance.
const presence = new Map<string, Map<string, PresenceUser>>()

function room(boardId: string): string {
  return `board:${boardId}`
}

function presenceList(boardId: string): PresenceUser[] {
  return Array.from(presence.get(boardId)?.values() ?? [])
}

// Simple per-socket, per-category sliding-window limiter to stop a client from
// flooding a room / hammering the DB with high-frequency events.
function makeLimiter(limit: number, windowMs: number): () => boolean {
  let count = 0
  let start = Date.now()
  return () => {
    const now = Date.now()
    if (now - start > windowMs) {
      start = now
      count = 0
    }
    count += 1
    return count <= limit
  }
}

// Validate a socket payload, then run the handler; report failures only to the
// caller. Never lets a handler rejection crash the process.
function on<T>(
  socket: Socket,
  event: string,
  schema: ZodType<T>,
  handler: (data: T) => void | Promise<void>,
  gate?: () => boolean,
): void {
  socket.on(event, async (payload: unknown) => {
    if (gate && !gate()) return // rate-limited: silently drop
    const parsed = schema.safeParse(payload)
    if (!parsed.success) return // invalid payload: ignore
    try {
      await handler(parsed.data)
    } catch (err) {
      socket.emit('error', {
        message: err instanceof AppError ? err.message : 'Server error',
      })
    }
  })
}

export function registerSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    const data = socket.data as SocketData
    // High-frequency events get their own budgets.
    const cursorGate = makeLimiter(60, 1000)
    const writeGate = makeLimiter(80, 1000)

    on(socket, 'board:join', joinSchema, async ({ boardId, user }) => {
      data.boardId = boardId
      data.user = user
      socket.join(room(boardId))

      // Send the current board state to the joiner.
      const board = await getOrCreateBoard(boardId)
      socket.emit('board:state', { shapes: board.shapes })

      // Track & broadcast presence.
      if (!presence.has(boardId)) presence.set(boardId, new Map())
      presence.get(boardId)!.set(socket.id, user)
      socket.emit('presence:list', presenceList(boardId))
      socket.to(room(boardId)).emit('presence:join', user)
    })

    on(
      socket,
      'shape:add',
      shapeAddSchema,
      async ({ boardId, shape }) => {
        socket.to(room(boardId)).emit('shape:add', shape)
        await addShape(boardId, shape)
      },
      writeGate,
    )

    on(
      socket,
      'shape:update',
      shapeUpdateSchema,
      async ({ boardId, shape }) => {
        socket.to(room(boardId)).emit('shape:update', shape)
        await updateShape(boardId, shape)
      },
      writeGate,
    )

    on(
      socket,
      'shape:delete',
      shapeDeleteSchema,
      async ({ boardId, shapeId }) => {
        socket.to(room(boardId)).emit('shape:delete', shapeId)
        await deleteShape(boardId, shapeId)
      },
      writeGate,
    )

    on(socket, 'board:clear', boardClearSchema, async ({ boardId }) => {
      socket.to(room(boardId)).emit('board:clear')
      await clearBoard(boardId)
    })

    // Layer order: reorder the whole shapes array to the given id order.
    on(socket, 'board:reorder', reorderSchema, async ({ boardId, ids }) => {
      socket.to(room(boardId)).emit('board:reorder', ids)
      await reorderShapes(boardId, ids)
    })

    // Live cursor — high frequency, broadcast only (never persisted). Identity
    // comes from the connection's join, not the payload.
    on(
      socket,
      'cursor:move',
      cursorSchema,
      ({ boardId, x, y }) => {
        if (!data.user) return
        socket.to(room(boardId)).emit('cursor:move', { userId: data.user.id, x, y })
      },
      cursorGate,
    )

    const leave = () => {
      const { boardId, user } = data
      if (!boardId || !user) return
      presence.get(boardId)?.delete(socket.id)
      if (presence.get(boardId)?.size === 0) presence.delete(boardId)
      socket.to(room(boardId)).emit('presence:leave', user.id)
    }

    // Left the board (navigated away) but the socket stays connected.
    socket.on('board:leave', () => {
      leave()
      if (data.boardId) socket.leave(room(data.boardId))
      data.boardId = undefined
    })

    socket.on('disconnect', leave)
  })
}
