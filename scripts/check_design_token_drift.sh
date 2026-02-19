#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TOKENS_FILE="${ROOT_DIR}/frontend/src/styles/tokens.json"
CSS_FILE="${ROOT_DIR}/frontend/src/styles/foundation.css"

if [ ! -f "${TOKENS_FILE}" ]; then
  echo "Missing tokens file: ${TOKENS_FILE}"
  exit 1
fi

if [ ! -f "${CSS_FILE}" ]; then
  echo "Missing CSS file: ${CSS_FILE}"
  exit 1
fi

python3 - "${TOKENS_FILE}" "${CSS_FILE}" <<'PY'
import json
import re
import sys
from pathlib import Path

tokens_path = Path(sys.argv[1])
css_path = Path(sys.argv[2])

tokens = json.loads(tokens_path.read_text(encoding="utf-8"))
css = css_path.read_text(encoding="utf-8")

def block(pattern: str) -> str:
    match = re.search(pattern, css, re.S)
    if not match:
        raise SystemExit(f"Missing CSS block for pattern: {pattern}")
    return match.group("body")

def vars_from(body: str) -> dict[str, str]:
    entries = re.findall(r"--([a-z0-9-]+)\s*:\s*([^;]+);", body)
    return {name: value.strip() for name, value in entries}

root_block = block(r":root\s*\{(?P<body>.*?)\n\}")
dark_block = block(r':root\[data-theme="dark"\]\s*\{(?P<body>.*?)\n\}')

root_vars = vars_from(root_block)
dark_vars = vars_from(dark_block)

expected_root = tokens.get("root")
expected_dark = tokens.get("dark")

if not isinstance(expected_root, dict) or not expected_root:
    raise SystemExit("tokens.json root section missing or invalid")
if not isinstance(expected_dark, dict) or not expected_dark:
    raise SystemExit("tokens.json dark section missing or invalid")

errors: list[str] = []

for name, expected in sorted(expected_root.items()):
    key = name.replace("--", "")
    if key not in root_vars:
        errors.append(f"Missing root token in CSS: --{key}")
        continue
    if root_vars[key] != expected:
        errors.append(f"Root token drift for --{key}: css='{root_vars[key]}' expected='{expected}'")

for name, expected in sorted(expected_dark.items()):
    key = name.replace("--", "")
    if key not in dark_vars:
        errors.append(f"Missing dark token in CSS: --{key}")
        continue
    if dark_vars[key] != expected:
        errors.append(f"Dark token drift for --{key}: css='{dark_vars[key]}' expected='{expected}'")

if errors:
    print("Design token drift detected:")
    for item in errors:
        print(f"- {item}")
    raise SystemExit(1)

print("Design tokens are in sync.")
PY
