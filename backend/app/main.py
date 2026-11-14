from __future__ import annotations

import math
import os
import secrets
from threading import Lock
from typing import Any, Dict, List, Literal
from urllib.parse import urlsplit

import torch
from fastapi import FastAPI, Body, Depends, Header, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StrictFloat, StrictInt, field_validator, model_validator
from starlette.middleware.base import RequestResponseEndpoint
from starlette.responses import Response

from backend.app.advisory import generate_advisory_for_state
from backend.app.modeling import (
    LSTM_TRAINING_EPOCHS,
    PINN_TRAINING_EPOCHS,
    evaluate_metrics,
    risk_band_for_value,
    risk_from_predictions,
    train_lstm_model,
    train_pinn_model,
)
from backend.app.preprocessing import prepare_dataset
from backend.app.simulator import SCENARIO_PROFILES, ExtrusionSimulator


DEFAULT_CORS_ORIGINS = (
    "http://127.0.0.1:3000",
    "http://localhost:3000",
    "http://127.0.0.1:3102",
    "http://localhost:3102",
)
MUTATION_TOKEN_MIN_LENGTH = 32
MAX_SIMULATION_STEPS = 100


def _configured_cors_origins() -> List[str]:
    environment = os.getenv("PLANTGUARD_ENV", "development").strip().lower()
    configured = os.getenv("PLANTGUARD_CORS_ORIGINS")
    if not configured:
        if environment == "production":
            raise RuntimeError("PLANTGUARD_CORS_ORIGINS must be configured in production.")
        return list(DEFAULT_CORS_ORIGINS)

    origins = [origin.strip() for origin in configured.split(",") if origin.strip()]
    if not origins or "*" in origins:
        raise RuntimeError("PLANTGUARD_CORS_ORIGINS must contain explicit origins and cannot contain '*'.")
    for origin in origins:
        parsed = urlsplit(origin)
        if (
            parsed.scheme not in {"http", "https"}
            or not parsed.netloc
            or parsed.path
            or parsed.query
            or parsed.fragment
            or origin.endswith("/")
            or parsed.username
            or parsed.password
        ):
            raise RuntimeError("PLANTGUARD_CORS_ORIGINS must contain exact HTTP(S) origins without paths.")
        if environment == "production" and parsed.scheme != "https":
            raise RuntimeError("Production CORS origins must use HTTPS.")
    return origins


ALLOWED_CORS_ORIGINS = _configured_cors_origins()


class StrictPayload(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


class ResetPayload(StrictPayload):
    scenario: Literal[
        "normal",
        "overheating",
        "uneven_cooling",
        "feed_rate_instability",
        "gradual_drift",
        "sudden_disturbance",
    ] = "normal"

    @field_validator("scenario", mode="before")
    @classmethod
    def normalize_scenario(cls, value: object) -> object:
        return value.lower() if isinstance(value, str) else value


class InjectPayload(StrictPayload):
    defect: Literal["surface_cracking", "warping", "thickness_variation"] = "surface_cracking"

    @field_validator("defect", mode="before")
    @classmethod
    def normalize_defect(cls, value: object) -> object:
        return value.lower() if isinstance(value, str) else value


class AdvancePayload(StrictPayload):
    dt: StrictInt | StrictFloat = 1.0
    steps: StrictInt = Field(default=1, ge=1, le=MAX_SIMULATION_STEPS)

    @field_validator("dt")
    @classmethod
    def validate_dt(cls, value: int | float) -> float:
        dt = float(value)
        if not math.isfinite(dt) or not 0.0 < dt <= 60.0:
            raise ValueError("dt must be finite and between 0 and 60 seconds.")
        return dt

    @model_validator(mode="after")
    def validate_elapsed_time(self) -> "AdvancePayload":
        if self.dt * self.steps > 600.0:
            raise ValueError("dt multiplied by steps must not exceed 600 seconds.")
        return self


app = FastAPI(title="PlantGuard AI API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_CORS_ORIGINS,
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)


@app.middleware("http")
async def reject_untrusted_origins(
    request: Request,
    call_next: RequestResponseEndpoint,
) -> Response:
    origin = request.headers.get("origin")
    if origin and origin not in ALLOWED_CORS_ORIGINS:
        return JSONResponse(status_code=403, content={"detail": "Origin is not allowed."})
    return await call_next(request)


def require_mutation_token(authorization: str | None = Header(default=None)) -> None:
    expected = os.getenv("PLANTGUARD_MUTATION_TOKEN", "")
    if len(expected) < MUTATION_TOKEN_MIN_LENGTH:
        raise HTTPException(
            status_code=503,
            detail="Simulation mutations are disabled until a valid operator token is configured.",
        )
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail="A valid operator token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    supplied = authorization[7:]
    if not secrets.compare_digest(supplied.encode("utf-8"), expected.encode("utf-8")):
        raise HTTPException(
            status_code=401,
            detail="A valid operator token is required.",
            headers={"WWW-Authenticate": "Bearer"},
        )


simulator = ExtrusionSimulator("normal")
risk_history: List[float] = []
_simulation_lock = Lock()
_model_cache: Dict[str, Any] | None = None
_model_cache_lock = Lock()
def _snapshot_sensor(sensor: Dict[str, float]) -> Dict[str, float]:
    return {k: float(v) for k, v in sensor.items() if k != "timestamp_s"}


def _predict_models(sensor_history: List[Dict[str, float]]) -> Dict[str, Any]:
    cache = _ensure_model_cache()
    dataset = cache["dataset"]
    columns = dataset["columns"]
    history = sensor_history[-max(dataset["window_size"], 1) :]
    raw_features = torch.as_tensor(
        [[float(reading[column]) for column in columns] for reading in history],
        dtype=torch.float32,
    )
    scaled_features = dataset["preprocessor"].transform(raw_features.numpy())
    pinn_input = torch.as_tensor(scaled_features[-1:], dtype=torch.float32)
    with torch.no_grad():
        pinn_prediction = cache["pinn"](pinn_input)[0].numpy()
        lstm_prediction = None
        if len(history) >= dataset["window_size"]:
            lstm_input = torch.as_tensor(scaled_features[-dataset["window_size"] :][None, :, :], dtype=torch.float32)
            lstm_prediction = cache["lstm"](lstm_input)[0].numpy()
    return {"pinn": pinn_prediction, "lstm": lstm_prediction}


def _build_risk_payload(
    sensor: Dict[str, float],
    sensor_history: List[Dict[str, float]] | None = None,
) -> Dict[str, Any]:
    history = sensor_history or [sensor]
    predictions = _predict_models(history)
    raw_risk = risk_from_predictions(predictions["pinn"], risk_history)
    lstm_risk = risk_from_predictions(predictions["lstm"]) if predictions["lstm"] is not None else None
    if lstm_risk is not None:
        lstm_risk["thickness_non_uniformity"] = lstm_risk.pop("thickness_variation")
    risk_map = {
        "surface_cracking": float(raw_risk["surface_cracking"]),
        "warping": float(raw_risk["warping"]),
        "thickness_non_uniformity": float(raw_risk["thickness_variation"]),
        "overall_risk": float(raw_risk["overall_risk"]),
        "risk_band": str(raw_risk["risk_band"]),
        "risk_bands": {
            "surface_cracking": risk_band_for_value(raw_risk["surface_cracking"]),
            "warping": risk_band_for_value(raw_risk["warping"]),
            "thickness_non_uniformity": risk_band_for_value(raw_risk["thickness_variation"]),
        },
        "lead_time_estimate_s": float(raw_risk["lead_time_estimate_s"]),
        "model_comparison": {
            "primary_model": "pinn",
            "lstm_status": "active" if predictions["lstm"] is not None else "warming_up",
            "lstm_risk": lstm_risk,
        },
    }
    return risk_map


def _build_dashboard() -> Dict[str, Any]:
    sim_state = simulator.current_state()
    sensor = sim_state["sensor"]
    risk = _build_risk_payload(sensor, sim_state["history"])
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
            "active_scenario": {"type": sim_state["scenario"]},
            "latest_sensor": sensor,
            "sensor_history": sim_state["history"][-90:],
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
            "risk_bands": risk["risk_bands"],
            "lead_time_estimate_s": float(risk["lead_time_estimate_s"]),
            "model_comparison": risk["model_comparison"],
        },
        "advisory": advisory,
        "notice": "SIMULATION ONLY — synthetic / simulated repository evaluation; no direct machine control.",
    }


def _ensure_model_cache() -> Dict[str, Any]:
    global _model_cache
    if _model_cache is None:
        with _model_cache_lock:
            if _model_cache is None:
                dataset = prepare_dataset(window_size=8)
                torch.manual_seed(42)
                _model_cache = {
                    "pinn": train_pinn_model(
                        dataset["x_train"],
                        dataset["y_train"],
                        dataset["raw_x_train"],
                        epochs=PINN_TRAINING_EPOCHS,
                    ),
                    "lstm": train_lstm_model(
                        dataset["x_train_windows"],
                        dataset["y_train_windows"],
                        epochs=LSTM_TRAINING_EPOCHS,
                    ),
                    "dataset": dataset,
                }
    return _model_cache


@app.get("/health")
def health() -> Dict[str, Any]:
    return {"status": "ok", "product": "PlantGuard AI", "simulation_only": True}


@app.get("/api/v1/auth/status", dependencies=[Depends(require_mutation_token)])
def mutation_auth_status() -> Dict[str, bool]:
    return {"authorized": True}


@app.get("/api/v1/dashboard")
def get_dashboard() -> Dict[str, Any]:
    with _simulation_lock:
        return _build_dashboard()


@app.get("/api/v1/sensors/latest")
def get_latest_sensor() -> Dict[str, Any]:
    with _simulation_lock:
        return {"sensor": simulator.current_state()["sensor"]}


@app.get("/api/v1/sensors/history")
def get_sensor_history(limit: int = Query(default=90, ge=1, le=1000)) -> Dict[str, Any]:
    with _simulation_lock:
        history = simulator.sensor_history[-limit:]
        return {"readings": history}


@app.get("/api/v1/risk/latest")
def get_latest_risk() -> Dict[str, Any]:
    with _simulation_lock:
        state = simulator.current_state()
        sensor = state["sensor"]
        risk = _build_risk_payload(sensor, state["history"])
        return {
            "risk": {
                "surface_cracking": float(risk["surface_cracking"]),
                "warping": float(risk["warping"]),
                "thickness_non_uniformity": float(risk["thickness_non_uniformity"]),
            },
            "overall_risk": float(risk["overall_risk"]),
            "risk_band": risk["risk_band"],
            "risk_bands": risk["risk_bands"],
            "lead_time_estimate_s": float(risk["lead_time_estimate_s"]),
            "model_comparison": risk["model_comparison"],
        }


@app.get("/api/v1/advisory/latest")
def get_latest_advisory() -> Dict[str, Any]:
    with _simulation_lock:
        state = simulator.current_state()
        sensor = state["sensor"]
        risk = _build_risk_payload(sensor, state["history"])
        advisory = generate_advisory_for_state({
            "surface_cracking": risk["surface_cracking"],
            "warping": risk["warping"],
            "thickness_variation": risk["thickness_non_uniformity"],
            "overall_risk": risk["overall_risk"],
        }, sensor)
        return advisory


@app.post("/api/v1/advisories/apply", dependencies=[Depends(require_mutation_token)])
def apply_advisory() -> Dict[str, Any]:
    with _simulation_lock:
        state = simulator.current_state()
        sensor = state["sensor"]
        before_risk = _build_risk_payload(sensor, state["history"])
        recommendation = generate_advisory_for_state({
            "surface_cracking": before_risk["surface_cracking"],
            "warping": before_risk["warping"],
            "thickness_variation": before_risk["thickness_non_uniformity"],
            "overall_risk": before_risk["overall_risk"],
        }, sensor)
        simulator.apply_advisory(recommendation)
        dashboard = _build_dashboard()
        risk_key = {
            "surface_cracking": "surface_cracking",
            "warping": "warping",
            "thickness_variation": "thickness_non_uniformity",
        }[recommendation["defect"]]
        target = recommendation["target_process_variable"]
        before_sensor = state["sensor"]
        after_sensor = dashboard["simulation"]["latest_sensor"]
        dashboard["correction_result"] = {
            "simulated": True,
            "defect": recommendation["defect"],
            "target_process_variable": target,
            "duration_s": recommendation["duration_s"],
            "before": {
                "sensor_value": float(before_sensor[target]),
                "defect_risk": float(before_risk[risk_key]),
                "overall_risk": float(before_risk["overall_risk"]),
            },
            "after": {
                "sensor_value": float(after_sensor[target]),
                "defect_risk": float(dashboard["risk"]["risk"][risk_key]),
                "overall_risk": float(dashboard["risk"]["overall_risk"]),
            },
        }
        return dashboard


@app.post("/api/v1/simulation/reset", dependencies=[Depends(require_mutation_token)])
def reset_simulation(payload: ResetPayload = Body(...)) -> Dict[str, Any]:
    with _simulation_lock:
        simulator.reset(payload.scenario)
        risk_history.clear()
        return _build_dashboard()


@app.post("/api/v1/simulation/inject", dependencies=[Depends(require_mutation_token)])
def inject_defect(payload: InjectPayload = Body(...)) -> Dict[str, Any]:
    with _simulation_lock:
        simulator.inject_defect(payload.defect)
        return _build_dashboard()


@app.post("/api/v1/simulation/advance", dependencies=[Depends(require_mutation_token)])
def advance_simulation(payload: AdvancePayload = Body(...)) -> Dict[str, Any]:
    with _simulation_lock:
        for _ in range(payload.steps):
            simulator.advance(payload.dt)
        return _build_dashboard()


@app.get("/api/v1/metrics")
def get_metrics() -> Dict[str, Any]:
    cache = _ensure_model_cache()
    dataset = cache["dataset"]
    x_test = dataset["x_test"]
    y_test = dataset["y_test"]
    x_test_tensor = torch.as_tensor(x_test, dtype=torch.float32)
    y_test_tensor = torch.as_tensor(y_test, dtype=torch.float32)
    x_test_windows = torch.as_tensor(dataset["x_test_windows"], dtype=torch.float32)
    y_test_windows = torch.as_tensor(dataset["y_test_windows"], dtype=torch.float32)
    with torch.no_grad():
        pinn_preds = cache["pinn"](x_test_tensor)
        lstm_preds = cache["lstm"](x_test_windows)
    pinn_metrics = evaluate_metrics(pinn_preds.numpy(), y_test_tensor.numpy())
    lstm_metrics = evaluate_metrics(lstm_preds.numpy(), y_test_windows.numpy())
    return {
        "synthetic_holdout": True,
        "scope": "synthetic_simulator_holdout",
        "pinn": pinn_metrics,
        "lstm": lstm_metrics,
    }


@app.get("/api/v1/roi")
def get_roi() -> Dict[str, Any]:
    with _simulation_lock:
        state = simulator.current_state()
        risk = _build_risk_payload(state["sensor"], state["history"])
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
