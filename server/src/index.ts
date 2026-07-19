import http from 'node:http'
import mongoose from 'mongoose'
import { Server } from 'socket.io'
import { createApp } from './app'
import { connectDb } from './config/db'
import { registerSocketHandlers } from './sockets'
import { env } from './config/env'

async function main(): Promise<void> {
  await connectDb()

  const app = createApp()
  const server = http.createServer(app)

  const io = new Server(server, {
    cors: { origin: env.corsOrigin, credentials: true },
  })
  registerSocketHandlers(io)

  server.listen(env.port, () => {
    console.log(`Whiteboard server listening on :${env.port}`)
  })

  // Graceful shutdown: stop accepting connections, close sockets + DB, then a
  // hard-exit fallback so a hung connection can't block forever.
  let shuttingDown = false
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    console.log(`${signal} received, shutting down…`)

    const force = setTimeout(() => {
      console.error('Forced shutdown after timeout')
      process.exit(1)
    }, 10_000)
    force.unref()

    io.close()
    server.close(() => void 0)
    await mongoose.connection.close().catch(() => void 0)
    clearTimeout(force)
    process.exit(0)
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'))
  process.on('SIGINT', () => void shutdown('SIGINT'))
}

main().catch((err) => {
  console.error('Failed to start server', err)
  process.exit(1)
})
