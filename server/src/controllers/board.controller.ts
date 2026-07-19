import type { RequestHandler } from 'express'
import {
  createBoard,
  deleteBoard,
  getBoardMeta,
  listBoards,
  renameBoard,
} from '../services/board.service'
import { AppError } from '../errors/AppError'

export const create: RequestHandler = async (req, res) => {
  res.status(201).json(await createBoard(req.body.name, req.userId ?? null))
}

export const list: RequestHandler = async (req, res) => {
  if (!req.userId) throw new AppError(401, 'Unauthorized')
  res.json(await listBoards(req.userId))
}

export const getOne: RequestHandler = async (req, res) => {
  res.json(await getBoardMeta(String(req.params.id)))
}

export const rename: RequestHandler = async (req, res) => {
  if (!req.userId) throw new AppError(401, 'Unauthorized')
  res.json(await renameBoard(String(req.params.id), req.body.name, req.userId))
}

export const remove: RequestHandler = async (req, res) => {
  if (!req.userId) throw new AppError(401, 'Unauthorized')
  res.json(await deleteBoard(String(req.params.id), req.userId))
}
