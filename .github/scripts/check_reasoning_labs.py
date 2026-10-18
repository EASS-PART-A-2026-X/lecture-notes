"""Execute the original delivery lab directly from its published Markdown fences.

uv run --no-project --python 3.14 python .github/scripts/check_reasoning_labs.py
No third-party packages, model, broker or network calls. Temporary files only.
"""

import ast
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main():
    source = (ROOT / "guides/systems-reasoning.md").read_text()
    snippets = re.findall(r"^```python\n(.*?)^```", source, re.MULTILINE | re.DOTALL)
    with tempfile.TemporaryDirectory(prefix="eass-reasoning-") as directory:
        for filename in ("delivery.py", "test_delivery.py"):
            matches = [s for s in snippets if s.splitlines()[0] == f"# {filename}"]
            if len(matches) != 1:
                raise ValueError(f"Expected exactly one complete {filename}")
            ast.parse(matches[0], filename=filename)
            (Path(directory) / filename).write_text(matches[0])
        result = subprocess.run(
            [sys.executable, "-m", "unittest", "-v"],
            cwd=directory,
            check=False,
            text=True,
            capture_output=True,
            timeout=60,
        )
        print(result.stdout, end="")
        print(result.stderr, end="", file=sys.stderr)
        result.check_returncode()
        if "Ran 8 tests" not in result.stderr:
            raise RuntimeError(
                "Update the documented lab count when changing its tests"
            )
    print("PASS: eight printed delivery-lab checks (SQLite; no broker or model)")


if __name__ == "__main__":
    main()
