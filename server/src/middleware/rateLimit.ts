import rateLimit, { ipKeyGenerator } from 'express-rate-limit'

// Brute-force protection for auth endpoints. Keyed per IP + account and counting
// only FAILED attempts (successful logins/registrations don't consume the budget)
// so legitimate users aren't locked out.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : ''
    return `${ipKeyGenerator(req.ip ?? '')}:${email}`
  },
  message: { message: 'Too many attempts, please try again later' },
})
