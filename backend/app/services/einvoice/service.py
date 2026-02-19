from __future__ import annotations

import shutil
import subprocess

from app.services.einvoice.models import EinvoiceValidationError
from app.services.einvoice import validation as _validation
from app.services.einvoice.xrechnung import build_xrechnung_xml
from app.services.einvoice.zugferd import build_zugferd_pdf

# Keep test monkeypatch targets on this module compatible with pre-refactor paths.
_validation.shutil = shutil
_validation.subprocess = subprocess

validate_en16931 = _validation.validate_en16931
validate_export_prerequisites = _validation.validate_export_prerequisites

__all__ = [
    "EinvoiceValidationError",
    "build_xrechnung_xml",
    "build_zugferd_pdf",
    "validate_en16931",
    "validate_export_prerequisites",
]
