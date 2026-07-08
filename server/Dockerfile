# Express + Socket.io backend. Runs TypeScript directly via tsx (no build step).
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY tsconfig.json ./
COPY src ./src

EXPOSE 5000
CMD ["npm", "start"]
