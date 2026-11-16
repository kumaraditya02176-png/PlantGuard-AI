from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app


INDUSTRIES = (
    "plastic_extrusion",
    "paper_pulp",
    "steel_metals",
    "chemical_process",
    "food_beverage",
    "pharmaceutical",
)
TEST_MUTATION_TOKEN = "test-only-industry-mutation-token-32"


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("PLANTGUARD_MUTATION_TOKEN", TEST_MUTATION_TOKEN)
    return TestClient(app, headers={"Authorization": f"Bearer {TEST_MUTATION_TOKEN}"})


def _industry_path(industry_id: str) -> str:
    return f"/api/v1/industries/{industry_id}"


def test_catalog_exposes_flagship_and_five_independent_modules(client):
    response = client.get("/api/v1/industries")
    assert response.status_code == 200
    industries = response.json()["industries"]
    assert [item["id"] for item in industries] == list(INDUSTRIES)
    for item in industries:
        assert item["simulation_only"] is True
        assert item["equipment"]
        assert item["sensors"]
        assert item["scenarios"]
        assert item["defects"]
        assert len(item["risk_categories"]) == 3


@pytest.mark.parametrize("industry_id", INDUSTRIES[1:])
def test_each_industry_scenarios_advance_and_keep_own_sensor_schema(client, industry_id):
    base = _industry_path(industry_id)
    metadata = next(item for item in client.get("/api/v1/industries").json()["industries"] if item["id"] == industry_id)
    expected_sensor_keys = {item["key"] for item in metadata["sensors"]}
    for scenario in metadata["scenarios"]:
        reset = client.post(f"{base}/simulation/reset", json={"scenario": scenario["id"]})
        assert reset.status_code == 200
        before = reset.json()
        assert before["simulation"]["active_scenario"]["type"] == scenario["id"]
        assert {key for key in before["simulation"]["latest_sensor"] if key != "timestamp_s"} == expected_sensor_keys

        advanced = client.post(f"{base}/simulation/advance", json={"dt": 1.0, "steps": 2})
        assert advanced.status_code == 200
        after = advanced.json()
        assert after["simulation"]["time_s"] == pytest.approx(2.0)
        assert after["simulation"]["latest_sensor"] != before["simulation"]["latest_sensor"]
        assert len(after["simulation"]["sensor_history"]) >= 3
        assert set(after["risk"]["risk"]) == {item["id"] for item in metadata["risk_categories"]}
        assert all(0.0 <= score <= 1.0 for score in after["risk"]["risk"].values())
        assert after["risk"]["lead_time_estimate_s"] is None


@pytest.mark.parametrize("industry_id", INDUSTRIES[1:])
def test_normal_advance_updates_sensor_samples_used_by_industry_charts(client, industry_id):
    base = _industry_path(industry_id)
    metadata = next(item for item in client.get("/api/v1/industries").json()["industries"] if item["id"] == industry_id)
    initial = client.post(f"{base}/simulation/reset", json={"scenario": "normal"}).json()
    advanced = client.post(f"{base}/simulation/advance", json={"dt": 1.0, "steps": 2}).json()
    for sensor in metadata["sensors"][:3]:
        key = sensor["key"]
        assert advanced["simulation"]["latest_sensor"][key] != initial["simulation"]["latest_sensor"][key]
    assert advanced["simulation"]["sensor_history"][-1]["timestamp_s"] > initial["simulation"]["sensor_history"][-1]["timestamp_s"]


@pytest.mark.parametrize(
    ("industry_id", "risk_key"),
    [
        ("paper_pulp", "sheet_break"),
        ("paper_pulp", "moisture_variation"),
        ("paper_pulp", "caliper_variation"),
        ("steel_metals", "surface_cracking"),
        ("steel_metals", "thickness_deviation"),
        ("steel_metals", "strip_warping"),
        ("chemical_process", "thermal_excursion"),
        ("chemical_process", "pressure_excursion"),
        ("chemical_process", "feed_composition_drift"),
        ("food_beverage", "pasteurization_deviation"),
        ("food_beverage", "fill_volume_variation"),
        ("food_beverage", "line_flow_instability"),
        ("pharmaceutical", "moisture_deviation"),
        ("pharmaceutical", "tablet_weight_variation"),
        ("pharmaceutical", "compression_force_deviation"),
    ],
)
def test_fault_injection_changes_sensor_state_and_its_risk(client, industry_id, risk_key):
    base = _industry_path(industry_id)
    client.post(f"{base}/simulation/reset", json={"scenario": "normal"})
    before = client.get(f"{base}/dashboard").json()
    injected = client.post(f"{base}/simulation/inject", json={"defect": risk_key})
    assert injected.status_code == 200
    after = injected.json()
    assert after["simulation"]["latest_sensor"] != before["simulation"]["latest_sensor"]
    assert after["simulation"]["latest_sensor"]["timestamp_s"] == before["simulation"]["latest_sensor"]["timestamp_s"]
    assert after["risk"]["risk"][risk_key] > before["risk"]["risk"][risk_key]
    assert after["advisory"]["defect"] == risk_key
    correction = client.post(f"{base}/advisories/apply")
    assert correction.status_code == 200
    correction_result = correction.json()["correction_result"]
    assert correction_result["defect"] == risk_key
    assert correction_result["after"]["defect_risk"] < correction_result["before"]["defect_risk"]


@pytest.mark.parametrize("industry_id", INDUSTRIES[1:])
def test_advisory_application_is_bounded_and_reports_simulated_before_after(client, industry_id):
    base = _industry_path(industry_id)
    initial = client.post(f"{base}/simulation/reset", json={"scenario": "normal"}).json()
    applied = client.post(f"{base}/advisories/apply")
    assert applied.status_code == 200
    response = applied.json()
    correction = response["correction_result"]
    assert correction["simulated"] is True
    target = correction["target_process_variable"]
    assert target in {item["key"] for item in response["industry"]["sensors"]}
    assert correction["before"]["sensor_value"] == initial["simulation"]["latest_sensor"][target]
    assert correction["after"]["sensor_value"] == response["simulation"]["latest_sensor"][target]
    assert correction["before"]["sensor_value"] != correction["after"]["sensor_value"]
    definition = next(item for item in response["industry"]["sensors"] if item["key"] == target)
    assert definition["minimum"] <= correction["after"]["sensor_value"] <= definition["maximum"]


def test_industry_states_are_isolated_and_invalid_actions_do_not_change_state(client):
    paper = _industry_path("paper_pulp")
    steel = _industry_path("steel_metals")
    paper_reset = client.post(f"{paper}/simulation/reset", json={"scenario": "normal"}).json()
    steel_reset = client.post(f"{steel}/simulation/reset", json={"scenario": "normal"}).json()
    paper_before = paper_reset["simulation"]["latest_sensor"]
    steel_before = steel_reset["simulation"]["latest_sensor"]

    client.post(f"{paper}/simulation/advance", json={"dt": 1.0, "steps": 2})
    assert client.get(f"{steel}/dashboard").json()["simulation"]["latest_sensor"] == steel_before

    invalid_scenario = client.post(f"{paper}/simulation/reset", json={"scenario": "not-a-scenario"})
    invalid_fault = client.post(f"{paper}/simulation/inject", json={"defect": "not-a-defect"})
    unknown_industry = client.get("/api/v1/industries/not-an-industry/dashboard")
    assert invalid_scenario.status_code == 422
    assert invalid_fault.status_code == 422
    assert unknown_industry.status_code == 404
    assert client.get(f"{paper}/dashboard").json()["simulation"]["latest_sensor"] != paper_before


def test_namespaced_extrusion_routes_use_existing_simulator_and_require_auth(client):
    response = client.post(
        "/api/v1/industries/plastic_extrusion/simulation/reset",
        json={"scenario": "overheating"},
    )
    assert response.status_code == 200
    assert response.json()["industry"]["id"] == "plastic_extrusion"
    assert response.json()["simulation"]["active_scenario"]["type"] == "overheating"

    unauthenticated = TestClient(app)
    blocked = unauthenticated.post(
        "/api/v1/industries/paper_pulp/simulation/reset",
        json={"scenario": "normal"},
    )
    assert blocked.status_code == 401
