import { Router } from 'express'
import { login, me, register } from '../controllers/auth.controller'
import { requireAuth } from '../middleware/auth'
import { validateBody } from '../middleware/validate'
import { authLimiter } from '../middleware/rateLimit'
import { loginSchema, registerSchema } from '../schemas/auth.schema'

const router = Router()

router.post('/auth/register', authLimiter, validateBody(registerSchema), register)
router.post('/auth/login', authLimiter, validateBody(loginSchema), login)
router.get('/auth/me', requireAuth, me)

export default router
