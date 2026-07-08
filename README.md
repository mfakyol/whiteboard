# 🎨 Collabo Board — Real-time Collaborative Whiteboard

A multiplayer whiteboard where several people draw on the same canvas at once and
see each other's cursors move live. Create a board, share the link, draw together.

**Live:** https://draw.fatihakyol.com

## Features

- **Real-time collaboration** — shapes sync instantly across everyone in a room (Socket.io)
- **Live presence** — see who's online and their cursors moving in real time, each with a name + color
- **Drawing tools** — freehand pen, rectangle, ellipse, arrow, text, sticky notes
- **Select / move / delete** — grab any shape, drag it, delete with a keypress
- **Color & stroke width** picker
- **Persistent boards** — every board is stored in MongoDB and restored when you rejoin
- **Infinite canvas** — pan (hand tool / trackpad) and zoom (Ctrl+scroll) over an unbounded surface
- **Shareable rooms** — each board has a short id; share the URL to invite others

## Tech stack

| Layer | Tech |
|-------|------|
| Client | React + TypeScript, Vite, Tailwind CSS, **react-konva** (2D canvas), socket.io-client |
| Server | Node + Express + TypeScript, **Socket.io**, Mongoose |
| Data | MongoDB |
| Infra | Docker + docker-compose, nginx reverse proxy, deployed behind host nginx with TLS |

## Architecture

The client is a static SPA served by nginx, which also reverse-proxies `/api`
(REST) and `/socket.io` (WebSocket) to the Express server. Board state
(the shapes) is persisted in MongoDB; presence and live cursors are ephemeral
and broadcast over Socket.io rooms — never written to the database.

```
browser ──HTTPS/WSS──> host nginx ──> client nginx ─┬─ /            (SPA)
                                                     ├─ /api         → server
                                                     └─ /socket.io   → server (WebSocket)
                                                                          │
                                                                     MongoDB
```

## Development

```bash
# server (needs a local MongoDB on :27017)
cd server && npm install && npm run dev      # http://localhost:5000

# client
cd client && npm install && npm run dev      # http://localhost:5173
```

The Vite dev server proxies `/api` and `/socket.io` to the backend on `:5000`.

## Production

```bash
cp .env.example .env    # set DOMAIN + MONGO_URI
docker compose -f docker-compose.prod.yml up -d --build
```
