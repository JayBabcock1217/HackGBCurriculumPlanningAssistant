#!/usr/bin/env bash
# Tail backend + frontend logs. Usage: npm run logs [-- backend|frontend]
# (defaults to showing both)

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/docker-env.sh
source "${SCRIPT_DIR}/lib/docker-env.sh"

resolve_docker || exit 1

target="${1:-all}"
case "${target}" in
  backend)  ${COMPOSE} logs -f --tail=100 backend ;;
  frontend) ${COMPOSE} logs -f --tail=100 frontend ;;
  all)      ${COMPOSE} logs -f --tail=100 backend frontend ;;
  *) echo "Unknown target '${target}'. Use: backend | frontend | all"; exit 1 ;;
esac
