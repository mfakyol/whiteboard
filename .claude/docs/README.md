# Engineering Docs

Reference docs for how this codebase is built. Read the relevant one before making
structural or security decisions.

## Reusable across projects (copy these into any repo's `.claude/docs/`)
- [`nodejs-backend-security.md`](nodejs-backend-security.md) — Node/Express (+ Socket.io) security checklist.
- [`backend-file-structure.md`](backend-file-structure.md) — layered backend structure standards.
- [`frontend-structure.md`](frontend-structure.md) — React client structure & component/security standards.

## Project-specific (do not copy blindly)
- [`PROJECT-whiteboard.md`](PROJECT-whiteboard.md) — decisions unique to this repo
  (realtime/Socket.io architecture, data model, topology, and the current gaps vs.
  the standards we're about to apply).
