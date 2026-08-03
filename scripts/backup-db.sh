#!/usr/bin/env bash
#
# Nightly Postgres backup -> S3.
#
# The whole stack lives on one EC2 instance with one EBS volume and no replica,
# so losing the instance loses every booking, user and payment record. This
# takes a logical dump, compresses it, ships it off the box, and keeps a short
# local history for quick restores.
#
# Deliberately a pg_dump rather than an EBS snapshot: a dump can be restored
# into any Postgres (local, RDS, a new instance) and can be inspected. Snapshots
# only restore as a whole volume.
#
# Install (on the server):
#   chmod +x ~/fixerhub-gh/scripts/backup-db.sh
#   crontab -e
#   0 2 * * * /home/ubuntu/fixerhub-gh/scripts/backup-db.sh >> /home/ubuntu/backup.log 2>&1
#
# Requires: an S3 bucket, and an IAM role on the instance granting
# s3:PutObject/GetObject/ListBucket on it. Using a role means no access keys
# ever sit on disk.

set -euo pipefail

# ─── Config ──────────────────────────────────────────────────────────────────
BUCKET="${BACKUP_BUCKET:-fixerhub-backups}"
COMPOSE_DIR="${COMPOSE_DIR:-/home/ubuntu/fixerhub-gh}"
LOCAL_DIR="${LOCAL_DIR:-/home/ubuntu/backups}"
KEEP_LOCAL_DAYS=3        # S3 holds the long tail; local is just for fast restores
CONTAINER="fixerhub-gh-postgres-1"

# Credentials come from the compose .env, so they're never duplicated here.
set -a
# shellcheck disable=SC1091
source "${COMPOSE_DIR}/.env"
set +a

STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
FILE="fixerhub-${STAMP}.sql.gz"
DEST="${LOCAL_DIR}/${FILE}"

mkdir -p "${LOCAL_DIR}"

echo "[$(date -u +%FT%TZ)] starting backup -> ${FILE}"

# ─── Dump ────────────────────────────────────────────────────────────────────
# --clean --if-exists so the dump can be replayed over an existing database
# without hand-dropping tables first. Piped straight into gzip: never writes the
# uncompressed dump to disk, which matters on a 30 GB volume.
docker exec "${CONTAINER}" pg_dump \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    --clean --if-exists --no-owner \
  | gzip -9 > "${DEST}"

# A pg_dump that fails mid-stream still leaves a valid gzip, so check the dump
# actually ends the way pg_dump ends. Catches truncation before it's trusted.
if ! gunzip -c "${DEST}" | tail -5 | grep -q "PostgreSQL database dump complete"; then
    echo "ERROR: dump looks truncated — not uploading" >&2
    rm -f "${DEST}"
    exit 1
fi

SIZE="$(du -h "${DEST}" | cut -f1)"
echo "  dump ok (${SIZE})"

# ─── Upload ──────────────────────────────────────────────────────────────────
if command -v aws >/dev/null 2>&1; then
    aws s3 cp "${DEST}" "s3://${BUCKET}/postgres/${FILE}" --only-show-errors
    echo "  uploaded to s3://${BUCKET}/postgres/${FILE}"
else
    echo "WARNING: aws cli not installed — backup is LOCAL ONLY" >&2
fi

# ─── Prune local copies ──────────────────────────────────────────────────────
find "${LOCAL_DIR}" -name 'fixerhub-*.sql.gz' -mtime "+${KEEP_LOCAL_DAYS}" -delete
echo "[$(date -u +%FT%TZ)] done"
