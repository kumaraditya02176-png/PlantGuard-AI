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
        "surface_cracking": max(
            rising_risk(sensor["furnace_temperature_c"], 1040.0, 1210.0),
            falling_risk(sensor["cooling_flow_l_s"], 105.0, 55.0),
        ),
        "thickness_deviation": max(
            deviation_risk(sensor["strip_thickness_mm"], 2.0, 0.3, 0.85),
            rising_risk(sensor["rolling_force_mn"], 16.0, 22.0),
        ),
        "strip_warping": max(
            falling_risk(sensor["cooling_flow_l_s"], 108.0, 58.0),
            rising_risk(sensor["vibration_mm_s"], 2.5, 6.0),
        ),
    }


def build_advisory(
    risks: Mapping[str, float],
    sensor: Mapping[str, float],
    overall: float,
) -> dict[str, object]:
    defect = max(risks, key=risks.__getitem__)
    recommendations = {
        "surface_cracking": ("furnace_temperature_c", -18.0, 180, "Lower the simulated furnace-temperature setpoint and review the cooling profile."),
        "thickness_deviation": ("rolling_force_mn", -1.2, 120, "Reduce simulated rolling force incrementally and check strip-thickness consistency."),
        "strip_warping": ("cooling_flow_l_s", 12.0, 150, "Increase simulated cooling flow and review strip vibration."),
    }
    target, adjustment, duration, action = recommendations[defect]
    if risks[defect] > 0 and defect == "surface_cracking":
        temperature_risk = rising_risk(sensor["furnace_temperature_c"], 1040.0, 1210.0)
        cooling_risk = falling_risk(sensor["cooling_flow_l_s"], 105.0, 55.0)
        if cooling_risk > temperature_risk:
            target = "cooling_flow_l_s"
            adjustment = step_towards(sensor[target], 120.0, 15.0)
    elif risks[defect] > 0 and defect == "thickness_deviation":
        gauge_risk = deviation_risk(sensor["strip_thickness_mm"], 2.0, 0.3, 0.85)
        force_risk = rising_risk(sensor["rolling_force_mn"], 16.0, 22.0)
        if gauge_risk >= force_risk:
            target = "strip_thickness_mm"
            adjustment = step_towards(sensor[target], 2.0, 0.15)
        else:
            target = "rolling_force_mn"
            adjustment = step_towards(sensor[target], 12.0, 1.2)
    elif risks[defect] > 0 and defect == "strip_warping":
        cooling_risk = falling_risk(sensor["cooling_flow_l_s"], 108.0, 58.0)
        vibration_risk = rising_risk(sensor["vibration_mm_s"], 2.5, 6.0)
        if vibration_risk > cooling_risk:
            target = "vibration_mm_s"
            adjustment = step_towards(sensor[target], 1.2, 0.8)
        else:
            target = "cooling_flow_l_s"
            adjustment = step_towards(sensor[target], 120.0, 12.0)
    return {
        "defect": defect,
        "severity": risk_band(risks[defect]),
        "risk": float(risks[defect]),
        "overall_risk": float(overall),
        "recommended_action": action,
        "reason": f"Rule-based simulated metals-process signals selected {defect.replace('_', ' ')} as the highest current risk category.",
        "target_process_variable": target,
        "suggested_adjustment": adjustment,
        "duration_s": duration,
        "source": "steel-and-metals simulated rules",
    }


def build_spec() -> IndustrySpec:
    return IndustrySpec(
        id="steel_metals",
        name="Steel & Metals",
        description="Simulated furnace, rolling, strip transport, and cooling process.",
        equipment=(
            EquipmentDefinition("Reheat furnace", "Simulated furnace-temperature profile.", ("furnace_temperature_c",)),
            EquipmentDefinition("Rolling stand", "Rolling-force and strip-thickness signals.", ("rolling_force_mn", "strip_thickness_mm")),
            EquipmentDefinition("Strip line", "Line speed and vibration monitoring.", ("strip_speed_m_min", "vibration_mm_s")),
            EquipmentDefinition("Cooling section", "Post-roll cooling-flow signal.", ("cooling_flow_l_s",)),
        ),
        sensors=(
            SensorDefinition("furnace_temperature_c", "Furnace temperature", "°C", 700.0, 1300.0, 950.0),
            SensorDefinition("rolling_force_mn", "Rolling force", "MN", 5.0, 24.0, 12.0),
            SensorDefinition("strip_speed_m_min", "Strip speed", "m/min", 2.0, 20.0, 8.0),
            SensorDefinition("strip_thickness_mm", "Strip thickness", "mm", 0.5, 6.0, 2.0),
            SensorDefinition("cooling_flow_l_s", "Cooling flow", "L/s", 40.0, 250.0, 120.0),
            SensorDefinition("vibration_mm_s", "Stand vibration", "mm/s", 0.2, 8.0, 1.2),
        ),
        scenarios={
            "normal": ScenarioDefinition("Normal operation", "Nominal furnace, rolling, and cooling conditions.", {}, {"furnace_temperature_c": 0.04, "rolling_force_mn": 0.005, "strip_speed_m_min": 0.01}),
            "furnace_overheat": ScenarioDefinition("Furnace overheat", "Rising furnace temperature and cooling demand.", {"furnace_temperature_c": 1110.0, "cooling_flow_l_s": 105.0}, {"furnace_temperature_c": 0.45}),
            "roll_misalignment": ScenarioDefinition("Roll misalignment", "Higher rolling force and stand vibration.", {"rolling_force_mn": 18.0, "vibration_mm_s": 3.2, "strip_thickness_mm": 2.65}, {"rolling_force_mn": 0.08, "vibration_mm_s": 0.035}),
            "cooling_fault": ScenarioDefinition("Cooling fault", "Reduced cooling flow with rising strip distortion risk.", {"cooling_flow_l_s": 76.0, "furnace_temperature_c": 1020.0}, {"cooling_flow_l_s": -0.22, "vibration_mm_s": 0.025}),
        },
        defects={
            "surface_cracking": FaultDefinition("Surface-cracking risk", "Raises the thermal signal while retaining nominal cooling flow.", {"furnace_temperature_c": 160.0, "cooling_flow_l_s": -10.0}, {"furnace_temperature_c": 0.18}),
            "thickness_deviation": FaultDefinition("Thickness deviation", "Disturbs strip gauge and rolling force.", {"strip_thickness_mm": 0.55, "rolling_force_mn": 4.0}, {"strip_thickness_mm": 0.004}),
            "strip_warping": FaultDefinition("Strip warping", "Reduces cooling flow and increases stand vibration.", {"cooling_flow_l_s": -38.0, "vibration_mm_s": 1.6}, {"vibration_mm_s": 0.03}),
        },
        risk_categories={
            "surface_cracking": "Surface-cracking risk",
            "thickness_deviation": "Thickness deviation",
            "strip_warping": "Strip warping",
        },
        risk_weights={"surface_cracking": 0.4, "thickness_deviation": 0.35, "strip_warping": 0.25},
        risk_calculator=calculate_risks,
        advisory_builder=build_advisory,
        adjustment_limits={
            "furnace_temperature_c": (-25.0, 0.0),
            "rolling_force_mn": (-2.0, 0.0),
            "strip_thickness_mm": (-0.2, 0.2),
            "cooling_flow_l_s": (0.0, 20.0),
            "vibration_mm_s": (-1.0, 0.0),
        },
    )
