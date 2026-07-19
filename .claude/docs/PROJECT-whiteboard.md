# Project-Specific — Whiteboard (Collabo Board)

Notes unique to **this** repo. General standards live in the sibling docs
(`nodejs-backend-security.md`, `backend-file-structure.md`, `frontend-structure.md`).
This app is a **real-time collaborative whiteboard**, so the standards' realtime
(Socket.io) clauses are the ones that matter most here.

## Topology
- Two independent apps, deployed separately:
  - `client/` — React + Vite SPA (react-konva canvas), dev on `:5173`.
  - `server/` — Express + **Socket.io** API, dev on `:5000`. Serves **only**
    `/api/*`, `/socket.io`, and `/health` — it does **not** serve the app HTML.
- **Implication:** an app-level CSP must be set at the client host / nginx, **not**
  in the server. It must allow the WebSocket origin in `connect-src`.
- Vite dev server proxies `/api` **and** `/socket.io` (`ws: true`) → `:5000`.
- Production: client nginx serves the SPA and reverse-proxies `/api` + `/socket.io`
  to the server; host nginx terminates TLS. Docker + docker-compose, shared MongoDB.
- Live: https://draw.fatihakyol.com

## Realtime architecture (the core of the app)
- `server/src/sockets/index.ts` owns all realtime handlers. Rooms are `board:<id>`.
- **Presence & live cursors are ephemeral** — kept in an in-memory `Map`
  (`boardId → socketId → user`) and broadcast over the room; **never persisted**.
- **Shapes are persisted**: `shape:add/update/delete`, `board:clear`, `board:reorder`
  mutate `Board.shapes` in MongoDB with atomic `$push`/`$pull`/`$set` (and a full
  reorder for layer order).
- Client socket lives in `client/src/lib/socket.ts` (single shared connection);
  `Canvas.tsx` subscribes to events and drives the konva stage.
- Board state flow on join: `board:join` → server sends `board:state` (all shapes) +
  `presence:list`, then broadcasts `presence:join` to the room.

## Data / env
- MongoDB via Mongoose. Models: **`User`**, **`Board`**.
  - `Board._id` is a short `nanoid(10)` string (the shareable id), not an ObjectId.
    `shapes` is a **schemaless `Mixed[]`** (client tools evolve without migrations;
    the only contract is a stable string `id` per shape). `ownerId` is `null` for
    anonymous/guest boards.
  - No Like/Comment models (unlike the code-editor project).
- Auth is **JWT Bearer**, not session cookies: token in `Authorization: Bearer …`,
  stored in `localStorage` (`wb_auth`) on the client. bcrypt cost 10, 30-day expiry.
- Env is read only in `server/src/config/env.ts`. Key vars: `PORT` (5000),
  `MONGO_URI`, `CLIENT_URL` (CORS/Socket.io origin allowlist, comma-separated or `*`),
  `JWT_SECRET`. Prod values come from root `.env` (see `.env.example`).

## Anonymous vs. account model
- You can create and draw on a board **without an account** (guest identity is a
  random name+color in `localStorage`, `wb_user`).
- Accounts (JWT) add **owned, named boards** + a "My Boards" dashboard. Rename/delete
  are **owner-only** (checked in `board.routes.ts`).

## Current state vs. the standards

### Backend — DONE (standards applied)
The server now follows the layered structure + security standards:
- **Layered:** `routes/` (wire only) → `middleware/` → `controllers/` (thin) →
  `services/` (framework-agnostic) → `models/`, plus `schemas/` (Zod), `errors/`
  (`AppError`), `types/` (Express `Request.userId` augmentation). `sockets/index.ts`
  is thin and delegates to the **same** `board.service` the REST controllers use.
- **Validation from one source:** every REST body **and every socket payload** is
  Zod-validated (`schemas/*.schema.ts`, `middleware/validate.ts`, and an `on()` helper
  in the socket layer). No raw body/payload reaches a model.
- **One error model:** `AppError` + a single `errorHandler` (maps Mongo dup-key → 409,
  hides internals in prod). Express 5 forwards async throws to it automatically.
- **Config:** `config/env.ts` is Zod-validated once, **fails fast in prod** if
  `JWT_SECRET` is weak/default or `MONGO_URI` is unset.
- **Security:** `helmet`, CORS locked to `env.corsOrigin` (shared with Socket.io),
  `trust proxy` in prod only, 2mb JSON limit, auth rate-limiting
  (`middleware/rateLimit.ts`, per IP+account, failed-only), per-socket throttling of
  `cursor:move` and `shape:*`, and a `MAX_SHAPES_PER_BOARD` (5000) cap enforced
  atomically in `addShape`.
- **Lifecycle:** `/health` returns 503 when Mongo is down; `index.ts` does graceful
  shutdown (close io + server + mongoose, 10s force-exit fallback).

### Deliberate decision — socket writes stay open by link
The Socket.io connection is **intentionally not auth-gated**: anonymous/guest drawing
("share the link, draw together") is a core feature. So anyone with a board id can
join/read/write shapes; the presence `user` (name+color) is cosmetic and validated but
not a trusted identity. Board **rename/delete stay owner-only** (REST, JWT). If the
product later needs private/edit-restricted boards, add a Socket.io auth middleware and
per-room authorization then.

### Backend — still open
- **No automated tests yet.** Verified manually (REST + a `socket.io-client` smoke
  test). Add Vitest + supertest + mongodb-memory-server (+ socket.io-client) per the
  backend-structure doc.
- Structured logging (pino) instead of `console.*`.

### Frontend — DONE (standards applied)
- **`@/` alias** everywhere (tsconfig.app.json `paths` + vite `resolve.alias`); no
  relative intra-`src` imports.
- **Folders match the standard:** `services/` (auth, board, socket — all IO; board/auth
  return a discriminated `Result<T>`), `stores/` (auth.store, user.store — localStorage
  state), `utils/` (id, image — pure), `types/`, `i18n/`, and `components/board/` (Canvas,
  Toolbar, PresenceBar in one feature folder). `lib/` is gone.
- **i18n:** all user-facing copy in `i18n/en.ts`, read via a typed `t()` (`i18n/index.ts`);
  no hardcoded strings in components. Homegrown (no i18n library dep).
- Verified end-to-end in a browser: guest board create/navigate, toolbar+presence,
  draw a shape, and **persistence across a full reload** (socket → server → Mongo →
  board:state).

### Frontend — still open (optional)
- No client tests (only `oxlint` + `tsc`). No client-side Zod form validation / `schemas/`
  yet (server validates; a `schemas/` mirror is optional). No zustand — plain
  localStorage-backed store modules are enough at current scope; adopt zustand if shared
  client state grows.

## Conventions for this repo/owner
- **Do not add a `Co-Authored-By` trailer** to commits (owner preference, same owner
  as the code-editor project).
- Prefer small, single-concern commits.
- Client lints with **oxlint** (`npm run lint`); server has no linter, only
  `npm run typecheck`. Run these before claiming a change is clean.
- Backend deps added when applying standards: `zod`, `helmet`, `express-rate-limit`.
