import { z } from 'zod'

export const createBoardSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
})

export const renameBoardSchema = z.object({
  name: z.string().trim().min(1).max(120),
})

export type CreateBoardInput = z.infer<typeof createBoardSchema>
export type RenameBoardInput = z.infer<typeof renameBoardSchema>
