import type { Request, RequestHandler } from 'express'
import { verifyToken } from '../services/token.service'
import { AppError } from '../errors/AppError'

function readUserId(req: Request): string | undefined {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return undefined
  return verifyToken(header.slice(7))
}

// Populates req.userId when a valid token is present; never rejects.
export const optionalAuth: RequestHandler = (req, _res, next) => {
  req.userId = readUserId(req)
  next()
}

// Requires a valid token; otherwise 401 via the central error handler.
export const requireAuth: RequestHandler = (req, _res, next) => {
  const userId = readUserId(req)
  if (!userId) return next(new AppError(401, 'Unauthorized'))
  req.userId = userId
  next()
}
