import type { Server, Socket } from 'socket.io'
import { Board, type Shape } from '../models/Board'

interface User {
  id: string
  name: string
  color: string
}

interface SocketData {
  boardId?: string
  user?: User
}

// In-memory presence: boardId -> (socketId -> user). Presence is ephemeral
// (who is here right now); the drawing itself is persisted in MongoDB.
const presence = new Map<string, Map<string, User>>()

function room(boardId: string): string {
  return `board:${boardId}`
}

function presenceList(boardId: string): User[] {
  return Array.from(presence.get(boardId)?.values() ?? [])
}

async function getOrCreateBoard(boardId: string) {
  let board = await Board.findById(boardId)
  if (!board) board = await Board.create({ _id: boardId, shapes: [] })
  return board
}

export function registerSocketHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    const data = socket.data as SocketData

    socket.on(
      'board:join',
      async ({ boardId, user }: { boardId: string; user: User }) => {
        if (!boardId || !user) return
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
      },
    )

    socket.on(
      'shape:add',
      async ({ boardId, shape }: { boardId: string; shape: Shape }) => {
        if (!boardId || !shape?.id) return
        socket.to(room(boardId)).emit('shape:add', shape)
        await Board.updateOne({ _id: boardId }, { $push: { shapes: shape } })
      },
    )

    socket.on(
      'shape:update',
      async ({ boardId, shape }: { boardId: string; shape: Shape }) => {
        if (!boardId || !shape?.id) return
        socket.to(room(boardId)).emit('shape:update', shape)
        await Board.updateOne(
          { _id: boardId, 'shapes.id': shape.id },
          { $set: { 'shapes.$': shape } },
        )
      },
    )

    socket.on(
      'shape:delete',
      async ({ boardId, shapeId }: { boardId: string; shapeId: string }) => {
        if (!boardId || !shapeId) return
        socket.to(room(boardId)).emit('shape:delete', shapeId)
        await Board.updateOne(
          { _id: boardId },
          { $pull: { shapes: { id: shapeId } } },
        )
      },
    )

    socket.on('board:clear', async ({ boardId }: { boardId: string }) => {
      if (!boardId) return
      socket.to(room(boardId)).emit('board:clear')
      await Board.updateOne({ _id: boardId }, { $set: { shapes: [] } })
    })

    // Layer order: reorder the whole shapes array to the given id order.
    socket.on(
      'board:reorder',
      async ({ boardId, ids }: { boardId: string; ids: string[] }) => {
        if (!boardId || !Array.isArray(ids)) return
        socket.to(room(boardId)).emit('board:reorder', ids)
        const board = await Board.findById(boardId)
        if (!board) return
        const byId = new Map(
          (board.shapes as Shape[]).map((s) => [s.id, s]),
        )
        board.shapes = ids
          .map((id) => byId.get(id))
          .filter((s): s is Shape => Boolean(s))
        board.markModified('shapes')
        await board.save()
      },
    )

    // Live cursor — high frequency, broadcast only (never persisted).
    socket.on(
      'cursor:move',
      ({ boardId, x, y }: { boardId: string; x: number; y: number }) => {
        if (!boardId || !data.user) return
        socket
          .to(room(boardId))
          .emit('cursor:move', { userId: data.user.id, x, y })
      },
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
