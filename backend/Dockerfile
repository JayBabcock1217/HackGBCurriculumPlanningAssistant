FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm install --workspace=backend
COPY backend/ ./backend/
RUN npm run build --workspace=backend

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend ./backend
# Seed scripts (e.g. the one-time admin account setup) run inside this image
# via `docker exec hackgb-backend node /app/scripts/lib/seed-admin.mjs`.
COPY scripts/lib/seed-admin.mjs ./scripts/lib/seed-admin.mjs
EXPOSE 3001
CMD ["node", "backend/dist/main.js"]
