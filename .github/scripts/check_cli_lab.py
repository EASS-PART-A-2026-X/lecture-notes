"""Run the complete CLI lab exactly as printed, without a model or package install."""

import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    if sys.version_info < (3, 14):
        raise SystemExit("Use Python 3.14: the lab demonstrates argparse's color setting.")
    text = (ROOT / "guides/cli-first-agents.md").read_text()
    blocks = re.findall(r"^```python\n(.*?)^```", text, re.MULTILINE | re.DOTALL)
    env = {
        key: value
        for key, value in os.environ.items()
        if not key.endswith(("API_KEY", "TOKEN", "SECRET"))
    }
    with tempfile.TemporaryDirectory(prefix="eass-cli-") as directory:
        root = Path(directory)
        sources = {
            "catalog.py": ["# catalog.py"],
            "test_catalog.py": [
                "# test_catalog.py",
                "# test_catalog.py (continued; keep method indentation)",
            ],
        }
        for name, headers in sources.items():
            pieces = []
            for header in headers:
                matches = [block for block in blocks if block.splitlines()[0] == header]
                if len(matches) != 1:
                    raise SystemExit(f"Expected one {header} fence, got {len(matches)}")
                pieces.append(matches[0])
            (root / name).write_text("\n\n".join(pieces))
        subprocess.run(
            [sys.executable, "-m", "unittest", "-v", "test_catalog.py"],
            cwd=root,
            env=env,
            check=True,
            timeout=30,
        )
    print("PASS: eight printed CLI interface checks; no model or network service")


if __name__ == "__main__":
    main()
