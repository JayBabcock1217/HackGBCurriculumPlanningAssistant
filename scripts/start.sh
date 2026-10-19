#!/usr/bin/env bash
# One-command startup: allocates the first free host port for each service,
# builds the images, starts the stack, and waits until the backend + frontend
# are actually reachable.
#
# Ports are dynamic: the backend takes the first free port in 3100-3199 and
# the frontend the first free in 3200-3299, so a busy machine never blocks a
# start. The chosen ports are written to .ports so `status`/`logs`/`stop`
# agree with `start`.
#
# Usage:
#   npm run start            # build + start (default)
#   npm run start -- --no-build   # skip the image rebuild (faster)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=./lib/docker-env.sh
source "${SCRIPT_DIR}/lib/docker-env.sh"

BUILD=1
for arg in "$@"; do
  case "${arg}" in
    --no-build) BUILD=0 ;;
  esac
done

note "HackGB Curriculum Assistant — starting up"

# 0) Docker available?
resolve_docker || exit 1

# 1) Allocate the first free host ports for backend + frontend.
note "Allocating free host ports ..."
allocate_ports || exit 1
ok "Backend  -> host port ${BACKEND_PORT}"
ok "Frontend -> host port ${FRONTEND_PORT}"

# Remember the allocation for status/logs/stop (and for the frontend to talk
# to the backend).
{
  echo "# written by scripts/start.sh — do not edit by hand"
  echo "BACKEND_PORT=${BACKEND_PORT}"
  echo "FRONTEND_PORT=${FRONTEND_PORT}"
} > "${PROJECT_ROOT}/.ports"

# 2) Build images so the running code matches the source.
#    The frontend bakes NEXT_PUBLIC_API_URL in at build time, so if the
#    allocated backend port differs from the one the image was built with, we
#    rebuild just the frontend to make sure the browser talks to the right
#    backend port.
need_frontend_rebuild=0
if [ -f "${PROJECT_ROOT}/.frontend-api-url" ]; then
  old_api_url="$(cat "${PROJECT_ROOT}/.frontend-api-url" 2>/dev/null || true)"
else
  old_api_url=""
fi
new_api_url="http://localhost:${BACKEND_PORT}"
if [ "${old_api_url}" != "${new_api_url}" ]; then
  need_frontend_rebuild=1
fi

if [ "${BUILD}" -eq 1 ] || [ "${need_frontend_rebuild}" -eq 1 ]; then
  if [ "${need_frontend_rebuild}" -eq 1 ] && [ "${BUILD}" -ne 1 ]; then
    note "Backend port changed (${old_api_url:-none} -> ${new_api_url}); rebuilding frontend ..."
  else
    note "Building images (backend, frontend) ..."
  fi
  if ! FRONTEND_API_URL="${new_api_url}" ${COMPOSE} build; then
    err "Image build failed. See output above."
    exit 1
  fi
  ok "Images built."
  # Record which API URL the current frontend image was built with.
  echo "${new_api_url}" > "${PROJECT_ROOT}/.frontend-api-url"
else
  warn "Skipping build (--no-build). Running existing images."
fi

# 2b) If the default chat provider is LM Manager (on the Docker host) but the
#     container's bridge network can't reach it (some hosts' firewalls block
#     container->host NAT), fall back to the bundled Ollama container for chat
#     so the app is fully functional out of the box. Embeddings already use the
#     bundled Ollama. Set LLM_CHAT_PROVIDER / LLM_PROVIDER in .env to override
#     this automatically.
if [ -z "${LLM_CHAT_PROVIDER:-}" ] && [ -z "${LLM_PROVIDER:-}" ]; then
  if ! docker run --rm alpine:3.20 \
       wget -qO- -T 4 http://host.docker.internal:12340/health >/dev/null 2>&1; then
    note "LM Manager not reachable from the container bridge (host firewall)."
    note "Falling back to the bundled Ollama container for chat."
    export LLM_CHAT_PROVIDER=ollama
  fi
fi

# 3) Bring the stack up with the allocated ports.
note "Starting containers ..."
if ! BACKEND_PORT="${BACKEND_PORT}" FRONTEND_PORT="${FRONTEND_PORT}" \
  FRONTEND_API_URL="http://localhost:${BACKEND_PORT}" \
  LLM_CHAT_PROVIDER="${LLM_CHAT_PROVIDER:-}" \
  ${COMPOSE} up -d; then
  err "docker compose up failed."
  ${COMPOSE} ps || true
  exit 1
fi

# 4) Wait for the backend + frontend to actually accept connections.
note "Waiting for services to become ready ..."
backend_up=0
frontend_up=0
for _ in $(seq 1 45); do
  if [ "${backend_up}" -eq 0 ] && \
    curl -sf "http://localhost:${BACKEND_PORT}/api/health" >/dev/null 2>&1; then
    backend_up=1
  fi
  if [ "${frontend_up}" -eq 0 ] && \
    curl -sf -o /dev/null "http://localhost:${FRONTEND_PORT}" >/dev/null 2>&1; then
    frontend_up=1
  fi
  [ "${backend_up}" -eq 1 ] && [ "${frontend_up}" -eq 1 ] && break
  sleep 1
done

echo
if [ "${backend_up}" -eq 1 ]; then
  ok "Backend   : http://localhost:${BACKEND_PORT}/api/health"
else
  err "Backend   : not responding on :${BACKEND_PORT} yet (check: npm run logs backend)"
fi
if [ "${frontend_up}" -eq 1 ]; then
  ok "Frontend  : http://localhost:${FRONTEND_PORT}   (open this in your browser)"
else
  err "Frontend  : not responding on :${FRONTEND_PORT} yet (check: npm run logs frontend)"
fi

echo
note "Data services (fixed): Postgres :5432 · RustFS :9000/9001 · Ollama :11434"
note "Useful commands:"
note "  npm run status        # what's running + health"
note "  npm run logs          # live backend + frontend logs"
note "  npm run stop          # tear the stack down (keeps data)"
[ "${backend_up}" -eq 1 ] && [ "${frontend_up}" -eq 1 ] || exit 1
