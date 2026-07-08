import express from 'express'
import cors from 'cors'
import boardRoutes from './routes/board.routes'
import { env } from './config/env'

export function createApp() {
  const app = express()

  const origin = env.clientUrl === '*' ? true : env.clientUrl.split(',')
  app.use(cors({ origin, credentials: true }))
  app.use(express.json())

  app.get('/health', (_req, res) => res.json({ status: 'ok' }))
  app.use('/api', boardRoutes)

  app.use((_req, res) => res.status(404).json({ message: 'Not found' }))

  return app
}
