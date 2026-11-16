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
    rising_risk,
    step_towards,
)


def calculate_risks(sensor: Mapping[str, float]) -> Mapping[str, float]:
    return {
        "pasteurization_deviation": falling_risk(sensor["pasteurization_temperature_c"], 71.0, 65.0),
        "fill_volume_variation": deviation_risk(sensor["fill_volume_ml"], 500.0, 8.0, 28.0),
        "line_flow_instability": max(
            rising_risk(sensor["product_flow_l_min"], 39.0, 58.0),
            rising_risk(sensor["conveyor_speed_m_min"], 22.0, 30.0),
        ),
    }


def build_advisory(
    risks: Mapping[str, float],
    sensor: Mapping[str, float],
    overall: float,
) -> dict[str, object]:
    defect = max(risks, key=risks.__getitem__)
    recommendations = {
        "pasteurization_deviation": ("pasteurization_temperature_c", 2.0, 60, "Raise the simulated pasteurization setpoint modestly and review product-temperature signals."),
        "fill_volume_variation": ("fill_volume_ml", -5.0, 45, "Trim the simulated fill-volume target and review the filling-head trend."),
        "line_flow_instability": ("product_flow_l_min", -4.0, 60, "Reduce simulated product flow and review conveyor synchronization."),
    }
    target, adjustment, duration, action = recommendations[defect]
    if risks[defect] > 0 and defect == "fill_volume_variation":
        adjustment = step_towards(sensor[target], 500.0, 5.0)
    elif risks[defect] > 0 and defect == "line_flow_instability":
        flow_risk = rising_risk(sensor["product_flow_l_min"], 39.0, 58.0)
        speed_risk = rising_risk(sensor["conveyor_speed_m_min"], 22.0, 30.0)
        if speed_risk > flow_risk:
            target = "conveyor_speed_m_min"
            adjustment = step_towards(sensor[target], 18.0, 2.0)
        else:
            adjustment = step_towards(sensor[target], 30.0, 4.0)
    return {
        "defect": defect,
        "severity": risk_band(risks[defect]),
        "risk": float(risks[defect]),
        "overall_risk": float(overall),
        "recommended_action": action,
        "reason": f"Rule-based simulated food-process signals selected {defect.replace('_', ' ')} as the highest current risk category.",
        "target_process_variable": target,
        "suggested_adjustment": adjustment,
        "duration_s": duration,
        "source": "food-and-beverage simulated rules",
    }


def build_spec() -> IndustrySpec:
    return IndustrySpec(
        id="food_beverage",
        name="Food & Beverage",
        description="Simulated product heating, filling, and conveyor process.",
        equipment=(
            EquipmentDefinition("Pasteurization", "Simulated product-temperature and heating signal.", ("pasteurization_temperature_c",)),
            EquipmentDefinition("Product transfer", "Product-flow and product-acidity proxy signals.", ("product_flow_l_min", "product_ph")),
            EquipmentDefinition("Filling station", "Container fill-volume signal.", ("fill_volume_ml",)),
            EquipmentDefinition("Conveyor", "Line-speed signal.", ("conveyor_speed_m_min",)),
        ),
        sensors=(
            SensorDefinition("pasteurization_temperature_c", "Pasteurization temperature", "°C", 55.0, 95.0, 72.0),
            SensorDefinition("product_flow_l_min", "Product flow", "L/min", 10.0, 70.0, 30.0),
            SensorDefinition("fill_volume_ml", "Fill volume", "mL", 350.0, 650.0, 500.0),
            SensorDefinition("conveyor_speed_m_min", "Conveyor speed", "m/min", 5.0, 35.0, 18.0),
            SensorDefinition("product_ph", "Product pH proxy", "pH", 2.0, 9.0, 6.8),
        ),
        scenarios={
            "normal": ScenarioDefinition("Normal operation", "Nominal heating, transfer, and filling conditions.", {}, {"pasteurization_temperature_c": 0.01, "product_flow_l_min": 0.01, "fill_volume_ml": 0.002}),
            "thermal_excursion": ScenarioDefinition("Thermal excursion", "Pasteurization temperature below the configured simulated operating band.", {"pasteurization_temperature_c": 67.0}, {"pasteurization_temperature_c": -0.08}),
            "fill_instability": ScenarioDefinition("Fill instability", "Variable fill volume and elevated product flow.", {"fill_volume_ml": 526.0, "product_flow_l_min": 42.0}, {"fill_volume_ml": 0.12, "product_flow_l_min": 0.06}),
            "conveyor_jam": ScenarioDefinition("Conveyor jam", "Reduced conveyor speed with elevated upstream flow.", {"conveyor_speed_m_min": 12.0, "product_flow_l_min": 44.0}, {"conveyor_speed_m_min": -0.05, "product_flow_l_min": 0.08}),
        },
        defects={
            "pasteurization_deviation": FaultDefinition("Pasteurization deviation", "Reduces the simulated product-temperature signal.", {"pasteurization_temperature_c": -6.0}, {"pasteurization_temperature_c": -0.04}),
            "fill_volume_variation": FaultDefinition("Fill-volume variation", "Shifts fill volume and upstream flow.", {"fill_volume_ml": 22.0, "product_flow_l_min": 5.0}, {"fill_volume_ml": 0.08}),
            "line_flow_instability": FaultDefinition("Line-flow instability", "Increases product flow and conveyor speed.", {"product_flow_l_min": 14.0, "conveyor_speed_m_min": 5.0}, {"product_flow_l_min": 0.06}),
        },
        risk_categories={
            "pasteurization_deviation": "Pasteurization deviation",
            "fill_volume_variation": "Fill-volume variation",
            "line_flow_instability": "Line-flow instability",
        },
        risk_weights={"pasteurization_deviation": 0.4, "fill_volume_variation": 0.35, "line_flow_instability": 0.25},
        risk_calculator=calculate_risks,
        advisory_builder=build_advisory,
        adjustment_limits={
            "pasteurization_temperature_c": (0.0, 4.0),
            "fill_volume_ml": (-8.0, 8.0),
            "product_flow_l_min": (-6.0, 6.0),
            "conveyor_speed_m_min": (-3.0, 0.0),
        },
    )
