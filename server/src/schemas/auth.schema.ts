import { z } from 'zod'

export const registerSchema = z.object({
  email: z.email().max(200).toLowerCase(),
  name: z.string().trim().min(1).max(80),
  password: z.string().min(6).max(200),
})

export const loginSchema = z.object({
  email: z.email().max(200).toLowerCase(),
  password: z.string().min(1).max(200),
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
