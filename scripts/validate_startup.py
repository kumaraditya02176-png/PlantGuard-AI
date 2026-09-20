from __future__ import annotations

import json
import os
import socket
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
VENV_PYTHON = Path(r"C:\Users\ADITYA\Downloads\PlantGuard-AI-Codex-Ready1.0\.venv\Scripts\python.exe")
BACKEND_URL = "http://127.0.0.1:8001"
FRONTEND_URL = "http://127.0.0.1:3000"


def _run(cmd: list[str], cwd: str | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=False)


def validate_environment() -> dict[str, Any]:
    os.environ["PYTHONPATH"] = str(ROOT)
    result = {
        "workspace_root": str(ROOT),
        "workspace_valid": ROOT.exists(),
        "venv_exists": VENV_PYTHON.exists(),
        "venv_python": str(VENV_PYTHON),
    }

    if not result["workspace_valid"]:
        raise RuntimeError(f"Workspace root does not exist: {ROOT}")
    if not result["venv_exists"]:
        raise RuntimeError(f"Workspace-local venv is missing: {VENV_PYTHON}")

    env_check = _run([
        str(VENV_PYTHON),
        "-c",
        "import torch, numpy, fastapi, uvicorn; print('PLANTGUARD_ENV_OK')",
    ], cwd=str(ROOT))
    result["env_output"] = env_check.stdout.strip()
    result["env_returncode"] = env_check.returncode
    if env_check.returncode != 0:
        raise RuntimeError(env_check.stderr.strip() or env_check.stdout.strip() or "Environment validation failed")
    if env_check.stdout.strip() != "PLANTGUARD_ENV_OK":
        raise RuntimeError(f"Unexpected environment validation output: {env_check.stdout.strip()!r}")
    return result


def port_in_use(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def detect_conflicting_processes() -> dict[str, Any]:
    details: list[str] = []
    for port in (3000, 8001):
        if port_in_use(port):
            details.append(f"Port {port} is currently in use")

    py_cmd = _run(["powershell", "-NoProfile", "-Command", "Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'node|python' } | Select-Object -ExpandProperty CommandLine"], cwd=str(ROOT))
    stdout = py_cmd.stdout.strip()
    details.append(f"Process scan output length: {len(stdout.splitlines())}")
    return {"ports_in_use": [3000, 8001] if any(port_in_use(p) for p in (3000, 8001)) else [], "processes_sample": stdout.splitlines()[:10], "details": details}


def validate_backend_health(timeout: float = 15.0) -> dict[str, Any]:
    deadline = time.time() + timeout
    last_error: str | None = None
    while time.time() < deadline:
        try:
            response = _run(["powershell", "-NoProfile", "-Command", f"(Invoke-WebRequest -Uri '{BACKEND_URL}/health' -UseBasicParsing).Content"], cwd=str(ROOT))
            if response.returncode == 0 and response.stdout.strip():
                payload = json.loads(response.stdout.strip())
                return {"url": f"{BACKEND_URL}/health", "payload": payload, "returncode": response.returncode}
            last_error = response.stderr.strip() or response.stdout.strip() or "No backend response"
        except Exception as exc:  # pragma: no cover - defensive fault path
            last_error = str(exc)
        time.sleep(1)

    raise RuntimeError(f"Backend health validation failed: {last_error}")


def validate_frontend_target(timeout: float = 20.0) -> dict[str, Any]:
    deadline = time.time() + timeout
    last_error: str | None = None
    while time.time() < deadline:
        try:
            response = _run(["powershell", "-NoProfile", "-Command", f"(Invoke-WebRequest -Uri '{FRONTEND_URL}' -UseBasicParsing).StatusCode"], cwd=str(ROOT))
            if response.returncode == 0:
                status_code = response.stdout.strip()
                if status_code:
                    return {"url": FRONTEND_URL, "status_code": status_code, "returncode": response.returncode}
            last_error = response.stderr.strip() or response.stdout.strip() or "No frontend response"
        except Exception as exc:  # pragma: no cover - defensive fault path
            last_error = str(exc)
        time.sleep(1)

    raise RuntimeError(f"Frontend target validation failed: {last_error}")


def validate_api_target() -> dict[str, Any]:
    response = _run([
        "powershell",
        "-NoProfile",
        "-Command",
        f"(Invoke-WebRequest -Uri '{BACKEND_URL}/api/v1/dashboard' -UseBasicParsing).StatusCode",
    ], cwd=str(ROOT))
    if response.returncode != 0:
        raise RuntimeError(response.stderr.strip() or response.stdout.strip() or "API target validation failed")
    return {"url": f"{BACKEND_URL}/api/v1/dashboard", "status_code": response.stdout.strip(), "returncode": response.returncode}


def print_summary(summary: dict[str, Any]) -> None:
    print(json.dumps(summary, indent=2, sort_keys=True))


def main() -> int:
    summary: dict[str, Any] = {}
    try:
        summary["environment"] = validate_environment()
        summary["conflicts"] = detect_conflicting_processes()
        summary["backend_health"] = validate_backend_health()
        summary["frontend_target"] = validate_frontend_target()
        summary["dashboard_api"] = validate_api_target()
        print_summary(summary)
        return 0
    except Exception as exc:  # pragma: no cover - defensive fault path
        summary["error"] = str(exc)
        print_summary(summary)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
