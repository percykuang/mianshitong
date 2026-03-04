# 环境变量配置（开发 / 线上）

本项目采用“同名变量，不同值”的配置策略，应用代码只读取一套变量名。

## 本地开发

1. 复制模板：

```bash
cp env.example .env.local
```

2. 按需修改：
   - 本地模型：`LLM_PROVIDER=ollama`
   - 付费 API：`LLM_PROVIDER=deepseek` 并填写 `DEEPSEEK_API_KEY`

## 线上部署（Docker Compose 示例）

1. 在服务器上创建私有环境文件（不要提交到仓库）：

```bash
cat >/opt/mianshitong/.env.prod <<'EOF'
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=your_prod_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_REASONER_MODEL=deepseek-reasoner
EOF
```

2. 在 `compose.yaml` 中挂载：

```yaml
services:
  web:
    env_file:
      - /opt/mianshitong/.env.prod
```

3. 重启服务生效：

```bash
docker compose up -d
```

## 变量说明

- `LLM_PROVIDER`：`ollama` 或 `deepseek`
- `OLLAMA_*`：本地/私有模型配置
- `DEEPSEEK_*`：付费 API 配置
