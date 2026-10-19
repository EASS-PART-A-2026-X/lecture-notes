"""Execute the printed offline routing lab and syntax-check optional API examples."""

import re
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def main() -> None:
    text = (ROOT / "guides/model-apis-and-decisions.md").read_text()
    blocks = re.findall(r"^```python\n(.*?)^```", text, re.MULTILINE | re.DOTALL)
    sources = {}
    for block in blocks:
        name = block.splitlines()[0].removeprefix("# ").split(" —")[0]
        if name in sources:
            raise ValueError(f"Duplicate snippet: {name}")
        compile(block, name, "exec")
        sources[name] = block
    if len(sources) != 8:
        raise ValueError(f"Expected eight Python examples; got {len(sources)}")
    with tempfile.TemporaryDirectory(prefix="eass-decisions-") as directory:
        root = Path(directory)
        for name in ("routing.py", "test_routing.py"):
            (root / name).write_text(sources[name])
        subprocess.run(
            [sys.executable, "-m", "unittest", "-v"],
            cwd=root,
            check=True,
            timeout=30,
        )
    print("PASS: seven routing tests; eight snippets compile; no provider calls")


if __name__ == "__main__":
    main()
