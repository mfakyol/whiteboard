// Central configuration. Environment variables are read and validated ONLY here,
// once, at startup — fail fast in production if something required is missing.
import { z } from 'zod'

const DEV_JWT_SECRET = 'dev-insecure-jwt-secret'

const schema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(5000),
    MONGO_URI: z.string().min(1).default('mongodb://127.0.0.1:27017/whiteboard'),
    // Comma-separated list of allowed origins, or "*" for any.
    CLIENT_URL: z.string().min(1).default('http://localhost:5173'),
    JWT_SECRET: z.string().min(1).default(DEV_JWT_SECRET),
  })
  .superRefine((cfg, ctx) => {
    if (cfg.NODE_ENV !== 'production') return
    // Production must not run on insecure dev defaults.
    if (cfg.JWT_SECRET === DEV_JWT_SECRET || cfg.JWT_SECRET.length < 16)
      ctx.addIssue({
        code: 'custom',
        path: ['JWT_SECRET'],
        message: 'JWT_SECRET must be set to a strong value (≥16 chars) in production',
      })
    if (!process.env.MONGO_URI)
      ctx.addIssue({
        code: 'custom',
        path: ['MONGO_URI'],
        message: 'MONGO_URI must be set explicitly in production',
      })
  })

const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  console.error('Invalid environment configuration:')
  for (const issue of parsed.error.issues)
    console.error(`  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
  process.exit(1)
}

const cfg = parsed.data

export const env = {
  nodeEnv: cfg.NODE_ENV,
  isDev: cfg.NODE_ENV === 'development',
  isProd: cfg.NODE_ENV === 'production',
  port: cfg.PORT,
  mongoUri: cfg.MONGO_URI,
  jwtSecret: cfg.JWT_SECRET,
  // Origin allowlist shared by Express CORS and the Socket.io server.
  corsOrigin: cfg.CLIENT_URL === '*' ? true : cfg.CLIENT_URL.split(',').map((s) => s.trim()),
} as const
