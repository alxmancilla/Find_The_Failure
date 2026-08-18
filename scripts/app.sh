#!/usr/bin/env bash
# Docker-free launcher for the "Find the Failure" demo.
# Use this when MONGO_URI points at a remote MongoDB Atlas cluster
# (no local database container is started). Installs deps, seeds data,
# then runs backend + frontend.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Preflight: this launcher does NOT start a local database, so MONGO_URI should
# point at a reachable (typically Atlas) cluster. Read the host only — never
# echo the URI itself, since it may contain credentials.
if [ ! -f .env ]; then
  echo "[app] warning: no .env found. Copy .env.example to .env and set MONGO_URI." >&2
else
  URI_LINE="$(grep -E '^MONGO_URI=' .env | head -1 | cut -d= -f2-)"
  if [ -z "$URI_LINE" ]; then
    echo "[app] warning: MONGO_URI is not set in .env." >&2
  elif printf '%s' "$URI_LINE" | grep -qE 'localhost|127\.0\.0\.1'; then
    echo "[app] warning: MONGO_URI points at localhost, but this launcher does not" >&2
    echo "[app]          start a local database. Start one with 'docker compose up -d'" >&2
    echo "[app]          (or use 'npm run demo'), or set an Atlas SRV URI in .env." >&2
  fi
fi

echo "[app] installing dependencies (if needed)..."
(cd backend && npm install --silent)
(cd frontend && npm install --silent)

echo "[app] seeding database..."
(cd backend && npm run seed)

echo "[app] launching backend (:4000) and frontend (:5173)..."
(cd backend && npm start) &
BACK_PID=$!
(cd frontend && npm run dev) &
FRONT_PID=$!

cleanup() {
  echo ""
  echo "[app] shutting down servers..."
  kill "$BACK_PID" "$FRONT_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo ""
echo "[app] ready:"
echo "[app]   frontend  http://localhost:5173"
echo "[app]   backend   http://localhost:4000/api/health"
echo "[app] press Ctrl+C to stop."
echo ""

wait
