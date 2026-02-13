from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest


def _run_import(script_path: Path, source_path: Path, *, dry_run: bool = False):
    command = [
        sys.executable,
        str(script_path),
        "--source",
        str(source_path),
        "--batch-size",
        "2",
    ]
    if dry_run:
        command.append("--dry-run")

    return subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=False,
        env=os.environ.copy(),
    )


@pytest.mark.asyncio
async def test_legacy_import_fails_fast_on_invalid_schema():
    project_root = Path(__file__).resolve().parents[2]
    script_path = project_root / "scripts" / "import_legacy_products.py"
    source_path = Path(
        "/Users/tobiasmorixbauer/Documents/GitHub/LLMRAG/ab_db_data/data/csv/products.csv"
    )

    if not source_path.exists():
        pytest.skip(f"legacy source not available: {source_path}")

    result = _run_import(script_path, source_path, dry_run=True)
    combined_output = f"{result.stdout}\n{result.stderr}"

    assert result.returncode == 2
    assert "missing required columns" in combined_output
    assert "product_number" in combined_output
    assert "name" in combined_output
    assert "product_group" in combined_output


@pytest.mark.asyncio
async def test_legacy_import_apply_is_idempotent_for_valid_fixture():
    project_root = Path(__file__).resolve().parents[2]
    script_path = project_root / "scripts" / "import_legacy_products.py"
    source_path = project_root / "backend" / "tests" / "fixtures" / "legacy_products_valid.csv"

    first_run = _run_import(script_path, source_path, dry_run=False)
    assert first_run.returncode == 0
    assert "processed=3" in first_run.stdout
    assert "created=3" in first_run.stdout

    second_run = _run_import(script_path, source_path, dry_run=False)
    assert second_run.returncode == 0
    assert "processed=3" in second_run.stdout
    assert "created=0" in second_run.stdout
    assert "updated=0" in second_run.stdout
