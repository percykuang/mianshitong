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

3. 配置同步

- 新增环境变量：同步更新 `env.example`（不要提交 `.env.local`）。
- 新增专有名词/缩写：同步更新 `cspell.json`（避免 CI 拼写检查失败）。

## 第三方库/框架的代码编写规范

当涉及第三方库/框架的代码编写与 API 使用时：

- 优先使用 Context7 MCP 查询“最新文档/最新 API”，再写代码与配置，避免使用过时知识。

## Git 规范

- Commit message：Conventional Commits（由 commitlint + husky 强制）。
- 参考：`docs/GitConventions.md`。
