# Start PlantGuard AI

## Active workspace

Use the Phase 5 integration workspace containing `backend`, `frontend`, `docs`, and `scripts`. Do not use a duplicate or older project folder.

```powershell
Set-Location "C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\PlantGuard-AI-Codex-Ready-phase5-integration"
```

The required Python interpreter is:

```text
C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\.venv\Scripts\python.exe
```

## Configure authenticated local demo

Run once in an interactive PowerShell terminal. Enter an operator username and a strong password of at least 16 characters when prompted. The password is not echoed; a scrypt verifier and random mutation token are generated without being displayed. Settings are encrypted using Windows DPAPI for the current Windows user and ignored by Git.

```powershell
.\scripts\setup_local_demo.ps1
```

To rotate credentials, run the setup script again and confirm by entering `REPLACE`.

## Start services in separate PowerShell terminals

Docker Desktop must be installed and running. Start the loopback-only Redis session store first:

```powershell
.\scripts\start_local_demo_redis.ps1
```

Then start the backend in a second terminal:

```powershell
.\scripts\start_local_demo_backend.ps1
```

Finally, start the frontend in a third terminal:

```powershell
.\scripts\start_local_demo_frontend.ps1
```

The scripts use the existing ports and do not stop processes to free a port:

- Frontend: `http://127.0.0.1:3102`
- Backend: `http://127.0.0.1:8001`
- Redis: `127.0.0.1:6379` (loopback only)

Use `http://127.0.0.1:3102` as the only local frontend origin; do not substitute `localhost`. After changing local authentication settings, restart the backend and frontend so they load the updated DPAPI configuration. Redis can remain running if its health check succeeds.

## Health checks

- Backend health: `http://127.0.0.1:8001/health`
- Backend API documentation: `http://127.0.0.1:8001/docs`
- Frontend-proxied health: `http://127.0.0.1:3102/api/backend/health`
- Dashboard: `http://127.0.0.1:3102/overview`

The prototype is simulation-only and advisory-only. It does not connect to factory systems or control physical equipment. For test commands and implementation details, see [README.md](README.md) and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
