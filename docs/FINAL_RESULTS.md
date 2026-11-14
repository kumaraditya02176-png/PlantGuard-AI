# FINAL_RESULTS

## Verification status (2026-10-16)

The authoritative workspace was tested directly. The complete Python suite passed **25 tests**; the Next.js production build completed successfully. The suite exercises the synthetic extrusion simulator, episode-level data splitting and preprocessing, PINN/LSTM inference and training, risk and advisory behavior, simulated feedback, API routes, and startup checks.

## Measured model evaluation

The backend was initialized in a fresh Python process and `/api/v1/metrics` evaluated its fixed test partition. Dataset generation used seed 42, 120 synthetic episodes of 32 readings each, with an eight-reading LSTM window. Whole episodes were split before windows were created: 78 train, 24 validation, and 18 test episodes.

| Model | Evaluation unit | Test samples | MAE | MSE |
|---|---|---:|---:|---:|
| PINN-style feed-forward network | Current-step sensor snapshot | 576 | 0.006072 | 0.000066 |
| Sensor-only LSTM | Eight-reading window | 450 | 0.048267 | 0.003682 |

The initial metrics request took approximately **18.9 seconds** on the current host, including first-use dataset/model initialization and metric evaluation. This is a local observation, not a latency guarantee. Machine-readable values are recorded in [measured_metrics.json](../reports/measured_metrics.json).

## Interpretation and boundaries

This is a reproduction of simulator-generated targets on held-out simulator episodes, not an accuracy claim on measured plant data. Labels are synthetic risk formulas, not independently inspected defects. The PINN physics penalty is a consistency regularizer that uses those same formulas; it is not a calibrated governing-equation solver. The models are trained lazily in memory and are not exported to ONNX in this workspace.

The dashboard, ROI calculation, risk outputs, and corrections are demonstrations. The advisory changes only bounded simulator state and never controls real machinery. ROI inputs and outputs are user assumptions and are not measured or guaranteed savings. This project is a proof-of-concept, not a production or safety-certified system.
