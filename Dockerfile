# Multi-stage Dockerfile for Mini ERP + CRM Backend
FROM node:20-alpine AS builder

WORKDIR /app
COPY server/package*.json ./
RUN npm ci

COPY server/ ./
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

COPY server/package*.json ./
RUN npm ci --only=production

COPY --from=builder /app/dist ./dist
COPY database/ ./database/

EXPOSE 5000
CMD ["node", "dist/index.js"]
