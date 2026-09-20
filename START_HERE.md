# START HERE

## Authoritative workspace
Use only this workspace:

C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\PlantGuard-AI-Codex-Ready

Do not use the duplicate workspace in:
C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready

## Required Python environment
Use the workspace-local Python interpreter permanently:

C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\.venv\Scripts\python.exe

Do not switch to the global Python 3.14 interpreter for this project.

## Required local URLs
- Frontend: http://127.0.0.1:3000
- Backend: http://127.0.0.1:8001

## Validate the environment before starting the app
From the project root:

cd "C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\PlantGuard-AI-Codex-Ready"
$env:PYTHONPATH = "$PWD"
& "C:/Users/ADITYA/Downloads/PlantGuard-AI-Codex-Ready1.0/.venv/Scripts/python.exe" -c "import torch, numpy, fastapi, uvicorn; print('PLANTGUARD_ENV_OK')"

Optional preflight script:

cd "C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\PlantGuard-AI-Codex-Ready"
$env:PYTHONPATH = "$PWD"
python scripts/validate_startup.py

## Start backend
From the project root:

cd "C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\PlantGuard-AI-Codex-Ready"
$env:PYTHONPATH = "$PWD"
& "C:/Users/ADITYA/Downloads/PlantGuard-AI-Codex-Ready1.0/.venv/Scripts/python.exe" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8001

## Start frontend
From the project root:

cd "C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\PlantGuard-AI-Codex-Ready\frontend"
npm run dev -- --hostname 127.0.0.1 --port 3000

## Reset the app safely
1. Stop stale PlantGuard node/python processes that reference this workspace.
2. Optionally remove stale frontend build cache if the app has been restarting repeatedly:
   Remove-Item -Recurse -Force .next
3. Restart backend with the workspace-local venv.
4. Restart frontend with npm run dev.

## Health checks
- Backend health: http://127.0.0.1:8001/health
- Dashboard API: http://127.0.0.1:8001/api/v1/dashboard
- Frontend: http://127.0.0.1:3000

## Target demo
Launch -> choose extrusion scenario -> inject defect -> watch sensor drift -> risk rises -> advisory appears -> simulate correction -> risk changes -> compare model outputs -> show illustrative ROI.

The prototype remains simulation/advisory only and does not directly control real machines.
