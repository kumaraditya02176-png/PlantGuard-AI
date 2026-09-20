from __future__ import annotations

from typing import Any, Dict


def advisory_from_risk(defect: str, risk_value: float, sensor: Dict[str, float]) -> Dict[str, Any]:
    defect_key = (defect or "normal").lower()
    risk = float(risk_value)
    severity = "low" if risk < 0.35 else "moderate" if risk < 0.7 else "high"

    if defect_key == "surface_cracking":
        return {
            "defect": "surface_cracking",
            "severity": severity,
            "recommended_action": "Reduce thermal load and stabilize barrel temperature.",
            "target_process_variable": "temperature_c",
            "suggested_adjustment": -6.0 if severity != "high" else -10.0,
            "duration_s": 180,
            "explanation": "Elevated temperature and vibration increase surface crack susceptibility in the extruded product.",
        }
    if defect_key == "warping":
        return {
            "defect": "warping",
            "severity": severity,
            "recommended_action": "Normalize cooling and material viscosity.",
            "target_process_variable": "cooling_efficiency",
            "suggested_adjustment": 0.12 if severity != "high" else 0.2,
            "duration_s": 240,
            "explanation": "Thermal imbalance and viscosity drift are consistent with warping risk.",
        }
    if defect_key == "thickness_variation":
        return {
            "defect": "thickness_variation",
            "severity": severity,
            "recommended_action": "Stabilize feed rate and adjust thickness control.",
            "target_process_variable": "feed_rate_kg_h",
            "suggested_adjustment": -80.0 if severity != "high" else -130.0,
            "duration_s": 210,
            "explanation": "Feed instability and thickness drift indicate non-uniform material distribution.",
        }

    return {
        "defect": "normal",
        "severity": "low",
        "recommended_action": "Continue current operating profile and monitor drift.",
        "target_process_variable": "temperature_c",
        "suggested_adjustment": -1.0,
        "duration_s": 120,
        "explanation": "Process conditions remain stable; maintain nominal settings and continue monitoring.",
    }


def generate_advisory_for_state(risk_state: Dict[str, float], sensor: Dict[str, float]) -> Dict[str, Any]:
    defects = [
        ("surface_cracking", risk_state.get("surface_cracking", 0.0)),
        ("warping", risk_state.get("warping", 0.0)),
        ("thickness_variation", risk_state.get("thickness_variation", 0.0)),
    ]
    defect, value = max(defects, key=lambda item: item[1])
    advice = advisory_from_risk(defect, value, sensor)
    advice["risk"] = float(value)
    advice["overall_risk"] = float(risk_state.get("overall_risk", 0.0))
    advice["title"] = f"{defect.replace('_', ' ').title()} advisory"
    advice["reason"] = advice["explanation"]
    return advice


def apply_advisory_and_return(simulator: Any, recommendation: Dict[str, Any]) -> Dict[str, Any]:
    if not recommendation:
        return {"status": "no_advisory"}
    simulator.apply_advisory(recommendation)
    return {
        "status": "applied",
        "advisory": recommendation,
        "next_state": simulator.current_state(),
    }
