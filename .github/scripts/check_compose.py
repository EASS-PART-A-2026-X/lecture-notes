"""Validate Lecture 8's actual Compose block with Docker's parser; start no service."""

import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
source = (ROOT / "lectures/08-docker-compose.md").read_text()
blocks = re.findall(r"^```yaml\n(.*?)^```", source, re.MULTILINE | re.DOTALL)
matches = [b for b in blocks if b.startswith("# compose.yaml (Compose Specification:")]
if len(matches) != 1:
    raise SystemExit("Expected exactly one complete Lecture 8 Compose example")

with tempfile.TemporaryDirectory(prefix="eass-compose-") as directory:
    path = Path(directory) / "compose.yaml"
    path.write_text(matches[0])
    # No inherited .env, model override, key, or host-port setting enters this check.
    env = {
        k: v
        for k, v in os.environ.items()
        if k not in {"AI_MODEL", "BACKEND_PORT", "FRONTEND_PORT"}
        and not k.startswith("COMPOSE_")
    }
    env["COMPOSE_DISABLE_ENV_FILE"] = "true"
    result = subprocess.run(
        ["docker", "compose", "-f", str(path), "config", "--format", "json"],
        env=env,
        check=True,
        capture_output=True,
        text=True,
        timeout=30,
    )
    config = json.loads(result.stdout)  # never print resolved configuration/secrets
    services = config["services"]
    assert set(services) == {"backend", "frontend", "ai-service"}
    assert services["ai-service"]["environment"]["AI_MODEL"] == "test"
    assert not services["ai-service"].get("ports"), (
        "AI endpoint must not be host-published"
    )
    for name in ("backend", "frontend"):
        assert len(services[name]["ports"]) == 1
        assert services[name]["ports"][0]["host_ip"] == "127.0.0.1"
    for name in services:
        assert services[name]["healthcheck"]["test"][0] == "CMD"
        assert not services[name].get("privileged", False)
    assert (
        services["backend"]["environment"]["AI_SERVICE_URL"] == "http://ai-service:8001"
    )
    assert services["frontend"]["environment"]["BACKEND_URL"] == "http://backend:8000"
    assert (
        services["backend"]["depends_on"]["ai-service"]["condition"]
        == "service_healthy"
    )
    assert (
        services["frontend"]["depends_on"]["backend"]["condition"] == "service_healthy"
    )
    assert "backend-data" in config["volumes"]
    assert any(
        mount.get("source") == "backend-data" and mount.get("target") == "/app/data"
        for mount in services["backend"]["volumes"]
    )
print(
    "PASS: Lecture 8 Compose parses; three services, offline model default, loopback ports, DNS, health ordering, volume"
)
