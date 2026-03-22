#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ $# -lt 1 ]]; then
  echo "用法：bash scripts/rollback.sh <image_tag>" >&2
  exit 1
fi

IMAGE_TAG="$1" bash "$SCRIPT_DIR/deploy.sh"
