# EXPERIMENTS

## Reproducible current experiment

The backend generates 120 deterministic synthetic extrusion episodes (six scenarios, 20 each), with 32 samples per episode. It allocates 13/4/3 episodes per scenario to train/validation/test, fits preprocessing on train only, then creates eight-step LSTM windows. Training is CPU-based; the PINN uses 800 epochs and the LSTM 100 epochs. A fixed PyTorch seed of 42 is set before model initialization.

The PINN is trained on single-step features and the LSTM on temporal windows. Both outputs are compared against the simulator-derived target functions. `/api/v1/metrics` reports MAE and MSE, not classification accuracy or event-detection performance. Current measured values and sample counts are in [measured_metrics.json](../reports/measured_metrics.json).

## Verification

On 2026-10-16 in the authoritative workspace, the full pytest suite passed **25 tests** and `npm run build` passed. The tests cover simulator scenarios, preprocessing and split isolation, model training/inference, risk/advisory flow, feedback, API behavior, required project files, and startup validation.

## Limits and academic comparison

These are local synthetic-simulator measurements, not plant results. No result in this run reproduces or validates the academic synopsis/presentation benchmark claims. The PINN's physics targets are deliberately the same transparent formulas used to produce synthetic labels, so the low proxy loss is not evidence of independently learned physical laws. The training code does not currently export or verify ONNX.
