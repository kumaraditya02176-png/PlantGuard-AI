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

## Model and simulation boundaries
- Both models are trained lazily on the first request that needs model inference or metrics: 120 deterministic 32-step simulator episodes, with 800 PINN and 100 LSTM training epochs. That first request performs training synchronously; concurrent first requests wait for the same initialization. Later requests reuse the process-local cache. An isolated first-cache measurement in the workspace Python environment took about 18 seconds; actual latency depends on the host. There are no plant measurements or empirically validated labels in this repository.
- Episodes are split before temporal windows are formed, and feature scaling is fit only on training episodes. The PINN receives normalized features for prediction and raw sensor units for its physics penalty. Its current penalty targets deliberately match the transparent synthetic label formulas; they are a consistency regularizer, not an independently validated physical model. Evaluation found the previous prior disagreed with those targets: nominal prior `[0.537, 0.473, 0.990]` versus target `[0.387, 0.643, 0.500]`; overheating prior `[0.833, 0.922, 0.996]` versus target `[0.910, 0.713, 0.874]`; feed-instability prior `[0.622, 0.822, 0.998]` versus target `[0.749, 0.532, 0.922]`. The PINN penalty now matches the synthetic label formulas, and regression tests verify this at nominal and defect states. The LSTM receives eight consecutive normalized readings and reports a live comparison only after that history is available.
- Dashboard and advisory risk use the PINN prediction. `/api/v1/metrics` reports MAE/MSE on held-out synthetic simulator samples (one current-step sample for PINN, one temporal window for LSTM); these are not accuracy, false-alarm, or real-world performance claims.
- Applying an advisory adjusts only its bounded target variable through a rate-limited simulated response for a finite duration. Feed-rate corrections cannot set feed below the normal-profile value of 820 kg/h. Half of feed-instability training episodes include this bounded simulated correction so the PINN sees corrected states. Scenario dynamics continue; the model-backed API regression verifies the advised defect score against a matched no-advisory trajectory. That target score improves in both tested scenarios, but total risk may still rise slightly when other scenario-driven components rise. This simulation must not be connected to real machine controls.

## Primary demo
Plastic extrusion with surface cracking, warping and thickness non-uniformity.

This repository is a proof-of-concept and remains simulation/advisory only. Real factory deployment requires plant-specific validation, sensor integration, physics calibration, cybersecurity, auditability and field trials. The prototype must not directly control real machinery.
