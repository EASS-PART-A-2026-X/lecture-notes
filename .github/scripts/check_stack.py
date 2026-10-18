"""Run the assembled Lecture 9 stack and verify real HTTP/restart/outage behavior.

python3 .github/scripts/check_stack.py /path/to/assembled-reference [--keep]
Requires Docker Compose and uv. Uses synthetic data and AI_MODEL=test; no model bill.
--keep preserves only this check's containers/volume for a manual browser walkthrough.
"""

import argparse
import json
import os
import subprocess
import time
import uuid
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--keep", action="store_true")
    parser.add_argument("--project", default="eass-check-" + uuid.uuid4().hex[:10])
    parser.add_argument("--backend-port", type=int, default=18000)
    parser.add_argument("--frontend-port", type=int, default=18501)
    args = parser.parse_args()
    root = args.directory.resolve()
    if not args.project.startswith("eass-check-"):
        parser.error("project must start with eass-check- (dedicated disposable stack)")
    if (root / ".env").exists():
        parser.error("reference checks require a directory without .env")
    # Do not inherit model keys, model selection, Compose overrides or Docker context changes.
    env = {
        k: v
        for k, v in os.environ.items()
        if not k.endswith(("API_KEY", "TOKEN", "SECRET"))
        and not k.startswith(("AI_", "OLLAMA_", "COMPOSE_", "DOCKER_"))
    }
    env.update(
        AI_MODEL="test",
        BACKEND_PORT=str(args.backend_port),
        FRONTEND_PORT=str(args.frontend_port),
    )
    compose = ["docker", "compose", "-p", args.project]

    def run(*command, timeout=180):
        subprocess.run(command, cwd=root, env=env, check=True, timeout=timeout)

    def dc(*command, timeout=180):
        run(*compose, *command, timeout=timeout)

    def request(method, path, body=None):
        payload = None if body is None else json.dumps(body).encode()
        req = Request(
            f"http://127.0.0.1:{args.backend_port}{path}",
            data=payload,
            headers={"Content-Type": "application/json"},
            method=method,
        )
        try:
            response = urlopen(req, timeout=15)
        except HTTPError as error:
            response = error
        with response:
            content = response.read()
            return response.status, json.loads(content) if content else None

    checks = []

    def passed(name):
        checks.append(name)
        print("PASS:", name, flush=True)

    try:
        for service in ("backend", "ai-service", "frontend"):
            run(
                "uv",
                "run",
                "--locked",
                "--directory",
                str(root / service),
                "pytest",
                "-q",
            )
        dc("config", "--quiet")
        dc("up", "--build", "--wait", "--wait-timeout", "180", timeout=600)
        assert request("GET", "/health") == (200, {"status": "ok"})
        with urlopen(
            f"http://127.0.0.1:{args.frontend_port}/_stcore/health", timeout=10
        ) as response:
            assert response.status == 200
        passed("backend and frontend are reachable; Compose health gating passed")
        status, initial = request("GET", "/recipes")
        assert status == 200 and initial
        before = len(initial)
        assert request("POST", "/recipes", {"title": "", "minutes": 0})[0] == 422
        assert len(request("GET", "/recipes")[1]) == before
        passed("invalid input is rejected without saving a row")
        status, saved = request(
            "POST", "/recipes", {"title": "Integration checkpoint", "minutes": 12}
        )
        assert status == 201
        rid = saved["id"]
        assert request("PATCH", f"/recipes/{rid}", {"minutes": 18})[1]["minutes"] == 18
        passed("create, read and update use the real persistent backend")
        status, candidate = request(
            "POST",
            "/recipes/from-text",
            {"text": "Hummus: chickpeas and tahini. 15 minutes."},
        )
        assert status == 201 and candidate["ingredients"]
        assert request("GET", f"/recipes/{candidate['id']}") == (200, candidate)
        passed(
            "backend -> AI service DNS/HTTP -> validated candidate -> database commit (TestModel)"
        )
        dc("down")
        dc("up", "--wait", "--wait-timeout", "180")
        assert request("GET", f"/recipes/{rid}")[1]["minutes"] == 18
        assert request("GET", f"/recipes/{candidate['id']}") == (200, candidate)
        passed(
            "both manual and AI-created rows survive container removal and recreation"
        )
        dc("stop", "ai-service")
        count = len(request("GET", "/recipes")[1])
        started = time.monotonic()
        assert request(
            "POST",
            "/recipes/from-text",
            {"text": "A valid request while AI is stopped."},
        ) == (503, {"detail": "AI service unavailable"})
        assert time.monotonic() - started < 10
        assert len(request("GET", "/recipes")[1]) == count
        status, during_outage = request(
            "POST", "/recipes", {"title": "CRUD during outage", "minutes": 7}
        )
        assert status == 201
        passed(
            "AI outage fails within 10 seconds; no partial AI row; ordinary CRUD still works"
        )
        dc("up", "--wait", "--wait-timeout", "60", "--no-deps", "ai-service")
        assert (
            request(
                "POST",
                "/recipes/from-text",
                {"text": "Recovered AI request with synthetic data."},
            )[0]
            == 201
        )
        passed("AI flow recovers after the service starts again")
        assert request("DELETE", f"/recipes/{during_outage['id']}")[0] == 204
        assert request("GET", f"/recipes/{during_outage['id']}")[0] == 404
        passed("delete is committed and subsequent reads return 404")
        report = {
            "scope": "Lecture 9 reference; real containers and HTTP, deterministic TestModel",
            "checks": checks,
            "project": args.project,
            "backend_port": args.backend_port,
            "frontend_port": args.frontend_port,
            "real_model_quality": "not measured",
            "browser_flow": "manual verification required separately",
        }
        (root / "stack-check.json").write_text(json.dumps(report, indent=2) + "\n")
    finally:
        if args.keep:
            print(
                f"Kept {args.project} for browser review at http://localhost:{args.frontend_port}"
            )
        else:
            dc("down", "--volumes", "--remove-orphans")


if __name__ == "__main__":
    main()
