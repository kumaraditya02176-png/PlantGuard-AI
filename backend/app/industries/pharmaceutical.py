from __future__ import annotations

from typing import Mapping

from backend.app.industry_core import (
    EquipmentDefinition,
    FaultDefinition,
    IndustrySpec,
    ScenarioDefinition,
    SensorDefinition,
    deviation_risk,
    falling_risk,
    risk_band,
    step_towards,
)


def calculate_risks(sensor: Mapping[str, float]) -> Mapping[str, float]:
    return {
        "moisture_deviation": deviation_risk(sensor["granulation_moisture_pct"], 2.8, 0.7, 2.0),
        "tablet_weight_variation": deviation_risk(sensor["tablet_weight_mg"], 500.0, 8.0, 30.0),
        "compression_force_deviation": max(
            deviation_risk(sensor["tablet_press_force_kn"], 12.0, 1.5, 5.0),
            falling_risk(sensor["room_pressure_pa"], 12.0, 0.0),
        ),
    }


def build_advisory(
    risks: Mapping[str, float],
    sensor: Mapping[str, float],
    overall: float,
) -> dict[str, object]:
    defect = max(risks, key=risks.__getitem__)
    recommendations = {
        "moisture_deviation": ("dryer_temperature_c", 2.0, 90, "Adjust the simulated dryer-temperature setpoint modestly and review granulation-moisture signals."),
        "tablet_weight_variation": ("tablet_press_force_kn", -0.6, 60, "Trim the simulated press-force target and review tablet-weight variation."),
        "compression_force_deviation": ("tablet_press_force_kn", -0.8, 60, "Reduce the simulated compression-force target and review room-pressure signals."),
    }
    target, adjustment, duration, action = recommendations[defect]
    if risks[defect] > 0 and defect == "moisture_deviation":
        target = "granulation_moisture_pct"
        adjustment = step_towards(sensor[target], 2.8, 0.6)
    elif risks[defect] > 0 and defect == "tablet_weight_variation":
        target = "tablet_weight_mg"
        adjustment = step_towards(sensor[target], 500.0, 5.0)
    elif risks[defect] > 0 and defect == "compression_force_deviation":
        force_risk = deviation_risk(sensor["tablet_press_force_kn"], 12.0, 1.5, 5.0)
        room_risk = falling_risk(sensor["room_pressure_pa"], 12.0, 0.0)
        if room_risk > force_risk:
            target = "room_pressure_pa"
            adjustment = step_towards(sensor[target], 15.0, 3.0)
        else:
            adjustment = step_towards(sensor[target], 12.0, 0.8)
    return {
        "defect": defect,
        "severity": risk_band(risks[defect]),
        "risk": float(risks[defect]),
        "overall_risk": float(overall),
        "recommended_action": action,
        "reason": f"Rule-based simulated pharmaceutical-process signals selected {defect.replace('_', ' ')} as the highest current risk category.",
        "target_process_variable": target,
        "suggested_adjustment": adjustment,
        "duration_s": duration,
        "source": "pharmaceutical simulated rules",
    }


def build_spec() -> IndustrySpec:
    return IndustrySpec(
        id="pharmaceutical",
        name="Pharmaceutical",
        description="Simulated granulation, drying, blending, compression, and room-pressure process.",
        equipment=(
            EquipmentDefinition("Granulator", "Simulated granulation-moisture signal.", ("granulation_moisture_pct",)),
            EquipmentDefinition("Dryer and blender", "Dryer temperature and blend-speed signals.", ("dryer_temperature_c", "blend_speed_rpm")),
            EquipmentDefinition("Tablet press", "Compression-force and tablet-weight signals.", ("tablet_press_force_kn", "tablet_weight_mg")),
            EquipmentDefinition("Controlled room", "Simulated room-pressure differential.", ("room_pressure_pa",)),
        ),
        sensors=(
            SensorDefinition("granulation_moisture_pct", "Granulation moisture", "%", 0.5, 7.0, 2.8),
            SensorDefinition("blend_speed_rpm", "Blend speed", "rpm", 5.0, 50.0, 18.0),
            SensorDefinition("tablet_press_force_kn", "Tablet-press force", "kN", 4.0, 25.0, 12.0),
            SensorDefinition("tablet_weight_mg", "Tablet weight", "mg", 350.0, 650.0, 500.0),
            SensorDefinition("room_pressure_pa", "Room pressure differential", "Pa", -5.0, 40.0, 15.0),
            SensorDefinition("dryer_temperature_c", "Dryer temperature", "°C", 35.0, 90.0, 55.0),
        ),
        scenarios={
            "normal": ScenarioDefinition("Normal operation", "Nominal granulation, drying, blending, and compression.", {}, {"granulation_moisture_pct": 0.002, "blend_speed_rpm": 0.004, "tablet_press_force_kn": 0.001}),
            "moisture_drift": ScenarioDefinition("Moisture drift", "Rising granulation moisture and dryer temperature.", {"granulation_moisture_pct": 3.8, "dryer_temperature_c": 62.0}, {"granulation_moisture_pct": 0.025, "dryer_temperature_c": 0.08}),
            "press_force_instability": ScenarioDefinition("Press-force instability", "Variable tablet-press force and tablet weight.", {"tablet_press_force_kn": 16.0, "tablet_weight_mg": 518.0}, {"tablet_press_force_kn": 0.08, "tablet_weight_mg": 0.16}),
            "room_pressure_excursion": ScenarioDefinition("Room-pressure excursion", "Reduced room-pressure differential.", {"room_pressure_pa": 5.0}, {"room_pressure_pa": -0.04}),
        },
        defects={
            "moisture_deviation": FaultDefinition("Moisture deviation", "Shifts granulation moisture and dryer temperature.", {"granulation_moisture_pct": 1.2, "dryer_temperature_c": 5.0}, {"granulation_moisture_pct": 0.015}),
            "tablet_weight_variation": FaultDefinition("Tablet-weight variation", "Disturbs tablet weight and press force.", {"tablet_weight_mg": 18.0, "tablet_press_force_kn": 2.0}, {"tablet_weight_mg": 0.1}),
            "compression_force_deviation": FaultDefinition("Compression-force deviation", "Disturbs press force and room-pressure differential.", {"tablet_press_force_kn": 3.0, "room_pressure_pa": -8.0}, {"tablet_press_force_kn": 0.06}),
        },
        risk_categories={
            "moisture_deviation": "Moisture deviation",
            "tablet_weight_variation": "Tablet-weight variation",
            "compression_force_deviation": "Compression-force deviation",
        },
        risk_weights={"moisture_deviation": 0.35, "tablet_weight_variation": 0.35, "compression_force_deviation": 0.3},
        risk_calculator=calculate_risks,
        advisory_builder=build_advisory,
        adjustment_limits={
            "dryer_temperature_c": (0.0, 4.0),
            "granulation_moisture_pct": (-0.8, 0.8),
            "tablet_press_force_kn": (-1.0, 1.0),
            "tablet_weight_mg": (-8.0, 8.0),
            "room_pressure_pa": (0.0, 4.0),
        },
    )
