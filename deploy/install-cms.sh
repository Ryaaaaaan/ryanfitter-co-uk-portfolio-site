#!/usr/bin/env bash
# Run as root AFTER building and testing a separate checkout, passing its path.
set -Eeuo pipefail
[[ $EUID == 0 ]] || { echo 'Run with sudo.'; exit 1; }
SOURCE=$(realpath "${1:?Provide the built checkout path}")
RUNTIME=/opt/ryanfitter-portfolio
PUBLIC=/var/www/ryanfitter/html
[[ "$SOURCE" != "$RUNTIME" ]] || { echo 'Use a separate checkout so the old runtime can be backed up.'; exit 1; }
[[ -f "$SOURCE/dist/index.html" && -f "$SOURCE/dist/review/dixiescolne/index.html" && -f "$SOURCE/backend/cms.py" && -f /etc/ryanfitter-admin.env ]]
grep -Fq 'include /etc/nginx/snippets/ryanfitter-admin.conf;' /etc/nginx/sites-enabled/ryanfitter
"$RUNTIME/.venv/bin/python" -c 'import flask,jwt,requests,gunicorn'
# The tests use disposable configuration and databases, never the live env file.
(cd "$SOURCE" && "$RUNTIME/.venv/bin/python" -m unittest discover -s backend/tests -v)
BACKUP="/var/backups/ryanfitter-cms-$(date -u +%Y%m%dT%H%M%SZ)"
install -d -m 0700 "$BACKUP"
tar -czf "$BACKUP/runtime.tar.gz" -C "$RUNTIME" backend src deploy dist
cp -a "$PUBLIC/index.html" "$BACKUP/public-index.html"
if [[ -f "$PUBLIC/review/dixiescolne/index.html" ]]; then
  cp -a "$PUBLIC/review/dixiescolne/index.html" "$BACKUP/dixies-review-index.html"
fi
for name in robots.txt sitemap.xml; do
  [[ ! -f "$PUBLIC/$name" ]] || cp -a "$PUBLIC/$name" "$BACKUP/public-$name"
done
cp -a /etc/nginx/snippets/ryanfitter-admin.conf "$BACKUP/nginx-admin.conf"
cp -a /etc/systemd/system/ryanfitter-admin.service "$BACKUP/admin.service"
for database in cms jobs; do
  if [[ -f "/var/lib/ryanfitter-admin/$database.sqlite3" ]]; then
    "$RUNTIME/.venv/bin/python" - "$BACKUP/$database.sqlite3" "$database" <<'PY'
import sqlite3,sys
with sqlite3.connect('/var/lib/ryanfitter-admin/' + sys.argv[2] + '.sqlite3') as source:
    with sqlite3.connect(sys.argv[1]) as target: source.backup(target)
PY
  fi
done
# Persistent uploaded screenshots remain outside the checkout during deployments.
if [[ -d /var/lib/ryanfitter-admin/media ]]; then
  tar -czf "$BACKUP/media.tar.gz" -C /var/lib/ryanfitter-admin media
fi
# The CV vault also lives outside the deployment checkout and is backed up privately.
if [[ -d /var/lib/ryanfitter-admin/cvs ]]; then
  tar -czf "$BACKUP/cvs.tar.gz" -C /var/lib/ryanfitter-admin cvs
fi
rollback(){
  trap - ERR
  echo "Deployment failed; restoring runtime and routing from $BACKUP" >&2
  tar -xzf "$BACKUP/runtime.tar.gz" -C "$RUNTIME"
  cp -a "$BACKUP/public-index.html" "$PUBLIC/index.html"
  if [[ -f "$BACKUP/dixies-review-index.html" ]]; then
    install -d -m 0755 "$PUBLIC/review/dixiescolne"
    cp -a "$BACKUP/dixies-review-index.html" "$PUBLIC/review/dixiescolne/index.html"
  else
    rm -f -- "$PUBLIC/review/dixiescolne/index.html"
  fi
  for name in robots.txt sitemap.xml; do
    [[ ! -f "$BACKUP/public-$name" ]] || cp -a "$BACKUP/public-$name" "$PUBLIC/$name"
  done
  cp -a "$BACKUP/nginx-admin.conf" /etc/nginx/snippets/ryanfitter-admin.conf
  cp -a "$BACKUP/admin.service" /etc/systemd/system/ryanfitter-admin.service
  systemctl daemon-reload
  systemctl restart ryanfitter-admin
  nginx -t && systemctl reload nginx
  exit 1
}
trap rollback ERR
cp -R "$SOURCE/backend/." "$RUNTIME/backend/"
cp -R "$SOURCE/src/." "$RUNTIME/src/"
cp -R "$SOURCE/deploy/." "$RUNTIME/deploy/"
cp -R "$SOURCE/dist/." "$RUNTIME/dist/"
chmod -R a+rX "$RUNTIME/backend" "$RUNTIME/src" "$RUNTIME/dist"
install -m 0644 "$SOURCE/deploy/ryanfitter-admin.service" /etc/systemd/system/ryanfitter-admin.service
install -m 0644 "$SOURCE/deploy/nginx-admin-location.conf" /etc/nginx/snippets/ryanfitter-admin.conf
nginx -t
systemctl daemon-reload
systemctl restart ryanfitter-admin
# Wait up to ten seconds for the local worker, without touching the public index.
READY=0
for attempt in {1..10}; do
  STATUS=$(curl -s -o /dev/null -w '%{http_code}' -H 'Host: ryanfitter.co.uk' http://127.0.0.1:8787/admin/api/session || true)
  if [[ "$STATUS" == 401 ]]; then READY=1; break; fi
  sleep 1
done
[[ "$READY" == 1 ]]
# New assets are added first; old assets stay available for existing browser tabs.
cp -R "$SOURCE/dist/assets/." "$PUBLIC/assets/"
chmod -R a+rX "$PUBLIC/assets"
# Publish the isolated Dixy\x27s review page. Vite leaves it in dist/review/;
# do not let the SPA fallback silently serve the portfolio homepage instead.
install -d -m 0755 "$PUBLIC/review/dixiescolne"
install -m 0644 "$SOURCE/dist/review/dixiescolne/index.html" "$PUBLIC/review/dixiescolne/.index.next"
mv -f -- "$PUBLIC/review/dixiescolne/.index.next" "$PUBLIC/review/dixiescolne/index.html"
systemctl reload nginx
CURL=(curl --resolve ryanfitter.co.uk:443:127.0.0.1 -sS)
[[ "$("${CURL[@]}" -o /dev/null -w '%{http_code}' https://ryanfitter.co.uk/admin)" == 302 ]]
[[ "$("${CURL[@]}" -o /dev/null -w '%{http_code}' https://ryanfitter.co.uk/admin/api/cms)" == 401 ]]
[[ "$("${CURL[@]}" -o /dev/null -w '%{http_code}' https://ryanfitter.co.uk/admin/jobs)" == 302 ]]
[[ "$("${CURL[@]}" -o /dev/null -w '%{http_code}' https://ryanfitter.co.uk/admin/api/jobs)" == 401 ]]
[[ "$("${CURL[@]}" -o /dev/null -w '%{http_code}' https://ryanfitter.co.uk/admin/job-matches)" == 302 ]]
[[ "$("${CURL[@]}" -o /dev/null -w '%{http_code}' https://ryanfitter.co.uk/admin/api/job-matches)" == 401 ]]
[[ "$("${CURL[@]}" -o /dev/null -w '%{http_code}' https://ryanfitter.co.uk/admin/cvs)" == 302 ]]
[[ "$("${CURL[@]}" -o /dev/null -w '%{http_code}' https://ryanfitter.co.uk/admin/interviews)" == 302 ]]
[[ "$("${CURL[@]}" -o /dev/null -w '%{http_code}' https://ryanfitter.co.uk/admin/api/cvs)" == 401 ]]
[[ "$("${CURL[@]}" -o /dev/null -w '%{http_code}' https://ryanfitter.co.uk/admin/api/interviews)" == 401 ]]
[[ "$("${CURL[@]}" -o /dev/null -w '%{http_code}' https://ryanfitter.co.uk/admin/api/interviews/calendar.ics)" == 401 ]]
[[ "$("${CURL[@]}" -o /dev/null -w '%{http_code}' https://ryanfitter.co.uk/admin/api/media)" == 401 ]]
[[ "$("${CURL[@]}" -o /dev/null -w '%{http_code}' https://ryanfitter.co.uk/content/media/missing.png)" == 404 ]]
"${CURL[@]}" --fail https://ryanfitter.co.uk/content/site.json | "$RUNTIME/.venv/bin/python" -c 'import json,sys; d=json.load(sys.stdin); assert d["version"]==1 and isinstance(d["sections"],list)'
for name in robots.txt sitemap.xml; do
  [[ ! -f "$SOURCE/dist/$name" ]] || install -m 0644 "$SOURCE/dist/$name" "$PUBLIC/$name"
done
install -m 0644 "$SOURCE/dist/index.html" "$PUBLIC/.cms-index.next"
mv "$PUBLIC/.cms-index.next" "$PUBLIC/index.html"
"${CURL[@]}" --fail -o /dev/null https://ryanfitter.co.uk/
"${CURL[@]}" --fail -o /dev/null https://ryanfitter.co.uk/pokemon
# Verify exact HTML, not merely HTTP 200 (which the SPA fallback also returns).
"${CURL[@]}" --fail https://ryanfitter.co.uk/review/dixiescolne/ -o "$BACKUP/dixies-review-smoke.html"
cmp -s "$SOURCE/dist/review/dixiescolne/index.html" "$BACKUP/dixies-review-smoke.html"
trap - ERR
echo "CMS deployed. Backup: $BACKUP"
echo 'Open https://ryanfitter.co.uk/admin/cms to edit and publish.'
