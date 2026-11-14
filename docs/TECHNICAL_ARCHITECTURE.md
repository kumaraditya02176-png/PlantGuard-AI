# TECHNICAL_ARCHITECTURE

## Runtime

- **Frontend:** Next.js 14, React 18, TypeScript; development server on port 3000.
- **Backend:** FastAPI/Python with PyTorch and NumPy; local launcher uses port 8001.
- **Inference:** CPU models trained lazily from deterministic synthetic episodes and cached for the lifetime of a backend process.
- **State:** simulator history, risk history, and trained models are process-local in-memory objects.

## API surface

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Health and simulation-only status |
| GET | `/api/v1/dashboard` | Consistent simulator snapshot, risks, comparator, advisory |
| GET | `/api/v1/sensors/latest` | Latest sensor reading |
| GET | `/api/v1/sensors/history` | Recent sensor history |
| GET | `/api/v1/risk/latest` | Defect-specific and aggregate risk |
| GET | `/api/v1/advisory/latest` | Highest-risk advisory |
| POST | `/api/v1/advisories/apply` | Apply advisory to simulator state |
| POST | `/api/v1/simulation/reset` | Reset to a scenario |
| POST | `/api/v1/simulation/inject` | Inject a synthetic defect |
| POST | `/api/v1/simulation/advance` | Advance simulated time |
| GET | `/api/v1/metrics` | Synthetic held-out MAE/MSE and counts |
| GET | `/api/v1/roi` | Backend's synthetic risk-derived estimate (not used by the interactive calculator) |

The dashboard's interactive ROI form calculates from user assumptions in the frontend; it does not treat the backend's separate illustrative endpoint as customer ROI. Sensor history can be exported to CSV by the browser.

## Operations

The API locks simulator operations, and the model cache uses a separate lock during first initialization. The first model-backed call performs dataset generation and training synchronously. The app has no persistent database or model artifact lifecycle. ONNX export is not implemented in this workspace.
