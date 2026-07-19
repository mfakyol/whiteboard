// JWT sign/verify — framework-agnostic auth infrastructure (no req/res).
import jwt from 'jsonwebtoken'
import { env } from '../config/env'

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: '30d' })
}

// Returns the user id encoded in the token, or undefined if invalid/expired.
export function verifyToken(token: string): string | undefined {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub?: string }
    return payload.sub
  } catch {
    return undefined
  }
}
