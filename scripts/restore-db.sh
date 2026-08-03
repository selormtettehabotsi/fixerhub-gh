#!/usr/bin/env bash
#
# Restore a backup produced by backup-db.sh.
#
#   ./restore-db.sh ~/backups/fixerhub-2026-08-03T02-00-00Z.sql.gz
#   ./restore-db.sh s3://fixerhub-backups/postgres/fixerhub-2026-08-03T02-00-00Z.sql.gz
#
# This exists so the backup is a tested procedure rather than a hopeful one.
# Run it once against a throwaway database before you ever need it for real —
# the failure you don't want is discovering at 2am that the dumps were useless.
#
# DESTRUCTIVE: the dump was taken with --clean --if-exists, so it DROPs each
# object before recreating it. Everything currently in the target database is
# replaced.

set -euo pipefail

SRC="${1:-}"
COMPOSE_DIR="${COMPOSE_DIR:-/home/ubuntu/fixerhub-gh}"
CONTAINER="fixerhub-gh-postgres-1"
# Restore into a scratch database by default. Override to go over the live one:
#   TARGET_DB=fixerhub ./restore-db.sh <file>
TARGET_DB="${TARGET_DB:-fixerhub_restore_test}"

if [[ -z "${SRC}" ]]; then
    echo "usage: $0 <backup.sql.gz | s3://bucket/key>" >&2
    exit 1
fi

set -a
# shellcheck disable=SC1091
source "${COMPOSE_DIR}/.env"
set +a

TMP="$(mktemp /tmp/fixerhub-restore-XXXXXX.sql.gz)"
trap 'rm -f "${TMP}"' EXIT

if [[ "${SRC}" == s3://* ]]; then
    echo "fetching ${SRC}"
    aws s3 cp "${SRC}" "${TMP}" --only-show-errors
else
    cp "${SRC}" "${TMP}"
fi

if [[ "${TARGET_DB}" == "${POSTGRES_DB}" ]]; then
    echo
    echo "!! Restoring over the LIVE database '${POSTGRES_DB}'."
    echo "!! Stop the app services first, or they'll write during the restore:"
    echo "!!   docker compose -f docker-compose.yml -f docker-compose.prod.yml --profile app stop \\"
    echo "!!     auth-service worker-service booking-service payment-service review-service"
    echo
    read -rp "Type the database name to confirm: " CONFIRM
    [[ "${CONFIRM}" == "${POSTGRES_DB}" ]] || { echo "aborted"; exit 1; }
else
    echo "restoring into scratch database '${TARGET_DB}' (live data untouched)"
    docker exec "${CONTAINER}" psql -U "${POSTGRES_USER}" -d postgres \
        -c "DROP DATABASE IF EXISTS ${TARGET_DB};" -c "CREATE DATABASE ${TARGET_DB};"
fi

gunzip -c "${TMP}" | docker exec -i "${CONTAINER}" \
    psql -U "${POSTGRES_USER}" -d "${TARGET_DB}" -v ON_ERROR_STOP=1 --quiet

echo
echo "restored. row counts in '${TARGET_DB}':"
docker exec "${CONTAINER}" psql -U "${POSTGRES_USER}" -d "${TARGET_DB}" -c "
SELECT 'users' t, count(*) FROM users
UNION ALL SELECT 'workers',  count(*) FROM workers
UNION ALL SELECT 'bookings', count(*) FROM bookings
UNION ALL SELECT 'payments', count(*) FROM payments;"
