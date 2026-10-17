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
EXPOSE 3001
CMD ["node", "backend/dist/main.js"]
