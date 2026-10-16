# Video to Article Ubuntu Deployment Implementation Plan

> **For agentic workers:** Execute the following tasks in order, verifying each deliverable before proceeding. Existing uncommitted feature work belongs to the user and must be preserved.

**Goal:** Prepare a reproducible empty-library deployment on the existing Ubuntu 24.04 server, initially accessed through SSH, with a future `v2a.fengjiajun.site` HTTPS entry.

**Architecture:** Build React assets locally. Ship the current working tree through an explicit allowlist, without databases, snapshots, credentials, dependencies or Git metadata. Run separate backend/frontend containers under Compose project `v2a`; publish only `127.0.0.1:8890`. Persist SQLite and snapshots together in `v2a_data`.

**Tech Stack:** FastAPI, SQLite, React/Vite, Python 3.12, Node 22 for yt-dlp EJS, FFmpeg, Docker Compose, existing host Nginx.

## Global Constraints

- The server already runs ClipRAG on 3000/8888 and FinAnalyst on loopback 8800/host Nginx 443. Do not stop, overwrite or rebuild either project.
- User will execute server commands; no SSH credentials are requested or used by the agent.
- Start with an empty database; never upload local `app.db`, `database.db`, cookies, snapshots, `.env`, task logs or browser storage.
- Initial private access only. DNS/ICP approval, public TLS, and access-policy review remain separate gates for `v2a.fengjiajun.site`.
- One backend process; deployment admits at most one active conversion. Per-task model concurrency is one. Configure backend 640 MiB/frontend 96 MiB memory ceilings; these are limits, not capacity validation.
- Tests use temporary working directories and isolated databases. No video/provider calls or billable operations during preparation.
- Local Docker daemon is unavailable: configuration validation is possible, Linux container startup must be verified on the user's server.

### Task 1: Repair deployment-blocking runtime paths

Files: `backend/main.py`, `backend/services/task_runtime.py`, `frontend/src/utils/api.ts`, `frontend/src/utils/apiHeaders.ts`, targeted backend/frontend tests.

- [x] Add tests for GLM/MiniMax/SiliconFlow key forwarding and ensure credentials are absent from persisted task rows.
- [x] Add an API test proving a full active-task slot rejects the next request with 429 and creates no extra task. Completed/failed rows must not block admission.
- [x] Add restart recovery coverage: incomplete tasks become failed with an explicit interruption message, completed articles stay intact.
- [x] Add a database-backed `/api/health` probe. Verify it against an isolated real SQLite session.
- [x] Implement the smallest fixes and run those tests. Existing local execution remains unlimited unless `MAX_ACTIVE_TASKS` is configured; restart recovery is deployment opt-in.

Expected commands (run tests from an isolated temporary working directory):

```text
python -m unittest discover -s backend/tests -p test_deployment_runtime.py -v
npm test
npm run build
```

### Task 2: Add isolated Compose runtime and installation checks

Files: `compose.ubuntu.yml`, `deploy/ubuntu/Dockerfile.backend`, `deploy/ubuntu/Dockerfile.frontend`, `deploy/ubuntu/frontend.conf`, `deploy/ubuntu/requirements.txt`, `deploy/ubuntu/install.sh`, `.dockerignore`, `.gitattributes`.

- [x] Use separate non-root containers, a persistent `/data` mount, and no published backend port. Node 22 and compatible yt-dlp EJS are installed in the backend image.
- [x] Serve prebuilt frontend assets with same-origin API proxying; include bounded requests, extended proxy timeout and a frontend probe.
- [x] Installer checks Docker Compose, required frontend assets, free port, current available memory and image/container health. It does not change host Nginx/firewall or delete volumes.
- [x] Validate Compose with `docker compose -f compose.ubuntu.yml config -q` and shell syntax with Bash. Clearly record that actual Docker execution has not run locally.

### Task 3: Package and hand off

Files: `deploy/ubuntu/package_release.py`, `deploy/ubuntu/test_package_release.py`, `deploy/ubuntu/nginx-v2a.conf.example`, `docs/deployment/Ubuntu部署.md`, `README-DEPLOY.md`, release artifacts under `.deploy/`.

- [x] Add an allowlist-based packager with a tested exclusion of local credentials/data, symlink rejection, LF normalization for Linux deployment files, and per-file SHA-256 manifest.
- [x] Build frontend with `VITE_API_BASE_URL` explicitly empty; inspect bundled origin and ensure requests use `/api`.
- [x] Produce a source/runtime archive with no historical data and validate every archived file against the manifest.
- [x] Document upload, installation, SSH access, BYOK, backup, update, restart interruption and later domain/TLS activation. Distinguish local verification from pending server acceptance.

## Acceptance evidence

Local preparation evidence:

- Relevant backend API/publication regression suite: 15 tests passed in isolated databases; no local app.db was used.
- Frontend suite: 10 tests passed; production build succeeded with an explicitly empty API base and emitted same-origin assets.
- Release packager: two tests passed, one real-symlink test skipped because the Windows account cannot create symlinks. Selected symlinks/outside-root paths are rejected in implementation; the skipped filesystem scenario is not claimed verified.
- Docker Compose configuration and Git Bash shell syntax validation passed. The local Linux Docker engine is unavailable; no image startup, Linux Nginx configuration execution or 2GB-server load test has run.
- Release is built from current uncommitted work, excludes local data and credentials, and is verified against a per-file SHA-256 manifest during packaging and installation.
- Independent read-only deployment review: no Critical/Important findings. The minor update-time memory caveat was resolved by documenting a maintenance stop of only the v2a containers before reinstalling; the other two projects remain running.
- Final archive integrity is checked by the packager before it publishes the archive; the sidecar SHA-256 is provided for server upload verification.
- GNU sha256sum verification caught Windows CRLF in the checksum sidecar. The writer now emits ASCII bytes with LF explicitly, with a regression assertion and a fresh GNU checksum check before delivery.

Server acceptance remains outstanding:

- [ ] Server resource/port preflight, official image pulls and actual Linux container build/startup.
- [ ] Both containers healthy; API and static frontend return HTTP 200; initial articles count zero.
- [ ] SSH tunnel browser check and one authorized real video/model conversion.
- [ ] Screenshot/history survive restart; interrupted task behavior on the server.
- [ ] Future v2a DNS/TLS/public access and access-policy review after ICP/platform readiness.
- [ ] Automated certificate renewal, if a public domain is later enabled.

No production deployment or remote server login was performed by the agent. The user will execute the delivered server commands.
