import { Router } from 'express'
import { nanoid } from 'nanoid'
import { Board } from '../models/Board'

const router = Router()

// Create a fresh board and return its short id.
router.post('/boards', async (_req, res) => {
  const id = nanoid(10)
  await Board.create({ _id: id, shapes: [] })
  res.status(201).json({ id })
})

// Check a board exists (used before joining by id).
router.get('/boards/:id', async (req, res) => {
  const board = await Board.findById(req.params.id).lean()
  if (!board) return res.status(404).json({ message: 'Board not found' })
  res.json({ id: board._id, shapeCount: board.shapes.length })
})

export default router
