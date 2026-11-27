"""Execute the printed AI-systems Python labs directly from Markdown fences.

uv run --no-project --python 3.14 python .github/scripts/check_aisys_labs.py
No third-party packages, GPU, model, or network calls. Temporary files only.
"""

import ast
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

LABS = [
    (
        "guides/ai-systems-02-rl-and-rollouts.md",
        ("rollout_fsm.py", "test_rollout_fsm.py"),
        8,
    ),
    (
        "guides/ai-systems-03-environments-state-roadmap.md",
        ("trajectory_verifier.py", "test_trajectory_verifier.py"),
        8,
    ),
]


def run_lab(guide_rel: str, filenames: tuple[str, str], expected_tests: int) -> None:
    source = (ROOT / guide_rel).read_text(encoding="utf-8")
    snippets = re.findall(r"^```python\n(.*?)^```", source, re.MULTILINE | re.DOTALL)
    with tempfile.TemporaryDirectory(prefix="eass-aisys-") as directory:
        for filename in filenames:
            matches = [s for s in snippets if s.splitlines()[0] == f"# {filename}"]
            if len(matches) != 1:
                raise ValueError(f"{guide_rel}: expected exactly one complete {filename}, found {len(matches)}")
            ast.parse(matches[0], filename=filename)
            (Path(directory) / filename).write_text(matches[0], encoding="utf-8")
        # Run the beginner demo entrypoint first
        demo = subprocess.run(
            [sys.executable, filenames[0]],
            cwd=directory,
            check=False,
            text=True,
            capture_output=True,
            timeout=60,
        )
        print(demo.stdout, end="")
        demo.check_returncode()
        if not demo.stdout.strip():
            raise RuntimeError(f"{guide_rel}: expected non-empty demo stdout from {filenames[0]}")
        # Run the unittest suite
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
        if f"Ran {expected_tests} tests" not in result.stderr:
            raise RuntimeError(f"{guide_rel}: expected Ran {expected_tests} tests")


def main() -> None:
    total = 0
    for guide_rel, filenames, expected_tests in LABS:
        run_lab(guide_rel, filenames, expected_tests)
        total += expected_tests
    print(f"PASS: {total} printed AI-systems lab checks + demos (stdlib only; no GPU or model)")


if __name__ == "__main__":
    main()
