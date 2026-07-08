import http from 'node:http'
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
    cors: {
      origin: env.clientUrl === '*' ? true : env.clientUrl.split(','),
      credentials: true,
    },
  })
  registerSocketHandlers(io)

  server.listen(env.port, () => {
    console.log(`Whiteboard server listening on :${env.port}`)
  })
}

main().catch((err) => {
  console.error('Failed to start server', err)
  process.exit(1)
})
