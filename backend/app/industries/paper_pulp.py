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
    rising_risk,
    risk_band,
    step_towards,
)


def calculate_risks(sensor: Mapping[str, float]) -> Mapping[str, float]:
    moisture = sensor["sheet_moisture_pct"]
    return {
        "sheet_break": max(
            rising_risk(sensor["web_tension_n_m"], 46.0, 76.0),
            falling_risk(sensor["stock_flow_l_min"], 430.0, 280.0),
        ),
        "moisture_variation": max(
            rising_risk(moisture, 6.2, 10.0),
            falling_risk(moisture, 4.4, 2.5),
        ),
        "caliper_variation": max(
            deviation_risk(sensor["caliper_um"], 120.0, 9.0, 28.0),
            deviation_risk(sensor["headbox_pressure_kpa"], 45.0, 9.0, 24.0),
        ),
    }


def build_advisory(
    risks: Mapping[str, float],
    sensor: Mapping[str, float],
    overall: float,
) -> dict[str, object]:
    defect = max(risks, key=risks.__getitem__)
    recommendations = {
        "sheet_break": (
            "web_tension_n_m",
            -6.0,
            120,
            "Reduce the simulated web-tension setpoint and review stock-flow stability.",
        ),
        "moisture_variation": (
            "dryer_temperature_c",
            4.0,
            120,
            "Increase the simulated dryer temperature gradually and review moisture uniformity.",
        ),
        "caliper_variation": (
            "headbox_pressure_kpa",
            -3.0,
            90,
            "Trim the simulated headbox pressure and review caliper consistency.",
        ),
    }
    target, adjustment, duration, action = recommendations[defect]
    if risks[defect] > 0:
        if defect == "sheet_break":
            tension_risk = rising_risk(sensor["web_tension_n_m"], 46.0, 76.0)
            flow_risk = falling_risk(sensor["stock_flow_l_min"], 430.0, 280.0)
            if flow_risk > tension_risk:
                target = "stock_flow_l_min"
                adjustment = step_towards(sensor[target], 520.0, 60.0)
        elif defect == "moisture_variation":
            target = "sheet_moisture_pct"
            adjustment = step_towards(sensor[target], 5.5, 1.0)
        elif defect == "caliper_variation":
            caliper_risk = deviation_risk(sensor["caliper_um"], 120.0, 9.0, 28.0)
            pressure_risk = deviation_risk(sensor["headbox_pressure_kpa"], 45.0, 9.0, 24.0)
            if caliper_risk >= pressure_risk:
                target = "caliper_um"
                adjustment = step_towards(sensor[target], 120.0, 8.0)
            else:
                target = "headbox_pressure_kpa"
                adjustment = step_towards(sensor[target], 45.0, 3.0)
    return {
        "defect": defect,
        "severity": risk_band(risks[defect]),
        "risk": float(risks[defect]),
        "overall_risk": float(overall),
        "recommended_action": action,
        "reason": f"Rule-based simulated paper-process signals selected {defect.replace('_', ' ')} as the highest current risk category.",
        "target_process_variable": target,
        "suggested_adjustment": adjustment,
        "duration_s": duration,
        "source": "paper-and-pulp simulated rules",
    }


def build_spec() -> IndustrySpec:
    return IndustrySpec(
        id="paper_pulp",
        name="Paper & Pulp",
        description="Simulated stock preparation, paper web formation, drying, and winding process.",
        equipment=(
            EquipmentDefinition("Pulp preparation", "Stock consistency and flow preparation.", ("stock_consistency_pct", "stock_flow_l_min")),
            EquipmentDefinition("Headbox and forming section", "Headbox pressure and wet-web formation.", ("headbox_pressure_kpa", "web_tension_n_m")),
            EquipmentDefinition("Dryer section", "Thermal drying and sheet-moisture tracking.", ("dryer_temperature_c", "sheet_moisture_pct")),
            EquipmentDefinition("Calender and reel", "Simulated finished-sheet caliper and winding.", ("caliper_um", "web_tension_n_m")),
        ),
        sensors=(
            SensorDefinition("stock_consistency_pct", "Stock consistency", "%", 2.0, 8.0, 4.5),
            SensorDefinition("stock_flow_l_min", "Stock flow", "L/min", 250.0, 850.0, 520.0),
            SensorDefinition("headbox_pressure_kpa", "Headbox pressure", "kPa", 25.0, 70.0, 45.0),
            SensorDefinition("dryer_temperature_c", "Dryer temperature", "°C", 70.0, 160.0, 105.0),
            SensorDefinition("web_tension_n_m", "Web tension", "N/m", 10.0, 90.0, 35.0),
            SensorDefinition("sheet_moisture_pct", "Sheet moisture", "%", 2.0, 12.0, 5.5),
            SensorDefinition("caliper_um", "Sheet caliper", "um", 70.0, 180.0, 120.0),
        ),
        scenarios={
            "normal": ScenarioDefinition("Normal operation", "Nominal stock flow and paper-web conditions.", {}, {"stock_consistency_pct": 0.001, "stock_flow_l_min": 0.04, "headbox_pressure_kpa": 0.005, "dryer_temperature_c": 0.02}),
            "wet_stock": ScenarioDefinition("Wet stock", "Elevated stock consistency and sheet moisture.", {"stock_consistency_pct": 6.5, "sheet_moisture_pct": 7.4}, {"sheet_moisture_pct": 0.025, "web_tension_n_m": 0.08}),
            "dryer_overload": ScenarioDefinition("Dryer overload", "Elevated dryer temperature with increasing sheet moisture.", {"dryer_temperature_c": 132.0, "sheet_moisture_pct": 7.2}, {"dryer_temperature_c": 0.3, "sheet_moisture_pct": 0.035}),
            "web_tension_drift": ScenarioDefinition("Web-tension drift", "Gradually rising web tension and caliper deviation.", {"web_tension_n_m": 54.0, "caliper_um": 128.0}, {"web_tension_n_m": 0.18, "caliper_um": 0.05}),
        },
        defects={
            "sheet_break": FaultDefinition("Sheet-break risk", "Disturbs web tension and stock flow.", {"web_tension_n_m": 18.0, "stock_flow_l_min": -95.0}, {"web_tension_n_m": 0.12}),
            "moisture_variation": FaultDefinition("Moisture variation", "Introduces sheet-moisture and stock-consistency drift.", {"sheet_moisture_pct": 2.2, "stock_consistency_pct": 0.5}, {"sheet_moisture_pct": 0.015}),
            "caliper_variation": FaultDefinition("Caliper variation", "Disturbs caliper and headbox pressure.", {"caliper_um": 14.0, "headbox_pressure_kpa": 7.0}, {"caliper_um": 0.04}),
        },
        risk_categories={
            "sheet_break": "Sheet-break risk",
            "moisture_variation": "Moisture variation",
            "caliper_variation": "Caliper variation",
        },
        risk_weights={"sheet_break": 0.4, "moisture_variation": 0.35, "caliper_variation": 0.25},
        risk_calculator=calculate_risks,
        advisory_builder=build_advisory,
        adjustment_limits={
            "web_tension_n_m": (-8.0, 0.0),
            "stock_flow_l_min": (0.0, 60.0),
            "sheet_moisture_pct": (-1.0, 1.0),
            "dryer_temperature_c": (0.0, 5.0),
            "headbox_pressure_kpa": (-4.0, 4.0),
            "caliper_um": (-8.0, 8.0),
        },
    )
