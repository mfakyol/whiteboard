import bcrypt from 'bcryptjs'
import { User } from '../models/User'
import { AppError } from '../errors/AppError'
import { signToken } from './token.service'
import type { LoginInput, RegisterInput } from '../schemas/auth.schema'

const BCRYPT_COST = 10

function publicUser(u: { _id: unknown; email: string; name: string }) {
  return { id: String(u._id), email: u.email, name: u.name }
}

export async function registerUser(input: RegisterInput) {
  const exists = await User.findOne({ email: input.email })
  if (exists) throw new AppError(409, 'Email already registered')
  const user = await User.create({
    email: input.email,
    name: input.name,
    passwordHash: await bcrypt.hash(input.password, BCRYPT_COST),
  })
  return { token: signToken(String(user._id)), user: publicUser(user) }
}

export async function loginUser(input: LoginInput) {
  const user = await User.findOne({ email: input.email })
  // Generic error — never reveal which field was wrong.
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash)))
    throw new AppError(401, 'Invalid email or password')
  return { token: signToken(String(user._id)), user: publicUser(user) }
}

export async function getMe(userId: string) {
  const user = await User.findById(userId)
  if (!user) throw new AppError(404, 'Not found')
  return { user: publicUser(user) }
}
