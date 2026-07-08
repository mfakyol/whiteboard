import { io, type Socket } from 'socket.io-client'

// Connects to the same origin (Vite proxy in dev, client nginx in prod).
let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) socket = io({ autoConnect: true })
  return socket
}
