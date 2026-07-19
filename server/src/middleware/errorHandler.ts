import type { ErrorRequestHandler, RequestHandler } from 'express'
import { AppError } from '../errors/AppError'
import { env } from '../config/env'

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ message: 'Not found' })
}

// The one place errors become responses. Never leaks internals in production.
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    return res.status(err.status).json({ message: err.message, code: err.code })
  }

  // Mongo duplicate-key (e.g. unique email) → 409.
  if (err && typeof err === 'object' && (err as { code?: number }).code === 11000) {
    return res.status(409).json({ message: 'Already exists' })
  }

  console.error(err)
  const message =
    env.isProd || !(err instanceof Error) ? 'Internal server error' : err.message
  res.status(500).json({ message })
}
