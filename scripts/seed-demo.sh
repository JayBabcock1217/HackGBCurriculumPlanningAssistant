#!/usr/bin/env bash
# One-time demo seed: wipe app data and create a clean, realistic 3rd-grade
# class (teacher, 8 students, 2 curricula with chunks, progress entries,
# suggestions + feedback). Also (re)creates the demo teacher + admin accounts.
#
# Usage:
#   npm run seed-demo
#
# Requires the stack running (npm run start).
# WARNING: deletes students/suggestions/feedback/curricula/chunks/progress and
# the demo teacher + admin auth accounts, then re-creates them.

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
# shellcheck source=./lib/docker-env.sh
source "${SCRIPT_DIR}/lib/docker-env.sh"

resolve_docker || exit 1

note "Seeding demo class (wipes existing students/suggestions/curricula/feedback) ..."
# shellcheck disable=SC2086
if ! ${DOCKER} exec \
  -e "DATABASE_URL=postgresql://hackgb:hackgb_dev_password@postgres:5432/hackgb" \
  -e "SEED_ADMIN_PASSWORD=${SEED_ADMIN_PASSWORD:-HackGB-Admin-2026}" \
  hackgb-backend node /app/scripts/lib/seed-demo.mjs; then
  err "Demo seeding failed. Is the stack running? (npm run start)"
  exit 1
fi

echo
ok "Demo class ready. Log in at the frontend login page."
echo "   Teacher: sarah.cole@school.edu / demo1234"
echo "   Admin:   admin@school.edu / ${SEED_ADMIN_PASSWORD:-HackGB-Admin-2026}"
