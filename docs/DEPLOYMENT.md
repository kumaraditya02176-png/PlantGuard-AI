# Deployment and local operation

PlantGuard AI is a simulation-only demonstration, not a production deployment. Never connect it to plant/OT networks, PLCs, actuators, production data, or physical equipment.

## Operator authentication configuration

The Next.js server requires an operator username, a scrypt password hash, Redis session storage, the exact public origin, an explicit cookie policy, the server-only backend URL, and the backend mutation token. Generate a password verifier interactively (input is not echoed):

```powershell
node .\scripts\generate_operator_password_hash.mjs
```

Provide the resulting hash and other values to the process through an approved secret manager or local process environment. Do not put credentials in source control, `.env` files, build arguments, frontend variables, URLs, or logs. The backend mutation token is separate from the operator password.

For **local loopback HTTP only**, set:

```powershell
$env:PLANTGUARD_PUBLIC_ORIGIN = 'http://127.0.0.1:3102'
$env:PLANTGUARD_AUTH_ENV = 'development'
$env:PLANTGUARD_COOKIE_SECURE = 'false'
$env:PLANTGUARD_SESSION_STORE_URL = 'redis://127.0.0.1:6379/0'
$env:PLANTGUARD_TRUST_PROXY = 'false'
```

Also set `PLANTGUARD_OPERATOR_USERNAME`, `PLANTGUARD_OPERATOR_PASSWORD_HASH`, `PLANTGUARD_MUTATION_TOKEN` (at least 32 characters), and `PLANTGUARD_API_URL` in the server process environment. Start Redis and application services only on ports verified available for the test. Do not use the default Compose ports if they belong to existing services.

For **production configuration**, set `PLANTGUARD_AUTH_ENV=production`, use an HTTPS `PLANTGUARD_PUBLIC_ORIGIN`, `PLANTGUARD_COOKIE_SECURE=true`, an authenticated TLS Redis URL, TLS at a trusted reverse proxy, and secret-manager-provided credentials. If `PLANTGUARD_TRUST_PROXY=true`, the trusted proxy must strip client-provided forwarding headers and set its own `X-Forwarded-For` and `X-Forwarded-Proto`. The production auth route fails closed unless the HTTPS origin and Secure cookie policy agree.

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
pnpm build
```

Run frontend install/build in an isolated copy when a development or integration server may be using the current `.next` directory.
