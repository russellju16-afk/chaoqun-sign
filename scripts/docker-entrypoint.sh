#!/usr/bin/env sh
# Docker entrypoint: run migrations then start Next.js standalone server
set -e

echo "[entrypoint] Running Prisma migrations..."
node_modules/.bin/prisma migrate deploy

echo "[entrypoint] Starting Next.js..."
exec node server.js
