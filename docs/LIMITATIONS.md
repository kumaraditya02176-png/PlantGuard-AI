# LIMITATIONS

## Data and model

- The process, sensor values, scenarios, target labels, feedback, and model evaluation data are synthetic.
- Held-out metrics measure fit to the simulator's own target formulas; no empirical plant performance, false-alarm rate, or defect-detection accuracy has been established.
- PINN physics targets intentionally match synthetic label formulas. They are a consistency proxy, not calibrated heat-transfer, rheology, mass-conservation, or structural equations.
- The LSTM is a comparator and needs eight readings before its live output is available. First model use trains synchronously and can delay the initial request.
- No ONNX export/runtime verification exists in this authoritative workspace.

## Product and operations

- The simulator and model cache are in-memory, single-process demo state; there is no persistent telemetry store or multi-user isolation.
- ROI outputs depend on user assumptions and simplified calculations; they are not customer savings, a quote, or financial advice.
- The application has no real sensor connector and sends no action to a PLC or actuator.
- No plant calibration, prospective trial, cybersecurity certification, safety case, customer deployment, or production service commitment has been completed.

Any real-world use would require representative data, independent validation, sensor and physics calibration, security and safety reviews, operator approval, and supervised field trials. Never connect this demonstration to machine controls.
