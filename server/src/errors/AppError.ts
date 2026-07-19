// One error model for the whole app. Services/controllers throw AppError; the
// central error handler is the only place that formats an error response.
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}
