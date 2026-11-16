from __future__ import annotations

import math
import re
from dataclasses import dataclass
from threading import RLock
from typing import Callable, Mapping


@dataclass(frozen=True)
class SensorDefinition:
    key: str
    label: str
    unit: str
    minimum: float
    maximum: float
    nominal: float


@dataclass(frozen=True)
class EquipmentDefinition:
    name: str
    description: str
    sensor_keys: tuple[str, ...]


@dataclass(frozen=True)
class ScenarioDefinition:
    label: str
    note: str
    initial: Mapping[str, float]
    drift_per_second: Mapping[str, float]


@dataclass(frozen=True)
class FaultDefinition:
    label: str
    note: str
    sensor_offsets: Mapping[str, float]
    drift_per_second: Mapping[str, float]


RiskCalculator = Callable[[Mapping[str, float]], Mapping[str, float]]
AdvisoryBuilder = Callable[[Mapping[str, float], Mapping[str, float], float], dict[str, object]]


@dataclass(frozen=True)
class IndustrySpec:
    id: str
    name: str
    description: str
    equipment: tuple[EquipmentDefinition, ...]
    sensors: tuple[SensorDefinition, ...]
    scenarios: Mapping[str, ScenarioDefinition]
    defects: Mapping[str, FaultDefinition]
    risk_categories: Mapping[str, str]
    risk_weights: Mapping[str, float]
    risk_calculator: RiskCalculator
    advisory_builder: AdvisoryBuilder
    adjustment_limits: Mapping[str, tuple[float, float]]
    risk_method: str = "Industry-specific deterministic rules over simulated process signals."

    def __post_init__(self) -> None:
        if not re.fullmatch(r"[a-z][a-z0-9_]*", self.id):
            raise ValueError(f"Invalid industry identifier: {self.id}")
        if not self.sensors or "normal" not in self.scenarios:
            raise ValueError(f"{self.id} requires sensors and a normal scenario.")
        sensor_keys = {sensor.key for sensor in self.sensors}
        if len(sensor_keys) != len(self.sensors):
            raise ValueError(f"{self.id} has duplicate sensor keys.")
        for sensor in self.sensors:
            if not all(math.isfinite(value) for value in (sensor.minimum, sensor.maximum, sensor.nominal)):
                raise ValueError(f"{self.id}.{sensor.key} has non-finite bounds.")
            if sensor.minimum >= sensor.maximum or not sensor.minimum <= sensor.nominal <= sensor.maximum:
                raise ValueError(f"{self.id}.{sensor.key} has invalid sensor bounds.")
        for scenario_name, scenario in self.scenarios.items():
            if not set(scenario.initial).issubset(sensor_keys) or not set(scenario.drift_per_second).issubset(sensor_keys):
                raise ValueError(f"{self.id}.{scenario_name} references an unknown sensor.")
            if any(not math.isfinite(float(value)) for value in (*scenario.initial.values(), *scenario.drift_per_second.values())):
                raise ValueError(f"{self.id}.{scenario_name} contains non-finite simulator values.")
            for key, value in scenario.initial.items():
                sensor = next(item for item in self.sensors if item.key == key)
                if not sensor.minimum <= value <= sensor.maximum:
                    raise ValueError(f"{self.id}.{scenario_name} starts {key} outside its sensor bounds.")
        for defect_name, defect in self.defects.items():
            if not set(defect.sensor_offsets).issubset(sensor_keys) or not set(defect.drift_per_second).issubset(sensor_keys):
                raise ValueError(f"{self.id}.{defect_name} references an unknown sensor.")
            if any(not math.isfinite(float(value)) for value in (*defect.sensor_offsets.values(), *defect.drift_per_second.values())):
                raise ValueError(f"{self.id}.{defect_name} contains non-finite simulator values.")
        if set(self.risk_weights) != set(self.risk_categories):
            raise ValueError(f"{self.id} must define a weight for every risk category.")
        if any(not math.isfinite(weight) or weight <= 0 for weight in self.risk_weights.values()):
            raise ValueError(f"{self.id} risk weights must be positive and finite.")
        if any(
            key not in sensor_keys
            or not math.isfinite(low)
            or not math.isfinite(high)
            or low >= high
            for key, (low, high) in self.adjustment_limits.items()
        ):
            raise ValueError(f"{self.id} has invalid simulated adjustment limits.")
        for equipment in self.equipment:
            if not set(equipment.sensor_keys).issubset(sensor_keys):
                raise ValueError(f"{self.id} equipment references an unknown sensor.")

    def metadata(self) -> dict[str, object]:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "simulation_only": True,
            "equipment": [
                {
                    "id": re.sub(r"[^a-z0-9]+", "-", item.name.lower()).strip("-"),
                    "name": item.name,
                    "description": item.description,
                    "sensor_keys": list(item.sensor_keys),
                }
                for item in self.equipment
            ],
            "sensors": [
                {
                    "key": item.key,
                    "label": item.label,
                    "unit": item.unit,
                    "minimum": item.minimum,
                    "maximum": item.maximum,
                }
                for item in self.sensors
            ],
            "scenarios": [
                {"id": key, "label": item.label, "note": item.note}
                for key, item in self.scenarios.items()
            ],
            "defects": [
                {"id": key, "label": item.label, "note": item.note}
                for key, item in self.defects.items()
            ],
            "risk_categories": [
                {"id": key, "label": label}
                for key, label in self.risk_categories.items()
            ],
            "risk_method": self.risk_method,
        }


def bounded_risk(value: float) -> float:
    if not math.isfinite(value):
        raise ValueError("Risk calculation returned a non-finite value.")
    return min(1.0, max(0.0, float(value)))


def rising_risk(value: float, caution: float, critical: float) -> float:
    if critical <= caution:
        raise ValueError("Critical threshold must exceed caution threshold.")
    return bounded_risk((value - caution) / (critical - caution))


def falling_risk(value: float, caution: float, critical: float) -> float:
    if critical >= caution:
        raise ValueError("Critical threshold must be below caution threshold.")
    return bounded_risk((caution - value) / (caution - critical))


def deviation_risk(value: float, nominal: float, caution_delta: float, critical_delta: float) -> float:
    if critical_delta <= caution_delta or caution_delta <= 0:
        raise ValueError("Deviation thresholds must be positive and increasing.")
    return bounded_risk((abs(value - nominal) - caution_delta) / (critical_delta - caution_delta))


def step_towards(value: float, target: float, maximum_step: float) -> float:
    if not math.isfinite(value) or not math.isfinite(target) or not math.isfinite(maximum_step) or maximum_step <= 0:
        raise ValueError("A simulated adjustment requires finite values and a positive step limit.")
    return min(maximum_step, max(-maximum_step, target - value))


def risk_band(value: float) -> str:
    if value < 0.35:
        return "low"
    if value < 0.65:
        return "moderate"
    return "high"


class IndustrySimulator:
    def __init__(self, spec: IndustrySpec) -> None:
        self.spec = spec
        self._lock = RLock()
        self.scenario = "normal"
        self.defect: str | None = None
        self.time_s = 0.0
        self.state: dict[str, float] = {}
        self.sensor_history: list[dict[str, float]] = []
        self.event_log: list[str] = []
        self.reset("normal")

    def _bounds(self) -> dict[str, tuple[float, float]]:
        return {sensor.key: (sensor.minimum, sensor.maximum) for sensor in self.spec.sensors}

    def _clamp(self) -> None:
        for key, (minimum, maximum) in self._bounds().items():
            self.state[key] = min(maximum, max(minimum, self.state[key]))

    def _snapshot(self) -> dict[str, float]:
        return {"timestamp_s": float(self.time_s), **{key: float(value) for key, value in self.state.items()}}

    def _record(self) -> None:
        self.sensor_history.append(self._snapshot())
        if len(self.sensor_history) > 120:
            del self.sensor_history[:-120]

    def reset(self, scenario: str) -> dict[str, object]:
        with self._lock:
            if scenario not in self.spec.scenarios:
                raise ValueError(f"Unsupported {self.spec.name} scenario: {scenario}.")
            profile = self.spec.scenarios[scenario]
            self.scenario = scenario
            self.defect = None
            self.time_s = 0.0
            self.state = {sensor.key: float(sensor.nominal) for sensor in self.spec.sensors}
            self.state.update({key: float(value) for key, value in profile.initial.items()})
            self._clamp()
            self.sensor_history = []
            self.event_log = [f"Scenario reset: {scenario}"]
            self._record()
            return self.dashboard()

    def inject_defect(self, defect: str) -> dict[str, object]:
        with self._lock:
            if defect not in self.spec.defects:
                raise ValueError(f"Unsupported {self.spec.name} defect: {defect}.")
            fault = self.spec.defects[defect]
            self.defect = defect
            for key, delta in fault.sensor_offsets.items():
                self.state[key] += float(delta)
            self._clamp()
            self.event_log.append(f"Injected simulated disturbance: {defect}")
            self._record()
            return self.dashboard()

    def advance(self, dt: float, steps: int) -> dict[str, object]:
        with self._lock:
            if not math.isfinite(dt) or dt <= 0 or steps < 1:
                raise ValueError("Simulation advance requires a positive finite duration and at least one step.")
            profile = self.spec.scenarios[self.scenario]
            fault = self.spec.defects.get(self.defect) if self.defect else None
            for _ in range(steps):
                self.time_s += dt
                for key, rate in profile.drift_per_second.items():
                    self.state[key] += float(rate) * dt
                if fault:
                    for key, rate in fault.drift_per_second.items():
                        self.state[key] += float(rate) * dt
                self._clamp()
                self._record()
            return self.dashboard()

    def _risk(self) -> tuple[dict[str, float], float]:
        scores = dict(self.spec.risk_calculator(self.state))
        if set(scores) != set(self.spec.risk_categories):
            raise RuntimeError(f"{self.spec.id} risk calculator returned an incomplete category set.")
        normalized = {key: bounded_risk(float(value)) for key, value in scores.items()}
        weight_total = sum(self.spec.risk_weights.values())
        overall = sum(normalized[key] * weight for key, weight in self.spec.risk_weights.items()) / weight_total
        return normalized, bounded_risk(overall)

    def dashboard(self) -> dict[str, object]:
        with self._lock:
            scores, overall = self._risk()
            advisory = self.spec.advisory_builder(scores, self.state, overall)
            sensor = self._snapshot()
            return {
                "industry": self.spec.metadata(),
                "simulation": {
                    "time_s": float(self.time_s),
                    "active_scenario": {"type": self.scenario},
                    "latest_sensor": sensor,
                    "sensor_history": list(self.sensor_history[-90:]),
                    "controls": {},
                },
                "risk": {
                    "risk": scores,
                    "risk_bands": {key: risk_band(value) for key, value in scores.items()},
                    "overall_risk": overall,
                    "risk_band": risk_band(overall),
                    "lead_time_estimate_s": None,
                    "method": self.spec.risk_method,
                },
                "advisory": advisory,
                "notice": "SIMULATION ONLY — industry-specific rules and process values are illustrative; no direct machine control.",
            }

    def apply_advisory(self) -> dict[str, object]:
        with self._lock:
            before = self.dashboard()
            recommendation = before["advisory"]
            target = str(recommendation["target_process_variable"])
            if target not in self._bounds() or target not in self.spec.adjustment_limits:
                raise RuntimeError(f"{self.spec.id} advisory targets an unsupported process variable.")
            minimum_adjustment, maximum_adjustment = self.spec.adjustment_limits[target]
            requested = float(recommendation["suggested_adjustment"])
            adjustment = min(maximum_adjustment, max(minimum_adjustment, requested))
            before_value = self.state[target]
            low_bound, high_bound = self._bounds()[target]
            self.state[target] = min(high_bound, max(low_bound, before_value + adjustment))
            self._record()
            after = self.dashboard()
            after["correction_result"] = {
                "simulated": True,
                "defect": recommendation["defect"],
                "target_process_variable": target,
                "duration_s": recommendation["duration_s"],
                "before": {
                    "sensor_value": before_value,
                    "defect_risk": float(recommendation["risk"]),
                    "overall_risk": float(recommendation["overall_risk"]),
                },
                "after": {
                    "sensor_value": self.state[target],
                    "defect_risk": float(after["risk"]["risk"][recommendation["defect"]]),
                    "overall_risk": float(after["risk"]["overall_risk"]),
                },
            }
            self.event_log.append(f"Applied simulated advisory to {target}")
            return after
