#!/usr/bin/env bash
# One-command launcher for the "Find the Failure" demo:
# starts MongoDB, installs deps, seeds data, then runs backend + frontend.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

CONTAINER=ftf-mongo

# Refuse to start if another MongoDB already holds 27017: the seed would
# otherwise write into that database.
if nc -z localhost 27017 2>/dev/null && [ -z "$(docker ps -q --filter "name=^${CONTAINER}$" --filter status=running)" ]; then
  OWNER="$(docker ps --filter publish=27017 --format 'container {{.Names}}' | head -1)"
  [ -z "$OWNER" ] && OWNER="process $(lsof -nP -iTCP:27017 -sTCP:LISTEN 2>/dev/null | awk 'NR==2{print $1" (pid "$2")"}')"
  echo "[demo] port 27017 is in use by ${OWNER}; stop it or free the port, then rerun." >&2
  exit 1
fi

echo "[demo] starting MongoDB (docker compose)..."
docker compose up -d

echo "[demo] waiting for ${CONTAINER} to report healthy (first start can take a minute)..."
HEALTH=""
for i in $(seq 1 120); do
  HEALTH="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' "$CONTAINER" 2>/dev/null || true)"
  if [ "$HEALTH" = "healthy" ]; then break; fi
  if [ "$HEALTH" = "none" ] && nc -z localhost 27017 2>/dev/null; then break; fi
  sleep 1
done
if [ "$HEALTH" != "healthy" ] && [ "$HEALTH" != "none" ]; then
  echo "[demo] ${CONTAINER} not healthy after 120 s (status: ${HEALTH:-unknown}); check 'docker logs ${CONTAINER}'." >&2
  exit 1
fi

echo "[demo] installing dependencies (if needed)..."
(cd backend && npm install --silent)
(cd frontend && npm install --silent)

echo "[demo] seeding database..."
(cd backend && npm run seed)

echo "[demo] launching backend (:4000) and frontend (:5173)..."
(cd backend && npm start) &
BACK_PID=$!
(cd frontend && npm run dev) &
FRONT_PID=$!

cleanup() {
  echo ""
  echo "[demo] shutting down servers..."
  kill "$BACK_PID" "$FRONT_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo ""
echo "[demo] ready:"
echo "[demo]   frontend  http://localhost:5173"
echo "[demo]   backend   http://localhost:4000/api/health"
echo "[demo] press Ctrl+C to stop (MongoDB keeps running; use 'npm run stop' to stop it)."
echo ""

wait
