# PlantGuard AI

Physics-aware predictive quality intelligence for continuous manufacturing.

## Authoritative workspace
Use only this project root:

C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\PlantGuard-AI-Codex-Ready

Do not use the duplicate workspace in:
C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready

## Authoritative environment
Use the workspace-local Python environment permanently:

C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\.venv\Scripts\python.exe

Do not switch to the global Python 3.14 interpreter for this project.

## Local runtime
- Frontend: http://127.0.0.1:3000
- Backend: http://127.0.0.1:8001

## Quick start
### Validate the environment
cd "C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\PlantGuard-AI-Codex-Ready"
$env:PYTHONPATH = "$PWD"
& "C:/Users/ADITYA/Downloads/PlantGuard-AI-Codex-Ready1.0/.venv/Scripts/python.exe" -c "import torch, numpy, fastapi, uvicorn; print('PLANTGUARD_ENV_OK')"

### Run the startup validation workflow
cd "C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\PlantGuard-AI-Codex-Ready"
$env:PYTHONPATH = "$PWD"
python scripts/validate_startup.py

### Start the backend
From the project root:
cd "C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\PlantGuard-AI-Codex-Ready"
$env:PYTHONPATH = "$PWD"
& "C:/Users/ADITYA/Downloads/PlantGuard-AI-Codex-Ready1.0/.venv/Scripts/python.exe" -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8001

### Start the frontend
From the project root:
cd "C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\PlantGuard-AI-Codex-Ready\frontend"
npm run dev -- --hostname 127.0.0.1 --port 3000

## Reset / restart workflow
1. Stop stale PlantGuard node/python processes tied to this workspace.
2. Clear stale frontend cache if required: Remove-Item -Recurse -Force .next
3. Start backend with the workspace-local venv.
4. Start frontend with npm run dev.
5. Verify health at http://127.0.0.1:8001/health and the dashboard at http://127.0.0.1:3000

## Goal
Demonstrate sensor simulation -> preprocessing -> PINN/LSTM -> defect risk -> advisory -> simulated correction -> feedback -> business dashboard.

## Primary demo
Plastic extrusion with surface cracking, warping and thickness non-uniformity.

This repository is a proof-of-concept and remains simulation/advisory only. Real factory deployment requires plant-specific validation, sensor integration, physics calibration, cybersecurity, auditability and field trials. The prototype must not directly control real machinery.
