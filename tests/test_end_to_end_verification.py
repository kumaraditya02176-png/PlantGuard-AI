from __future__ import annotations

import numpy as np
import pytest
import torch
from fastapi.testclient import TestClient

from backend.app.advisory import advisory_from_risk, generate_advisory_for_state
from backend.app import main as main_module
from backend.app.main import _ensure_model_cache, app
from backend.app.modeling import (
    LSTMBaseline,
    PINNModel,
    compute_risk_from_state,
    evaluate_metrics,
    risk_band_for_value,
    risk_from_predictions,
    train_lstm_model,
    train_pinn_model,
)
from backend.app.preprocessing import FEATURE_COLUMNS, prepare_dataset, synthetic_risk_target
from backend.app.simulator import SENSOR_BOUNDS, SCENARIO_PROFILES, ExtrusionSimulator


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
    assert dataset["x_train_windows"].shape[1] == 6
    expected_windows_per_episode = dataset["episode_length"] - 6 + 1
    assert dataset["x_train_windows"].shape[0] == len(dataset["episode_ids"]["train"]) * expected_windows_per_episode
    split_ids = [set(dataset["episode_ids"][part]) for part in ("train", "val", "test")]
    assert not split_ids[0] & split_ids[1]
    assert not split_ids[0] & split_ids[2]
    assert not split_ids[1] & split_ids[2]
    np.testing.assert_allclose(
        dataset["x_train"],
        dataset["preprocessor"].transform(dataset["raw_x_train"]),
    )
    np.testing.assert_allclose(
        dataset["preprocessor"].offset_,
        dataset["raw_x_train"].mean(axis=0),
    )
    expected_feature_windows = []
    expected_label_windows = []
    raw_episode_features = dataset["raw_x_train"].reshape(-1, dataset["episode_length"], len(FEATURE_COLUMNS))
    episode_targets = dataset["y_train"].reshape(-1, dataset["episode_length"], 3)
    for raw_episode, target_episode in zip(raw_episode_features, episode_targets):
        scaled_episode = dataset["preprocessor"].transform(raw_episode)
        expected_feature_windows.extend(
            scaled_episode[start : start + 6]
            for start in range(dataset["episode_length"] - 6 + 1)
        )
        expected_label_windows.extend(
            target_episode[start + 5]
            for start in range(dataset["episode_length"] - 6 + 1)
        )
    np.testing.assert_allclose(dataset["x_train_windows"], expected_feature_windows)
    np.testing.assert_allclose(dataset["y_train_windows"], expected_label_windows)
    assert dataset["columns"] == FEATURE_COLUMNS
    assert np.isfinite(dataset["x_train_windows"]).all()


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

    physical_features = np.tile(
        np.asarray([90.0, 60.0, 120.0, 850.0, 2.5, 75.0, 2.4, 25.0, 0.8], dtype=np.float32),
        (8, 1),
    )
    trained = train_pinn_model(
        features.numpy(),
        targets.numpy(),
        physical_features,
        epochs=2,
    )
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
    with pytest.raises(ValueError):
        model(torch.tensor(x[:, 0, :], dtype=torch.float32))

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
    with pytest.raises(ValueError):
        train_lstm_model(x[:, 0, :], y, epochs=1)


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


def test_prediction_risk_uses_shared_weights_and_bounded_output():
    predictions = np.asarray([0.8, 0.4, 0.2], dtype=np.float32)
    risk = risk_from_predictions(predictions)
    assert risk["overall_risk"] == pytest.approx(0.4 * 0.8 + 0.35 * 0.4 + 0.25 * 0.2)
    assert risk["risk_band"] == "moderate"
    with pytest.raises(ValueError):
        risk_from_predictions(np.asarray([0.2, np.nan, 0.4], dtype=np.float32))


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        (0.649999, "moderate"),
        (0.65, "high"),
        (0.699999, "high"),
        (0.70, "high"),
    ],
)
def test_risk_and_advisory_share_band_boundaries(value, expected):
    assert risk_band_for_value(value) == expected
    assert advisory_from_risk("surface_cracking", value, {})["severity"] == expected


def test_pinn_physics_targets_match_documented_synthetic_teacher_at_nominal_and_defect_states():
    model = PINNModel()
    cases = [
        SCENARIO_PROFILES["normal"],
        SCENARIO_PROFILES["overheating"],
        SCENARIO_PROFILES["feed_rate_instability"],
    ]
    for scenario, defect in (
        ("overheating", "surface_cracking"),
        ("feed_rate_instability", "thickness_variation"),
    ):
        simulator = ExtrusionSimulator(scenario)
        sensor = simulator.inject_defect(defect)["sensor"]
        cases.append(sensor)

    features = torch.tensor(
        [[case[column] for column in FEATURE_COLUMNS] for case in cases],
        dtype=torch.float32,
    )
    with torch.no_grad():
        physics_targets = model.physics_targets(features).numpy()
    expected_targets = np.asarray([synthetic_risk_target(case) for case in cases])
    np.testing.assert_allclose(physics_targets, expected_targets, rtol=1e-6, atol=1e-6)


def _expected_api_model_risks(simulator):
    cache = _ensure_model_cache()
    state = simulator.current_state()
    columns = cache["dataset"]["columns"]
    raw = np.asarray(
        [[reading[column] for column in columns] for reading in state["history"][-8:]],
        dtype=np.float32,
    )
    features = cache["dataset"]["preprocessor"].transform(raw)
    with torch.no_grad():
        pinn = cache["pinn"](torch.tensor(features[-1:], dtype=torch.float32))[0].numpy()
        lstm = None
        if len(features) >= 8:
            lstm = cache["lstm"](torch.tensor(features[-8:][None, :, :], dtype=torch.float32))[0].numpy()
    return risk_from_predictions(pinn), None if lstm is None else risk_from_predictions(lstm)


def test_api_dashboard_advisory_use_cached_pinn_and_lstm_warms_up(monkeypatch):
    monkeypatch.setattr(main_module, "simulator", ExtrusionSimulator("normal"))
    monkeypatch.setattr(
        "backend.app.modeling.compute_risk_from_state",
        lambda *args, **kwargs: pytest.fail("API called the non-model risk helper"),
    )
    client = TestClient(app)

    reset = client.post("/api/v1/simulation/reset", json={"scenario": "overheating"})
    assert reset.status_code == 200
    dashboard = reset.json()
    expected_pinn, expected_lstm = _expected_api_model_risks(main_module.simulator)
    assert dashboard["risk"]["risk"]["surface_cracking"] == pytest.approx(expected_pinn["surface_cracking"])
    assert dashboard["risk"]["risk"]["warping"] == pytest.approx(expected_pinn["warping"])
    assert dashboard["risk"]["risk"]["thickness_non_uniformity"] == pytest.approx(expected_pinn["thickness_variation"])
    assert dashboard["risk"]["overall_risk"] == pytest.approx(expected_pinn["overall_risk"])
    assert dashboard["risk"]["model_comparison"]["lstm_status"] == "warming_up"
    assert dashboard["risk"]["model_comparison"]["lstm_risk"] is None

    advisory = client.get("/api/v1/advisory/latest").json()
    expected_defect = max(
        (
            ("surface_cracking", expected_pinn["surface_cracking"]),
            ("warping", expected_pinn["warping"]),
            ("thickness_variation", expected_pinn["thickness_variation"]),
        ),
        key=lambda value: value[1],
    )[0]
    assert advisory["defect"] == expected_defect
    assert advisory["risk"] == pytest.approx(expected_pinn[expected_defect])

    advanced = client.post(
        "/api/v1/simulation/advance",
        json={"dt": 1.0, "steps": 7},
    ).json()
    expected_pinn, expected_lstm = _expected_api_model_risks(main_module.simulator)
    assert expected_lstm is not None
    comparison = advanced["risk"]["model_comparison"]
    assert comparison["lstm_status"] == "active"
    assert comparison["lstm_risk"]["surface_cracking"] == pytest.approx(expected_lstm["surface_cracking"])
    assert comparison["lstm_risk"]["warping"] == pytest.approx(expected_lstm["warping"])
    assert comparison["lstm_risk"]["thickness_non_uniformity"] == pytest.approx(expected_lstm["thickness_variation"])


@pytest.mark.parametrize("scenario", ["overheating", "feed_rate_instability"])
def test_model_backed_api_advisory_beats_matched_control(scenario, monkeypatch):
    monkeypatch.setattr(main_module, "simulator", ExtrusionSimulator(scenario))
    client = TestClient(app)
    reset = client.post("/api/v1/simulation/reset", json={"scenario": scenario})
    assert reset.status_code == 200

    apply = client.post("/api/v1/advisories/apply")
    assert apply.status_code == 200
    applied_dashboard = apply.json()
    correction_target = applied_dashboard["advisory"]["target_process_variable"]
    expected_target = {
        "overheating": "temperature_c",
        "feed_rate_instability": "feed_rate_kg_h",
    }[scenario]
    assert correction_target == expected_target
    corrected = client.post(
        "/api/v1/simulation/advance",
        json={"dt": 1.0, "steps": 30},
    ).json()
    corrected_risk = corrected["risk"]["overall_risk"]

    monkeypatch.setattr(main_module, "simulator", ExtrusionSimulator(scenario))
    control_reset = client.post("/api/v1/simulation/reset", json={"scenario": scenario})
    assert control_reset.status_code == 200
    control = client.post(
        "/api/v1/simulation/advance",
        json={"dt": 1.0, "steps": 30},
    ).json()
    control_risk = control["risk"]["overall_risk"]
    target_risk_key = {
        "temperature_c": "surface_cracking",
        "feed_rate_kg_h": "thickness_non_uniformity",
    }[correction_target]
    corrected_target_risk = corrected["risk"]["risk"][target_risk_key]
    control_target_risk = control["risk"]["risk"][target_risk_key]
    assert corrected_target_risk < control_target_risk, (
        f"{scenario} model-backed correction ({correction_target}) produced "
        f"{target_risk_key} risk {corrected_target_risk:.6f} versus "
        f"{control_target_risk:.6f} matched-control risk; overall was "
        f"{corrected_risk:.6f} versus {control_risk:.6f}"
    )


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
    assert after_risk["overall_risk"] < before_risk["overall_risk"]
    assert after_risk["lead_time_estimate_s"] != before_risk["lead_time_estimate_s"]


def test_advisory_correction_is_targeted_bounded_and_beats_matched_control():
    expected_defects = {
        "overheating": "surface_cracking",
        "feed_rate_instability": "thickness_variation",
    }

    for scenario, expected_defect in expected_defects.items():
        sim = ExtrusionSimulator(scenario)
        control = ExtrusionSimulator(scenario)
        before_sensor = sim.current_state()["sensor"]
        before_risk = compute_risk_from_state(before_sensor)
        recommendation = generate_advisory_for_state(before_risk, before_sensor)
        assert recommendation["defect"] == expected_defect

        sim.apply_advisory(recommendation)
        corrected_sensor = sim.current_state()["sensor"]
        target = recommendation["target_process_variable"]
        changed = [key for key in before_sensor if key != "timestamp_s" and corrected_sensor[key] != before_sensor[key]]
        assert changed == [target]

        sim.advance(30.0)
        control.advance(30.0)
        sustained_sensor = sim.current_state()["sensor"]
        sustained_risk = compute_risk_from_state(sustained_sensor)
        control_risk = compute_risk_from_state(control.current_state()["sensor"])
        assert sustained_risk["overall_risk"] < control_risk["overall_risk"]
        assert sustained_sensor["pressure_bar"] != before_sensor["pressure_bar"]
        assert sustained_sensor["vibration_mm_s"] != before_sensor["vibration_mm_s"]
        assert sustained_sensor[target] != control.current_state()["sensor"][target]
        for key, (minimum, maximum) in SENSOR_BOUNDS.items():
            assert minimum <= sustained_sensor[key] <= maximum

        setpoint = sim._correction_setpoints[target]
        assert sustained_sensor[target] == pytest.approx(setpoint)

        sim.advance(recommendation["duration_s"] - 30.0)
        sim.advance(1.0)
        assert not sim._correction_setpoints

        sim.reset(scenario)
        assert not sim._correction_setpoints


def test_advisory_adjustment_is_clamped_to_sensor_bounds():
    sim = ExtrusionSimulator("overheating")
    initial_temperature = sim.current_state()["sensor"]["temperature_c"]
    sim.apply_advisory({
        "target_process_variable": "temperature_c",
        "suggested_adjustment": 1000.0,
        "duration_s": 10,
    })
    assert sim.current_state()["sensor"]["temperature_c"] == initial_temperature

    initial_feed = sim.current_state()["sensor"]["feed_rate_kg_h"]
    sim.apply_advisory({
        "target_process_variable": "feed_rate_kg_h",
        "suggested_adjustment": -1000.0,
        "duration_s": 10,
    })
    assert sim.current_state()["sensor"]["feed_rate_kg_h"] == initial_feed - 15.0
    sim.advance(6.0)
    assert sim.current_state()["sensor"]["feed_rate_kg_h"] == 820.0
    with pytest.raises(ValueError):
        sim.apply_advisory({"target_process_variable": "pressure_bar"})


def test_fastapi_endpoints():
    client = TestClient(app)
    assert client.get("/health").status_code == 200
    dashboard = client.get("/api/v1/dashboard")
    assert dashboard.status_code == 200
    dashboard_json = dashboard.json()
    assert "risk" in dashboard_json
    assert "advisory" in dashboard_json
    assert dashboard_json["risk"]["model_comparison"]["primary_model"] == "pinn"
    assert dashboard_json["risk"]["model_comparison"]["lstm_status"] == "warming_up"
    assert dashboard_json["risk"]["model_comparison"]["lstm_risk"] is None
    assert "baseline_lstm_risk" not in dashboard_json["risk"]

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
    advance_result = client.post("/api/v1/simulation/advance", json={"dt": 1.0, "steps": 4})
    assert advance_result.status_code == 200
    assert advance_result.json()["risk"]["model_comparison"]["lstm_status"] == "active"
    assert 0.0 <= advance_result.json()["risk"]["model_comparison"]["lstm_risk"]["overall_risk"] <= 1.0

    metrics = client.get("/api/v1/metrics")
    assert metrics.status_code == 200
    metrics_json = metrics.json()
    assert "pinn" in metrics_json and "lstm" in metrics_json
    assert metrics_json["scope"] == "synthetic_simulator_holdout"
    assert "accuracy" not in str(metrics_json).lower()
    cache = _ensure_model_cache()
    dataset = cache["dataset"]
    with torch.no_grad():
        expected_pinn = cache["pinn"](torch.as_tensor(dataset["x_test"], dtype=torch.float32)).numpy()
        expected_lstm = cache["lstm"](torch.as_tensor(dataset["x_test_windows"], dtype=torch.float32)).numpy()
    assert metrics_json["pinn"] == evaluate_metrics(expected_pinn, dataset["y_test"])
    assert metrics_json["lstm"] == evaluate_metrics(expected_lstm, dataset["y_test_windows"])

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
    assert "False alarm rate" not in page_text
    assert "Per-label accuracy" not in page_text
