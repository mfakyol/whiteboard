// Augments Express' Request with the authenticated user id populated by the
// auth middleware. Importing AuthedRequest everywhere is no longer needed.
declare global {
  namespace Express {
    interface Request {
      userId?: string
    }
  }
}

export {}
