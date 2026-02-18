#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

SIZE_GUARD_MODE="${SIZE_GUARD_MODE:-changed}"

resolve_base_ref() {
  if [ -n "${BASE_REF:-}" ]; then
    echo "${BASE_REF}"
    return
  fi
  if [ -n "${GITHUB_BASE_REF:-}" ]; then
    if git rev-parse --verify "origin/${GITHUB_BASE_REF}" >/dev/null 2>&1; then
      echo "origin/${GITHUB_BASE_REF}"
      return
    fi
    if git rev-parse --verify "${GITHUB_BASE_REF}" >/dev/null 2>&1; then
      echo "${GITHUB_BASE_REF}"
      return
    fi
  fi
  for candidate in origin/main origin/master main master; do
    if git rev-parse --verify "${candidate}" >/dev/null 2>&1; then
      echo "${candidate}"
      return
    fi
  done
  echo ""
}

gather_changed_files() {
  local base_ref merge_base changed
  base_ref="$(resolve_base_ref)"
  if [ -n "${base_ref}" ]; then
    merge_base="$(git merge-base HEAD "${base_ref}" 2>/dev/null || true)"
    if [ -n "${merge_base}" ]; then
      changed="$(git diff --name-only "${merge_base}"...HEAD)"
    else
      changed="$(git diff --name-only)"
    fi
  else
    changed="$(git diff --name-only)"
  fi

  {
    printf '%s\n' "${changed}"
    git diff --name-only
    git diff --name-only --cached
    git ls-files --others --exclude-standard
  } | sed '/^$/d' | sort -u
}

gather_all_files() {
  git ls-files | sed '/^$/d' | sort -u
}

if [ "${SIZE_GUARD_MODE}" = "all" ]; then
  FILES="$(gather_all_files)"
else
  FILES="$(gather_changed_files)"
fi

if [ -z "${FILES}" ]; then
  echo "No files to evaluate for size limits."
  exit 0
fi

declare -a VIOLATIONS=()

while IFS= read -r file; do
  [ -z "${file}" ] && continue
  [ ! -f "${file}" ] && continue

  limit=0

  if [[ "${file}" =~ ^frontend/src/ ]] || [[ "${file}" =~ ^backend/app/ ]]; then
    limit=700
  fi

  if [[ "${file}" =~ ^frontend/src/pages/(GoodsIssuePage|StockTransferPage|ShippingPage|PurchasingPage|InterWarehouseTransferPage|ReturnsPage|ReportsPage|ProductFormPage|GoodsReceiptPage)\.tsx$ ]]; then
    limit=450
  fi

  if [[ "${file}" =~ ^frontend/src/pages/.*Workspace\.tsx$ ]]; then
    limit=450
  fi

  if [[ "${file}" =~ ^backend/app/routers/.*\.py$ ]]; then
    limit=450
  fi

  if [ "${limit}" -eq 0 ]; then
    continue
  fi

  lines="$(wc -l < "${file}" | tr -d ' ')"
  if [ "${lines}" -gt "${limit}" ]; then
    VIOLATIONS+=("${file}: ${lines} lines (limit ${limit})")
  fi
done <<EOF
${FILES}
EOF

if [ "${#VIOLATIONS[@]}" -gt 0 ]; then
  echo "File size limit violations:"
  printf '  - %s\n' "${VIOLATIONS[@]}"
  echo
  echo "Fix by splitting files into container/view/hook/service modules before merge."
  exit 1
fi

echo "File size limits check passed (${SIZE_GUARD_MODE} mode)."
