# Backend — File Structure Standards

Reusable layered structure for Node + Express + TypeScript services. Optimizes for
clear dependency direction, testability, and predictable file locations.

## Layout

```
src/
  config/        # env, db, auth setup — startup & infrastructure
  routes/        # endpoint → handler wiring ONLY (no logic)
  middleware/    # validate, requireAuth, rateLimit, errorHandler
  controllers/   # HTTP in/out; parse request, call service, shape response — thin
  services/      # business logic, framework-agnostic (no req/res)
  models/        # data-layer schemas (Mongoose/Prisma/…)
  schemas/       # input validation (Zod) — request DTOs
  sockets/       # realtime handlers (Socket.io) — thin, delegate to services
  errors/        # AppError and typed error helpers
  types/         # shared types + third-party .d.ts shims
  <domain>/      # cohesive domain modules when useful
index.ts         # composition root: connect deps, start server, wire shutdown
app.ts           # build the Express app (middleware + routes), export it
test/            # tests mirroring src/, integration tests on an in-memory DB
```

## Principles

- **Dependency direction is one-way:** `routes → middleware → controllers →
  services → models`. Lower layers never import higher ones.
- **Routes only wire.** A route file maps method+path to middleware+handler and nothing else.
- **Controllers stay thin.** They translate HTTP ⇄ domain and delegate to services.
  Once a handler grows past trivial DB calls, push logic into a `service`.
- **Sockets stay thin too.** A socket handler validates the payload and delegates to a
  service — the same service a controller would call, so REST and realtime share logic.
- **Services are framework-agnostic.** No `req`/`res`/`socket` — pure functions/classes
  that are unit-testable and reusable from both HTTP and Socket.io.
- **One validation source.** Define request schemas once (Zod) and reuse for types
  (`z.infer`). Validate via a single `validate(schema)` middleware (and validate socket
  payloads with the same schemas).
- **One error model.** A single `AppError` (status, code, message) plus one central
  error handler; controllers `throw`/`next(err)` and never format error responses themselves.
- **Config isolated & typed.** All env access in `config/env`, validated once,
  fail-fast in production.
- **Separate `app` from `server`.** `app.ts` builds the app (import it in tests);
  `index.ts` connects dependencies and listens. This keeps tests fast and DB-agnostic.

## Naming conventions

- `feature.routes.ts`, `feature.controller.ts`, `feature.service.ts`, `feature.schema.ts`
- Models `PascalCase.ts` (`User.ts`, `Board.ts`)
- Middleware `camelCase.ts` (`requireAuth.ts`, `rateLimit.ts`)
- Keep one feature's files consistently named across layers so they're easy to find.

## Testing layout

- `test/` mirrors `src/`; name files `feature.test.ts`.
- Prefer integration tests that exercise routes end-to-end against an in-memory DB
  (e.g. `mongodb-memory-server`) + `supertest`, with per-test collection cleanup.
- Import the built `app` (not the live server) so no real network/DB is needed.
- Test realtime flows by connecting a `socket.io-client` to the app's server against
  the in-memory DB.
