# 生产自动部署设计稿

目的：为面试通设计一条接近真实公司项目的自动化上线链路。目标不是“能手工部署”，而是满足以下要求：

- `main` 分支合入后可自动触发线上部署
- 构建、测试、发布、部署职责分离
- 生产机不参与源码构建，只负责拉取镜像和运行容器
- 支持数据库迁移、失败回滚、基础审计与后续扩展

## 1. 当前约束

- 你已具备：
  - 自有域名
  - 自有 Linux 服务器
  - GitHub 仓库
  - 现有 CI：[`ci.yml`](/Users/percy/Desktop/mianshitong/.github/workflows/ci.yml)
  - 现有镜像构建基础：[`Dockerfile`](/Users/percy/Desktop/mianshitong/Dockerfile)
- 当前系统形态：
  - `apps/web`：C 端主站
  - `apps/admin`：后台管理
  - `packages/db`：Prisma + PostgreSQL
  - Web/Admin 都是 Next.js standalone 运行形态
- 部署目标：
  - 单服务器单生产环境先落地
  - 后续可扩展 `staging`

## 2. 方案比较

### 方案 A：服务器直接 `git pull` 构建部署

- 流程：GitHub Actions 通过 SSH 登录服务器，执行 `git pull && pnpm install && pnpm build && docker compose restart`
- 优点：
  - 实现快
  - 初期心智负担小
- 缺点：
  - 生产机直接参与构建，环境漂移风险高
  - 构建速度依赖服务器状态
  - 回滚差
  - 工程展示价值有限

### 方案 B：GitHub Actions 构建镜像，推送 GHCR，服务器拉镜像部署

- 流程：CI 通过后，GitHub Actions 构建并推送镜像到 GitHub Container Registry，服务器只执行 `docker compose pull` 和 `docker compose up`
- 优点：
  - 构建与部署职责分离
  - 回滚简单
  - 容易做版本审计
  - 非常接近真实团队常见做法
- 缺点：
  - 需要额外设计镜像命名、部署脚本、镜像凭证

### 方案 C：生产机作为 self-hosted runner

- 流程：给服务器安装 GitHub self-hosted runner，合入 `main` 后直接在生产机执行 workflow
- 优点：
  - 连接服务器资源直接
  - 部署脚本简单
- 缺点：
  - 生产机暴露给 CI 任务，安全边界差
  - runner 环境不是一次性干净实例，容易污染
  - 不适合作为第一版生产标准方案

## 3. 推荐结论

选择方案 B：

`GitHub Actions -> GHCR -> 服务器 Docker Compose -> Caddy`

推荐原因：

- 最符合你当前仓库形态，不需要重做应用结构
- 足够接近真实公司的自动化上线流程
- 构建留在 GitHub-hosted runner，部署留在生产机，职责明确
- 后续要加 `staging`、回滚、蓝绿发布时，迁移成本低

## 4. 目标拓扑

```text
GitHub PR / Merge to main
        |
        v
GitHub Actions
  - ci
  - build & push images to GHCR
  - ssh trigger deploy on server
        |
        v
Production Server
  - caddy
  - web
  - admin
  - db
  - optional backup job
        |
        v
Users
  - https://mianshitong.chat
  - https://admin.mianshitong.chat
```

## 5. 生产环境设计

### 5.1 域名规划

- `mianshitong.chat`：Web 主站
- `admin.mianshitong.chat`：Admin 后台

DNS 设计：

- 两个域名都指向同一台生产服务器公网 IP
- 服务器只开放 `80/443`
- PostgreSQL 不对公网暴露

### 5.2 反向代理

推荐使用 Caddy。

原因：

- 自动 HTTPS，省去证书申请和续期脚本
- 配置比 Nginx 更轻
- 单机双域名场景非常适合

职责：

- `mianshitong.chat -> web:3000`
- `admin.mianshitong.chat -> admin:3000`

### 5.3 容器职责

生产机上的服务建议如下：

- `caddy`
- `web`
- `admin`
- `db`
- `migrate`：只在部署时按需执行，不常驻

说明：

- `web/admin` 通过 Docker 内网访问数据库
- `db` 使用独立 volume 持久化
- `caddy` 单独持久化证书与配置数据

## 6. 镜像设计

### 6.1 镜像命名

推荐命名：

- `ghcr.io/<owner>/mianshitong-web`
- `ghcr.io/<owner>/mianshitong-admin`
- `ghcr.io/<owner>/mianshitong-migrate`

### 6.2 Tag 策略

推荐同时打两类 tag：

- 不可变 tag：
  - `${GIT_SHA}`
- 可读 tag：
  - `main-latest`

部署时建议生产环境固定使用 `${GIT_SHA}`，不要只用 `latest`。

原因：

- 回滚明确
- 审计明确
- 不会因为覆盖 tag 造成“当前线上到底跑了哪个版本”不清楚

## 7. CI/CD 流程设计

### 7.1 总体流程

1. 开发分支提 PR
2. 现有 CI 执行：
   - `format`
   - `lint`
   - `typecheck`
   - `test`
   - `spellcheck`
   - `admin-e2e`
   - `web-e2e`
3. 分支保护要求上述检查全部通过后才允许合入 `main`
4. 合入 `main` 后触发独立 `deploy.yml`
5. `deploy.yml` 构建并推送镜像到 GHCR
6. `deploy.yml` 通过 SSH 登录服务器执行部署脚本
7. 服务器拉取指定 SHA 镜像，执行数据库迁移，再更新 `web/admin`
8. 健康检查通过后标记部署成功

### 7.2 为什么 deploy 与 ci 分开

推荐把部署单独放到 `.github/workflows/deploy.yml`，而不是直接塞进现有 `ci.yml`。

原因：

- CI 与生产部署职责不同
- 部署可以支持 `workflow_dispatch`
- 部署失败时可以单独重试，不需要重跑所有测试
- 更符合真实团队的职责分离

## 8. GitHub 配置设计

### 8.1 分支保护

建议对 `main` 开启：

- 必须通过 PR 合并
- 必须通过状态检查
- 禁止直接 push

这样可以保证“自动部署”的前提是“合入 main 的代码已经过质量门禁”。

### 8.2 Deploy Workflow 触发条件

推荐：

- `push` 到 `main`
- `workflow_dispatch`

这样既能自动发版，也支持手动重发。

### 8.3 GitHub Environment

推荐创建：

- `production`

用途：

- 记录部署历史
- 承载生产 secrets / vars
- 后续可加审批或分支限制

注意：

- GitHub 官方文档说明，私有仓库在 GitHub Free 下对 environment secrets / protection rules 有可用性限制
- 如果你当前是私有仓库且账号计划不支持，可以先退回使用 repository secrets

## 9. Secrets 与变量设计

### 9.1 GitHub Secrets

GitHub 侧建议准备：

- `PROD_SSH_HOST`
- `PROD_SSH_PORT`
- `PROD_SSH_USER`
- `PROD_SSH_PRIVATE_KEY`
- `PROD_DEPLOY_PATH`

说明：

- 部署 workflow 通过 SSH 连接生产服务器
- workflow 本身不需要知道数据库密码，只需要触发服务器上的部署动作

### 9.2 服务器本地 Secrets

服务器上建议在部署目录放独立的生产环境文件，例如：

- `/opt/mianshitong/.env.prod`

包括：

- `DATABASE_URL`
- `AUTH_SECRET`
- `ADMIN_AUTH_SECRET`
- `NEXTAUTH_URL`
- `LLM_PROVIDER`
- `EMBEDDING_PROVIDER`
- `OLLAMA_*`
- `DEEPSEEK_*`

以及镜像拉取所需：

- 服务器本机执行一次 `docker login ghcr.io`

如果镜像是私有的：

- 服务器拉取 GHCR 私有镜像通常需要 `read:packages` 的 PAT classic
- 这个凭证建议只存服务器，不经由每次 workflow 传输

## 10. 数据库迁移策略

这是部署设计里最重要的部分之一。

### 10.1 推荐方案

使用独立 `migrate` 镜像，在部署时先执行：

1. `docker compose pull`
2. `docker compose run --rm migrate`
3. `docker compose up -d --wait web admin caddy`

原因：

- 迁移动作被纳入镜像交付链
- 不依赖服务器本地 Node/pnpm/源码
- 更符合“镜像即交付物”

### 10.2 为什么不推荐在服务器上直接跑 `pnpm prisma migrate deploy`

- 生产机需要保留源码和构建工具
- 容易出现“镜像版本”和“迁移代码版本”不一致
- 可审计性差

## 11. 服务器目录设计

建议目录：

```text
/opt/mianshitong/
  compose.prod.yml
  Caddyfile
  .env.prod
  scripts/
    deploy.sh
    rollback.sh
    backup-db.sh
  backups/
```

说明：

- 仓库源码不需要长期驻留在生产机
- 生产机只保存部署编排文件、运行时环境和备份

## 12. 部署脚本设计

部署脚本应满足：

- 幂等
- 可重复执行
- 输出清晰
- 失败时中止

推荐动作顺序：

1. 切换到部署目录
2. 导入 `.env.prod`
3. `docker compose pull web admin migrate caddy`
4. `docker compose run --rm migrate`
5. `docker compose up -d --remove-orphans --wait web admin caddy`
6. 本地健康检查
7. 输出当前部署 SHA

为什么使用 `docker compose pull` + `docker compose up --wait`：

- Docker 官方文档说明 `pull` 只拉镜像，不启动容器
- `up --wait` 会等待服务达到 `running|healthy`

## 13. 健康检查设计

为了让自动部署更可靠，建议后续补两个健康检查端点：

- Web：
  - `/api/health`
- Admin：
  - `/api/health`

检查项建议最小化：

- 进程存活
- 应用可响应
- 可选：数据库连接是否可用

在没有独立健康端点之前，可以临时退化为：

- `GET /`
- `GET /login`

但这不如专用健康端点稳定。

## 14. 回滚设计

### 14.1 最小可用回滚

回滚逻辑建议基于镜像 SHA：

1. 记录上一次成功部署的 SHA
2. 部署失败时把 `compose.prod.yml` 或环境变量中的镜像 tag 切回旧 SHA
3. `docker compose up -d`

### 14.2 为什么回滚不能只靠 `main-latest`

- `main-latest` 会被覆盖
- 回滚时无法精确定位旧版本

所以生产部署一定要基于不可变 SHA tag。

## 15. 备份与运维

### 15.1 数据库备份

推荐从第一天就做：

- 每日 `pg_dump`
- 备份文件同步到对象存储或另一台机器
- 至少保留最近 7 到 14 天

### 15.2 日志

第一期可以先用：

- `docker compose logs`
- GitHub Actions deployment logs

第二期再考虑：

- Sentry
- Loki / Promtail / Grafana
- Uptime Kuma

## 16. 安全建议

- 服务器只开放 `22/80/443`
- PostgreSQL 不开放公网
- SSH 只允许密钥登录
- 部署用户尽量专用，不直接用日常账号
- 生产 secrets 只放服务器，不写入仓库
- 如果仓库是私有的，GHCR 镜像拉取权限单独控制

## 17. 分阶段落地计划

### 阶段 1：最小生产自动部署

目标：先把“merge main 自动上线”跑通。

需要新增：

- `.github/workflows/deploy.yml`
- `deploy/compose.prod.yml`
- `deploy/Caddyfile`
- `scripts/deploy-remote.sh`
- `scripts/rollback-remote.sh`

并补齐：

- 生产环境变量约定
- 服务器初始化文档
- 基础健康检查

### 阶段 2：生产加固

- `staging` 环境
- GitHub `production` environment 审批
- 更清晰的发布记录
- 数据库自动备份
- 监控告警

### 阶段 3：更像成熟团队

- 蓝绿发布
- 零停机切换
- 自动回滚
- SBOM / provenance
- 更完整的运行指标

## 18. 针对当前仓库的实现注意事项

在正式落地前，需要先补几处与当前仓库直接相关的工程问题：

1. [`Dockerfile`](/Users/percy/Desktop/mianshitong/Dockerfile) 当前清单仍需同步最新 workspace 依赖
   - 当前构建链路已经依赖：
     - `packages/retrieval`
     - `packages/agent-skills`
   - 镜像构建前需要确认 manifests 与源码复制范围完整，否则生产构建可能失败
2. 当前还没有专用健康检查路由
3. 当前还没有生产专用 compose / Caddy 编排文件
4. 当前 Prisma 迁移还没有被封装成独立 `migrate` 镜像

## 19. 推荐的下一步实现顺序

1. 先补部署骨架文件：
   - `deploy/compose.prod.yml`
   - `deploy/Caddyfile`
   - `.github/workflows/deploy.yml`
2. 再补镜像与迁移能力：
   - 修正 Dockerfile 依赖复制范围
   - 增加 `migrate` 镜像/服务
3. 再补应用健康检查接口
4. 最后连通服务器与域名，做第一次真实自动发布

## 19.1 当前实现进度

当前仓库已经补齐第一版部署骨架：

- 已有：
  - `deploy/compose.prod.yml`
  - `deploy/Caddyfile`
  - `deploy/.env.prod.example`
  - `deploy/scripts/deploy.sh`
  - `deploy/scripts/rollback.sh`
  - `.github/workflows/deploy.yml`
  - Web/Admin `/api/health`
  - Docker `migrator` 目标
- 尚未完成：
  - 服务器初始化
  - 生产 `.env.prod`
  - GHCR 登录
  - GitHub Secrets 配置
  - 第一次真实域名发布验证

## 20. 参考资料

以下设计基于官方文档能力边界整理：

- GitHub Actions Deployment Environments
  - https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments
- GitHub Actions 管理 Environment
  - https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments
- GitHub Deployments and Environments
  - https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments
- GitHub 发布 Docker 镜像
  - https://docs.github.com/actions/guides/publishing-docker-images
- GitHub Container Registry
  - https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry
- Docker GitHub Actions
  - https://docs.docker.com/build/ci/github-actions/
- Docker Compose Pull
  - https://docs.docker.com/reference/cli/docker/compose/pull/
- Docker Compose Up
  - https://docs.docker.com/reference/cli/docker/compose/up/
- Caddy Automatic HTTPS
  - https://caddyserver.com/docs/automatic-https
