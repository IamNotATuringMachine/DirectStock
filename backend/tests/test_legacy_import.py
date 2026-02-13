from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest


def test_legacy_import_fails_fast_on_invalid_schema():
    project_root = Path(__file__).resolve().parents[2]
    script_path = project_root / "scripts" / "import_legacy_products.py"
    source_path = Path(
        "/Users/tobiasmorixbauer/Documents/GitHub/LLMRAG/ab_db_data/data/csv/products.csv"
    )

    if not source_path.exists():
        pytest.skip(f"legacy source not available: {source_path}")

    result = subprocess.run(
        [
            sys.executable,
            str(script_path),
            "--source",
            str(source_path),
            "--dry-run",
        ],
        capture_output=True,
        text=True,
        check=False,
    )

    combined_output = f"{result.stdout}\n{result.stderr}"

    assert result.returncode == 2
    assert "missing required columns" in combined_output
    assert "product_number" in combined_output
    assert "name" in combined_output
    assert "product_group" in combined_output
