import { z } from 'zod'

// Socket payloads are just as untrusted as HTTP bodies — validate every one.

const boardId = z.string().min(1).max(64)

// A shape is intentionally schemaless (the client's drawing tools evolve without
// server migrations); the only contract is a stable string `id` + a `type`. We
// keep arbitrary extra fields but cap the serialized size to prevent abuse.
export const shapeSchema = z
  .object({
    id: z.string().min(1).max(100),
    type: z.string().min(1).max(40),
  })
  .catchall(z.unknown())
  .refine((s) => JSON.stringify(s).length <= 100_000, {
    message: 'Shape too large',
  })

const presenceUser = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(80),
  color: z.string().min(1).max(40),
})

export const joinSchema = z.object({ boardId, user: presenceUser })
export const shapeAddSchema = z.object({ boardId, shape: shapeSchema })
export const shapeUpdateSchema = z.object({ boardId, shape: shapeSchema })
export const shapeDeleteSchema = z.object({ boardId, shapeId: z.string().min(1).max(100) })
export const boardClearSchema = z.object({ boardId })
export const reorderSchema = z.object({
  boardId,
  ids: z.array(z.string().min(1).max(100)).max(10_000),
})
export const cursorSchema = z.object({
  boardId,
  x: z.number().finite(),
  y: z.number().finite(),
})

export type PresenceUser = z.infer<typeof presenceUser>
