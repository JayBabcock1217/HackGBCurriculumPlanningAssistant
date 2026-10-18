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

# Git Bash (MSYS2) rewrites absolute POSIX paths like /app/... into Windows
# paths (e.g. "apps/...") before docker sees them, so 'docker exec' gets a
# mangled path and fails with "no such file or directory". Disable that
# conversion for this script so the path reaches the container intact. This is
# a no-op on macOS/Linux (the env var simply isn't read there).
export MSYS_NO_PATHCONV=1
export MSWIN_PATH_MAX=1000000

# The seed script runs INSIDE the backend container, so it must be baked into
# the image at build time. If the running container was built from an older
# image (before the seed script existed), the file won't be inside it and
# Node fails with "Cannot find module". Detect that case and say so.
if ! ${DOCKER} exec hackgb-backend test -f /app/scripts/lib/seed-demo.mjs; then
  err "seed-demo.mjs is not inside the running backend container."
  err "The backend image is older than the seed script. Rebuild it:"
  echo
  echo "    git pull"
  echo "    npm run start        # (NOT docker:up — it must rebuild the image)"
  echo
  exit 1
fi

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
