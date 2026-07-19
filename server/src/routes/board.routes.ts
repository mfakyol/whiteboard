import { Router } from 'express'
import { create, getOne, list, remove, rename } from '../controllers/board.controller'
import { optionalAuth, requireAuth } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { createBoardSchema, renameBoardSchema } from '../schemas/board.schema'

const router = Router()

router.post('/boards', optionalAuth, validateBody(createBoardSchema), create)
router.get('/boards', requireAuth, list)
router.get('/boards/:id', getOne)
router.patch('/boards/:id', requireAuth, validateBody(renameBoardSchema), rename)
router.delete('/boards/:id', requireAuth, remove)

export default router
