import type { RequestHandler } from 'express'
import type { ZodType } from 'zod'
import { AppError } from '../errors/AppError'

// Validate req.body against a schema and replace it with the parsed (typed,
// whitelisted) result. Rejects with 400 via the central error handler so no
// raw request body ever reaches a controller or the database.
export function validateBody<T>(schema: ZodType<T>): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const first = result.error.issues[0]
      return next(new AppError(400, first?.message ?? 'Invalid request body', 'VALIDATION'))
    }
    req.body = result.data
    next()
  }
}
