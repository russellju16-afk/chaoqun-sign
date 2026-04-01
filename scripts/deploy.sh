#!/usr/bin/env bash
# Deployment script for chaoqun-sign on Aliyun ECS
# Usage: ./scripts/deploy.sh [branch]
# Requires: docker, docker compose v2, git

set -euo pipefail

DEPLOY_DIR="${DEPLOY_DIR:-/opt/chaoqun-sign}"
COMPOSE_FILE="${DEPLOY_DIR}/docker-compose.prod.yml"
HEALTH_URL="${HEALTH_URL:-http://localhost/api/health}"
HEALTH_RETRIES="${HEALTH_RETRIES:-12}"
HEALTH_INTERVAL="${HEALTH_INTERVAL:-5}"
BRANCH="${1:-main}"

log() { echo "[$(date -Iseconds)] $*"; }
die() { log "ERROR: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1. Pull latest code
# ---------------------------------------------------------------------------

log "Pulling latest code from branch '${BRANCH}'..."
cd "${DEPLOY_DIR}"
git fetch origin
git checkout "${BRANCH}"
git pull origin "${BRANCH}" --rebase

log "HEAD is now: $(git log -1 --oneline)"

# ---------------------------------------------------------------------------
# 2. Build the Docker image
# ---------------------------------------------------------------------------

log "Building Docker image..."
docker compose -f "${COMPOSE_FILE}" build --no-cache app

# ---------------------------------------------------------------------------
# 3. Run database migrations
# ---------------------------------------------------------------------------

log "Running database migrations..."
docker compose -f "${COMPOSE_FILE}" run --rm \
  -e RUN_MIGRATIONS=1 \
  app node -e "
    const { execSync } = require('child_process');
    execSync('node_modules/.bin/prisma migrate deploy', { stdio: 'inherit' });
  "

# ---------------------------------------------------------------------------
# 4. Restart services (zero-downtime swap)
# ---------------------------------------------------------------------------

log "Restarting app and worker services..."
docker compose -f "${COMPOSE_FILE}" up -d --no-deps app worker

# Remove dangling images to reclaim disk
docker image prune -f

# ---------------------------------------------------------------------------
# 5. Health check
# ---------------------------------------------------------------------------

log "Waiting for application to become healthy..."
ATTEMPT=0
until [ "${ATTEMPT}" -ge "${HEALTH_RETRIES}" ]; do
  ATTEMPT=$((ATTEMPT + 1))
  HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${HEALTH_URL}" 2>/dev/null || true)
  if [ "${HTTP_STATUS}" = "200" ]; then
    log "Health check passed (HTTP ${HTTP_STATUS}) after ${ATTEMPT} attempt(s)"
    break
  fi
  if [ "${ATTEMPT}" -ge "${HEALTH_RETRIES}" ]; then
    log "Health check FAILED after ${ATTEMPT} attempts (last HTTP status: ${HTTP_STATUS})"
    log "---"
    log "Rollback hint:"
    log "  git -C ${DEPLOY_DIR} log --oneline -5   # find a good commit"
    log "  git -C ${DEPLOY_DIR} checkout <commit>   # pin to it"
    log "  docker compose -f ${COMPOSE_FILE} up -d --no-deps app worker"
    log "---"
    die "Deployment failed — health check did not pass"
  fi
  log "  attempt ${ATTEMPT}/${HEALTH_RETRIES}: HTTP ${HTTP_STATUS} — retrying in ${HEALTH_INTERVAL}s..."
  sleep "${HEALTH_INTERVAL}"
done

# ---------------------------------------------------------------------------
# 6. Done
# ---------------------------------------------------------------------------

log "Deployment successful!"
log "  App version: $(curl -s "${HEALTH_URL}" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("version","?"))' 2>/dev/null || echo '?')"
