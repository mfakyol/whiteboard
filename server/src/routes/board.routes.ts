import { Router } from 'express'
import { nanoid } from 'nanoid'
import { Board } from '../models/Board'
import { optionalAuth, requireAuth, type AuthedRequest } from '../middleware/auth'

const router = Router()

// Create a board. If the request is authenticated, it becomes owned + named.
router.post('/boards', optionalAuth, async (req: AuthedRequest, res) => {
  const id = nanoid(10)
  const name = (req.body?.name as string)?.trim() || 'Untitled board'
  await Board.create({ _id: id, name, ownerId: req.userId ?? null, shapes: [] })
  res.status(201).json({ id })
})

// List the current user's boards (dashboard).
router.get('/boards', requireAuth, async (req: AuthedRequest, res) => {
  const boards = await Board.find({ ownerId: req.userId })
    .sort({ updatedAt: -1 })
    .lean()
  res.json(
    boards.map((b) => ({
      id: b._id, name: b.name, updatedAt: b.updatedAt,
      shapeCount: (b.shapes as unknown[]).length,
    })),
  )
})

// Board metadata (also used to check existence before joining).
router.get('/boards/:id', async (req, res) => {
  const b = await Board.findById(req.params.id).lean()
  if (!b) return res.status(404).json({ message: 'Board not found' })
  res.json({ id: b._id, name: b.name, ownerId: b.ownerId, shapeCount: (b.shapes as unknown[]).length })
})

// Rename (owner only).
router.patch('/boards/:id', requireAuth, async (req: AuthedRequest, res) => {
  const b = await Board.findById(req.params.id)
  if (!b) return res.status(404).json({ message: 'Not found' })
  if (b.ownerId !== req.userId) return res.status(403).json({ message: 'Forbidden' })
  b.name = (req.body?.name as string)?.trim() || b.name
  await b.save()
  res.json({ id: b._id, name: b.name })
})

// Delete (owner only).
router.delete('/boards/:id', requireAuth, async (req: AuthedRequest, res) => {
  const b = await Board.findById(req.params.id)
  if (!b) return res.status(404).json({ message: 'Not found' })
  if (b.ownerId !== req.userId) return res.status(403).json({ message: 'Forbidden' })
  await b.deleteOne()
  res.json({ ok: true })
})

export default router
