#!/usr/bin/env bash
set -euo pipefail

project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"
cd -- "$project_dir"
command -v docker >/dev/null
docker info >/dev/null
docker compose version
test -s frontend/dist/index.html
test -s release-manifest.json

python3 - <<'PY'
from deploy.ubuntu.package_release import selected
from pathlib import Path
import hashlib, json
root = Path.cwd()
manifest = json.loads((root / 'release-manifest.json').read_text())
for entry in manifest['files']:
    path = Path(entry['path'])
    if path.is_absolute() or '..' in path.parts or not selected(path):
        raise SystemExit('Invalid manifest path')
    source = root / path
    if source.is_symlink() or not source.resolve().is_relative_to(root):
        raise SystemExit('Release source is a link or outside the project')
    content = source.read_bytes()
    if len(content) != entry['size'] or hashlib.sha256(content).hexdigest() != entry['sha256']:
        raise SystemExit('Release integrity check failed: ' + entry['path'])
print('Release integrity: OK; no local history or screenshots included.')
PY

available_kib="$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)"
if (( available_kib < 921600 )); then
    echo 'Less than 900 MiB available RAM; inspect free -h/docker stats before adding a third app.' >&2
    free -h
    exit 1
fi
available_disk_kib="$(df -Pk . | awk 'NR==2 {print $4}')"
if (( available_disk_kib < 3145728 )); then
    echo 'Less than 3 GiB free disk; stop before image builds.' >&2
    exit 1
fi
if ss -H -ltn 'sport = :8890' | grep -q .; then
    existing_entry="$(docker compose -f compose.ubuntu.yml port frontend 8080 2>/dev/null || true)"
    if [[ "$existing_entry" != '127.0.0.1:8890' ]]; then
        echo 'Port 8890 belongs to another service; no services were stopped.' >&2
        exit 1
    fi
fi

docker compose -f compose.ubuntu.yml config -q
# Sequential builds; React has already been built on the local computer.
docker compose -f compose.ubuntu.yml build backend
docker compose -f compose.ubuntu.yml build frontend
docker compose -f compose.ubuntu.yml up -d --wait --wait-timeout 180
curl --noproxy '*' --fail --max-time 10 --retry 6 --retry-delay 2 \
    --retry-connrefused http://127.0.0.1:8890/api/health
curl --noproxy '*' --fail --max-time 10 --silent --output /dev/null \
    --write-out 'Frontend HTTP: %{http_code}\n' http://127.0.0.1:8890/
docker compose -f compose.ubuntu.yml ps
echo 'Ready for private verification: SSH forward local 18890 to server 127.0.0.1:8890.'
echo 'Host Nginx, firewall and other Compose projects were not modified.'
