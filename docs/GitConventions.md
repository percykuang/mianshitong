# Git 规范（面试通 / mianshitong）

## Commit 规范（Conventional Commits）

本项目使用 commitlint + husky 强制提交信息符合 Conventional Commits。

推荐格式：

```text
<type>(<scope>): <subject>
```

常用 `type`：

- feat: 新功能
- fix: 修复 bug
- docs: 文档变更
- chore: 杂项（构建脚本/依赖/工具链）
- refactor: 重构（不改变外部行为）
- test: 测试相关
- ci: CI 配置

示例：

```text
feat(interview): add session state machine skeleton
fix(web): handle empty config
docs: update PRD
chore: bump deps
```

## Hooks

- pre-commit：运行 `lint-staged`（主要做 Prettier 格式化）
- commit-msg：运行 `commitlint` 校验提交信息
