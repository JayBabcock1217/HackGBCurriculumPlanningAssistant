#!/usr/bin/env bash
# Shared helpers for the start/stop/status scripts.
# Sourced, not executed directly.

# Host port ranges we search when allocating dynamic ports.
# Backend and frontend each take the first free port in their range; the
# ranges are wide and non-overlapping so the two never collide.
BACKEND_PORT_RANGE_START=3100
BACKEND_PORT_RANGE_END=3199
FRONTEND_PORT_RANGE_START=3200
FRONTEND_PORT_RANGE_END=3299

# Resolve a docker command that works in this environment.
#   DOCKER      -> e.g. "docker" or "sudo -n docker"
#   COMPOSE     -> e.g. "docker compose" or "sudo -n docker compose" or "docker-compose"
# Exits non-zero with a clear message if no usable docker/compose is found.
resolve_docker() {
  local base=""
  if docker ps >/dev/null 2>&1; then
    base="docker"
  elif sudo -n docker ps >/dev/null 2>&1; then
    base="sudo -n docker"
  else
    echo "ERROR: Docker is not available."
    echo "  - If Docker Desktop / Engine is not running, start it."
    echo "  - If you don't have permission, add yourself to the docker group:"
    echo "      sudo usermod -aG docker \$USER   (then log out/in)"
    echo "    or run your shell's docker via sudo."
    return 1
  fi

  # Prefer the compose v2 plugin; fall back to standalone docker-compose.
  if ${base} compose version >/dev/null 2>&1; then
    DOCKER="${base}"
    COMPOSE="${base} compose"
  elif command -v docker-compose >/dev/null 2>&1; then
    DOCKER="${base}"
    COMPOSE="docker-compose"
  else
    echo "ERROR: Docker Compose is not installed."
    echo "  Arch/CachyOS:    sudo pacman -S docker-compose"
    echo "  Debian/Ubuntu:   sudo apt-get install docker-compose-plugin"
    echo "  macOS/Windows:   Docker Desktop includes it."
    return 1
  fi
}

# Print a small colored status line. Degrades to plain text if not a TTY.
note()  { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
ok()    { printf '\033[1;32m  ✓\033[0m %s\n' "$*"; }
warn()  { printf '\033[1;33m  !\033[0m %s\n' "$*"; }
err()   { printf '\033[1;31m  ✗\033[0m %s\n' "$*" >&2; }

# Ask the Node port allocator for the first free ports in each range and
# export them as BACKEND_PORT / FRONTEND_PORT.
# Usage: allocate_ports   (calls node; fails hard if a range is exhausted)
allocate_ports() {
  local out
  if ! out="$(node "${SCRIPT_DIR}/lib/ports.js" \
      "backend:${BACKEND_PORT_RANGE_START}:${BACKEND_PORT_RANGE_END}" \
      "frontend:${FRONTEND_PORT_RANGE_START}:${FRONTEND_PORT_RANGE_END}" 2>&1)"; then
    err "Port allocation failed: ${out}"
    return 1
  fi
  eval "${out}"
  BACKEND_PORT="${BACKEND_PORT:?allocation returned no backend port}"
  FRONTEND_PORT="${FRONTEND_PORT:?allocation returned no frontend port}"
}

# Read ports previously allocated by start.sh from a state file, if any.
# Usage: read_port_state [file]   (defaults to the project's state file)
read_port_state() {
  local file="${1:-${PROJECT_ROOT:-.}/.ports}"
  [ -f "${file}" ] || return 1
  # shellcheck disable=SC1090
  source "${file}"
  [ -n "${BACKEND_PORT:-}" ] && [ -n "${FRONTEND_PORT:-}" ]
}
