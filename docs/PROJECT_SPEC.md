# PROJECT_SPEC

## Academic motivation

The accompanying synopsis and presentation propose physics-informed defect prediction and actionable advisories for continuous manufacturing, with plastic extrusion as a motivating example. Their research motivation is to combine sensor observations with process knowledge where labeled defects are scarce.

## Implemented proof-of-concept

This repository demonstrates a synthetic extrusion simulator, nine-feature preprocessing, a PINN-style model with data and heuristic physics-proxy losses, an LSTM comparator, three simulated defect-risk outputs, an advisory engine, bounded simulated feedback, FastAPI endpoints, a Next.js dashboard, illustrative ROI arithmetic, and CSV export.

## Deliberate differences and exclusions

This code is not a full reproduction of the proposed research claims: it has no measured plant dataset, independent defect labels, calibrated heat/mass/stress equations, confidence-bound validation, production edge deployment, or automatic process control. Metrics are generated from the same simulator/target family as training. Academic synopsis/presentation results are not treated as reproduced measurements.

The safety boundary is simulation and advisory only.
