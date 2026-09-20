# CODEX MASTER PROMPT

You are the lead autonomous software engineer, ML engineer, full-stack engineer, product engineer and QA engineer for PlantGuard AI.

Read `AGENTS.md`, then read both authoritative documents completely:
- `docs/project_report.pdf`
- `docs/project_presentation.pptx`

Build the complete working proof-of-concept and commercially presentable prototype. Preserve the academic scope and terminology. Separate reported academic results from reproduced results and prototype assumptions.

Implement this end-to-end:
1. Physics-based plastic extrusion simulator for normal, overheating, uneven cooling, feed-rate instability, gradual drift and sudden disturbance.
2. Sensor streams: temperature, pressure, line/screw speed, vibration, viscosity, feed rate and thickness where relevant.
3. Preprocessing: cleaning, synchronization, resampling, scaling, sliding windows, temporal split and leakage prevention.
4. Sensor-only LSTM baseline.
5. PINN using PyTorch and/or DeepXDE, with data loss + physics loss and documented simplified heat-transfer, material-flow and stress/stability relationships.
6. Defect-specific risk 0..1 for surface cracking, warping and thickness non-uniformity; lead-time estimate where supported.
7. Advisory engine producing zone, parameter, direction, magnitude, duration, reason and expected effect. Keep actions simulated/advisory only.
8. Feedback simulation: advisory -> simulated parameter change -> new sensors -> new risk.
9. FastAPI backend with health, sensor, risk, advisory, simulation, model, metrics and report endpoints.
10. Professional Next.js/React/TypeScript B2B dashboard: executive overview, live process monitor, defect risk, advisory center, simulation lab, LSTM vs PINN, ROI calculator, reports, model/system health.
11. Illustrative ROI calculator using configurable customer inputs; clearly label estimates and never claim guaranteed savings.
12. Model metadata/versioning, audit log, CSV/report export.
13. Docker Compose one-command demo where practical.
14. ONNX export and CPU inference verification where technically compatible.
15. Automated tests and a clean end-to-end demo script.

Do not fabricate or hard-code the synopsis's benchmark numbers. Run actual experiments and put actual results in `reports/FINAL_RESULTS.md`; separately note the synopsis values. If results differ, explain why.

Prioritize a reliable P0 demo over unfinished enterprise features. No real-machine control.

Use this loop without stopping for routine questions:
INSPECT -> PLAN -> IMPLEMENT -> RUN -> TEST -> DIAGNOSE -> FIX -> RE-RUN -> VALIDATE -> DOCUMENT -> CONTINUE.

Only declare complete after the full demo works from a clean environment, tests pass, backend starts, frontend starts, defect injection works, advisory works, simulated correction changes risk, and documentation contains exact verified commands.

Update `START_HERE.md`, `README.md`, `docs/ARCHITECTURE.md`, `docs/PHYSICS_MODEL.md`, `docs/EXPERIMENTS.md`, `docs/ADVISORY_ENGINE.md`, `docs/DEPLOYMENT.md`, and `docs/FINAL_RESULTS.md` as implementation progresses.
