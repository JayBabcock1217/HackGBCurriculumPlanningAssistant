FROM node:22-alpine AS builder
WORKDIR /app
# NEXT_PUBLIC_API_URL is baked into the Next.js build at compile time.
# scripts/start.sh passes the allocated backend port as this build arg.
ARG NEXT_PUBLIC_API_URL=http://localhost:3100
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY package*.json ./
COPY frontend/package*.json ./frontend/
RUN npm install --workspace=frontend
COPY frontend/ ./frontend/
RUN npm run build --workspace=frontend

FROM node:22-alpine
WORKDIR /app
RUN mkdir -p frontend
COPY --from=builder /app/frontend/.next/standalone ./
COPY --from=builder /app/frontend/.next/static ./frontend/.next/static
# The project has no public/ directory; create an empty one so Next.js
# static file handling doesn't break at runtime.
RUN mkdir -p frontend/public
EXPOSE 3000
CMD ["node", "frontend/server.js"]
