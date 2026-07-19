# Node.js / Express — Security Standards

Reusable security checklist for Node + Express + TypeScript APIs (including Socket.io
realtime). Apply these by default on every backend; treat exceptions as decisions
that need justification.

## Input & validation
- Validate **every** external input at the boundary (`body`, `params`, `query`,
  headers, **and every socket event payload**) with a schema library (e.g. Zod).
  Reject on failure with a 400 (HTTP) or by ignoring/erroring the event (socket).
- Derive types from the schema (`z.infer`) so validation and types share one
  source of truth.
- **Never spread raw `req.body` (or a raw socket payload) into a DB model**
  (mass-assignment). Persist only whitelisted, validated fields.
- Validate resource IDs (e.g. `ObjectId.isValid`) before hitting the database.
- Cap sizes: body parser limit (`express.json({ limit: '1mb' })`), max string
  lengths, max array counts, pagination `limit` caps. For realtime, cap payload
  sizes and the number of persisted items (e.g. shapes per board).

## Authentication & sessions
- Hash passwords with bcrypt/argon2 (bcrypt cost ≥ 10). Never store or log plaintext.
- If using **session cookies**: `httpOnly`, `sameSite: 'lax'` (or `strict`), `secure`
  in prod; regenerate the session on login (fixation) and destroy it on logout.
- If using **JWT**: enforce a strong secret (fail fast if missing in prod), set a
  sensible expiry, and verify the token on every protected route.
- **Authenticate the socket connection**, not just REST. Verify the JWT/session in
  Socket.io middleware and attach the identity to `socket.data` — don't trust a
  `userId`/`user` the client puts in an event payload.
- Return generic auth errors ("invalid email or password") — don't reveal which field failed.

## Authorization
- Check ownership/role on every state-changing or private-read route, **and on every
  state-changing socket event** — not just at the router/connection level.
- Default deny: private resources return 403/404 unless the caller is owner/authorized.
- For realtime: verify the socket is allowed to join/write to a given room before
  broadcasting or persisting.

## Rate limiting & abuse
- Rate-limit auth endpoints (login/register/change-password) against brute force,
  keyed per **IP + account**, counting **failed** attempts only so valid users aren't punished.
- Rate-limit high-frequency socket events (cursor moves, shape writes) so one client
  can't flood a room or hammer the DB.
- Note: an in-memory limiter (or in-memory presence map) is **per-process** — use a
  shared store (Redis) once you run more than one instance / need horizontal scaling.

## Untrusted code / heavy compute
- Run untrusted templates/code in an isolated `node:vm` context (or a worker/child
  process) with a **hard timeout**; deny access to `process`, `require`, globals.
- CPU-bound work blocks the event loop — move it to `worker_threads` with a
  wall-clock timeout to prevent a single request from DoS-ing the server.

## Transport & headers
- Use `helmet` for security headers. Enable HSTS in production.
- Lock CORS to the known client origin(s) with `credentials: true`; don't use `*` with
  credentials. **Apply the same origin allowlist to the Socket.io `cors` option.**
- Serve over HTTPS/WSS in production; set `trust proxy` correctly when behind a proxy
  (and only then — a wrong value lets clients spoof `X-Forwarded-For`).

## Errors, logging & data hygiene
- One central error handler. **Never leak stack traces or internal messages** to
  clients in production; return a generic 500. Map known errors (e.g. Mongo dup key → 409).
- Don't put secrets, tokens, passwords, or PII in URLs, query strings, or logs.
- Prefer structured logging (pino) with request IDs over `console.*` in production.

## Data integrity
- Add unique indexes for natural keys; handle the duplicate-key error path.
- Clean up dependent documents on delete (cascade) so you don't orphan rows.
- Use atomic operations (`findOneAndUpdate`, `$push`/`$pull`, upserts) where races
  matter, backed by unique indexes — important when many clients mutate one document
  concurrently (e.g. one board's shapes).

## Config, secrets & lifecycle
- Centralize config in one typed module; validate required vars, fail fast in prod.
- Keep `.env` out of version control; commit a `.env.example` with safe placeholders.
- Expose a health/readiness endpoint that reflects **dependency status** (e.g. DB
  connectivity), returning non-200 when unhealthy.
- Handle graceful shutdown (`SIGTERM`/`SIGINT`): stop accepting connections, close
  Socket.io, drain in-flight requests, close DB connections, with a force-exit fallback.

## Quick pre-ship checklist
- [ ] All inputs schema-validated (HTTP **and** socket payloads); no raw-body persistence
- [ ] Passwords hashed; JWT/session secret required in prod; socket connection authenticated
- [ ] Auth rate-limited; high-frequency socket events rate-limited
- [ ] Ownership checked on state-changing routes **and** socket events
- [ ] helmet + locked CORS (HTTP **and** Socket.io) + body limits
- [ ] Central error handler hides internals in prod
- [ ] Secrets required in prod, not committed
- [ ] Health check reflects DB; graceful shutdown wired
