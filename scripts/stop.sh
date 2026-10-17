#!/usr/bin/env bash
# Tear the stack down. Keeps named volumes (data) by default; use --volumes to
# also wipe Postgres + object-storage data.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=./lib/docker-env.sh
source "${SCRIPT_DIR}/lib/docker-env.sh"

resolve_docker || exit 1

WIPE=0
for arg in "$@"; do
  case "${arg}" in
    --volumes) WIPE=1 ;;
  esac
done

# Stop with the same ports that were allocated at start time so compose can
# always find the containers, regardless of what the host is doing now.
UP_ENV=()
if read_port_state "${PROJECT_ROOT}/.ports"; then
  UP_ENV=(BACKEND_PORT="${BACKEND_PORT}" FRONTEND_PORT="${FRONTEND_PORT}")
fi

if [ "${WIPE}" -eq 1 ]; then
  note "Stopping containers and removing volumes (data will be lost) ..."
  env "${UP_ENV[@]}" ${COMPOSE} down -v
else
  note "Stopping containers (volumes/data are kept) ..."
  env "${UP_ENV[@]}" ${COMPOSE} down
fi

echo
ok "Stack stopped."
[ "${WIPE}" -eq 1 ] && ok "Volumes removed." || ok "Data preserved (use 'npm run stop -- --volumes' to wipe)."
