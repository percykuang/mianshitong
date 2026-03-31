# Web App

面试通主站。基于 Next.js App Router，负责用户侧页面、认证、聊天主链路与相关 API。

## 主要能力

- 登录/注册与游客身份
- 普通聊天与模拟面试
- 知识检索增强
- 聊天会话管理、消息编辑、反馈与额度展示

## 本地启动

在仓库根目录执行：

```bash
pnpm db:up
pnpm db:migrate:deploy
pnpm dev:web
```

默认地址：`http://127.0.0.1:3000`

## 关键目录

- `src/app`：路由与页面
- `src/app/api`：服务端路由
- `src/app/chat`：聊天页客户端逻辑、组件与 hooks
- `src/components`：跨页面共享组件
- `src/lib/server`：服务端策略、仓库层与检索/鉴权逻辑

## 常用命令

```bash
pnpm -C apps/web dev
pnpm -C apps/web build
pnpm -C apps/web lint
pnpm -C apps/web typecheck
```

E2E 请在仓库根目录执行：

```bash
pnpm test:e2e:web
```
