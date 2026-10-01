#!/bin/bash
# Runs once, on first container start with an empty data volume.
# WHY: the application must never connect as root. A compromised API then
# can only read/write this one database, not drop others or create users.
set -euo pipefail

mongosh --quiet "mongodb://localhost:27017/admin" \
  -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" <<EOF
use ${MONGO_DB}
db.createUser({
  user: "${MONGO_APP_USER}",
  pwd:  "${MONGO_APP_PASSWORD}",
  roles: [{ role: "readWrite", db: "${MONGO_DB}" }]
})
EOF