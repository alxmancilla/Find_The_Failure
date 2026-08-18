#!/usr/bin/env bash
# One-command launcher for the "Find the Failure" demo:
# starts MongoDB, installs deps, seeds data, then runs backend + frontend.
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "[demo] starting MongoDB (docker compose)..."
docker compose up -d

echo "[demo] waiting for MongoDB on localhost:27017..."
for i in $(seq 1 30); do
  if nc -z localhost 27017 2>/dev/null; then break; fi
  sleep 1
done

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
