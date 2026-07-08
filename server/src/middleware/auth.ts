import type { Request, Response, NextFunction, RequestHandler } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { env } from '../config/env'

export interface AuthedRequest extends Request {
  userId?: string
}

export function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10)
}
export function comparePassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash)
}
export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: '30d' })
}

function readUserId(req: Request): string | undefined {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return undefined
  try {
    const payload = jwt.verify(header.slice(7), env.jwtSecret) as { sub?: string }
    return payload.sub
  } catch {
    return undefined
  }
}

// Populates req.userId when a valid token is present; never rejects.
export const optionalAuth: RequestHandler = (req: AuthedRequest, _res, next) => {
  req.userId = readUserId(req)
  next()
}

// Requires a valid token.
export const requireAuth: RequestHandler = (req: AuthedRequest, res: Response, next: NextFunction) => {
  const userId = readUserId(req)
  if (!userId) return res.status(401).json({ message: 'Unauthorized' })
  req.userId = userId
  next()
}
