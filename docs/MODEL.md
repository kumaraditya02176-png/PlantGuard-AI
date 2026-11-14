# MODEL

## PINN-style primary model

The feed-forward network maps nine normalized sensor features through two 32-unit ReLU hidden layers to three sigmoid outputs: surface cracking, warping, and thickness variation. It is trained with mean-squared error against simulator-derived targets plus a 0.25-weighted physics-proxy consistency loss. The physical features passed to that penalty remain in raw sensor units.

The penalty targets are the same explicit sensor formulas used to generate synthetic labels. This makes the network physics-aware in the limited sense of regularizing toward transparent domain-shaped proxies; it does not solve PDEs, enforce independently calibrated conservation laws, or establish real-process validity.

## LSTM comparator

The baseline receives eight consecutive normalized readings, each with nine features, and predicts the same three synthetic target values for the last step. Its recurrent layer has 24 hidden units; a small dense head maps to three sigmoid outputs. It is a comparator only and does not drive dashboard or advisory risk.

## Training and evaluation

Training is CPU-based and lazy: first model use creates the deterministic 120-episode dataset and trains the PINN for 800 epochs and LSTM for 100 epochs; models are cached only within that process. Train-only preprocessing and episode-level splits avoid sharing episode windows across partitions. See [measured_metrics.json](../reports/measured_metrics.json) for the current synthetic holdout MAE/MSE. No ONNX model artifact is produced by this implementation.
