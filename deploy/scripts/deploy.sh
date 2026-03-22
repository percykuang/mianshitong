#!/usr/bin/env bash

set -euo pipefail

PROJECT_NAME="mianshitong-prod"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$DEPLOY_ROOT/compose.prod.yml"
ENV_FILE="$DEPLOY_ROOT/.env.prod"
IMAGE_TAG_VALUE="${1:-${IMAGE_TAG:-}}"

if [[ -z "$IMAGE_TAG_VALUE" ]]; then
  echo "缺少 IMAGE_TAG。用法：IMAGE_TAG=<git_sha> bash scripts/deploy.sh" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  echo "缺少 $ENV_FILE，请先在服务器上创建生产环境文件。" >&2
  exit 1
fi

export IMAGE_TAG="$IMAGE_TAG_VALUE"

compose() {
  docker compose \
    --project-name "$PROJECT_NAME" \
    --env-file "$ENV_FILE" \
    -f "$COMPOSE_FILE" \
    "$@"
}

echo "[deploy] 拉取镜像..."
compose pull web admin migrate caddy

echo "[deploy] 启动数据库..."
compose up -d --wait db

echo "[deploy] 执行 Prisma migrate deploy..."
compose run --rm migrate

echo "[deploy] 启动应用与代理..."
compose up -d --remove-orphans --wait web admin caddy

echo "[deploy] 当前状态："
compose ps

echo "[deploy] 发布完成，IMAGE_TAG=$IMAGE_TAG"
