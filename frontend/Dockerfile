FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY frontend/package*.json ./frontend/
RUN npm install --workspace=frontend
COPY frontend/ ./frontend/
RUN npm run build --workspace=frontend

FROM node:22-alpine
WORKDIR /app
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=builder /app/frontend/public ./frontend/public
EXPOSE 3000
CMD ["node", "frontend/server.js"]
