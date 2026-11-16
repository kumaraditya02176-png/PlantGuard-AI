from __future__ import annotations

from backend.app.industry_core import IndustrySimulator
from backend.app.industries.chemical_process import build_spec as build_chemical_process
from backend.app.industries.food_beverage import build_spec as build_food_beverage
from backend.app.industries.paper_pulp import build_spec as build_paper_pulp
from backend.app.industries.pharmaceutical import build_spec as build_pharmaceutical
from backend.app.industries.steel_metals import build_spec as build_steel_metals
from backend.app.simulator import SCENARIO_PROFILES, SENSOR_BOUNDS


EXTRUSION_METADATA: dict[str, object] = {
    "id": "plastic_extrusion",
    "name": "Plastic & Polymer",
    "description": "Flagship simulated plastic-extrusion process with its existing 3D twin, PINN-style proxy model, LSTM comparator, and advisory flow.",
    "simulation_only": True,
    "equipment": [
        {"id": "feed-system", "name": "Feed system", "description": "Simulated material input.", "sensor_keys": ["feed_rate_kg_h"]},
        {"id": "extrusion-zone", "name": "Extrusion zone", "description": "Simulated melt processing.", "sensor_keys": ["temperature_c", "pressure_bar", "screw_speed_rpm", "viscosity_pa_s"]},
        {"id": "cooling-section", "name": "Cooling section", "description": "Simulated thermal stabilization.", "sensor_keys": ["cooling_efficiency"]},
        {"id": "output-gauge", "name": "Output gauge", "description": "Simulated product measurement.", "sensor_keys": ["thickness_mm", "line_speed_m_min"]},
    ],
    "sensors": [
        {"key": key, "label": label, "unit": unit, "minimum": SENSOR_BOUNDS[key][0], "maximum": SENSOR_BOUNDS[key][1]}
        for key, label, unit in (
            ("temperature_c", "Temperature", "°C"),
            ("pressure_bar", "Melt pressure", "bar"),
            ("screw_speed_rpm", "Screw speed", "rpm"),
            ("feed_rate_kg_h", "Feed rate", "kg/h"),
            ("vibration_mm_s", "Vibration", "mm/s"),
            ("viscosity_pa_s", "Viscosity", "Pa·s"),
            ("thickness_mm", "Output thickness", "mm"),
            ("line_speed_m_min", "Line speed", "m/min"),
            ("cooling_efficiency", "Cooling efficiency", "%"),
        )
    ],
    "scenarios": [
        {"id": key, "label": label, "note": note}
        for key, label, note in (
            ("normal", "Normal operation", "Nominal extrusion process"),
            ("overheating", "Overheating", "Thermal excursion"),
            ("uneven_cooling", "Uneven cooling", "Cooling imbalance"),
            ("feed_rate_instability", "Feed-rate instability", "Variable throughput"),
            ("gradual_drift", "Gradual drift", "Slow process change"),
            ("sudden_disturbance", "Sudden disturbance", "Rapid process change"),
        )
        if key in SCENARIO_PROFILES
    ],
    "defects": [
        {"id": key, "label": label, "note": "Supported simulated extrusion disturbance."}
        for key, label in (
            ("surface_cracking", "Surface cracking"),
            ("warping", "Warping"),
            ("thickness_variation", "Thickness variation"),
        )
    ],
    "risk_categories": [
        {"id": key, "label": label}
        for key, label in (
            ("surface_cracking", "Surface cracking"),
            ("warping", "Warping"),
            ("thickness_non_uniformity", "Thickness variation"),
        )
    ],
    "risk_method": "Physics-Proxy-Guided Neural Network trained on synthetic simulator targets; not a full PDE-residual PINN.",
}


_SPECS = (
    build_paper_pulp(),
    build_steel_metals(),
    build_chemical_process(),
    build_food_beverage(),
    build_pharmaceutical(),
)
INDUSTRY_SPECS = {spec.id: spec for spec in _SPECS}
INDUSTRY_SIMULATORS = {key: IndustrySimulator(spec) for key, spec in INDUSTRY_SPECS.items()}


def get_industry_catalog() -> list[dict[str, object]]:
    return [dict(EXTRUSION_METADATA), *(spec.metadata() for spec in _SPECS)]


def get_industry_metadata(industry_id: str) -> dict[str, object] | None:
    if industry_id == "plastic_extrusion":
        return dict(EXTRUSION_METADATA)
    spec = INDUSTRY_SPECS.get(industry_id)
    return spec.metadata() if spec else None
