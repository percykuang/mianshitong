# 生产部署落地清单

目的：把“如何把面试通第一次真实上线”收敛成一份可以逐项执行的清单。该清单与当前仓库中的部署骨架保持一致，适用于：

- 单台 Linux 服务器
- 自有域名
- GitHub 仓库
- 可配置镜像仓库（当前推荐阿里云 ACR）
- Docker Compose + Caddy

## 1. 执行顺序总览

按下面顺序做，不要跳步：

1. 服务器基础环境安装
2. 服务器部署目录初始化
3. 服务器生成生产 `.env.prod`
4. 准备镜像仓库（当前推荐 ACR 个人版）
5. GitHub Secrets 配置
6. DNS 配置
7. 手动触发第一次 deploy workflow
8. 验证 Web / Admin / HTTPS / 数据库迁移

补充说明：

- 当前 deploy 脚本默认只拉 `web/admin/migrate` 三个业务镜像
- 如需显式刷新 `caddy`，在服务器执行：

```bash
cd /opt/mianshitong
PULL_INFRA_IMAGES=1 IMAGE_TAG=main-latest bash scripts/deploy.sh
```

## 2. 服务器基础环境

假设服务器系统为 Ubuntu 22.04/24.04。

需要安装：

- Docker Engine
- Docker Compose Plugin

如果还没安装，可以先按官方推荐方式安装。

安装完成后验证：

```bash
docker --version
docker compose version
```

建议额外检查：

```bash
sudo systemctl status docker --no-pager
```

如果你希望日常部署不依赖 `sudo`，把部署用户加入 `docker` 组：

```bash
sudo usermod -aG docker <your_user>
```

然后重新登录 SSH 会话。

## 3. 服务器部署目录初始化

建议部署目录：

```bash
sudo mkdir -p /opt/mianshitong
sudo chown -R <your_user>:<your_user> /opt/mianshitong
```

进入目录后，后续 GitHub Actions 会同步这些文件：

- `compose.prod.yml`
- `Caddyfile`
- `scripts/deploy.sh`
- `scripts/rollback.sh`

但有一个文件需要你自己先创建：

- `.env.prod`

## 4. 服务器创建生产环境文件

当前 workflow 不会把 `.env.prod.example` 同步到服务器，所以这里请直接手写 `.env.prod`。

### 4.1 推荐的 `.env.prod` 模板

下面是基于你当前项目的建议值，你只需要把占位符换成真实值：

```env
IMAGE_NAMESPACE=crpi-xxxx.cn-hangzhou.personal.cr.aliyuncs.com/<your-namespace>
IMAGE_TAG=main-latest

WEB_DOMAIN=mianshitong.chat
ADMIN_DOMAIN=admin.mianshitong.chat

AUTH_SECRET=<生成一个长随机串>
ADMIN_AUTH_SECRET=<生成一个长随机串>
NEXTAUTH_URL=https://mianshitong.chat

POSTGRES_USER=mianshitong
POSTGRES_PASSWORD=<数据库强密码>
POSTGRES_DB=mianshitong
DATABASE_URL=postgresql://mianshitong:<数据库强密码>@db:5432/mianshitong?schema=public

LLM_PROVIDER=deepseek
EMBEDDING_PROVIDER=ollama
EMBEDDING_VERSION=v1
RUN_LLM_EVALS=0

OLLAMA_BASE_URL=http://host.docker.internal:11434
OLLAMA_MODEL=deepseek-r1:8b
OLLAMA_REASONER_MODEL=deepseek-r1:8b
OLLAMA_EMBED_MODEL=nomic-embed-text
OLLAMA_EMBED_DIMENSIONS=

DEEPSEEK_API_KEY=<你的 DeepSeek Key>
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
DEEPSEEK_REASONER_MODEL=deepseek-reasoner

ADMIN_ALLOWED_IPS=
```

### 4.2 如何生成随机 Secret

可以直接在服务器执行：

```bash
openssl rand -base64 48
```

至少生成两个不同的值：

- `AUTH_SECRET`
- `ADMIN_AUTH_SECRET`

## 5. 准备镜像仓库（当前推荐 ACR 个人版）

推荐原因：

- 你的生产服务器在中国内地
- 当前部署最慢的瓶颈是远端 `docker pull ghcr.io/...`
- 阿里云 ACR 对国内服务器拉取更稳定、通常也更快

当前建议：

- 个人项目 / MVP：先用 `ACR 个人版`
- 以后如果你要追求更稳定的线上保障，再切 `ACR 企业版`

注意：

- 阿里云官方当前说明里，`ACR 个人版` 为“公测限额免费”
- 但同样明确写了“仅限个人开发者使用、仅限开发测试、无 SLA”

### 5.1 你在阿里云控制台要做什么

1. 开通容器镜像服务 ACR
2. 创建个人版实例
3. 创建命名空间
4. 创建 3 个镜像仓库：
   - `mianshitong-web`
   - `mianshitong-admin`
   - `mianshitong-migrate`
5. 在 ACR 控制台生成固定登录密码

### 5.2 你需要记下的 4 个值

- `REGISTRY_HOST`
  - 例如：`crpi-xxxx.cn-hangzhou.personal.cr.aliyuncs.com`
- `REGISTRY_NAMESPACE`
  - 例如：`percykuang`
- `REGISTRY_USERNAME`
  - ACR 登录用户名
- `REGISTRY_PASSWORD`
  - ACR 固定登录密码

### 5.3 服务器还要不要手工 `docker login`

当前 deploy workflow 已支持：

- GitHub Runner 自动登录镜像仓库
- 通过 SSH 在服务器自动执行一次 `docker login`

所以：

- 正常自动部署时，不再要求你提前在服务器手工登录 ACR
- 只有排查拉取问题时，才建议你手工执行：

```bash
echo '<registry_password>' | docker login <registry_host> -u <registry_username> --password-stdin
```

## 6. GitHub Secrets 配置

在 GitHub 仓库的 `Settings -> Secrets and variables -> Actions` 中配置以下 secrets。

### 6.1 必填 Secrets

- `PROD_SSH_HOST`
  - 生产服务器公网 IP 或域名
- `PROD_SSH_PORT`
  - 一般是 `22`
- `PROD_SSH_USER`
  - 部署用 SSH 用户名
- `PROD_SSH_PRIVATE_KEY`
  - 对应部署用户的私钥内容
- `PROD_SSH_KNOWN_HOSTS`
  - 服务器 SSH host key
- `PROD_DEPLOY_PATH`
  - 例如 `/opt/mianshitong`
- `REGISTRY_HOST`
  - 例如：`crpi-xxxx.cn-hangzhou.personal.cr.aliyuncs.com`
- `REGISTRY_NAMESPACE`
  - 例如：`percykuang`
- `REGISTRY_USERNAME`
  - ACR 登录用户名
- `REGISTRY_PASSWORD`
  - ACR 固定登录密码

### 6.2 如何生成 `PROD_SSH_KNOWN_HOSTS`

在你本地机器执行：

```bash
ssh-keyscan -p 22 <your_server_ip>
```

把输出完整内容填进 `PROD_SSH_KNOWN_HOSTS`。

### 6.3 SSH 私钥说明

建议专门为部署创建一把 SSH key，不要复用你个人常用 key。

本地生成示例：

```bash
ssh-keygen -t ed25519 -f ~/.ssh/mianshitong_deploy -C "mianshitong deploy"
```

然后：

- 把 `~/.ssh/mianshitong_deploy.pub` 追加到服务器 `~/.ssh/authorized_keys`
- 把私钥内容写入 GitHub Secret `PROD_SSH_PRIVATE_KEY`

## 7. DNS 配置

在域名服务商控制台中配置：

- `A` 记录：`@ -> <server_ip>`
- `A` 记录：`admin -> <server_ip>`

或者使用等价的解析方式。

验证：

```bash
dig +short mianshitong.chat
dig +short admin.mianshitong.chat
```

两者都应指向你的服务器公网 IP。

## 8. 首次部署前的服务器准备

如果这是第一次部署，建议先在服务器上手动准备目录和权限：

```bash
cd /opt/mianshitong
mkdir -p scripts
chmod +x scripts/*.sh 2>/dev/null || true
```

注意：

- 第一次 workflow 执行时会同步 `deploy/` 下的文件到服务器
- `.env.prod` 不会被 workflow 自动覆盖，你需要自己保留并维护这个文件
- 第一次 workflow 执行时也会在服务器上自动执行一次镜像仓库登录

## 9. 第一次触发部署

建议第一次不要依赖 `push main` 自动触发，而是先手动触发：

GitHub:

- `Actions -> deploy -> Run workflow`

这样更适合首发排查。

## 10. 第一次部署后的验证

### 10.1 服务器容器状态

```bash
cd /opt/mianshitong
docker compose --project-name mianshitong-prod --env-file .env.prod -f compose.prod.yml ps
```

你需要看到至少这些服务：

- `db`
- `web`
- `admin`
- `caddy`

`migrate` 是一次性任务，不常驻。

### 10.2 健康检查

服务器本机验证：

```bash
curl -i http://127.0.0.1/api/health
```

这个命令对当前结构不一定直接命中，因为 Web/Admin 在容器内，建议优先用域名验证：

```bash
curl -i https://mianshitong.chat/api/health
curl -i https://admin.mianshitong.chat/api/health
```

期望返回：

```json
{
  "ok": true,
  "app": "web|admin",
  "status": "healthy"
}
```

### 10.3 页面验证

检查：

- `https://mianshitong.chat`
- `https://admin.mianshitong.chat/login`

重点确认：

- HTTPS 证书已签发
- 页面可正常访问
- 管理员登录可用

## 11. 常见问题排查

### 11.1 GitHub Actions 能构建成功，但服务器拉不到镜像

优先检查：

- `REGISTRY_HOST / REGISTRY_NAMESPACE / REGISTRY_USERNAME / REGISTRY_PASSWORD` 是否配置正确
- `.env.prod` 中的 `IMAGE_NAMESPACE` 是否和 registry 实际命名空间一致
- ACR 仓库是否已创建：
  - `mianshitong-web`
  - `mianshitong-admin`
  - `mianshitong-migrate`

### 11.2 Caddy 没拿到证书

优先检查：

- 域名 A 记录是否生效
- 80/443 是否放行
- 服务器时间是否正确

### 11.3 `migrate` 失败

优先检查：

- `DATABASE_URL`
- `db` 容器是否 healthy
- Prisma migration 文件是否齐全

### 11.4 Web/Admin 启动失败

优先检查：

- `.env.prod` 是否漏配
- `DEEPSEEK_API_KEY`
- `OLLAMA_BASE_URL`
- `DATABASE_URL`

### 11.5 Ollama 在宿主机，容器访问不到

当前 `compose.prod.yml` 已加：

```yaml
extra_hosts:
  - 'host.docker.internal:host-gateway'
```

但你仍需要保证：

- 宿主机上的 Ollama 正在监听
- 服务器防火墙/本机安全策略未阻断

可在服务器上验证：

```bash
curl http://127.0.0.1:11434/api/tags
```

## 12. 首次上线后建议立刻做的事

1. 创建管理员账号
2. 导入或准备一批题库数据
3. 执行 embedding 回填
4. 实测完整面试链路
5. 补数据库定时备份

## 13. 回滚方式

如果要回滚到历史镜像 SHA：

```bash
cd /opt/mianshitong
bash scripts/rollback.sh <old_git_sha>
```

前提是对应 SHA 镜像已经存在于当前镜像仓库中。

## 14. 你现在最该做的动作

按顺序执行：

1. 在服务器安装 Docker / Compose
2. 建 `/opt/mianshitong`
3. 创建 `.env.prod`
4. 在阿里云 ACR 创建实例/命名空间/仓库并拿到登录凭证
5. 配 GitHub Secrets
6. 配 DNS
7. 手动运行一次 `deploy` workflow

只要你完成这 7 步，我就可以继续帮你做第一次线上发布联调。
