#!/usr/bin/env bash
# Show what's running in our stack + a quick health check.
# Uses the ports recorded by `npm run start` (.ports) for backend/frontend.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=./lib/docker-env.sh
source "${SCRIPT_DIR}/lib/docker-env.sh"

resolve_docker || exit 1

BACKEND_PORT=""
FRONTEND_PORT=""
if read_port_state "${PROJECT_ROOT}/.ports"; then
  :
else
  BACKEND_PORT=3100
  FRONTEND_PORT=3200
  warn "No .ports state found — assuming defaults (run 'npm run start' to allocate)."
fi

note "Containers"
${COMPOSE} ps 2>/dev/null || true

# Self-heal: if the .ports state disagrees with the ports the running
# containers actually expose, trust the containers and rewrite the state.
# (Catches cases where the state got out of sync, e.g. a manual
# `docker compose up -d` with different port env vars.)
actual_backend=""
actual_frontend=""
# One line per service: "service hostport" (hostport = first 0.0.0.0:NNNN).
# Flatten the Ports field to a single line so grep -o returns one match.
while read -r svc ports; do
  [ -z "${svc}" ] && continue
  hostport="$(echo "${ports}" | tr '\n' ' ' | grep -oE '0\.0\.0\.0:[0-9]+' | head -1 | grep -oE '[0-9]+$')"
  [ -z "${hostport}" ] && continue
  case "${svc}" in
    backend)  actual_backend="${hostport}" ;;
    frontend) actual_frontend="${hostport}" ;;
  esac
done <<< "$(${COMPOSE} ps --format '{{.Service}} {{.Ports}}' 2>/dev/null || true)"

if [ -n "${actual_backend}" ] && [ "${actual_backend}" != "${BACKEND_PORT}" ]; then
  warn "State said backend :${BACKEND_PORT} but container is on :${actual_backend} — correcting."
  BACKEND_PORT="${actual_backend}"
fi
if [ -n "${actual_frontend}" ] && [ "${actual_frontend}" != "${FRONTEND_PORT}" ]; then
  warn "State said frontend :${FRONTEND_PORT} but container is on :${actual_frontend} — correcting."
  FRONTEND_PORT="${actual_frontend}"
fi
# Persist the corrected state so future calls agree.
{
  echo "# written by scripts/start.sh — do not edit by hand"
  echo "BACKEND_PORT=${BACKEND_PORT}"
  echo "FRONTEND_PORT=${FRONTEND_PORT}"
} > "${PROJECT_ROOT}/.ports"

echo
note "Health"
check() {
  local name="$1" url="$2"
  local code
  code="$(curl -sf -o /dev/null -w '%{http_code}' "${url}" 2>/dev/null)" || code="---"
  if [ "${code}" = "200" ]; then
    ok "${name}  ${url}"
  else
    err "${name}  ${url}  (not responding)"
  fi
}
check "Backend   " "http://localhost:${BACKEND_PORT}/api/health"
check "Frontend  " "http://localhost:${FRONTEND_PORT}"
check "RustFS    " "http://localhost:9000/health"
check "Ollama    " "http://localhost:11434"
