from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
from decimal import Decimal
from pathlib import Path

from app.services.einvoice.models import EinvoiceValidationError, REQUIRED_BILLING_FIELDS


def validate_export_prerequisites(*, invoice, invoice_items: list, billing_settings) -> None:
    missing = [field for field in REQUIRED_BILLING_FIELDS if not getattr(billing_settings, field, None)]
    if missing:
        raise EinvoiceValidationError(
            message="Billing settings are incomplete",
            report={"valid": False, "missing_fields": missing, "stage": "billing_settings"},
        )

    if not invoice_items:
        raise EinvoiceValidationError(
            message="Invoice has no items",
            report={"valid": False, "stage": "invoice_items", "message": "Invoice has no positions"},
        )

    if Decimal(invoice.total_gross) <= Decimal("0"):
        raise EinvoiceValidationError(
            message="Invoice total must be > 0",
            report={"valid": False, "stage": "totals", "message": "total_gross must be > 0"},
        )


def _builtin_en16931_checks(xml_bytes: bytes) -> dict:
    text = xml_bytes.decode("utf-8", errors="ignore")
    required_tokens = [
        "<rsm:CrossIndustryInvoice",
        "<ram:ID>",
        "<ram:SellerTradeParty>",
        "<ram:GrandTotalAmount>",
    ]
    missing = [token for token in required_tokens if token not in text]
    valid = len(missing) == 0
    return {
        "valid": valid,
        "engine": "builtin-minimal",
        "missing_tokens": missing,
    }


def _validation_mode() -> str:
    raw = os.getenv("EINVOICE_EN16931_VALIDATION_MODE", "strict").strip().lower()
    if raw in {"strict", "builtin_fallback"}:
        return raw
    return "strict"


def validate_en16931(xml_bytes: bytes) -> dict:
    mode = _validation_mode()
    validator_jar = os.getenv("EINVOICE_KOSIT_VALIDATOR_JAR", "").strip()
    validator_scenario = os.getenv("EINVOICE_KOSIT_SCENARIO", "").strip()

    def _builtin_or_raise(error_code: str, message: str, *, report_extra: dict | None = None) -> dict:
        if mode == "builtin_fallback":
            report = _builtin_en16931_checks(xml_bytes)
            report["mode"] = mode
            report["fallback_reason"] = error_code
            if report_extra:
                report.update(report_extra)
            if not report["valid"]:
                raise EinvoiceValidationError(message="EN16931 validation failed", report=report)
            return report
        report = {"valid": False, "engine": "kosit", "mode": mode, "error": error_code}
        if report_extra:
            report.update(report_extra)
        raise EinvoiceValidationError(message=message, report=report)

    if not validator_jar:
        return _builtin_or_raise(
            "validator_jar_not_configured",
            "KoSIT validator jar is required for strict EN16931 validation",
        )

    if not Path(validator_jar).exists():
        return _builtin_or_raise(
            "validator_jar_missing",
            "Configured KoSIT validator jar not found",
            report_extra={"validator_jar": validator_jar},
        )

    if not validator_scenario:
        return _builtin_or_raise(
            "validator_scenario_not_configured",
            "KoSIT scenario is required for strict EN16931 validation",
        )

    if not Path(validator_scenario).exists():
        return _builtin_or_raise(
            "validator_scenario_missing",
            "Configured KoSIT scenario not found",
            report_extra={"validator_scenario": validator_scenario},
        )

    if shutil.which("java") is None:
        return _builtin_or_raise(
            "java_not_found",
            "Java runtime is required to execute KoSIT validator",
        )

    with tempfile.TemporaryDirectory(prefix="einvoice-kosit-") as temp_dir:
        temp_dir_path = Path(temp_dir)
        input_file = temp_dir_path / "invoice.xml"
        input_file.write_bytes(xml_bytes)
        output_dir = temp_dir_path / "out"
        output_dir.mkdir(parents=True, exist_ok=True)

        command = [
            "java",
            "-jar",
            validator_jar,
            "-s",
            validator_scenario,
            "-o",
            str(output_dir),
            str(input_file),
        ]
        try:
            process = subprocess.run(command, capture_output=True, text=True)
        except OSError as exc:
            return _builtin_or_raise(
                "validator_execution_error",
                "KoSIT validator execution failed",
                report_extra={"exception": str(exc)},
            )

        if process.returncode != 0:
            return _builtin_or_raise(
                "validator_non_zero_exit",
                "KoSIT validator returned non-zero exit code",
                report_extra={
                    "return_code": process.returncode,
                    "stdout": process.stdout[-4000:],
                    "stderr": process.stderr[-4000:],
                },
            )

        return {
            "valid": True,
            "engine": "kosit",
            "return_code": process.returncode,
            "stdout": process.stdout[-4000:],
            "stderr": process.stderr[-4000:],
        }
