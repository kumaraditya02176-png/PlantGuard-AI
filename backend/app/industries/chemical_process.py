from __future__ import annotations

from typing import Mapping

from backend.app.industry_core import (
    EquipmentDefinition,
    FaultDefinition,
    IndustrySpec,
    ScenarioDefinition,
    SensorDefinition,
    deviation_risk,
    risk_band,
    rising_risk,
    step_towards,
)


def calculate_risks(sensor: Mapping[str, float]) -> Mapping[str, float]:
    return {
        "thermal_excursion": max(
            rising_risk(sensor["reactor_temperature_c"], 96.0, 128.0),
            rising_risk(sensor["reactor_pressure_bar"], 4.8, 7.2),
        ),
        "pressure_excursion": rising_risk(sensor["reactor_pressure_bar"], 4.5, 7.0),
        "feed_composition_drift": max(
            deviation_risk(sensor["ph"], 7.0, 1.0, 3.0),
            deviation_risk(sensor["feed_flow_l_min"], 40.0, 12.0, 32.0),
        ),
    }


def build_advisory(
    risks: Mapping[str, float],
    sensor: Mapping[str, float],
    overall: float,
) -> dict[str, object]:
    defect = max(risks, key=risks.__getitem__)
    recommendations = {
        "thermal_excursion": ("reactor_temperature_c", -8.0, 90, "Reduce the simulated reactor-temperature setpoint and review jacket-flow response."),
        "pressure_excursion": ("reactor_pressure_bar", -0.5, 60, "Reduce the simulated feed-pressure target and review the pressure trend."),
        "feed_composition_drift": ("feed_flow_l_min", -3.0, 75, "Trim simulated feed flow and review the pH and flow signals together."),
    }
    target, adjustment, duration, action = recommendations[defect]
    if risks[defect] > 0 and defect == "thermal_excursion":
        temperature_risk = rising_risk(sensor["reactor_temperature_c"], 96.0, 128.0)
        pressure_risk = rising_risk(sensor["reactor_pressure_bar"], 4.8, 7.2)
        if pressure_risk > temperature_risk:
            target = "reactor_pressure_bar"
            adjustment = step_towards(sensor[target], 3.2, 0.5)
        else:
            adjustment = step_towards(sensor[target], 82.0, 8.0)
    elif risks[defect] > 0 and defect == "feed_composition_drift":
        ph_risk = deviation_risk(sensor["ph"], 7.0, 1.0, 3.0)
        flow_risk = deviation_risk(sensor["feed_flow_l_min"], 40.0, 12.0, 32.0)
        if ph_risk >= flow_risk:
            target = "ph"
            adjustment = step_towards(sensor[target], 7.0, 0.5)
        else:
            target = "feed_flow_l_min"
            adjustment = step_towards(sensor[target], 40.0, 4.0)
    return {
        "defect": defect,
        "severity": risk_band(risks[defect]),
        "risk": float(risks[defect]),
        "overall_risk": float(overall),
        "recommended_action": action,
        "reason": f"Rule-based simulated process signals selected {defect.replace('_', ' ')} as the highest current risk category.",
        "target_process_variable": target,
        "suggested_adjustment": adjustment,
        "duration_s": duration,
        "source": "chemical-and-process simulated rules",
    }


def build_spec() -> IndustrySpec:
    return IndustrySpec(
        id="chemical_process",
        name="Chemical & Process",
        description="Simulated reactor, feed, agitation, and jacket-cooling process.",
        equipment=(
            EquipmentDefinition("Reactor vessel", "Temperature and pressure signals for the simulated reactor.", ("reactor_temperature_c", "reactor_pressure_bar")),
            EquipmentDefinition("Feed system", "Feed-flow and acidity proxy signals.", ("feed_flow_l_min", "ph")),
            EquipmentDefinition("Agitator", "Simulated mixing speed.", ("agitator_speed_rpm",)),
            EquipmentDefinition("Jacket circuit", "Heat-removal flow signal.", ("jacket_flow_l_min",)),
        ),
        sensors=(
            SensorDefinition("reactor_temperature_c", "Reactor temperature", "°C", 50.0, 140.0, 82.0),
            SensorDefinition("reactor_pressure_bar", "Reactor pressure", "bar", 0.5, 8.0, 3.2),
            SensorDefinition("feed_flow_l_min", "Feed flow", "L/min", 10.0, 100.0, 40.0),
            SensorDefinition("ph", "pH proxy", "pH", 3.0, 11.0, 7.0),
            SensorDefinition("agitator_speed_rpm", "Agitator speed", "rpm", 100.0, 600.0, 300.0),
            SensorDefinition("jacket_flow_l_min", "Jacket flow", "L/min", 20.0, 120.0, 75.0),
        ),
        scenarios={
            "normal": ScenarioDefinition("Normal operation", "Nominal reactor, feed, and jacket conditions.", {}, {"reactor_temperature_c": 0.02, "reactor_pressure_bar": 0.002, "feed_flow_l_min": 0.01}),
            "exotherm": ScenarioDefinition("Exotherm", "Rising reactor temperature with elevated pressure.", {"reactor_temperature_c": 106.0, "reactor_pressure_bar": 5.2}, {"reactor_temperature_c": 0.28, "reactor_pressure_bar": 0.035}),
            "pressure_surge": ScenarioDefinition("Pressure surge", "Elevated reactor pressure and feed flow.", {"reactor_pressure_bar": 5.5, "feed_flow_l_min": 58.0}, {"reactor_pressure_bar": 0.09}),
            "feed_instability": ScenarioDefinition("Feed instability", "Drifting feed flow and pH proxy.", {"feed_flow_l_min": 57.0, "ph": 8.2}, {"feed_flow_l_min": 0.12, "ph": 0.012}),
        },
        defects={
            "thermal_excursion": FaultDefinition("Thermal excursion", "Increases reactor temperature and pressure.", {"reactor_temperature_c": 16.0, "reactor_pressure_bar": 0.8}, {"reactor_temperature_c": 0.16}),
            "pressure_excursion": FaultDefinition("Pressure excursion", "Increases reactor pressure.", {"reactor_pressure_bar": 1.4}, {"reactor_pressure_bar": 0.05}),
            "feed_composition_drift": FaultDefinition("Feed-composition drift", "Changes the pH proxy and feed rate.", {"ph": 1.8, "feed_flow_l_min": 18.0}, {"ph": 0.025}),
        },
        risk_categories={
            "thermal_excursion": "Thermal excursion",
            "pressure_excursion": "Pressure excursion",
            "feed_composition_drift": "Feed/composition drift",
        },
        risk_weights={"thermal_excursion": 0.4, "pressure_excursion": 0.35, "feed_composition_drift": 0.25},
        risk_calculator=calculate_risks,
        advisory_builder=build_advisory,
        adjustment_limits={
            "reactor_temperature_c": (-12.0, 0.0),
            "reactor_pressure_bar": (-0.8, 0.8),
            "feed_flow_l_min": (-6.0, 6.0),
            "ph": (-1.0, 1.0),
        },
    )
