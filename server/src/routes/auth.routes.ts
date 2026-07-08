import { Router } from 'express'
import { User } from '../models/User'
import {
  hashPassword, comparePassword, signToken, requireAuth, type AuthedRequest,
} from '../middleware/auth'

const router = Router()

function publicUser(u: { _id: unknown; email: string; name: string }) {
  return { id: String(u._id), email: u.email, name: u.name }
}

router.post('/auth/register', async (req, res) => {
  const { email, name, password } = req.body ?? {}
  if (!email || !name || !password || password.length < 6)
    return res.status(400).json({ message: 'Email, name and a 6+ char password are required' })
  const exists = await User.findOne({ email: String(email).toLowerCase() })
  if (exists) return res.status(409).json({ message: 'Email already registered' })
  const user = await User.create({
    email: String(email).toLowerCase(),
    name,
    passwordHash: await hashPassword(password),
  })
  res.status(201).json({ token: signToken(String(user._id)), user: publicUser(user) })
})

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {}
  const user = await User.findOne({ email: String(email ?? '').toLowerCase() })
  if (!user || !(await comparePassword(password ?? '', user.passwordHash)))
    return res.status(401).json({ message: 'Invalid email or password' })
  res.json({ token: signToken(String(user._id)), user: publicUser(user) })
})

router.get('/auth/me', requireAuth, async (req: AuthedRequest, res) => {
  const user = await User.findById(req.userId)
  if (!user) return res.status(404).json({ message: 'Not found' })
  res.json({ user: publicUser(user) })
})

export default router
