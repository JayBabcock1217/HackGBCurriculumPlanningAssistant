#!/usr/bin/env bash
# Install the HackGB backend as a per-user systemd service (no root at runtime).
#
#   ./scripts/install-backend-service.sh
#
# What it does:
#   1. Resolves the absolute repo path + node binary.
#   2. Renders backend/hackgb-backend.service into ~/.config/systemd/user/
#      (substituting __REPO__ and __NODE__).
#   3. Enables + starts it, and turns on systemd "lingering" so it survives
#      logouts (needs a one-time sudo).
#
# The backend itself runs as your normal user — only the lingering step uses sudo.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
UNIT_SRC="${REPO_ROOT}/backend/hackgb-backend.service"
UNIT_DST="${HOME}/.config/systemd/user/hackgb-backend.service"

note() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()   { printf '\033[1;32m  ✓\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m  !\033[0m %s\n' "$*"; }
err()  { printf '\033[1;31m  ✗\033[0m %s\n' "$*" >&2; }

# 1) Sanity checks.
[ -f "${UNIT_SRC}" ] || { err "Unit template not found: ${UNIT_SRC}"; exit 1; }
[ -f "${REPO_ROOT}/backend/dist/main.js" ] || {
  err "backend/dist/main.js not found — run 'npm install && npm run build' first."
  exit 1
}
NODE_BIN="$(command -v node)" || { err "node not on PATH"; exit 1; }
[ -f "${REPO_ROOT}/backend/.env" ] || warn "backend/.env missing — copy backend/.env.example to backend/.env first."

# 2) Render the unit file with absolute paths.
mkdir -p "$(dirname "${UNIT_DST}")"
sed -e "s#__REPO__#${REPO_ROOT}#g" -e "s#__NODE__#${NODE_BIN}#g" \
  "${UNIT_SRC}" > "${UNIT_DST}"
ok "Wrote ${UNIT_DST}"
ok "   WorkingDirectory=${REPO_ROOT}"
ok "   ExecStart=${NODE_BIN} backend/dist/main.js"

# 3) Reload + enable + start (user manager).
systemctl --user daemon-reload
systemctl --user enable hackgb-backend.service
systemctl --user restart hackgb-backend.service
ok "Service enabled + started."

# 4) Lingering so it keeps running after you log out / reboot (one-time sudo).
if loginctl show-user "$(id -un)" 2>/dev/null | grep -q 'Linger=yes'; then
  ok "Linger already enabled."
else
  note "Enabling lingering (keeps the service running after logout) — needs sudo ..."
  if sudo -n loginctl enable-linger "$(id -un)" 2>/dev/null; then
    ok "Linger enabled."
  else
    warn "Could not enable linger non-interactively."
    warn "Run once yourself:  sudo loginctl enable-linger $(id -un)"
    warn "(Without it, the service stops when your user session ends.)"
  fi
fi

echo
note "Done. Useful commands:"
echo "   systemctl --user status hackgb-backend     # is it running?"
echo "   journalctl --user -u hackgb-backend -f      # live logs"
echo "   systemctl --user restart hackgb-backend     # restart after 'git pull && npm run build'"
echo
note "Health check:"
sleep 3
curl -sf "http://127.0.0.1:3001/api/health" >/dev/null 2>&1 \
  && ok "Backend healthy on http://127.0.0.1:3001/api/health" \
  || warn "Backend not responding yet — check: journalctl --user -u hackgb-backend -n 30"
