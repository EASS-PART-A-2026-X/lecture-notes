"""Assemble the Lecture 9 reference from printed code, never from a second app.

python3 .github/scripts/assemble_stack.py /path/to/NEW-directory
The destination must not exist. Dependencies/locks live in .github/reference.
Only the explicit continuation/import/function edits taught in Lectures 3–9 apply.
"""

import ast
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def snippet(lecture, language, header):
    (page,) = (ROOT / "lectures").glob(f"{lecture:02}-*.md")
    matches = [
        s
        for s in re.findall(
            r"^```" + language + r"\n(.*?)^```",
            page.read_text(),
            re.MULTILINE | re.DOTALL,
        )
        if s.splitlines()[0] == header
    ]
    if len(matches) != 1:
        raise ValueError(f"{page.name}: expected one {header!r}, found {len(matches)}")
    return matches[0]


def py(lecture, header):
    return snippet(lecture, "python", header)


def replace(source, old, new):
    if source.count(old) != 1:
        raise ValueError(f"Expected exactly one edit target: {old!r}")
    return source.replace(old, new)


def definition(source, name, owner=None):
    nodes = ast.parse(source).body
    if owner:
        (parent,) = [
            n for n in nodes if isinstance(n, ast.ClassDef) and n.name == owner
        ]
        nodes = parent.body
    (node,) = [
        n
        for n in nodes
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name == name
    ]
    start = min([node.lineno] + [d.lineno for d in node.decorator_list]) - 1
    return start, node.end_lineno


def replace_function(source, name, replacement, owner=None):
    start, end = definition(source, name, owner)
    lines = source.splitlines(keepends=True)
    return "".join(lines[:start]) + replacement.rstrip() + "\n" + "".join(lines[end:])


def function(source, name, owner=None):
    start, end = definition(source, name, owner)
    return "".join(source.splitlines(keepends=True)[start:end])


def assemble(destination):
    destination.mkdir()  # deliberately refuse existing directories

    def write(path, source):
        target = destination / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(source)

    for service in ("backend", "frontend", "ai-service"):
        (destination / service).mkdir(exist_ok=True)
        for name in ("pyproject.toml", "uv.lock"):
            shutil.copyfile(
                ROOT / ".github/reference" / service / name,
                destination / service / name,
            )
        write(
            f"{service}/.dockerignore",
            ".venv\n__pycache__\n.pytest_cache\n.ruff_cache\n.env\ntests\ne2e\n",
        )
        if service != "frontend":
            write(f"{service}/app/__init__.py", "")

    # Lecture 3 persistence keeps Lecture 2's API tests.
    for path in (
        "app/models.py",
        "app/db.py",
        "app/main.py",
        "app/seed.py",
        "tests/conftest.py",
        "tests/test_restart.py",
    ):
        write(f"backend/{path}", py(3, f"# backend/{path}"))
    write(
        "backend/tests/test_recipes.py",
        py(2, "# backend/tests/test_recipes.py (excerpt)")
        + "\n"
        + py(2, "# backend/tests/test_recipes.py (continued)"),
    )
    write(
        "backend/app/models.py",
        py(3, "# backend/app/models.py")
        + "\n"
        + py(7, "# backend/app/models.py (append)"),
    )
    main = py(3, "# backend/app/main.py")
    main = main.replace(
        "from app import db\n",
        "from app import db\nfrom app.ai_client import AIClientDep, AIServiceBadOutput, AIServiceUnavailable\nfrom app.models import FromTextRequest\n",
    )
    write(
        "backend/app/main.py",
        main + "\n" + py(7, "# backend/app/main.py (add the route)"),
    )
    client = py(7, "# backend/app/ai_client.py")
    update = py(9, "# backend/app/ai_client.py (excerpt)")
    contract = client[
        client.index("        try:\n            extraction =") : client.index(
            "\n\ndef get_ai_client"
        )
    ]
    method = (
        function(update, "extract_recipe", "AIClient").rstrip()
        + "\n"
        + contract.rstrip()
    )
    client = replace_function(client, "extract_recipe", method, "AIClient")
    prefix = update[update.index("from tenacity") : update.index("\n\nclass AIClient:")]
    client = prefix + "\n\n" + client
    client = replace(
        client,
        "    def extract_recipe(",
        function(update, "_post_extract", "AIClient") + "\n    def extract_recipe(",
    )
    client = client.replace("(no retries yet)", "(bounded retries at one layer)")
    write("backend/app/ai_client.py", client)
    tests = (
        py(7, "# backend/tests/test_from_text.py")
        + "\n"
        + py(7, "# backend/tests/test_from_text.py (continued)")
    )
    # The three tests Lecture 9 explicitly removes/replaces.
    for name in (
        "test_ai_down_is_503",
        "test_ai_timeout_is_503",
        "test_ai_error_status",
    ):
        tests = replace_function(tests, name, "")
    tests += (
        "\n"
        + py(9, "# backend/tests/test_from_text.py (excerpt)")
        + "\n"
        + py(9, "# backend/tests/test_from_text.py (the four retry tests)")
    )
    write("backend/tests/test_from_text.py", tests)

    for path in ("app/schemas.py", "app/agent.py", "app/main.py", "tests/conftest.py"):
        write(f"ai-service/{path}", py(6, f"# ai-service/{path}"))
    agent = py(6, "# ai-service/app/agent.py")
    agent = replace(
        agent,
        "from pydantic_ai import Agent, ModelRetry, RunContext",
        "from pydantic_ai import Agent, ModelRetry, RunContext, UsageLimits",
    )
    agent += "\nLIMITS = UsageLimits(request_limit=5, tool_calls_limit=5, total_tokens_limit=20_000)\n"
    write("ai-service/app/agent.py", agent)
    update = py(
        9, "# ai-service/app/main.py (excerpt: replace the imports and extract();"
    )
    old = py(6, "# ai-service/app/main.py")
    main = update[: update.index("@app.post")] + old[old.index("app = FastAPI") :]
    write(
        "ai-service/app/main.py",
        replace_function(main, "extract", function(update, "extract")),
    )
    tests = py(6, "# ai-service/tests/test_extract.py").replace(
        "from app.agent import extract_agent\n",
        "from app.agent import Deps, extract_agent, hours_to_minutes\n",
    )
    tests += "\n" + py(
        6, "# ai-service/tests/test_extract.py (add; change the app.agent import to"
    )
    tests += (
        "\n"
        + py(9, "# ai-service/tests/test_extract.py (excerpt)")
        + "\n"
        + py(9, "# ai-service/tests/test_extract.py (add; the imports go at the top)")
    )
    write("ai-service/tests/test_extract.py", tests)

    api = py(5, "# frontend/api.py")
    update = py(
        7, "# frontend/api.py (replace _friendly; add AI_TIMEOUT and create_from_text)"
    )
    api = replace_function(api, "_friendly", function(update, "_friendly"))
    api += "\nAI_TIMEOUT = httpx.Timeout(100.0, connect=2.0)\n\n" + function(
        update, "create_from_text"
    )
    api = replace(api, "uv run fastapi dev in backend/", "docker compose up")
    write("frontend/api.py", api)
    ui = replace(
        py(5, "# frontend/streamlit_app.py (after Lecture 5)"),
        'browse, add = st.tabs(["Recipes", "Add a recipe"])',
        py(7, "# frontend/streamlit_app.py (replace the tabs line)")
        .split("\n", 1)[1]
        .strip(),
    )
    write(
        "frontend/streamlit_app.py",
        ui + "\n" + py(7, "# frontend/streamlit_app.py (append)"),
    )
    write(
        "frontend/.streamlit/config.toml",
        snippet(4, "toml", "# frontend/.streamlit/config.toml"),
    )
    write(
        "frontend/tests/test_app.py",
        py(5, "# frontend/tests/test_app.py")
        + "\n"
        + py(7, "# frontend/tests/test_app.py (add)"),
    )
    write("frontend/tests/test_boundary.py", py(5, "# frontend/tests/test_boundary.py"))

    write(
        "backend/Dockerfile", snippet(3, "dockerfile", "# syntax=docker/dockerfile:1")
    )
    dockerfile = snippet(8, "dockerfile", "# syntax=docker/dockerfile:1")
    write("ai-service/Dockerfile", dockerfile)
    write(
        "frontend/Dockerfile",
        dockerfile[: dockerfile.index("EXPOSE 8001")]
        + snippet(8, "dockerfile", "EXPOSE 8501"),
    )
    write(
        "compose.yaml",
        snippet(
            8,
            "yaml",
            '# compose.yaml (Compose Specification: no top-level "version:" key)',
        ),
    )
    write(".gitignore", ".env\n.venv/\n__pycache__/\n.pytest_cache/\n")
    for path in destination.rglob("*.py"):
        ast.parse(path.read_text(), filename=str(path))
    print(f"Assembled Lecture 9 reference at {destination}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    assemble(Path(sys.argv[1]).resolve())
