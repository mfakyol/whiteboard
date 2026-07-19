# Collabo Board

A real-time collaborative whiteboard. Several people draw on the same infinite
canvas at once and see each other's cursors move live — create a board, share the
link, and sketch together. Boards are persisted, so everyone picks up where they
left off.

**Live demo:** [draw.fatihakyol.com](https://draw.fatihakyol.com)

## Features

**Canvas & drawing**
- Freehand pen, rectangle, ellipse, arrow, text, sticky notes, and image paste / upload
- Select, move, resize, and rotate; multi-select with group actions
- Undo / redo, copy / paste / duplicate, layer ordering, and keyboard shortcuts
- Infinite canvas — pan (hand tool / trackpad) and zoom over a dotted grid

**Collaboration**
- Shapes sync instantly across everyone in a room (Socket.io)
- Live presence and cursors, each with a name + color; jump to any collaborator
- Shareable room links plus a read-only view (`?view=1`)
- Boards persisted in MongoDB and restored on rejoin

**Accounts**
- JWT auth (register / login, bcrypt-hashed passwords)
- "My Boards" dashboard — create, rename, and delete named boards
- Or draw as a guest with no account

**Security**
- Every REST body and Socket.io payload is Zod-validated
- Helmet, CORS locked to the client origin, body / payload size caps, and a shapes-per-board cap
- Rate limiting on auth (brute-force) and on high-frequency socket events
- Central error handler hides internals in production; config fails fast in prod

## Tech Stack

- **Frontend** — React 19, Vite, TypeScript, Tailwind CSS v4, React Router 7, react-konva (Konva), socket.io-client
- **Backend** — Node.js, Express 5, Socket.io, MongoDB + Mongoose, Zod, JWT, bcrypt, Helmet
- **Infra** — Docker + docker-compose, nginx reverse proxy (TLS terminated at the host)

## Architecture

The client is a static SPA. In production nginx serves it and reverse-proxies
`/api` (REST) and `/socket.io` (WebSocket) to the Express server. Board **shapes**
are persisted in MongoDB; **presence and live cursors** are ephemeral — broadcast
over Socket.io rooms and never written to the database.

## Getting Started

**Prerequisites:** Node.js 20+ and MongoDB (local, Docker, or Atlas).

```bash
# Optional: MongoDB via Docker
docker run -d --name whiteboard-mongo -p 27017:27017 mongo:7
```

**Backend**

```bash
cd server
npm install
npm run dev               # http://localhost:5000
```

**Frontend**

```bash
cd client
npm install
npm run dev               # http://localhost:5173
```

The Vite dev server proxies `/api` and `/socket.io` to the backend, so no extra
configuration is needed for local development.

## Production

```bash
cp .env.example .env      # set DOMAIN, MONGO_URI, JWT_SECRET
docker compose -f docker-compose.prod.yml up -d --build
```

## Project Structure

```
whiteboard/
├── client/   # React + Vite — pages, components, services, stores, utils, types, i18n
└── server/   # Express + Socket.io — routes, controllers, services, models, schemas, middleware, sockets
```

## License

ISC — built as a portfolio project.
