// Central configuration. Environment variables are read only here.
export const env = {
  port: Number(process.env.PORT ?? 5000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  isDev: (process.env.NODE_ENV ?? 'development') === 'development',
  mongoUri: process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/whiteboard',
  // Comma-separated list of allowed origins, or "*" for any.
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:5173',
}
