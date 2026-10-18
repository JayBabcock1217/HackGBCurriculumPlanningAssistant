#!/usr/bin/env bash
# One-time setup: create the initial admin account in the running Postgres.
#
# Usage:
#   npm run seed-admin
#   SEED_ADMIN_EMAIL=me@school.edu SEED_ADMIN_PASSWORD=secret npm run seed-admin
#
# Idempotent — running it again when the account exists is a no-op.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=./lib/docker-env.sh
source "${SCRIPT_DIR}/lib/docker-env.sh"

resolve_docker || exit 1

# Default credentials (override via env vars).
EMAIL="${SEED_ADMIN_EMAIL:-admin@school.edu}"
PASSWORD="${SEED_ADMIN_PASSWORD:-hackgb123}"
FIRST="${SEED_ADMIN_FIRST_NAME:-Admin}"
LAST="${SEED_ADMIN_LAST_NAME:-User}"

# Where the script runs depends on whether we can reach the compose network
# from the host. We exec the script INSIDE the backend container so it always
# uses the compose-network DATABASE_URL (postgres:5432) and the installed
# pg/bcryptjs deps — no host-side dependency needed.
note "Seeding admin account (${EMAIL}) into Postgres ..."
# shellcheck disable=SC2086
if ! ${DOCKER} exec -e "SEED_ADMIN_EMAIL=${EMAIL}" \
  -e "SEED_ADMIN_PASSWORD=${PASSWORD}" \
  -e "SEED_ADMIN_FIRST_NAME=${FIRST}" \
  -e "SEED_ADMIN_LAST_NAME=${LAST}" \
  -e "DATABASE_URL=postgresql://hackgb:hackgb_dev_password@postgres:5432/hackgb" \
  hackgb-backend node /app/scripts/lib/seed-admin.mjs; then
  err "Seeding failed. Is the stack running? (npm run start)"
  exit 1
fi

echo
ok "Admin account ready: ${EMAIL}"
