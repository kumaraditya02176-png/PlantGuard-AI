# PlantGuard AI

**A simulation-only predictive quality monitoring prototype for continuous manufacturing**

PlantGuard AI preserves plastic extrusion as its flagship model-backed prototype and provides five additional independent simulated industry modules. The extrusion workflow combines generated process signals, preprocessing, a physics-proxy-guided neural network, an LSTM comparator, defect-risk estimates, operator-oriented advisories, simulated feedback, and a web dashboard. The added modules use their own configured equipment, sensors, scenarios, deterministic risk rules, and advisory mappings.

> **Scope and safety:** This repository is a proof of concept. It does not connect to factory sensors, use independently inspected defect labels, control machinery, or establish production performance. Sensor readings, labels, risks, recommendations, feedback, and ROI demonstrations are simulated or illustrative.

## Project at a glance

| Area | Current implementation |
|---|---|
| Flagship process | Simulated plastic extrusion, including its existing 3D twin and model-backed API |
| Industry selector | Plastic & Polymer, Paper & Pulp, Steel & Metals, Chemical & Process, Food & Beverage, and Pharmaceutical |
| Extrusion scenarios | Normal, overheating, uneven cooling, feed-rate instability, gradual drift, and sudden disturbance |
| Extrusion features | Nine simulated sensor/process channels |
| Extrusion risk categories | Surface cracking, warping, and thickness variation/non-uniformity |
| Extrusion primary model | Feed-forward neural network with data loss and a physics-related proxy penalty |
| Extrusion comparator | LSTM using eight consecutive readings |
| Additional industry modules | Independent equipment, sensor schema, scenarios, fault injection, risk rules, advisories, and simulator state |
| Backend | FastAPI, Python, and PyTorch |
| Frontend | Next.js, React, and TypeScript |
| Local development URLs | Frontend `http://127.0.0.1:3102`; backend `http://127.0.0.1:8001` |
| Application state | Process-local simulator history and model cache; no persistent telemetry database |

## Purpose and project context

The accompanying academic synopsis and presentation motivate the use of physics-informed learning for quality monitoring when labeled manufacturing defects are scarce. This repository implements a bounded software demonstration of that idea in a synthetic extrusion setting. It provides a way to explore the relationship between changing process conditions, model-derived risk estimates, and human-reviewed recommendations.

The implemented prototype should not be read as a reproduction of every academic proposal or result. In particular, it does not acquire live sensor measurements, solve calibrated governing partial differential equations, validate on real production outcomes, or automatically apply recommendations to equipment. Implementation details and evidence in the source code and experiment records take precedence over broader proposal language in the academic materials.

## End-to-end workflow

1. **Generate process data.** The selected industry simulator initializes a nominal or disturbed process state and advances its configured channels over simulated time. The extrusion flagship retains its nine original channels and six scenarios.
2. **Prepare model inputs.** Numeric features are imputed and standardized using training-set statistics. The LSTM input is formed from temporal windows.
3. **Estimate defect risk.** For plastic extrusion, the primary network predicts three simulator-derived risk targets and the LSTM provides a comparator when enough history is available. The five added modules use industry-specific deterministic risk rules and do not claim PINN/LSTM evaluation.
4. **Summarize risk.** The backend returns defect-specific risk values, a weighted overall risk, risk bands, and a heuristic lead-time estimate.
5. **Generate an advisory.** Rules select the highest-ranked defect category and map it to a bounded, simulated process-variable recommendation.
6. **Simulate feedback.** An authorized user can apply the advisory to the in-memory simulator. The API reports before-and-after values for the target sensor, selected defect risk, and overall risk.
7. **Present results.** The dashboard displays the current simulation, sensor history, risk, advisory, model comparison, and demonstration-oriented business views.

The simulated process continues to evolve after a correction. Consequently, a lower selected defect-risk value does not guarantee that overall risk will decrease; other scenario-driven signals may still change.

## Simulated process and signals

The simulator supports six scenarios:

- **Normal:** nominal profile with small gradual changes.
- **Overheating:** rising temperature and associated process drift.
- **Uneven cooling:** declining simulated cooling efficiency and changing product conditions.
- **Feed-rate instability:** oscillating feed behavior with related pressure and thickness changes.
- **Gradual drift:** slower changes across temperature, pressure, thickness, and viscosity.
- **Sudden disturbance:** faster simultaneous changes in several channels.

Each snapshot contains nine inputs:

| Signal | Unit/key |
|---|---|
| Temperature | degrees Celsius (`temperature_c`) |
| Pressure | bar (`pressure_bar`) |
| Screw speed | revolutions per minute (`screw_speed_rpm`) |
| Feed rate | kilograms per hour (`feed_rate_kg_h`) |
| Vibration | millimeters per second (`vibration_mm_s`) |
| Viscosity | pascal-seconds (`viscosity_pa_s`) |
| Thickness | millimeters (`thickness_mm`) |
| Line speed | meters per minute (`line_speed_m_min`) |
| Cooling efficiency | unitless fraction (`cooling_efficiency`) |

Defect targets are generated as continuous values between zero and one for surface cracking, warping, and thickness variation. They are transparent simulator formulas, not ground-truth inspection labels or probabilities validated against factory outcomes.

## Six-industry simulation platform

Plastic & Polymer (Plastic Extrusion) remains the default flagship. Its existing 3D factory twin, nine process features, six scenarios, PINN-style proxy model, LSTM comparator, three defect-risk outputs, advisory flow, and legacy API routes are retained. Five additional interactive 3D plant twins depict paper stock preparation and winding, steel hot rolling, chemical processing, food processing and packaging, and pharmaceutical solid-dose production. Each industry model has its own equipment layout and displays only that simulator's backend-provided sensor values and risk outputs.

| Industry module | Example simulated process configuration |
|---|---|
| Paper & Pulp | Stock consistency and flow, headbox pressure, dryer temperature, web tension, sheet moisture, and caliper |
| Steel & Metals | Furnace temperature, rolling force, strip speed and thickness, cooling flow, and stand vibration |
| Chemical & Process | Reactor temperature and pressure, feed flow, pH proxy, agitator speed, and jacket flow |
| Food & Beverage | Pasteurization temperature, product flow, fill volume, conveyor speed, and product pH proxy |
| Pharmaceutical | Granulation moisture, blend speed, tablet-press force and weight, room-pressure differential, and dryer temperature |

Each added module has a separate in-memory simulator, equipment-to-sensor associations, a normal profile and three process-disturbance scenarios, three supported fault injections, industry-specific rule-based risk calculations, and corresponding simulated advisory actions. State does not cross between modules. The modules do not use industrial measurements or production labels; their risk outputs are not trained-model predictions, calibrated probabilities, or validated manufacturing results. No lead-time estimate or PINN/LSTM metric is exposed for these modules.

The shared selector is populated from `GET /api/v1/industries`. Dashboard and mutation requests for a selected module use `/api/v1/industries/{industry_id}/...`; the original extrusion endpoints remain available and unchanged. All mutations continue to require operator authentication, CSRF validation at the frontend boundary, and backend mutation-token enforcement.

The five additional 3D scenes share the PlantGuard dark industrial visual system, orbit/zoom controls, selectable equipment details, backend-linked sensor readouts, and a keyboard-accessible process-sequence fallback when WebGL is unavailable. Their equipment geometry is illustrative and simulation-only; it is not a facility layout, safety system, or machinery control interface.

## Models and evaluation

### Physics-Proxy-Guided Neural Network

The primary feed-forward model accepts nine normalized features, uses two hidden layers of 32 ReLU units, and produces three sigmoid outputs. Its training objective combines mean-squared data loss with a weighted physics-related proxy penalty. For that penalty, the implementation uses raw sensor-unit features and explicit sensor-derived formulas.

The penalty is a consistency regularizer against the same formula family used to produce the synthetic labels. It is **not** a full PDE-residual PINN, a calibrated heat-transfer or mass-conservation model, or independent evidence of physical validity.

### LSTM comparator

The LSTM receives eight consecutive readings, with nine features per reading, and predicts the same three simulator-derived targets for the last step. Its recurrent layer has 24 hidden units. The LSTM is a comparator: dashboard and advisory risk are driven by the primary model, not by the LSTM.

### Dataset construction and leakage controls

The documented model-evaluation pipeline generates 120 deterministic episodes of 32 readings each across the six scenarios, using seed 42. Episodes are separated into training, validation, and test partitions before temporal windows are created. Preprocessing statistics are fitted on training readings only. The reported split contains 78 training, 24 validation, and 18 test episodes.

Model training is CPU-based and lazy: the first model-backed request initializes the synthetic dataset and trains both models synchronously (800 epochs for the primary network and 100 for the LSTM). Models are cached in memory for the lifetime of that backend process. The initial request can therefore take longer than subsequent requests; timing depends on the host.

### Recorded synthetic holdout metrics

The repository includes a stored synthetic evaluation, dated 2026-10-16, in [`reports/measured_metrics.json`](reports/measured_metrics.json). Values below describe reproduction of simulator-generated targets on held-out episodes from the same synthetic process; they are not real-plant performance.

| Model | Evaluation unit | Test samples | MAE | MSE |
|---|---|---:|---:|---:|
| Feed-forward physics-proxy-guided model | One sensor snapshot | 576 | 0.006072 | 0.000066 |
| LSTM comparator | Eight-reading window | 450 | 0.048267 | 0.003682 |

The models use different evaluation units and sample counts, so the table is not a like-for-like production benchmark. No independently labeled defect events are available to establish accuracy, precision, recall, F1 score, confusion matrix, or false-alarm rate. Lead-time values are heuristic estimates from simulator/model state, not empirically measured warning times.

## Risk and advisory behavior

The backend returns three defect-specific scores and a weighted aggregate overall-risk value. Risk bands are derived from configured thresholds. Advisory selection uses the highest defect-specific score; the aggregate is reported separately. Lead-time estimates are heuristic and should not be interpreted as measured time-to-failure.

The advisory engine maps the selected risk category to a simulated recommendation:

| Selected category | Simulated target | Suggested adjustment | Nominal duration |
|---|---|---:|---:|
| Surface cracking | Temperature | -6 or -10 degrees Celsius, depending on severity | 180 seconds |
| Warping | Cooling efficiency | +0.12 or +0.20, depending on severity | 240 seconds |
| Thickness variation | Feed rate | -80 or -130 kilograms per hour, depending on severity | 210 seconds |

The simulator clamps and rate-limits supported adjustments, applies them only to simulated state, and expires them after a finite duration. These values are illustrative model outputs, not process instructions. Never connect this feature to a PLC, actuator, or physical machine.

## Application architecture

```text
Browser
  -> Next.js dashboard (127.0.0.1:3102)
  -> same-origin Next.js API proxy (/api/backend/...)
  -> FastAPI service (127.0.0.1:8001)
  -> simulator, preprocessing, model inference, risk, and advisory logic
```

The frontend proxy forwards allowlisted requests to FastAPI. In local development, the default backend target is `http://127.0.0.1:8001`; `PLANTGUARD_API_URL` can explicitly configure the server-side target. The proxy does not fabricate a successful response when the backend is unavailable.

The simulator history, risk history, and trained model cache are held in process memory. Restarting the backend resets that state and requires the models to be initialized again. The repository does not provide persistent telemetry storage or multi-process simulator-state coordination.

## Dashboard and user-facing sections

The Next.js application exposes an overview and section-based views for assets, telemetry, analytics, alerts, advisory, workflows, simulation, ROI, reports, integrations, and settings. These are software views over the demonstration; they do not represent connected physical assets or production systems.

The dashboard supports simulated scenario exploration, sensor and risk visualization, advisory review, and a user-input ROI demonstration. The interactive ROI view uses user-provided assumptions. The separate backend `/api/v1/roi` response is explicitly illustrative and must not be represented as customer savings or a measured return.

## API reference

FastAPI provides interactive documentation at `http://127.0.0.1:8001/docs` and an OpenAPI schema at `http://127.0.0.1:8001/openapi.json`.

| Method | Backend path | Purpose | Access |
|---|---|---|---|
| `GET` | `/health` | Service health and simulation-only status | Read |
| `GET` | `/api/v1/dashboard` | Consistent simulation, sensor, risk, and advisory snapshot | Read |
| `GET` | `/api/v1/industries` | Available industry metadata and configured simulation capabilities | Read |
| `GET` | `/api/v1/industries/{industry_id}/dashboard` | Selected industry's isolated sensor, risk, and advisory snapshot | Read |
| `GET` | `/api/v1/sensors/latest` | Latest simulated sensor values | Read |
| `GET` | `/api/v1/sensors/history` | Recent simulated readings | Read |
| `GET` | `/api/v1/risk/latest` | Defect-specific and overall risk | Read |
| `GET` | `/api/v1/advisory/latest` | Highest-ranked simulated advisory | Read |
| `GET` | `/api/v1/metrics` | MAE/MSE on the synthetic holdout set | Read |
| `GET` | `/api/v1/roi` | Illustrative, risk-derived backend estimate | Read |
| `GET` | `/api/v1/auth/status` | Verifies backend mutation-token enforcement | Protected |
| `POST` | `/api/v1/simulation/reset` | Reset the simulator to a scenario | Protected |
| `POST` | `/api/v1/simulation/inject` | Inject a supported simulated defect | Protected |
| `POST` | `/api/v1/simulation/advance` | Advance simulated time | Protected |
| `POST` | `/api/v1/advisories/apply` | Apply a bounded advisory to simulator state | Protected |
| `POST` | `/api/v1/industries/{industry_id}/simulation/reset` | Reset only the selected industry's simulation | Protected |
| `POST` | `/api/v1/industries/{industry_id}/simulation/inject` | Apply a supported industry-specific disturbance | Protected |
| `POST` | `/api/v1/industries/{industry_id}/simulation/advance` | Advance only the selected industry's simulation | Protected |
| `POST` | `/api/v1/industries/{industry_id}/advisories/apply` | Apply that industry's advisory to simulated state | Protected |

The browser normally uses the same-origin proxy. For example, the dashboard data route is `http://127.0.0.1:3102/api/backend/api/v1/dashboard`. Backend mutation endpoints require a server-configured bearer token. Browser-originated mutations additionally require operator authentication, a same-origin request, and CSRF validation.

## Local development on Windows

Use the repository root (the directory containing `backend`, `frontend`, `docs`, and `scripts`). For the authenticated local demonstration, configure credentials once, then start Redis, the backend, and the frontend in three separate PowerShell terminals. The setup file is protected with Windows DPAPI for the current Windows user and is ignored by Git.

### 1. Configure local operator authentication

```powershell
Set-Location "C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\PlantGuard-AI-Codex-Ready-phase5-integration"
.\scripts\setup_local_demo.ps1
```

Enter an operator username and a password of at least 16 characters when prompted. Password input is hidden. The script creates the matching scrypt verifier and a cryptographically random backend mutation token without displaying either value. Re-run the setup script and type `REPLACE` when prompted to rotate credentials. The protected settings file can be decrypted only by the Windows account that created it.

### 2. Start Redis (first PowerShell terminal)

Docker Desktop must be installed and running. Redis is bound only to `127.0.0.1:6379`; the script does not stop or replace another process if the port is occupied.

```powershell
Set-Location "C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\PlantGuard-AI-Codex-Ready-phase5-integration"
.\scripts\start_local_demo_redis.ps1
```

If Docker Desktop is not running, start it and wait for the engine before retrying. The script clearly reports a missing CLI, unavailable engine, occupied port, or failed Redis health check.

### 3. Start the backend (second PowerShell terminal)

```powershell
Set-Location "C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\PlantGuard-AI-Codex-Ready-phase5-integration"
.\scripts\start_local_demo_backend.ps1
```

This uses the project Python environment at `C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\.venv\Scripts\python.exe` and listens on `127.0.0.1:8001`.

### 4. Start the frontend (third PowerShell terminal)

```powershell
Set-Location "C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\PlantGuard-AI-Codex-Ready-phase5-integration"
.\scripts\start_local_demo_frontend.ps1
```

The frontend startup checks that Redis and the backend health endpoint respond before starting Next.js on `127.0.0.1:3102`. If frontend dependencies are not installed yet, run `pnpm install --frozen-lockfile` from `frontend` once. The Windows `pnpm dev` command uses the same local startup loader; do not invoke the internal `pnpm run dev:next` command directly, because it bypasses DPAPI configuration loading.

The local authentication origin is exactly `http://127.0.0.1:3102`; do not substitute `localhost`. Re-running setup does not update already-running service processes. After changing credentials or configuration, restart the backend and frontend using their startup scripts so they load the current DPAPI settings. Redis does not need restarting when it is already healthy.

### 5. Open and verify

- Dashboard: `http://127.0.0.1:3102/overview`
- Backend health: `http://127.0.0.1:8001/health`
- Backend API documentation: `http://127.0.0.1:8001/docs`
- Frontend-proxied health: `http://127.0.0.1:3102/api/backend/health`
- Frontend-proxied dashboard: `http://127.0.0.1:3102/api/backend/api/v1/dashboard`

PowerShell checks:

```powershell
Invoke-RestMethod "http://127.0.0.1:8001/health"
Invoke-RestMethod "http://127.0.0.1:3102/api/backend/health"
Invoke-RestMethod "http://127.0.0.1:3102/api/backend/api/v1/dashboard"
```

## Authentication and configuration

Read-only dashboard data can be retrieved without operator authentication. Simulated state changes are intentionally fail-closed. A missing or unavailable auth configuration can cause `/api/auth` to return `503`; this is distinct from a backend connection failure and must not be fixed by disabling authentication or CSRF checks.

The Windows setup script configures the local operator-auth flow with a username and scrypt verifier, a cryptographically random mutation token of at least 32 characters, Redis session storage at `redis://127.0.0.1:6379/0`, public origin `http://127.0.0.1:3102`, local-development cookie policy, and server-side backend URL `http://127.0.0.1:8001`.

Generated values are decrypted into each service's process environment at startup; they are not written to tracked source files, `.env` files, client-side variables, or terminal output. The ignored DPAPI settings file must be re-created if the Windows user account changes. See [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) and [`docs/SECURITY_OVERVIEW.md`](docs/SECURITY_OVERVIEW.md) for the full configuration and security boundary.

## Validation and tests

Run backend tests from the repository root using the configured Python environment:

```powershell
$ProjectRoot = (Get-Location).Path
$Python = "C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\.venv\Scripts\python.exe"
$env:PYTHONPATH = $ProjectRoot
& $Python -m pytest -q
```

Run frontend type checking and a production build from `frontend`:

```powershell
pnpm exec tsc --noEmit --incremental false
pnpm build
```

The backend tests cover simulation behavior, preprocessing and episode-level splits, model outputs, risk and advisory logic, feedback, API validation, startup checks, and security behavior. A passing test suite verifies software behavior against the implemented synthetic prototype; it does not establish factory performance.

## Optional containerized demo

The Compose configuration is a separate local demonstration setup. It requires the authentication variables described in `docs/DEPLOYMENT.md`; it also uses host ports `3101` for the frontend and `8003` for the backend, not the native development ports `3102` and `8001`. Inspect port availability before using Compose and do not stop or replace unrelated services to free a port.

```powershell
docker compose up --build
```

Compose and container builds are not required for the native Windows development workflow above.

## Repository structure

```text
backend/
  app/
    main.py           FastAPI routes and application state
    simulator.py      Synthetic extrusion scenarios and feedback
    preprocessing.py  Synthetic data generation and feature preparation
    modeling.py       Primary model, LSTM comparator, and risk calculations
    advisory.py       Rule-based simulated recommendations
frontend/
  app/                Next.js routes and API proxy
  components/         Dashboard and section components
  lib/                Frontend API, authentication, and server utilities
docs/                 Architecture, model, data, security, and deployment notes
reports/              Evaluation artifacts and project reports
scripts/              Startup validation and helper scripts
tests/                Backend and end-to-end verification
docker/               Backend and frontend container definitions
requirements.txt      Python dependency declarations
requirements-lock.txt Python 3.11 lock file for Windows
requirements-lock-linux.txt  Linux container lock file
frontend/package.json Frontend dependencies and scripts
```

## Limitations and future work

The current application is an in-memory software proof of concept. It has no real sensor connector, persistent production telemetry store, calibrated process equations, independently verified defect labels, plant-specific physics calibration, or validated production deployment. Model results are based on simulator-derived targets; the advisory and ROI outputs are illustrative. No factory accuracy, false-alarm rate, savings, safety certification, or deployment claim is made.

Evaluation with representative manufacturing data, calibration with process specialists, cybersecurity and safety reviews, operator-supervised trials, and explicit authorization would be prerequisites for any future real-world assessment. The application must remain disconnected from physical machine controls.

## Technical documentation

- [Project scope](docs/PROJECT_SPEC.md)
- [Product overview](docs/PRODUCT_OVERVIEW.md)
- [Architecture](docs/TECHNICAL_ARCHITECTURE.md)
- [Synthetic dataset and split](docs/DATASET.md)
- [Model design](docs/MODEL.md)
- [Physics-proxy distinction](docs/PHYSICS_MODEL.md)
- [Advisory behavior](docs/ADVISORY_ENGINE.md)
- [Experiment methodology](docs/EXPERIMENTS.md)
- [Recorded results and interpretation](docs/FINAL_RESULTS.md)
- [Limitations](docs/LIMITATIONS.md)
- [Security overview](docs/SECURITY_OVERVIEW.md)
- [Deployment configuration](docs/DEPLOYMENT.md)
