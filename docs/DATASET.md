# DATASET

## Source and scope

The repository generates data from `ExtrusionSimulator`; it contains no plant telemetry or empirically validated defect labels. The dataset used by the model cache comprises 120 deterministic episodes, 32 time steps per episode, and six equally represented scenarios: normal, overheating, uneven cooling, feed-rate instability, gradual drift, and sudden disturbance. Generation uses seed 42.

Each snapshot has nine input features: temperature, pressure, screw speed, feed rate, vibration, viscosity, thickness, line speed, and cooling efficiency. Three targets are generated from transparent sigmoid formulas for surface cracking, warping, and thickness variation. They are simulation-derived soft risk targets, not inspected product outcomes.

## Split and preprocessing

Episodes are split within each scenario before temporal windows are formed: 78 train, 24 validation, and 18 test episodes (13/4/3 per scenario). At 32 readings per episode, the PINN receives 2,496 training and 576 test current-step samples. The LSTM uses eight consecutive readings, yielding 1,950 training and 450 test windows. Episodes do not cross splits, and the scaler is fit on training readings only.

Missing feature values are imputed with training medians; features are centered and scaled using training means and standard deviations. Constant feature scales are set to one.

## Interpretation

The deterministic simulator, synthetic targets, and train/test episodes share the same generating process. A held-out score therefore measures reproduction of this simulator's target function, not generalization to a real line or independently labeled defects. Dataset generation and split logic are implemented in `backend/app/preprocessing.py`.
