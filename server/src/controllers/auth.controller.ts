import type { RequestHandler } from 'express'
import { getMe, loginUser, registerUser } from '../services/auth.service'
import { AppError } from '../errors/AppError'

// Bodies are already validated by validateBody(...) in the route.
export const register: RequestHandler = async (req, res) => {
  res.status(201).json(await registerUser(req.body))
}

export const login: RequestHandler = async (req, res) => {
  res.json(await loginUser(req.body))
}

export const me: RequestHandler = async (req, res) => {
  if (!req.userId) throw new AppError(401, 'Unauthorized')
  res.json(await getMe(req.userId))
}
