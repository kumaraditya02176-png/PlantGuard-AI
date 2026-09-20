# PlantGuard AI Phase 0 Baseline

## Authoritative workspace
- Root: C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\PlantGuard-AI-Codex-Ready
- Do not use the duplicate workspace at C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready

## Python environment
- Interpreter: C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\.venv\Scripts\python.exe
- Required bootstrap: set PYTHONPATH to the project root before running backend commands
- Verified import set: torch, numpy, fastapi, uvicorn

## Backend runtime
- Base URL: http://127.0.0.1:8001
- Required launch command:
  cd "C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\PlantGuard-AI-Codex-Ready"
  $env:PYTHONPATH = "$PWD"
  & "C:/Users/ADITYA/Downloads/PlantGuard-AI-Codex-Ready1.0/.venv/Scripts/python.exe" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8001

## Frontend runtime
- URL: http://127.0.0.1:3000
- Stack: Next.js 14.2.15, React 18.3.1, TypeScript 5.3.3, Recharts 2.12.7
- Launch command:
  cd "C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\PlantGuard-AI-Codex-Ready\frontend"
  npm run dev -- --hostname 127.0.0.1 --port 3000

## Backend API base URL
- http://127.0.0.1:8001

## Validation command
- cd "C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\PlantGuard-AI-Codex-Ready"
- & "C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\.venv\Scripts\python.exe" .\scripts\validate_startup.py

## Test command
- cd "C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\PlantGuard-AI-Codex-Ready"
- & "C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\.venv\Scripts\python.exe" -m pytest -q

## Production build command
- cd "C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\PlantGuard-AI-Codex-Ready\frontend"
- npm run build

## Verified functionality
- Startup validation script exists and passes after fixing the PowerShell response serialization issue
- Backend health endpoint returns status ok
- Dashboard API is reachable and returns 200
- Sensor history, latest risk, advisory, reset, and apply-advisory flows are reachable
- Python test suite passes in the local venv
- Frontend production build succeeds after removing stale .next artifacts
- The app remains simulation/advisory only and does not directly control machinery

## Known non-blocking warnings
- FastAPI/starlette test client emits deprecation warnings for httpx/anyio aliases; this does not block runtime or build

## Current known blocker
- The Next.js dev server can still become corrupted by stale .next artifacts in this environment, producing a MODULE_NOT_FOUND error for missing chunk ./543.js even after cache cleanup. This is a frontend dev-runtime issue, not a backend capability issue.
- The verified baseline is therefore stabilized for backend validation and production build, but the dev-server runtime remains unstable until the Next.js cache issue is resolved or isolated.

## Phase 0 safety rule
Before any future feature work:
1. Run Phase 0 baseline validation
2. Confirm baseline passes
3. Make the smallest required change
4. Re-run targeted tests
5. Re-run baseline validation
6. Run full regression tests before completion

This repository must not proceed to Phase 1 while the frontend dev-server integrity issue remains unresolved.
