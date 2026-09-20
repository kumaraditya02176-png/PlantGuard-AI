from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "validate_startup.py"


def test_startup_validation_script_exists_and_is_executable():
    assert SCRIPT.exists(), "Startup validation script should exist in scripts/"
    content = SCRIPT.read_text(encoding="utf-8")
    assert "validate_environment" in content
    assert "validate_backend_health" in content
    assert "validate_frontend_target" in content
    assert "detect_conflicting_processes" in content
    assert "ConvertTo-Json" not in content
    assert "Invoke-WebRequest" in content
    assert ".Content" in content
    assert ".StatusCode" in content
