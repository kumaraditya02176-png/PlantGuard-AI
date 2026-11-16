# Deployment and local operation

PlantGuard AI is a simulation-only demonstration, not a production deployment. Never connect it to plant/OT networks, PLCs, actuators, production data, or physical equipment.

## Operator authentication configuration

The Next.js server requires an operator username, a scrypt password hash, Redis session storage, the exact public origin, an explicit cookie policy, the server-only backend URL, and the backend mutation token. For the supported local Windows demo, use the repository setup script rather than putting secrets in shell history or a `.env` file:

```powershell
Set-Location "C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\PlantGuard-AI-Codex-Ready-phase5-integration"
.\scripts\setup_local_demo.ps1
```

The script reads the password without echo, generates its verifier using the existing scrypt helper, creates a cryptographically random mutation token, and stores the values encrypted with Windows DPAPI for the current user. The generated settings file is Git-ignored. The hash and token are decrypted only into the server process environments by the service startup scripts and are not printed.

For **local loopback HTTP only**, the loader sets the following supported configuration:

```powershell
$env:PLANTGUARD_PUBLIC_ORIGIN = 'http://127.0.0.1:3102'
$env:PLANTGUARD_AUTH_ENV = 'development'
$env:PLANTGUARD_COOKIE_SECURE = 'false'
$env:PLANTGUARD_SESSION_STORE_URL = 'redis://127.0.0.1:6379/0'
$env:PLANTGUARD_API_URL = 'http://127.0.0.1:8001'
$env:PLANTGUARD_TRUST_PROXY = 'false'
```

For this Windows demo, `http://127.0.0.1:3102` is the only accepted frontend origin and Host; do not use `localhost` or another port. Next.js may reconstruct its internal `Request.url` using `localhost` even when the browser connected to `127.0.0.1`; authentication therefore validates the browser Origin and incoming Host, and accepts only matching Next.js forwarding headers with plain HTTP. It rejects origin, Host, and forwarded-header mismatches. Re-running setup does not change the environment of processes that are already running. After setup or credential rotation, restart the backend and frontend with the startup scripts so they load the current DPAPI settings. Redis can remain running if its health check succeeds.

Start the services in separate PowerShell terminals from the project root, in this order:

```powershell
.\scripts\start_local_demo_redis.ps1
.\scripts\start_local_demo_backend.ps1
.\scripts\start_local_demo_frontend.ps1
```

Each command belongs in its own terminal so the service remains visible and stoppable through that terminal. Docker Desktop must be running for Redis. Redis is published only on `127.0.0.1:6379`; the scripts do not kill processes or replace an unrelated service when a port is occupied. The frontend script checks Redis and backend health before it starts. Setup and startup scripts fail explicitly when configuration, Docker Engine, a required port, or a service health check is unavailable.

For **production configuration**, set `PLANTGUARD_AUTH_ENV=production`, use an HTTPS `PLANTGUARD_PUBLIC_ORIGIN`, `PLANTGUARD_COOKIE_SECURE=true`, an authenticated TLS Redis URL, TLS at a trusted reverse proxy, and secret-manager-provided credentials. Do not use the local DPAPI configuration for production. If `PLANTGUARD_TRUST_PROXY=true`, the trusted proxy must strip client-provided forwarding headers and set its own `X-Forwarded-For` and `X-Forwarded-Proto`. The production auth route fails closed unless the HTTPS origin and Secure cookie policy agree.

## Server-side API boundary

The browser sends operator username/password to the same-origin login route over HTTPS in production; those credentials are transient and are not persisted. The backend mutation token is never sent to browser JavaScript. After login, Next.js stores a random opaque session ID in an `HttpOnly`, `SameSite=Strict` cookie and a server-side Redis record with a 30-minute TTL. State-changing requests also require a CSRF nonce held only in page memory, a same-origin `Origin`, and an allowlisted proxy route. Logout deletes the Redis record. The backend continues to enforce its own bearer token.

No identity provider, SSO, MFA, per-user roles, or production audit system is included. This remains a single-configured-operator demo safeguard.

## Compose demo

`docker-compose.yml` adds a Redis session service with no host-published port. Redis has no persistence in the demo; a Redis restart invalidates sessions. The backend and session-store health checks gate frontend startup. The Compose frontend requires `PLANTGUARD_OPERATOR_USERNAME` and `PLANTGUARD_OPERATOR_PASSWORD_HASH` in addition to the server-only mutation token. The frontend connects to `http://backend:8000` over the Compose network.

The default published ports are retained for existing demo compatibility. Before any Compose start, inspect whether those ports are already in use; never stop or replace an existing container to make them available. Use a separate Compose project and explicit port overrides for isolated validation.

The backend Docker image uses `requirements-lock-linux.txt`; the Windows test lock is `requirements-lock.txt`. Lock advisory checks do not prove Linux installation or container runtime compatibility. Do not claim a successful Docker build or deployment until the actual build and isolated container checks complete.

## Validation commands

From the integration workspace, with the selected Python 3.11 environment:

```powershell
$env:PYTHONPATH = $PWD
python -m pytest -q
```

For frontend checks:

```powershell
Set-Location '.\frontend'
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit --incremental false
node --test tests/auth-origin.mjs
pnpm build
```

Run frontend install/build in an isolated copy when a development or integration server may be using the current `.next` directory.
