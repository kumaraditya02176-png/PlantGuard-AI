# PlantGuard AI — Codex Instructions

Read `docs/project_report.pdf` and `docs/project_presentation.pptx` completely before implementation. They are the authoritative academic specification.

Mission: turn the academic synopsis into a working, commercially presentable proof-of-concept named PlantGuard AI for continuous manufacturing, with plastic extrusion as the primary simulated use case.

Core flow:
Sensor simulation -> preprocessing -> PINN/LSTM -> defect risk -> advisory -> simulated correction -> feedback -> web dashboard.

Build: physics simulator; preprocessing; LSTM baseline; PINN with data+physics loss; defect risk and lead-time estimation where supported; physics-grounded advisory engine; feedback simulation; FastAPI backend; professional Next.js/React/TypeScript frontend; ROI demo; reports; model metadata; audit logs; tests; Docker; ONNX export where compatible.

Preferred stack: Python 3.10+, PyTorch, DeepXDE where useful, NumPy, Pandas, SciPy, Matplotlib/Plotly, FastAPI, SQLite/PostgreSQL-compatible architecture, Next.js/React/TypeScript, Docker, pytest, ONNX where compatible.

Rules: never fabricate customers, deployments, certifications, ROI, measurements, or results. Never hard-code academic benchmark values. Clearly label simulated/demo values. Do not directly control real machinery; recommendations are advisory/simulated.

Autonomous loop: INSPECT -> PLAN -> IMPLEMENT -> RUN -> TEST -> FIX -> RE-RUN -> VALIDATE -> DOCUMENT -> CONTINUE. Do not declare a feature complete until it runs and relevant tests pass.

P0: simulator, preprocessing, PINN inference, risk, advisory, feedback, API, reliable web demo.
P1: LSTM comparison, evaluation, ROI, reports, model metadata.
P2: ONNX, multi-plant architecture, extended security, future adapters.

Completion: from a clean environment, a user can launch the app, select an extrusion scenario, inject a simulated defect, observe sensor drift and PINN risk rise, receive a specific advisory, simulate correction, observe risk change, and view actual experiment metrics plus illustrative ROI.
