#!/usr/bin/env bash
set -euo pipefail

VERSION="${GITLEAKS_VERSION:-8.19.3}"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"

os_raw="$(uname -s)"
arch_raw="$(uname -m)"

case "${os_raw}" in
  Darwin) os="darwin" ;;
  Linux) os="linux" ;;
  *)
    echo "Unsupported OS: ${os_raw}" >&2
    exit 1
    ;;
esac

case "${arch_raw}" in
  x86_64|amd64) arch="x64" ;;
  arm64|aarch64) arch="arm64" ;;
  *)
    echo "Unsupported architecture: ${arch_raw}" >&2
    exit 1
    ;;
esac

archive="gitleaks_${VERSION}_${os}_${arch}.tar.gz"
url="https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/${archive}"

tmp_dir="$(mktemp -d)"
trap 'rm -rf "${tmp_dir}"' EXIT

curl -fsSL "${url}" -o "${tmp_dir}/${archive}"
tar -xzf "${tmp_dir}/${archive}" -C "${tmp_dir}"

if [ ! -f "${tmp_dir}/gitleaks" ]; then
  echo "Downloaded archive did not contain gitleaks binary." >&2
  exit 1
fi

if [ -w "${INSTALL_DIR}" ]; then
  install -m 0755 "${tmp_dir}/gitleaks" "${INSTALL_DIR}/gitleaks"
elif command -v sudo >/dev/null 2>&1; then
  sudo install -m 0755 "${tmp_dir}/gitleaks" "${INSTALL_DIR}/gitleaks"
else
  fallback_dir="${HOME}/.local/bin"
  mkdir -p "${fallback_dir}"
  install -m 0755 "${tmp_dir}/gitleaks" "${fallback_dir}/gitleaks"
  echo "Installed to ${fallback_dir}/gitleaks"
  echo "Add '${fallback_dir}' to PATH before running security gates."
fi

gitleaks version
