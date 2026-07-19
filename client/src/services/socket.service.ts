import { io, type Socket } from 'socket.io-client'

// Single shared Socket.io connection to the same origin (Vite proxy in dev,
// client nginx in prod). Components/pages subscribe through getSocket() rather
// than importing the raw client everywhere.
let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) socket = io({ autoConnect: true })
  return socket
}
