from __future__ import annotations

import csv
import os
import shutil
import subprocess
import sys
from pathlib import Path


def _run_migration(
    script_path: Path,
    *,
    source_path: Path,
    mode: str,
    domain: str = "all",
    since: str | None = None,
) -> subprocess.CompletedProcess[str]:
    command = [
        sys.executable,
        str(script_path),
        "--mode",
        mode,
        "--domain",
        domain,
        "--source",
        str(source_path),
        "--batch-size",
        "2",
    ]
    if since:
        command.extend(["--since", since])
    return subprocess.run(
        command,
        capture_output=True,
        text=True,
        check=False,
        env=os.environ.copy(),
    )


def test_legacy_migration_full_dry_run_contract():
    project_root = Path(__file__).resolve().parents[2]
    script_path = project_root / "scripts" / "migrate_legacy_full.py"
    source_path = project_root / "backend" / "tests" / "fixtures" / "legacy_full"

    result = _run_migration(script_path, source_path=source_path, mode="dry-run", domain="all")
    combined_output = f"{result.stdout}\n{result.stderr}"

    assert result.returncode == 0
    assert "legacy migration started mode=dry-run domain=all" in combined_output
    assert "domain=master mode=dry-run processed=3" in combined_output
    assert "domain=master mode=dry-run" in combined_output and "errors=0" in combined_output
    assert "domain=transactions mode=dry-run processed=8" in combined_output
    assert "domain=organization mode=dry-run processed=2" in combined_output
    assert "domain=support mode=dry-run processed=2" in combined_output


def test_legacy_migration_full_apply_is_idempotent(tmp_path: Path):
    project_root = Path(__file__).resolve().parents[2]
    script_path = project_root / "scripts" / "migrate_legacy_full.py"

    unique_prefix = f"LEG-MIG-{os.getpid()}-{tmp_path.name[-4:]}".upper()
    source_path = tmp_path / "legacy_products_phase4.csv"
    with source_path.open("w", encoding="utf-8", newline="") as file:
        writer = csv.DictWriter(
            file,
            fieldnames=["product_number", "name", "description", "unit", "status", "product_group"],
        )
        writer.writeheader()
        writer.writerow(
            {
                "product_number": f"{unique_prefix}-001",
                "name": "Legacy Migration Product A",
                "description": "phase4 apply idempotency A",
                "unit": "piece",
                "status": "active",
                "product_group": f"{unique_prefix}-GROUP",
            }
        )
        writer.writerow(
            {
                "product_number": f"{unique_prefix}-002",
                "name": "Legacy Migration Product B",
                "description": "phase4 apply idempotency B",
                "unit": "piece",
                "status": "blocked",
                "product_group": f"{unique_prefix}-GROUP",
            }
        )

    first = _run_migration(script_path, source_path=source_path, mode="apply", domain="master")
    first_output = f"{first.stdout}\n{first.stderr}"
    assert first.returncode == 0
    assert "domain=master mode=apply processed=2 created=2 updated=0 errors=0" in first_output

    second = _run_migration(script_path, source_path=source_path, mode="apply", domain="master")
    second_output = f"{second.stdout}\n{second.stderr}"
    assert second.returncode == 0
    assert "domain=master mode=apply processed=2 created=0 updated=0 errors=0" in second_output


def test_legacy_migration_full_delta_filters_unchanged_rows():
    project_root = Path(__file__).resolve().parents[2]
    script_path = project_root / "scripts" / "migrate_legacy_full.py"
    source_path = project_root / "backend" / "tests" / "fixtures" / "legacy_full"

    result = _run_migration(
        script_path,
        source_path=source_path,
        mode="delta",
        domain="organization",
        since="2026-01-20T00:00:00+00:00",
    )
    combined_output = f"{result.stdout}\n{result.stderr}"
    assert result.returncode == 0
    assert "domain=organization mode=delta processed=1" in combined_output


def test_legacy_migration_full_fails_fast_on_schema_mismatch(tmp_path: Path):
    project_root = Path(__file__).resolve().parents[2]
    script_path = project_root / "scripts" / "migrate_legacy_full.py"

    source_path = tmp_path / "legacy_products_invalid.csv"
    source_path.write_text(
        "sku,label,unit,status\n"
        "BAD-001,Invalid Product,piece,active\n",
        encoding="utf-8",
    )

    result = _run_migration(script_path, source_path=source_path, mode="dry-run", domain="master")
    combined_output = f"{result.stdout}\n{result.stderr}"

    assert result.returncode == 2
    assert "missing required columns" in combined_output
    assert "product_number" in combined_output
    assert "product_group" in combined_output


def test_legacy_migration_full_stages_unmapped_csv_tables(tmp_path: Path):
    project_root = Path(__file__).resolve().parents[2]
    script_path = project_root / "scripts" / "migrate_legacy_full.py"
    source_template = project_root / "backend" / "tests" / "fixtures" / "legacy_full"
    source_path = tmp_path / "legacy_full_all_tables"
    shutil.copytree(source_template, source_path)

    extra_file = source_path / "app_vars.csv"
    extra_file.write_text(
        "id,var_key,var_value,updated_at\n"
        "1,theme,light,2026-02-10T10:00:00+00:00\n"
        "2,timezone,UTC,2026-02-11T12:00:00+00:00\n",
        encoding="utf-8",
    )

    result = _run_migration(script_path, source_path=source_path, mode="dry-run", domain="support")
    combined_output = f"{result.stdout}\n{result.stderr}"

    assert result.returncode == 0
    assert "domain=support mode=dry-run processed=4" in combined_output


def test_legacy_migration_full_allows_directory_without_typed_contract_files(tmp_path: Path):
    project_root = Path(__file__).resolve().parents[2]
    script_path = project_root / "scripts" / "migrate_legacy_full.py"
    source_path = tmp_path / "legacy_raw_only"
    source_path.mkdir(parents=True, exist_ok=True)
    (source_path / "texte.csv").write_text(
        "id,key,value,updated_at\n"
        "10,welcome,de,2026-01-01T00:00:00+00:00\n"
        "11,welcome,en,2026-01-02T00:00:00+00:00\n",
        encoding="utf-8",
    )

    result = _run_migration(script_path, source_path=source_path, mode="dry-run", domain="all")
    combined_output = f"{result.stdout}\n{result.stderr}"

    assert result.returncode == 0
    assert "domain=master mode=dry-run processed=0" in combined_output
    assert "domain=transactions mode=dry-run processed=0" in combined_output
    assert "domain=organization mode=dry-run processed=0" in combined_output
    assert "domain=support mode=dry-run processed=2" in combined_output
