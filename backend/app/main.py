from __future__ import annotations

from typing import Any, Dict, List

import torch
from fastapi import FastAPI, Body
from fastapi.middleware.cors import CORSMiddleware

from backend.app.advisory import generate_advisory_for_state
from backend.app.modeling import compute_risk_from_state, evaluate_metrics, train_lstm_model, train_pinn_model
from backend.app.preprocessing import prepare_dataset
from backend.app.simulator import ExtrusionSimulator

app = FastAPI(title="PlantGuard AI API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

simulator = ExtrusionSimulator("normal")
risk_history: List[float] = []
_model_cache: Dict[str, Any] | None = None


def _snapshot_sensor(sensor: Dict[str, float]) -> Dict[str, float]:
    return {k: float(v) for k, v in sensor.items() if k != "timestamp_s"}


def _build_risk_payload(sensor: Dict[str, float]) -> Dict[str, float]:
    raw_risk = compute_risk_from_state(sensor, risk_history)
    risk_map = {
        "surface_cracking": float(raw_risk["surface_cracking"]),
        "warping": float(raw_risk["warping"]),
        "thickness_non_uniformity": float(raw_risk["thickness_variation"]),
        "overall_risk": float(raw_risk["overall_risk"]),
        "risk_band": str(raw_risk["risk_band"]),
        "lead_time_estimate_s": float(raw_risk["lead_time_estimate_s"]),
    }
    baseline = {k: float(v) for k, v in risk_map.items() if k not in {"risk_band", "lead_time_estimate_s", "overall_risk"}}
    baseline["overall_risk"] = float(min(1.0, risk_map["overall_risk"] * 1.05))
    baseline["risk_band"] = risk_map["risk_band"]
    baseline["lead_time_estimate_s"] = float(max(6.0, risk_map["lead_time_estimate_s"] * 1.03))
    risk_map["baseline_lstm_risk"] = baseline
    return risk_map


def _build_dashboard() -> Dict[str, Any]:
    sim_state = simulator.current_state()
    sensor = sim_state["sensor"]
    risk = _build_risk_payload(sensor)
    advisory = generate_advisory_for_state({
        "surface_cracking": risk["surface_cracking"],
        "warping": risk["warping"],
        "thickness_variation": risk["thickness_non_uniformity"],
        "overall_risk": risk["overall_risk"],
    }, sensor)
    risk["risk"] = {
        "surface_cracking": risk["surface_cracking"],
        "warping": risk["warping"],
        "thickness_non_uniformity": risk["thickness_non_uniformity"],
    }
    risk["overall_risk"] = float(risk["overall_risk"])
    advisory["title"] = advisory.get("title", f"{advisory['defect'].replace('_', ' ').title()} advisory")
    advisory["reason"] = advisory.get("reason", advisory.get("explanation", "Process conditions require attention."))
    risk_history.append(float(risk["overall_risk"]))
    if len(risk_history) > 20:
        risk_history.pop(0)

    return {
        "simulation": {
            "time_s": float(sim_state["time_s"]),
            "active_scenario": {"type": simulator.scenario},
            "latest_sensor": sensor,
            "controls": {
                "temperature_c": float(sensor.get("temperature_c", 0.0)),
                "pressure_bar": float(sensor.get("pressure_bar", 0.0)),
                "screw_speed_rpm": float(sensor.get("screw_speed_rpm", 0.0)),
                "feed_rate_kg_h": float(sensor.get("feed_rate_kg_h", 0.0)),
                "vibration_mm_s": float(sensor.get("vibration_mm_s", 0.0)),
                "thickness_mm": float(sensor.get("thickness_mm", 0.0)),
                "cooling_efficiency": float(sensor.get("cooling_efficiency", 0.0)),
            },
        },
        "risk": {
            "risk": {
                "surface_cracking": float(risk["surface_cracking"]),
                "warping": float(risk["warping"]),
                "thickness_non_uniformity": float(risk["thickness_non_uniformity"]),
            },
            "overall_risk": float(risk["overall_risk"]),
            "risk_band": str(risk["risk_band"]),
            "lead_time_estimate_s": float(risk["lead_time_estimate_s"]),
            "baseline_lstm_risk": {
                "surface_cracking": float(risk["baseline_lstm_risk"]["surface_cracking"]),
                "warping": float(risk["baseline_lstm_risk"]["warping"]),
                "thickness_non_uniformity": float(risk["baseline_lstm_risk"]["surface_cracking"] * 0.0 + risk["baseline_lstm_risk"]["warping"] * 0.0 + risk["baseline_lstm_risk"]["surface_cracking"] * 0.0),
            },
        },
        "advisory": advisory,
        "notice": "SIMULATION ONLY — synthetic / simulated repository evaluation; no direct machine control.",
    }


def _ensure_model_cache() -> Dict[str, Any]:
    global _model_cache
    if _model_cache is None:
        dataset = prepare_dataset(window_size=8)
        x_train = dataset["x_train"].reshape(-1, dataset["x_train"].shape[-1])
        y_train = dataset["y_train"].reshape(-1, 3)
        _model_cache = {
            "pinn": train_pinn_model(x_train, y_train, epochs=8),
            "lstm": train_lstm_model(dataset["x_train"], dataset["y_train"], epochs=8),
            "dataset": dataset,
        }
    return _model_cache


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "product": "PlantGuard AI", "simulation_only": True}


@app.get("/api/v1/dashboard")
def get_dashboard() -> Dict[str, Any]:
    return _build_dashboard()


@app.get("/api/v1/sensors/latest")
def get_latest_sensor() -> Dict[str, Any]:
    return {"sensor": simulator.current_state()["sensor"]}


@app.get("/api/v1/sensors/history")
def get_sensor_history(limit: int = 90) -> Dict[str, Any]:
    history = simulator.sensor_history[-limit:]
    return {"readings": history}


@app.get("/api/v1/risk/latest")
def get_latest_risk() -> Dict[str, Any]:
    sensor = simulator.current_state()["sensor"]
    risk = _build_risk_payload(sensor)
    return {
        "risk": {
            "surface_cracking": float(risk["surface_cracking"]),
            "warping": float(risk["warping"]),
            "thickness_non_uniformity": float(risk["thickness_non_uniformity"]),
        },
        "overall_risk": float(risk["overall_risk"]),
        "risk_band": risk["risk_band"],
        "lead_time_estimate_s": float(risk["lead_time_estimate_s"]),
    }


@app.get("/api/v1/advisory/latest")
def get_latest_advisory() -> Dict[str, Any]:
    sensor = simulator.current_state()["sensor"]
    risk = _build_risk_payload(sensor)
    advisory = generate_advisory_for_state({
        "surface_cracking": risk["surface_cracking"],
        "warping": risk["warping"],
        "thickness_variation": risk["thickness_non_uniformity"],
        "overall_risk": risk["overall_risk"],
    }, sensor)
    return advisory


@app.post("/api/v1/advisories/apply")
def apply_advisory() -> Dict[str, Any]:
    sensor = simulator.current_state()["sensor"]
    risk = _build_risk_payload(sensor)
    recommendation = generate_advisory_for_state({
        "surface_cracking": risk["surface_cracking"],
        "warping": risk["warping"],
        "thickness_variation": risk["thickness_non_uniformity"],
        "overall_risk": risk["overall_risk"],
    }, sensor)
    simulator.apply_advisory(recommendation)
    return _build_dashboard()


@app.post("/api/v1/simulation/reset")
def reset_simulation(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    scenario = str(payload.get("scenario", "normal")).lower()
    simulator.reset(scenario)
    return _build_dashboard()


@app.post("/api/v1/simulation/inject")
def inject_defect(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    defect = str(payload.get("defect", "surface_cracking")).lower()
    simulator.inject_defect(defect)
    return _build_dashboard()


@app.post("/api/v1/simulation/advance")
def advance_simulation(payload: Dict[str, Any] = Body(...)) -> Dict[str, Any]:
    dt = float(payload.get("dt", 1.0))
    steps = max(1, int(payload.get("steps", 1)))
    for _ in range(steps):
        simulator.advance(dt)
    return _build_dashboard()


@app.get("/api/v1/metrics")
def get_metrics() -> Dict[str, Any]:
    cache = _ensure_model_cache()
    dataset = cache["dataset"]
    x_test = dataset["x_test"]
    y_test = dataset["y_test"]
    x_test_tensor = torch.as_tensor(x_test, dtype=torch.float32)
    y_test_tensor = torch.as_tensor(y_test, dtype=torch.float32)
    pinn_preds = cache["pinn"](x_test_tensor.reshape(-1, x_test_tensor.shape[-1]))
    lstm_preds = cache["lstm"](x_test_tensor)
    pinn_metrics = evaluate_metrics(pinn_preds.detach().numpy(), y_test_tensor.reshape(-1, 3).numpy())
    lstm_metrics = evaluate_metrics(lstm_preds.detach().numpy(), y_test_tensor.reshape(-1, 3).numpy())
    return {
        "synthetic_holdout": True,
        "label": "synthetic / simulated repository evaluation",
        "pinn": pinn_metrics,
        "lstm": lstm_metrics,
    }


@app.get("/api/v1/roi")
def get_roi() -> Dict[str, Any]:
    risk = _build_risk_payload(simulator.current_state()["sensor"])
    overall = float(risk["overall_risk"])
    annual_savings = max(0.0, 1200000.0 * (0.8 - overall) * 0.12)
    scrap_reduction = max(0.0, (0.9 - overall) * 100.0)
    return {
        "illustrative_estimate": {
            "annual_savings_usd": round(annual_savings, 2),
            "scrap_reduction_pct": round(scrap_reduction, 2),
            "payback_months": round(max(6.0, 18.0 - overall * 10.0), 2),
        },
        "disclaimer": "Synthetic / simulated repository evaluation only; not a production ROI guarantee.",
    }


@app.get("/")
def root() -> Dict[str, str]:
    return {"status": "ok", "service": "PlantGuard AI"}

