# Build on a Debian (glibc) image so the headless Chromium that puppeteer uses
# for PDF export is compatible with the runtime. (Alpine/musl cannot run the
# standard Chrome binary.)
FROM node:22-bookworm AS builder
WORKDIR /app
COPY package*.json ./
COPY backend/package*.json ./backend/
RUN npm install --workspace=backend
COPY backend/ ./backend/
RUN npm run build --workspace=backend

FROM node:22-bookworm
WORKDIR /app

# System libraries required to launch headless Chromium (PDF export).
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates fonts-liberation fonts-noto-core \
    libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 libcups2 \
    libdbus-1-3 libdrm2 libgbm1 libgtk-3-0 libnspr4 libnss3 \
    libxcomposite1 libxdamage1 libxext6 libxfixes3 libxkbcommon0 \
    libxrandr2 \
  && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/backend ./backend
# Seed scripts (one-time admin account setup + demo class seed) run inside this
# image via `docker exec hackgb-backend node /app/scripts/lib/seed-*.mjs`.
COPY scripts/lib/seed-admin.mjs ./scripts/lib/seed-admin.mjs
COPY scripts/lib/seed-demo.mjs ./scripts/lib/seed-demo.mjs

# Headless Chromium is provided by the host cache (mounted by docker-compose as
# PUPPETEER_CACHE_DIR -> /home/node/.cache/puppeteer). The app launches it
# lazily on the first PDF request; if it is absent, PDF export is unavailable
# but HTML/DOCX/JSON export still work.
ENV PUPPETEER_CACHE_DIR=/home/node/.cache/puppeteer

EXPOSE 3001
CMD ["node", "backend/dist/main.js"]
