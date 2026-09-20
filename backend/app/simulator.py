from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional


SCENARIO_PROFILES = {
    "normal": {
        "temperature_c": 76.0,
        "pressure_bar": 48.0,
        "screw_speed_rpm": 118.0,
        "feed_rate_kg_h": 820.0,
        "vibration_mm_s": 1.4,
        "viscosity_pa_s": 84.0,
        "thickness_mm": 2.18,
        "line_speed_m_min": 24.0,
        "cooling_efficiency": 0.92,
    },
    "overheating": {
        "temperature_c": 92.0,
        "pressure_bar": 61.0,
        "screw_speed_rpm": 126.0,
        "feed_rate_kg_h": 860.0,
        "vibration_mm_s": 2.8,
        "viscosity_pa_s": 73.0,
        "thickness_mm": 2.34,
        "line_speed_m_min": 27.0,
        "cooling_efficiency": 0.78,
    },
    "uneven_cooling": {
        "temperature_c": 81.0,
        "pressure_bar": 57.0,
        "screw_speed_rpm": 121.0,
        "feed_rate_kg_h": 840.0,
        "vibration_mm_s": 2.2,
        "viscosity_pa_s": 78.0,
        "thickness_mm": 2.38,
        "line_speed_m_min": 25.0,
        "cooling_efficiency": 0.69,
    },
    "feed_rate_instability": {
        "temperature_c": 79.0,
        "pressure_bar": 58.0,
        "screw_speed_rpm": 119.0,
        "feed_rate_kg_h": 905.0,
        "vibration_mm_s": 2.6,
        "viscosity_pa_s": 76.0,
        "thickness_mm": 2.42,
        "line_speed_m_min": 26.0,
        "cooling_efficiency": 0.87,
    },
    "gradual_drift": {
        "temperature_c": 84.0,
        "pressure_bar": 59.0,
        "screw_speed_rpm": 123.0,
        "feed_rate_kg_h": 848.0,
        "vibration_mm_s": 2.1,
        "viscosity_pa_s": 75.0,
        "thickness_mm": 2.31,
        "line_speed_m_min": 25.5,
        "cooling_efficiency": 0.8,
    },
    "sudden_disturbance": {
        "temperature_c": 88.0,
        "pressure_bar": 64.0,
        "screw_speed_rpm": 132.0,
        "feed_rate_kg_h": 930.0,
        "vibration_mm_s": 3.4,
        "viscosity_pa_s": 70.0,
        "thickness_mm": 2.48,
        "line_speed_m_min": 29.0,
        "cooling_efficiency": 0.64,
    },
}


@dataclass
class ExtrusionSimulator:
    scenario: str = "normal"
    defect: Optional[str] = None
    state: Dict[str, float] = field(default_factory=dict)
    sensor_history: List[Dict[str, float]] = field(default_factory=list)
    event_log: List[str] = field(default_factory=list)
    time_s: float = 0.0

    def __post_init__(self) -> None:
        self.reset(self.scenario)

    def reset(self, scenario: Optional[str] = None) -> Dict[str, float]:
        key = (scenario or self.scenario or "normal").lower()
        self.scenario = key if key in SCENARIO_PROFILES else "normal"
        self.defect = None
        self.time_s = 0.0
        self.sensor_history = []
        self.event_log = [f"Scenario reset: {self.scenario}"]
        self.state = {
            "temperature_c": SCENARIO_PROFILES[self.scenario]["temperature_c"],
            "pressure_bar": SCENARIO_PROFILES[self.scenario]["pressure_bar"],
            "screw_speed_rpm": SCENARIO_PROFILES[self.scenario]["screw_speed_rpm"],
            "feed_rate_kg_h": SCENARIO_PROFILES[self.scenario]["feed_rate_kg_h"],
            "vibration_mm_s": SCENARIO_PROFILES[self.scenario]["vibration_mm_s"],
            "viscosity_pa_s": SCENARIO_PROFILES[self.scenario]["viscosity_pa_s"],
            "thickness_mm": SCENARIO_PROFILES[self.scenario]["thickness_mm"],
            "line_speed_m_min": SCENARIO_PROFILES[self.scenario]["line_speed_m_min"],
            "cooling_efficiency": SCENARIO_PROFILES[self.scenario]["cooling_efficiency"],
        }
        self.sensor_history.append(self._sensor_snapshot())
        return self.current_state()

    def _sensor_snapshot(self) -> Dict[str, float]:
        snapshot = {"timestamp_s": float(self.time_s)}
        for key, value in self.state.items():
            snapshot[key] = float(value)
        return snapshot

    def generate_sensor_snapshot(self) -> Dict[str, float]:
        return self._sensor_snapshot()

    def current_state(self) -> Dict[str, Any]:
        return {
            "scenario": self.scenario,
            "defect": self.defect,
            "time_s": float(self.time_s),
            "sensor": self._sensor_snapshot(),
            "history": list(self.sensor_history),
            "event_log": list(self.event_log),
        }

    def inject_defect(self, defect: str) -> Dict[str, Any]:
        defect_name = defect.lower()
        self.defect = defect_name
        if defect_name == "surface_cracking":
            self.state["temperature_c"] += 7.0
            self.state["pressure_bar"] += 8.0
            self.state["vibration_mm_s"] += 1.4
            self.state["thickness_mm"] += 0.18
        elif defect_name == "warping":
            self.state["temperature_c"] += 5.0
            self.state["cooling_efficiency"] -= 0.18
            self.state["viscosity_pa_s"] -= 11.0
            self.state["thickness_mm"] += 0.22
        elif defect_name == "thickness_variation":
            self.state["feed_rate_kg_h"] += 120.0
            self.state["pressure_bar"] += 9.0
            self.state["thickness_mm"] += 0.28
            self.state["vibration_mm_s"] += 1.1
        else:
            defect_name = "normal"
            self.defect = None
        self.event_log.append(f"Injected defect: {defect_name}")
        self.sensor_history.append(self._sensor_snapshot())
        return self.current_state()

    def advance(self, dt: float = 1.0) -> Dict[str, Any]:
        self.time_s += dt
        profile = SCENARIO_PROFILES[self.scenario]

        if self.scenario == "normal":
            self.state["temperature_c"] += 0.08 * dt
            self.state["pressure_bar"] += 0.05 * dt
            self.state["vibration_mm_s"] += 0.02 * dt
            self.state["thickness_mm"] += 0.002 * dt
        elif self.scenario == "overheating":
            self.state["temperature_c"] += 0.35 * dt
            self.state["pressure_bar"] += 0.18 * dt
            self.state["vibration_mm_s"] += 0.09 * dt
            self.state["thickness_mm"] += 0.015 * dt
        elif self.scenario == "uneven_cooling":
            self.state["temperature_c"] += 0.22 * dt
            self.state["cooling_efficiency"] -= 0.006 * dt
            self.state["vibration_mm_s"] += 0.05 * dt
            self.state["thickness_mm"] += 0.012 * dt
        elif self.scenario == "feed_rate_instability":
            self.state["feed_rate_kg_h"] += 5.0 * dt * (1.0 if self.time_s % 5 < 2.5 else -1.0)
            self.state["pressure_bar"] += 0.1 * dt
            self.state["vibration_mm_s"] += 0.07 * dt
            self.state["thickness_mm"] += 0.018 * dt
        elif self.scenario == "gradual_drift":
            self.state["temperature_c"] += 0.2 * dt
            self.state["pressure_bar"] += 0.12 * dt
            self.state["thickness_mm"] += 0.010 * dt
            self.state["viscosity_pa_s"] -= 0.08 * dt
        elif self.scenario == "sudden_disturbance":
            self.state["temperature_c"] += 0.45 * dt
            self.state["pressure_bar"] += 0.24 * dt
            self.state["feed_rate_kg_h"] += 18.0 * dt
            self.state["vibration_mm_s"] += 0.22 * dt
            self.state["thickness_mm"] += 0.025 * dt

        if self.defect == "surface_cracking":
            self.state["temperature_c"] += 0.7 * dt
            self.state["vibration_mm_s"] += 0.12 * dt
            self.state["thickness_mm"] += 0.02 * dt
        elif self.defect == "warping":
            self.state["temperature_c"] += 0.4 * dt
            self.state["cooling_efficiency"] -= 0.008 * dt
            self.state["viscosity_pa_s"] -= 0.2 * dt
        elif self.defect == "thickness_variation":
            self.state["feed_rate_kg_h"] += 8.0 * dt
            self.state["thickness_mm"] += 0.03 * dt

        self.state["temperature_c"] = max(68.0, min(self.state["temperature_c"], 110.0))
        self.state["pressure_bar"] = max(35.0, min(self.state["pressure_bar"], 85.0))
        self.state["screw_speed_rpm"] = max(80.0, min(self.state["screw_speed_rpm"], 150.0))
        self.state["feed_rate_kg_h"] = max(700.0, min(self.state["feed_rate_kg_h"], 980.0))
        self.state["vibration_mm_s"] = max(0.8, min(self.state["vibration_mm_s"], 5.5))
        self.state["viscosity_pa_s"] = max(60.0, min(self.state["viscosity_pa_s"], 100.0))
        self.state["thickness_mm"] = max(1.8, min(self.state["thickness_mm"], 3.0))
        self.state["line_speed_m_min"] = max(18.0, min(self.state["line_speed_m_min"], 32.0))
        self.state["cooling_efficiency"] = max(0.5, min(self.state["cooling_efficiency"], 1.0))

        snapshot = self._sensor_snapshot()
        self.sensor_history.append(snapshot)
        return self.current_state()

    def apply_advisory(self, advisory: Dict[str, Any]) -> Dict[str, Any]:
        target = advisory.get("target_process_variable", "temperature_c")
        adjustment = float(advisory.get("suggested_adjustment", 0.0))
        if target not in self.state:
            target = "temperature_c"

        current = float(self.state.get(target, 0.0))
        self.state[target] = current + adjustment
        self.event_log.append(f"Applied advisory to {target}: {adjustment}")

        if target == "temperature_c":
            self.state["cooling_efficiency"] = min(1.0, self.state["cooling_efficiency"] + 0.04)
        elif target == "feed_rate_kg_h":
            self.state["pressure_bar"] = max(35.0, self.state["pressure_bar"] - 2.5)
        elif target == "vibration_mm_s":
            self.state["screw_speed_rpm"] = max(80.0, self.state["screw_speed_rpm"] - 5.0)

        sensor = self._sensor_snapshot()
        self.sensor_history.append(sensor)
        return self.current_state()


def build_demo_backup() -> ExtrusionSimulator:
    simulator = ExtrusionSimulator("normal")
    simulator.reset("normal")
    return simulator
