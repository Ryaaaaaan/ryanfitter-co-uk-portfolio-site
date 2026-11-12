#!/usr/bin/env bash
# SSM executes this as root. Build scripts run as nobody, never as root.
set -Eeuo pipefail
REVISION=${1:?A Git commit SHA is required}
RUN_ID=${2:?A GitHub Actions run ID is required}
RUN_ATTEMPT=${3:?A GitHub Actions run attempt is required}
[[ "$REVISION" =~ ^[a-f0-9]{40}$ ]]
[[ "$RUN_ID" =~ ^[0-9]+$ && "$RUN_ATTEMPT" =~ ^[0-9]+$ ]]
[[ $EUID == 0 ]]
exec 9>/run/lock/ryanfitter-deploy.lock
flock -n 9 || { echo 'Another website deployment is running.'; exit 1; }
BUILD_DIR=$(mktemp -d /tmp/ryanfitter-auto.XXXXXX)
trap 'rm -rf -- "$BUILD_DIR"' EXIT
chown nobody:nogroup "$BUILD_DIR"
runuser -u nobody -- env HOME="$BUILD_DIR" git clone --no-checkout \
  https://github.com/Ryaaaaaan/ryanfitter-co-uk-portfolio-site.git "$BUILD_DIR/source"
runuser -u nobody -- env HOME="$BUILD_DIR" git -C "$BUILD_DIR/source" checkout --detach "$REVISION"
LATEST=$(runuser -u nobody -- git -C "$BUILD_DIR/source" rev-parse origin/main)
if [[ "$LATEST" != "$REVISION" ]]; then
  echo 'DEPLOY_SKIPPED_SUPERSEDED: a newer main commit exists; no install attempted.'
  exit 0
fi
runuser -u nobody -- env HOME="$BUILD_DIR" VITE_BUILD_SHA="$REVISION" bash -c 'cd "$1" && npm ci --no-audit --no-fund && npm run build' bash "$BUILD_DIR/source"
# Lock the built source against changes by the build user before root installation.
chown -R root:root "$BUILD_DIR/source"
chmod -R go-w "$BUILD_DIR/source"
bash "$BUILD_DIR/source/deploy/install-cms.sh" "$BUILD_DIR/source"

# The installer has already passed local health and public-route smoke tests.
# Publish a minimal public identity marker only after the install succeeded.
PUBLIC=/var/www/ryanfitter/html
STATUS_TMP=$(mktemp "$PUBLIC/.deployment-status.XXXXXX")
trap 'rm -f -- "$STATUS_TMP"; rm -rf -- "$BUILD_DIR"' EXIT
python3 - "$REVISION" "$RUN_ID" "$RUN_ATTEMPT" "$STATUS_TMP" <<'PY'
import datetime
import json
import sys
revision, run_id, attempt, output = sys.argv[1:]
payload = {
    "schema_version": 1,
    "revision": revision,
    "deployed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
    "run_id": run_id,
    "run_attempt": int(attempt),
}
with open(output, "w", encoding="utf-8") as stream:
    json.dump(payload, stream, separators=(",", ":"))
    stream.write("\n")
PY
chmod 0644 "$STATUS_TMP"
mv -f -- "$STATUS_TMP" "$PUBLIC/deployment-status.json"
printf '%s\n' "$REVISION" > /var/lib/ryanfitter-admin/deployed-revision
echo "DEPLOY_INSTALLED_REVISION: $REVISION (run $RUN_ID, attempt $RUN_ATTEMPT)"
