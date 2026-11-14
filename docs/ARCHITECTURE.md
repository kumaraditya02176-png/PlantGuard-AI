# ARCHITECTURE

## Implemented flow

```text
Synthetic extrusion scenarios
  -> sensor snapshots (nine features)
  -> episode split, training-only scaler, temporal windows
  -> PINN defect-risk prediction + LSTM comparator
  -> FastAPI dashboard/advisory APIs
  -> bounded simulated correction and updated sensor state
  -> Next.js dashboard, illustrative ROI, sensor CSV export
```

## Components

- `backend/app/simulator.py` models six deterministic scenario profiles and bounded sensor dynamics.
- `backend/app/preprocessing.py` creates 120 synthetic episodes of 32 steps, derives transparent risk targets, splits complete episodes, fits preprocessing on training data, and forms eight-reading LSTM windows.
- `backend/app/modeling.py` defines a 9-32-32-3 feed-forward PINN-style model and a sensor-only LSTM. Training is lazy on first model-backed request and cached in process memory.
- `backend/app/advisory.py` selects the highest defect-specific risk and maps it to a bounded simulated action.
- `backend/app/main.py` exposes a FastAPI service and serializes simulator operations with a lock.
- `frontend/app/page.tsx` implements the monitoring dashboard, simulation controls, model comparison, ROI assumptions, and CSV download.

## State and interfaces

Simulator state, model cache, and risk trend are in-memory and process-local. The API is not a persistent telemetry service. The local launcher uses frontend port 3000 and backend port 8001; Docker exposes the API on 8000. There is no implemented database-backed audit store or real sensor connector.

See [TECHNICAL_ARCHITECTURE.md](./TECHNICAL_ARCHITECTURE.md) for the API and runtime details.
