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
