#!/usr/bin/env bash
# SSM executes this as root. Build scripts run as nobody, never as root.
set -Eeuo pipefail
REVISION=${1:?A Git commit SHA is required}
[[ "$REVISION" =~ ^[a-f0-9]{40}$ ]]
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
  echo 'Superseded by a newer main commit; skipping this deployment.'
  exit 0
fi
runuser -u nobody -- env HOME="$BUILD_DIR" bash -c 'cd "$1" && npm ci --no-audit --no-fund && npm run build' bash "$BUILD_DIR/source"
# Lock the built source against changes by the build user before root installation.
chown -R root:root "$BUILD_DIR/source"
chmod -R go-w "$BUILD_DIR/source"
bash "$BUILD_DIR/source/deploy/install-cms.sh" "$BUILD_DIR/source"
printf '%s\n' "$REVISION" > /var/lib/ryanfitter-admin/deployed-revision
