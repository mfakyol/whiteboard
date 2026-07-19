import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import mongoose from 'mongoose'
import boardRoutes from './routes/board.routes'
import authRoutes from './routes/auth.routes'
import { notFound, errorHandler } from './middleware/errorHandler'
import { env } from './config/env'

export function createApp() {
  const app = express()

  // Behind nginx in prod: trust exactly one proxy hop so req.ip is the real
  // client (needed for correct rate-limit keying). Don't trust in dev.
  if (env.isProd) app.set('trust proxy', 1)

  app.use(helmet())
  app.use(cors({ origin: env.corsOrigin, credentials: true }))
  app.use(express.json({ limit: '2mb' }))

  // Readiness reflects the DB: 200 only when Mongo is connected.
  app.get('/health', (_req, res) => {
    const dbUp = mongoose.connection.readyState === 1
    res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'degraded', db: dbUp })
  })

  app.use('/api', authRoutes)
  app.use('/api', boardRoutes)

  app.use(notFound)
  app.use(errorHandler)

  return app
}
