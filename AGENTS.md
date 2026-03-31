# AGENTS.md（面试通 / mianshitong）

目的：把“如何在本仓库协作/迭代”的约定写清楚，避免做完改动忘记补文档或破坏工程规范。

## 基本约定

- 总是使用中文沟通与书写（代码注释按需）。
- 做到“先骨架后业务”：任何业务逻辑落地前，先保证规范/工具链可运行。
- 前后端分离以“职责边界分离”为准，不强制不同进程/仓库部署（当前形态为 Next.js BFF）。
- 开始任何实现/改动前：必须先阅读 `docs/ProjectContext.md`（以及必要时 `docs/IterationLog.md`），确保理解最新架构结论、约束与未决事项，避免上下文丢失或重复讨论。
- 每次实现一个功能前，都和用户沟通各种可行方案，同时推荐某个方案，并给出理由，同时需要考虑性能以及扩展性。

## 每次改动后的必做清单（重要）

1. 更新文档（至少二选一，通常都要更新）

- `docs/IterationLog.md`：追加一条记录（目标/主要改动/迁移/下一步）。
- `docs/ProjectContext.md`：如涉及架构/关键决定/约束变化，补充到“对话摘要日志”。

2. 自检命令（尽量全跑）

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm spellcheck
```

- 对任何实际代码、配置、脚本、文档改动，默认在交付前主动执行上述 5 条检查；除非用户明确说明“不需要跑命令”或当前任务仅要求只读分析。
- 优先使用统一入口 `pnpm verify`，避免遗漏单项检查。
- 对任何影响 Web/Admin 交互、页面行为、聊天链路、流式输出或用户可见流程的改动，交付前默认还需要使用 Playwright 做至少一轮对应自测。
- 若仓库里已有对应 Playwright 用例，优先直接运行并汇报结果；若没有现成用例，至少做一轮手动 Playwright 浏览器验证，并在交付说明里写清验证路径。

3. 配置同步

- 新增环境变量：同步更新 `env.example`（不要提交 `.env.local`）。
- 新增专有名词/缩写：同步更新 `cspell.json`（避免 CI 拼写检查失败）。

## Playwright 自测命令模板

- Web 全量 E2E：

```bash
pnpm test:e2e:web
```

- Admin 全量 E2E：

```bash
pnpm test:e2e:admin
```

- 只回归某一条 Web 用例：

```bash
PLAYWRIGHT_SCOPE=web pnpm test:e2e:web --grep '<用例名关键字>'
```

- 只回归某一条 Admin 用例：

```bash
PLAYWRIGHT_SCOPE=admin pnpm test:e2e:admin --grep '<用例名关键字>'
```

- 已有本地服务时跳过 Playwright 自动拉起 WebServer：

```bash
PLAYWRIGHT_SKIP_WEBSERVER=1 pnpm test:e2e:web --grep '<用例名关键字>'
```

- 选择命令时的默认原则：
  - 能精确命中本次改动影响面的，优先跑对应 `--grep` 用例。
  - 改动影响范围较大或没有现成细粒度用例时，优先跑对应端的全量 E2E。
  - 若本地已有手动启动的服务，为避免端口冲突，可显式加 `PLAYWRIGHT_SKIP_WEBSERVER=1`。

## 第三方库/框架的代码编写规范

当涉及第三方库/框架的代码编写与 API 使用时：

- 优先使用 Context7 MCP 查询“最新文档/最新 API”，再写代码与配置，避免使用过时知识。

## Git 规范

- Commit message：Conventional Commits（由 commitlint + husky 强制）。
- 参考：`docs/GitConventions.md`。
