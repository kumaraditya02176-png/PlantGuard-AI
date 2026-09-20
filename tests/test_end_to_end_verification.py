from __future__ import annotations

import numpy as np
import torch
from fastapi.testclient import TestClient

from backend.app.advisory import generate_advisory_for_state
from backend.app.main import app
from backend.app.modeling import (
    LSTMBaseline,
    PINNModel,
    compute_risk_from_state,
    train_lstm_model,
    train_pinn_model,
)
from backend.app.preprocessing import prepare_dataset
from backend.app.simulator import ExtrusionSimulator, SCENARIO_PROFILES


SCENARIOS = [
    "normal",
    "overheating",
    "uneven_cooling",
    "feed_rate_instability",
    "gradual_drift",
    "sudden_disturbance",
]


def test_simulator_reset_and_six_scenarios():
    scenario_checks = {
        "normal": lambda before, after: after["temperature_c"] > before["temperature_c"],
        "overheating": lambda before, after: after["temperature_c"] > before["temperature_c"],
        "uneven_cooling": lambda before, after: after["cooling_efficiency"] < before["cooling_efficiency"],
        "feed_rate_instability": lambda before, after: after["feed_rate_kg_h"] != before["feed_rate_kg_h"],
        "gradual_drift": lambda before, after: after["thickness_mm"] > before["thickness_mm"],
        "sudden_disturbance": lambda before, after: after["vibration_mm_s"] > before["vibration_mm_s"],
    }
    for scenario in SCENARIOS:
        sim = ExtrusionSimulator(scenario)
        sim.reset(scenario)
        before = sim.current_state()["sensor"].copy()
        sim.advance(2.0)
        after = sim.current_state()["sensor"]
        assert sim.scenario == scenario
        assert before != after
        assert scenario_checks[scenario](before, after)


def test_preprocessing_and_dataset_shapes():
    dataset = prepare_dataset(window_size=6)
    assert dataset["x_train"].shape[1] == 9
    assert dataset["y_train"].shape[1] == 3
    assert dataset["x_train_windows"].shape[-1] == 9
    assert dataset["y_train_windows"].shape[1] == 3


def test_pinn_creation_and_losses():
    model = PINNModel(input_dim=9)
    features = torch.rand(8, 9)
    targets = torch.rand(8, 3)

    preds = model(features)
    assert preds.shape == (8, 3)
    assert torch.all((preds >= 0.0) & (preds <= 1.0))

    data_loss = model.data_loss(preds, targets)
    physics_loss = model.physics_loss(features, preds)
    total_loss = model.total_loss(features, preds, targets)

    assert float(data_loss.item()) > 0.0
    assert float(physics_loss.item()) > 0.0
    assert float(total_loss.item()) >= float(data_loss.item())

    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    optimizer.zero_grad()
    step_loss = model.total_loss(features, model(features), targets)
    step_loss.backward()
    optimizer.step()
    assert torch.isfinite(step_loss)

    trained = train_pinn_model(features.numpy(), targets.numpy(), epochs=2)
    inference = trained(features)
    assert inference.shape == (8, 3)
    assert torch.all((inference >= 0.0) & (inference <= 1.0))


def test_lstm_creation_and_inference():
    dataset = prepare_dataset(window_size=8)
    x = dataset["x_train_windows"][:8]
    y = dataset["y_train_windows"][:8]

    model = LSTMBaseline(input_dim=9)
    logits = model(torch.tensor(x, dtype=torch.float32))
    assert logits.shape == (8, 3)
    assert torch.all((logits >= 0.0) & (logits <= 1.0))

    optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
    optimizer.zero_grad()
    prediction = model(torch.tensor(x, dtype=torch.float32))
    batch_loss = torch.nn.functional.mse_loss(prediction, torch.tensor(y, dtype=torch.float32))
    batch_loss.backward()
    optimizer.step()
    assert torch.isfinite(batch_loss)

    trained = train_lstm_model(x, y, epochs=2)
    inference = trained(torch.tensor(x, dtype=torch.float32))
    assert inference.shape == (8, 3)
    assert torch.all((inference >= 0.0) & (inference <= 1.0))


def test_risk_range_and_lead_time():
    sensor = {
        "temperature_c": 91.0,
        "pressure_bar": 62.0,
        "screw_speed_rpm": 125.0,
        "feed_rate_kg_h": 900.0,
        "vibration_mm_s": 3.2,
        "viscosity_pa_s": 72.0,
        "thickness_mm": 2.45,
        "line_speed_m_min": 27.0,
        "cooling_efficiency": 0.7,
    }
    risk = compute_risk_from_state(sensor, recent_trend=[0.2, 0.24, 0.35, 0.52])
    for key in [
        "surface_cracking",
        "warping",
        "thickness_variation",
        "overall_risk",
    ]:
        assert 0.0 <= risk[key] <= 1.0
    assert risk["lead_time_estimate_s"] > 0.0

    normal_risk = compute_risk_from_state({
        "temperature_c": 76.0,
        "pressure_bar": 48.0,
        "screw_speed_rpm": 118.0,
        "feed_rate_kg_h": 820.0,
        "vibration_mm_s": 1.4,
        "viscosity_pa_s": 84.0,
        "thickness_mm": 2.18,
        "line_speed_m_min": 24.0,
        "cooling_efficiency": 0.92,
    })
    overheating_risk = compute_risk_from_state({
        "temperature_c": 92.0,
        "pressure_bar": 61.0,
        "screw_speed_rpm": 126.0,
        "feed_rate_kg_h": 860.0,
        "vibration_mm_s": 2.8,
        "viscosity_pa_s": 73.0,
        "thickness_mm": 2.34,
        "line_speed_m_min": 27.0,
        "cooling_efficiency": 0.78,
    })
    feed_risk = compute_risk_from_state({
        "temperature_c": 79.0,
        "pressure_bar": 58.0,
        "screw_speed_rpm": 119.0,
        "feed_rate_kg_h": 905.0,
        "vibration_mm_s": 2.6,
        "viscosity_pa_s": 76.0,
        "thickness_mm": 2.42,
        "line_speed_m_min": 26.0,
        "cooling_efficiency": 0.87,
    })
    assert normal_risk["overall_risk"] >= 0.0
    assert overheating_risk["overall_risk"] >= normal_risk["overall_risk"]
    assert feed_risk["overall_risk"] >= normal_risk["overall_risk"]


def test_advisory_generation_and_simulated_correction():
    sim = ExtrusionSimulator("overheating")
    sim.inject_defect("surface_cracking")
    baseline_state = sim.current_state()["sensor"]
    before_risk = compute_risk_from_state(baseline_state)
    advisory = generate_advisory_for_state(
        {
            "surface_cracking": before_risk["surface_cracking"],
            "warping": before_risk["warping"],
            "thickness_variation": before_risk["thickness_variation"],
            "overall_risk": before_risk["overall_risk"],
        },
        baseline_state,
    )
    assert advisory["defect"] == "surface_cracking"
    sim.apply_advisory(advisory)
    sim.advance(3.0)
    after_state = sim.current_state()["sensor"]
    after_risk = compute_risk_from_state(after_state)
    assert after_state != baseline_state
    assert after_risk["overall_risk"] != before_risk["overall_risk"]
    assert after_risk["lead_time_estimate_s"] != before_risk["lead_time_estimate_s"]


def test_fastapi_endpoints():
    client = TestClient(app)
    assert client.get("/health").status_code == 200
    dashboard = client.get("/api/v1/dashboard")
    assert dashboard.status_code == 200
    dashboard_json = dashboard.json()
    assert "risk" in dashboard_json
    assert "advisory" in dashboard_json

    sensors = client.get("/api/v1/sensors/latest")
    assert sensors.status_code == 200
    sensor_json = sensors.json()
    assert "sensor" in sensor_json

    history = client.get("/api/v1/sensors/history?limit=5")
    assert history.status_code == 200
    assert "readings" in history.json()

    risk = client.get("/api/v1/risk/latest")
    assert risk.status_code == 200
    risk_json = risk.json()
    assert 0.0 <= float(risk_json["overall_risk"]) <= 1.0

    advisory = client.get("/api/v1/advisory/latest")
    assert advisory.status_code == 200
    assert "defect" in advisory.json()

    apply_result = client.post("/api/v1/advisories/apply")
    assert apply_result.status_code == 200

    reset_result = client.post("/api/v1/simulation/reset", json={"scenario": "feed_rate_instability"})
    assert reset_result.status_code == 200

    inject_result = client.post("/api/v1/simulation/inject", json={"defect": "warping"})
    assert inject_result.status_code == 200

    advance_result = client.post("/api/v1/simulation/advance", json={"dt": 1.0, "steps": 2})
    assert advance_result.status_code == 200

    metrics = client.get("/api/v1/metrics")
    assert metrics.status_code == 200
    metrics_json = metrics.json()
    assert "pinn" in metrics_json and "lstm" in metrics_json

    roi = client.get("/api/v1/roi")
    assert roi.status_code == 200
    assert "illustrative_estimate" in roi.json()


def test_frontend_files_and_build_contract():
    from pathlib import Path

    root = Path(__file__).resolve().parents[1]
    page = root / "frontend" / "app" / "page.tsx"
    layout = root / "frontend" / "app" / "layout.tsx"
    globals_css = root / "frontend" / "app" / "globals.css"

    assert page.exists()
    assert layout.exists()
    assert globals_css.exists()

    page_text = page.read_text(encoding="utf-8")
    assert "SIMULATION ONLY" in page_text or "SIMULATION ONLY" in (root / "frontend" / "app" / "page.tsx").read_text(encoding="utf-8")
    assert "http://localhost:8000" in page_text or "NEXT_PUBLIC_API_URL" in page_text
    assert "Monitor" in page_text or "Advisory" in page_text
    assert "ROI" in page_text
