# /// script
# requires-python = ">=3.14,<3.15"
# dependencies = ["fastapi[standard]", "httpx2", "pydantic-ai-slim", "pytest", "ruff", "sqlmodel"]
# ///
"""Execute complete reference checkpoints and standalone labs from the teaching text.

uv run --locked .github/scripts/check_examples.py

Temporary projects contain copied snippets, never a second maintained example.
These checks cover three complete checkpoints, a grader/usage clinic, and a storage lab,
not all later lecture excerpts, real-model quality, Docker networking, or a browser flow.
"""

import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def blocks(lecture: str) -> list[str]:
    return re.findall(
        r"^```python\n(.*?)^```", (ROOT / lecture).read_text(), re.MULTILINE | re.DOTALL
    )


def take(snippets: list[str], header: str) -> str:
    matches = [s for s in snippets if s.splitlines()[0] == header]
    if len(matches) != 1:
        raise ValueError(
            f"Expected exactly one snippet headed {header!r}, got {len(matches)}"
        )
    return matches[0]


def write(project: Path, relative: str, source: str) -> None:
    target = project / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(source)


def check(project: Path, expected: int) -> None:
    # Remove inherited model selection and credentials from child tests.
    env = {
        k: v
        for k, v in os.environ.items()
        if not k.endswith(("API_KEY", "TOKEN", "SECRET"))
    }
    env.update(AI_MODEL="test", PYDANTIC_AI_NO_BANNER="1", PYTHONPATH=str(project))
    write(
        project,
        "pyproject.toml",
        """[tool.pytest.ini_options]
pythonpath = ["."]
filterwarnings = ["error"]
[tool.ruff.lint]
extend-select = ["I", "FAST"]
""",
    )
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "-q"],
        cwd=project,
        env=env,
        text=True,
        capture_output=True,
        check=False,
        timeout=60,
    )
    print(result.stdout, flush=True)
    if result.returncode or f"{expected} passed" not in result.stdout:
        print(result.stderr, file=sys.stderr)
        raise SystemExit(f"{project.name}: expected {expected} passing examples")
    for arguments in (("check", "."), ("format", "--check", ".")):
        subprocess.run(
            [sys.executable, "-m", "ruff", *arguments],
            cwd=project,
            env=env,
            check=True,
            timeout=30,
        )


def main() -> None:
    with tempfile.TemporaryDirectory(prefix="eass-examples-") as directory:
        root = Path(directory)
        api = root / "lecture-02"
        snippets = blocks("lectures/02-http-fastapi-pydantic.md")
        for relative in ("app/models.py", "app/main.py", "tests/conftest.py"):
            write(api, relative, take(snippets, f"# backend/{relative}"))
        write(
            api,
            "tests/test_recipes.py",
            take(snippets, "# backend/tests/test_recipes.py (excerpt)")
            + "\n\n"
            + take(snippets, "# backend/tests/test_recipes.py (continued)"),
        )
        print("Lecture 2: the ten API contract tests", flush=True)
        check(api, 10)

        persistence = root / "lecture-03"
        snippets = blocks("lectures/03-persistence-and-first-pr.md")
        for relative in (
            "app/models.py",
            "app/db.py",
            "app/main.py",
            "app/seed.py",
            "tests/conftest.py",
            "tests/test_restart.py",
        ):
            write(persistence, relative, take(snippets, f"# backend/{relative}"))
        # The API contract tests remain exactly the same after the storage change.
        write(
            persistence,
            "tests/test_recipes.py",
            (api / "tests/test_recipes.py").read_text(),
        )
        print(
            "Lecture 3: unchanged API contract plus restart and idempotent seed",
            flush=True,
        )
        check(persistence, 12)

        ai = root / "lecture-06"
        snippets = blocks("lectures/06-pydantic-ai-agents.md")
        for relative in (
            "app/schemas.py",
            "app/agent.py",
            "app/main.py",
            "tests/conftest.py",
        ):
            write(ai, relative, take(snippets, f"# ai-service/{relative}"))
        primary = take(snippets, "# ai-service/tests/test_extract.py")
        # Follow the explicit import edit printed above the continuation.
        primary = primary.replace(
            "from app.agent import extract_agent\n",
            "from app.agent import Deps, extract_agent, hours_to_minutes\n",
        )
        continuation = take(
            snippets,
            "# ai-service/tests/test_extract.py (add; change the app.agent import to",
        )
        write(ai, "tests/test_extract.py", primary + "\n\n" + continuation)
        print(
            "Lecture 6: six offline agent tests; real model requests disabled by the fixture",
            flush=True,
        )
        check(ai, 6)
        clinic = root / "lecture-09"
        snippets = blocks("lectures/09-failures-evals-costs.md")
        write(clinic, "test_eval_clinic.py", take(snippets, "# eval_clinic.py"))
        write(
            clinic,
            "test_usage_limits.py",
            take(snippets, "# ai-service/tests/test_usage_limits.py"),
        )
        print(
            "Lecture 9: eight offline grader, slice-gate, and usage checks", flush=True
        )
        check(clinic, 8)
        studio = root / "industry-studio"
        snippets = blocks("guides/industry-studio.md")
        for relative in ("store.py", "test_store.py"):
            write(studio, relative, take(snippets, f"# {relative}"))
        print(
            "Industry studio: ten ownership and real SQLite concurrency checks",
            flush=True,
        )
        check(studio, 10)
    print("PASS: 46 executable reference checks, lint, and formatting", flush=True)


if __name__ == "__main__":
    main()
