#!/usr/bin/env bash
# Database backup script for chaoqun-sign
# Usage: ./scripts/backup-db.sh
# Cron example (daily at 2am): 0 2 * * * /app/scripts/backup-db.sh >> /var/log/backup.log 2>&1

set -euo pipefail

# ---------------------------------------------------------------------------
# Configuration — read from environment (set in .env or cron environment)
# ---------------------------------------------------------------------------

POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_USER="${POSTGRES_USER:-chaoqun}"
POSTGRES_DB="${POSTGRES_DB:-chaoqun_sign}"
PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set}"
export PGPASSWORD

BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="${BACKUP_DIR}/chaoqun_sign_${TIMESTAMP}.sql.gz"

# ---------------------------------------------------------------------------
# Ensure backup directory exists
# ---------------------------------------------------------------------------

mkdir -p "${BACKUP_DIR}"

# ---------------------------------------------------------------------------
# Run pg_dump and compress in a single pipe
# ---------------------------------------------------------------------------

echo "[$(date -Iseconds)] Starting backup: ${BACKUP_FILE}"

pg_dump \
  --host="${POSTGRES_HOST}" \
  --port="${POSTGRES_PORT}" \
  --username="${POSTGRES_USER}" \
  --dbname="${POSTGRES_DB}" \
  --no-password \
  --format=plain \
  --no-owner \
  --no-acl \
  | gzip --best > "${BACKUP_FILE}"

BACKUP_SIZE=$(du -sh "${BACKUP_FILE}" | cut -f1)
echo "[$(date -Iseconds)] Backup complete: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ---------------------------------------------------------------------------
# Prune backups older than KEEP_DAYS
# ---------------------------------------------------------------------------

echo "[$(date -Iseconds)] Pruning backups older than ${KEEP_DAYS} days..."
find "${BACKUP_DIR}" -name "chaoqun_sign_*.sql.gz" -mtime "+${KEEP_DAYS}" -delete -print \
  | sed "s/^/[$(date -Iseconds)] Deleted: /"

REMAINING=$(find "${BACKUP_DIR}" -name "chaoqun_sign_*.sql.gz" | wc -l | tr -d ' ')
echo "[$(date -Iseconds)] Backup retention: ${REMAINING} file(s) kept"
