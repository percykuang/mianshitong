# 迭代改动记录（面试通 / mianshitong）

目的：长期项目需要可追溯性。这里记录“每次迭代我们做了什么功能/改动”，便于回看进度、定位回归、规划下一步。

约定：

- 每次完成一个可运行增量（哪怕很小），就在顶部追加一条新记录（新在上）。
- 每条记录尽量包含：目标、主要改动、破坏性变更/迁移、下一步。

---

## Iteration 2.48（2026-03-06）：聊天页对齐 zhitalk（删除交互 + 游客本地存储 + 登录态 DB 存储）

### 目标

- 对齐聊天页交互：
  - 去掉右上角锁图标与私有切换能力；
  - 侧栏支持“删除全部会话”和“单条会话删除”；
  - 游客会话落浏览器 IndexDB，登录用户会话落 PostgreSQL。

### 主要改动

- 聊天页 UI 与交互调整：
  - 移除 `ChatHeader` 的锁图标按钮及对应切换逻辑；
  - 侧栏头部将设置图标替换为删除图标（`title/aria-label: 删除所有聊天记录`），点击执行全部删除；
  - 侧栏会话项改为 hover 显示右侧删除图标，支持单条删除。
- 游客本地会话存储（IndexDB）：
  - 新增本地会话仓库：`chat-local-storage.ts`（`list/get/save/delete/clear`）；
  - 新增本地会话构建与流式上下文工具：`chat-local-session.ts`；
  - 新增游客发送/编辑流式 hooks：`use-local-send-message.ts`、`use-local-edit-message.ts`；
  - 游客模式下刷新页面后，会话可从本地恢复。
- 登录用户数据库会话存储（PostgreSQL + Prisma）：
  - Prisma 新增 `ChatSessionRecord` 模型，并关联 `AuthUser`；
  - 新增迁移：`20260306035454_add_chat_session_record`；
  - 聊天 API 路由改为鉴权后读写 DB（含列表、详情、单删、全删、流式发送、流式编辑）。
- 新增游客无状态流式接口：
  - `POST /api/chat/stream`，接收游客本地上下文 `messages`，仅做模型流式返回，不落库。
- 水合稳定性修复：
  - 为聊天页模型选择器增加 SSR 安全渲染策略，清除登录态下 Radix Select 的 hydration warning。

### 迁移/破坏性变更

- `GET/POST/DELETE /api/chat/sessions` 及相关子路由现在要求登录态（未登录返回 `401`）。
- 游客模式不再依赖服务端会话列表接口，改为浏览器 IndexDB 本地持久化。

### 下一步

- 如需更完整对齐 zhitalk，可继续补“删除确认弹窗”和“游客登录后本地会话一键导入账号”。

## Iteration 2.47（2026-03-06）：修复聊天页误显示 system 欢迎语

### 目标

- 修复 `/chat` 点击快捷提问后，消息列表额外显示“欢迎语”导致的对话内容错位问题。

### 主要改动

- 前端消息渲染层增加可见消息过滤：
  - `apps/web/src/app/chat/components/chat-message-list.tsx` 新增 `visibleMessages`；
  - 对 `role === 'system'` 或 `kind === 'system'` 的消息不再渲染到对话区。
- 加载态判断同步对齐：
  - `isLoading` 的末条消息判断改为基于 `visibleMessages`，避免隐藏消息干扰 loading 气泡定位。
- 回归验证：
  - `pnpm -C apps/web lint`、`pnpm -C apps/web typecheck` 通过；
  - Playwright 实测点击“可以帮我优化简历吗？”后，仅显示用户消息与 AI 回复，不再出现 system 欢迎语。

### 迁移/破坏性变更

- 无接口变化；仅调整前端展示层消息过滤逻辑。

### 下一步

- 若你希望侧边栏会话摘要也隐藏 system 内容，可进一步在 summary 计算处过滤首条 system 消息。

## Iteration 2.46（2026-03-06）：修复 `schema.prisma` 的 Prisma 7 配置报错

### 目标

- 消除 `schema.prisma` 中 `datasource.url` 的 Prisma 7 报错，并保持现有 PostgreSQL 认证链路可用。

### 主要改动

- Prisma 升级到 v7：
  - `packages/db` 升级为 `prisma@7.4.2`、`@prisma/client@7.4.2`；
  - 新增 `@prisma/adapter-pg@7.4.2` 与 `pg@8.16.3`。
- 配置迁移到 `prisma.config.ts`：
  - 新增 `packages/db/prisma.config.ts`，在配置文件中声明 `datasource.url`；
  - `packages/db/prisma/schema.prisma` 的 `datasource db` 移除 `url` 字段，仅保留 `provider`。
- Prisma Client 初始化方式调整：
  - `packages/db/src/client.ts` 从 `datasources.db.url` 切换为 `PrismaPg adapter` 注入连接串；
  - 保留既有开发默认连接串与生产环境显式配置校验逻辑。
- 回归验证：
  - `pnpm db:migrate` 在 PostgreSQL 下可正常执行（`Already in sync`）；
  - `packages/db` 与 `apps/web` typecheck 均通过。

### 迁移/破坏性变更

- Prisma 运行时模型从“schema 内 `datasource.url` + Client datasources”迁移为“`prisma.config.ts` + `adapter`”。

### 下一步

- 若你希望进一步收敛，可以把 `packages/db` 内部 `prisma:*` 脚本也统一改为走根 `db:*` 包装脚本，减少入口分散。

## Iteration 2.45（2026-03-06）：修复“数据库删用户后仍保持登录态”问题

### 目标

- 当用户记录被删除后，刷新页面应自动退出登录，避免前端仍显示已登录态。

### 主要改动

- 服务端会话校验增强：
  - `apps/web/src/lib/server/auth-user-repository.ts` 新增 `findUserById`；
  - `apps/web/src/lib/server/auth-options.ts` 的 `session callback` 改为每次读取会话时校验 `token.sub` 对应用户是否仍存在；
  - 若用户不存在，清空 `session.user`，避免继续向客户端暴露已失效用户信息。
- 客户端自动清理会话 cookie：
  - `apps/web/src/components/guest-menu.tsx` 新增 effect：
    - 当 `status === 'authenticated'` 但 `session.user` 已为空时，自动执行 `signOut({ redirect: false })` 并 `router.refresh()`；
    - 保障前端状态与服务端真实用户状态一致。
- 回归验证：
  - 登录后手动删除 `AuthUser` 记录并刷新页面，已自动回到 `Guest`。

### 迁移/破坏性变更

- 无接口变化；仅会话有效性校验逻辑增强。

### 下一步

- 若后续需要减少每次 `session` 读取的数据库查询，可引入“短周期校验缓存”策略（例如 token 中记录最近校验时间）。

## Iteration 2.44（2026-03-06）：补齐 `db:migrate` / `db:reset` 数据库脚本

### 目标

- 在已有 `db:*` 基础上补齐“迁移更新”和“清库重建”能力，降低数据库维护门槛。

### 主要改动

- 根脚本增强：
  - 新增 `db:migrate`：执行 `prisma migrate dev`（按迁移更新数据库结构）；
  - 新增 `db:reset`：执行 `prisma migrate reset --force --skip-seed`（清空并按迁移重建）；
  - `db:studio` 改为“优先读取外部 `DATABASE_URL`，未配置时回退本地默认 PG URL”，提升环境兼容性。
- 文档更新：
  - `README.md` 新增 `db:migrate` / `db:reset` 使用说明与风险提示（`db:reset` 为危险操作）。
- 脚本验证：
  - `pnpm db:migrate` 已验证通过（当前提示 `Already in sync`）。

### 迁移/破坏性变更

- `db:reset` 会删除当前数据库数据，请仅在确认需要清库时使用。

### 下一步

- 若你需要，我可以再补一个 `db:seed` 和 `db:reset:seed` 脚本，把“重建 + 初始化测试账号”串成一条命令。

## Iteration 2.43（2026-03-06）：新增数据库一键脚本（启动/连接/查看数据）

### 目标

- 提供统一、低记忆成本的数据库操作入口，支持“快速启动 PostgreSQL 与查看当前数据”。

### 主要改动

- 在仓库根 `package.json` 新增 `db:*` 脚本：
  - `db:up`：启动 `compose` 中的 `db` 服务；
  - `db:down`：停止 `db` 服务；
  - `db:restart`：重启 `db`；
  - `db:status`：查看 `db` 容器状态；
  - `db:logs`：跟踪数据库日志；
  - `db:psql`：进入 PostgreSQL 命令行；
  - `db:studio`：启动 Prisma Studio；
  - `db:users`：快速查看最近 50 条 `AuthUser`。
- `README.md` 新增“数据库快捷命令（PostgreSQL）”章节，统一说明启动与查看数据方式。
- 已实测新脚本：
  - `pnpm db:status` 可正常返回容器健康状态；
  - `pnpm db:users` 可正常查询到当前用户数据。

### 迁移/破坏性变更

- 无破坏性变更；仅新增开发辅助命令。

### 下一步

- 若你希望进一步降低手工操作，可追加 `db:reset`（重建库）与 `db:migrate`（显式执行迁移）脚本。

## Iteration 2.42（2026-03-06）：认证数据层从 SQLite 切回 PostgreSQL

### 目标

- 按项目既定技术栈，把认证数据层从 SQLite 过渡实现切回 PostgreSQL，统一本地与后续线上环境形态。

### 主要改动

- Prisma 数据源切换：
  - `packages/db/prisma/schema.prisma` 的 `datasource db.provider` 从 `sqlite` 改为 `postgresql`；
  - `env.example` 的 `DATABASE_URL` 改为本地 compose 对应连接串：
    - `postgresql://mianshitong:mianshitong@127.0.0.1:5432/mianshitong?schema=public`
- Prisma 客户端连接策略收敛：
  - `packages/db/src/client.ts` 移除 SQLite 文件路径探测逻辑；
  - 统一优先读取 `DATABASE_URL`，开发环境无显式配置时回退到本地 PostgreSQL 默认连接串；
  - 非开发环境缺失 `DATABASE_URL` 时显式抛错，避免静默连错库。
- 迁移历史重建（Provider 切换要求）：
  - 清理旧的 SQLite 迁移历史与 `dev.db`；
  - 新建并应用 PostgreSQL 初始迁移：
    - `packages/db/prisma/migrations/20260306015753_init_auth_postgres/migration.sql`
  - `migration_lock.toml` 已更新为 `provider = "postgresql"`。

### 迁移/破坏性变更

- 本地开发需启动 PostgreSQL（可用 `compose.yaml` 的 `db` 服务）。
- 旧 SQLite 数据文件不再使用；若有历史测试数据，需按需导入到 PostgreSQL。

### 下一步

- 建议补一条认证 E2E（注册/登录/退出）在 PostgreSQL 环境下执行，防止回归。

## Iteration 2.41（2026-03-06）：修复首页/聊天页用户菜单潜在 hydration mismatch

### 目标

- 消除 `pnpm dev:web` 下偶发的 React hydration warning（SSR HTML 与客户端属性不一致）。

### 主要改动

- 定位并收敛 `GuestMenu` 的水合风险点：
  - `apps/web/src/components/guest-menu.tsx` 移除基于主题切换头像 `src` 的分支渲染；
  - 头像改为固定 `src` + `dark:invert` 样式，避免服务端与客户端首帧属性差异；
  - 保留主题切换逻辑，仅在菜单展开后读取 `resolvedTheme/theme` 计算目标主题。
- 参考 `next-themes` 文档“避免 hydration mismatch”的建议，统一采用“首帧不依赖不稳定主题属性”的渲染策略。
- Playwright 回归：
  - 首页与 `/chat` 首屏加载；
  - 强制深色媒体模式下再次加载；
  - 控制台均未出现 hydration warning。

### 迁移/破坏性变更

- 无接口变化，仅前端渲染细节调整。

### 下一步

- 若你本机浏览器仍提示 hydration mismatch，建议提供完整报错堆栈（含组件路径），我会继续定点清理其余触发源。

## Iteration 2.40（2026-03-06）：对齐 zhitalk 的注册/登录闭环并修复本地会话漂移

### 目标

- 参考 `zhitalk.chat` 落地 Email + Password 的注册/登录/退出流程，并保证本地开发（`127.0.0.1`）会话稳定。

### 主要改动

- 认证能力落地（Web + DB）：
  - `apps/web` 新增 NextAuth Credentials 配置与路由；
  - 新增 `/login`、`/register` 页面及复用认证卡片组件；
  - 新增 `/api/auth/register` 注册接口（`zod` 校验 + `bcryptjs` 哈希）；
  - `guest-menu` 接入真实会话状态，已登录显示邮箱并支持退出登录。
- 数据层落地（Prisma）：
  - `packages/db/prisma/schema.prisma` 新增 `AuthUser` 模型；
  - 新增 Prisma client 导出与迁移脚本，完成初始迁移。
- 本地稳定性修复：
  - 修复 `signIn/signOut` 在 `127.0.0.1` 与 `localhost` 间的回跳漂移，统一使用安全相对路径跳转；
  - `auth-options` 补充 `AUTH_SECRET` 读取与开发环境默认值，避免 `NO_SECRET/JWT_SESSION_ERROR`；
  - `env.example` 补充 `NEXTAUTH_URL`；
  - `cspell.json` 补充 `cuid`，恢复拼写检查通过。
- 回归验证（Playwright）：
  - 注册成功后自动登录并回首页；
  - 顶部菜单显示登录邮箱；
  - 退出后恢复 `Guest`；
  - 错误密码登录显示错误提示。

### 迁移/破坏性变更

- 新增认证相关环境变量：
  - `AUTH_SECRET`
  - `NEXTAUTH_URL`
  - `DATABASE_URL`

### 下一步

- 若要完全对齐线上部署，建议将 SQLite 切回项目既定 PostgreSQL，并补充认证 E2E 用例（注册/登录/退出/错误分支）。

## Iteration 2.39（2026-03-05）：回退 chat 局部 UI/编辑状态到 `useState`

### 目标

- 按“仅跨路由/跨层级共享状态才用全局状态”的约束，清理 chat 模块中不必要的 `zustand` 使用。

### 主要改动

- 保留会话域全局状态：
  - `apps/web/src/app/chat/stores/chat-session-store.ts` 继续使用 `zustand` 管理会话主状态（session/model/sending/loading）。
- 回退局部状态到组件内：
  - `apps/web/src/app/chat/hooks/use-chat-controller.ts` 新增本地 `useState` 管理 `inputValue/notice/toast/sidebarOpen/editingMessageId/editingValue`；
  - `apps/web/src/app/chat/hooks/use-chat-controller-store.ts` 收敛为仅聚合 `session` store，不再混入 UI/编辑域。
- 删除不再需要的 store：
  - 删除 `apps/web/src/app/chat/stores/chat-ui-store.ts`；
  - 删除 `apps/web/src/app/chat/stores/chat-edit-store.ts`。

### 迁移/破坏性变更

- 无接口破坏；仅状态管理实现方式调整（局部状态从 zustand 回退为 React 本地状态）。

### 下一步

- 若后续 chat 页面再次出现跨多个分支组件共享局部状态的场景，可优先考虑“局部 context + reducer”，再评估是否上升为 store。

## Iteration 2.38（2026-03-05）：补齐可点击图标/按钮的 `cursor-pointer`

### 目标

- 统一可点击元素的鼠标指针反馈，避免“可点但光标不提示”的交互不一致问题。

### 主要改动

- 全局按钮收敛：
  - `apps/web/src/components/ui/button.tsx` 的 `buttonVariants` 基类新增 `cursor-pointer`，覆盖绝大部分图标按钮与普通按钮。
- 原生按钮补齐：
  - `apps/web/src/components/guest-menu.tsx`：用户菜单触发按钮新增 `cursor-pointer`；
  - `apps/web/src/app/chat/components/chat-sidebar.tsx`：
    - 移动端侧栏遮罩关闭按钮新增 `cursor-pointer`；
    - 会话列表项按钮新增 `cursor-pointer`。

### 迁移/破坏性变更

- 无；仅样式交互提示增强。

### 下一步

- 若你希望范围扩大到 `apps/admin`，可按同样策略补齐后台可点击元素。

## Iteration 2.37（2026-03-05）：清理仓库根目录调试 PNG 截图

### 目标

- 清理未被项目引用的临时截图文件，减少仓库噪音。

### 主要改动

- 删除仓库根目录 3 个未引用的 PNG 文件：
  - `chat-after-send.png`
  - `chat-fixed-after-send.png`
  - `chat-fixed-before-send.png`
- 通过全局搜索确认当前仓库无 `.png` 文件残留，也无代码/文档引用这些截图。

### 迁移/破坏性变更

- 无；仅删除调试产物文件。

### 下一步

- 若后续仍会频繁产出调试截图，可考虑补充 `.gitignore` 规则（例如仅忽略约定命名的截图文件）。

## Iteration 2.36（2026-03-05）：修复发送后会话请求死循环并完成格式化清理

### 目标

- 解决 `/chat` 发送消息后出现“编译/页面持续刷新、请求死循环”的问题，并清理当前 Prettier 存量文件。

### 主要改动

- 死循环根因修复：
  - `apps/web/src/app/chat/hooks/use-chat-controller.ts` 中，传给 `useChatControllerEffects` 的 setter 由包装函数改为直接传递稳定引用（移除 render 期新建函数）；
  - 避免 `useChatControllerEffects` 初始化 effect 因依赖引用变化被重复触发，导致 `fetchSessions` 循环调用。
- 回归验证（Playwright）：
  - 打开 `/chat` 并发送一条消息后，网络请求恢复为预期链路（创建会话、拉会话、流式消息），未再出现 `/api/chat/sessions` 无限请求；
  - 页面未出现持续刷新现象。
- 格式化清理：
  - 已对此前 `format:check` 提示的 12 个文件执行 `prettier --write`；
  - `pnpm format:check` 已恢复通过。

### 迁移/破坏性变更

- 无接口破坏；仅修复 hooks 依赖稳定性与代码格式。

### 下一步

- 可继续补一条端到端用例（发送消息后断言不会重复请求会话列表）防止回归。

## Iteration 2.35（2026-03-05）：修复 chat 页 hydration mismatch（SSR 安全的 zustand 实例化）

### 目标

- 解决 `/chat` 页面出现的 hydration mismatch（服务端 HTML 属性与客户端初始属性不一致）报错。

### 主要改动

- 按 zustand 最新 Next.js 指南，把 chat 三个 store 从模块级全局 `create(...)` 改为实例工厂：
  - `apps/web/src/app/chat/stores/chat-session-store.ts`
  - `apps/web/src/app/chat/stores/chat-ui-store.ts`
  - `apps/web/src/app/chat/stores/chat-edit-store.ts`
  - 三个文件统一改为 `createStore`（`zustand/vanilla`）并导出 `*StoreApi` 类型。
- `apps/web/src/app/chat/hooks/use-chat-controller-store.ts` 改为组件实例级初始化：
  - 使用 `useState` 懒初始化 3 个 store API（每个 `ChatClient` 实例独立）；
  - 使用 `useStore(storeApi, selector)` 订阅状态，保留原有 selector 拆分与行为。
- 保持既有“多 store 拆分”结构，不回退到单体 store；关键文件仍控制在 200 行以内。

### 迁移/破坏性变更

- 无接口破坏；仅 store 初始化策略从“模块级共享”改为“组件实例级隔离”。

### 下一步

- 建议在本地启动 `apps/web` 后手动回归 `/chat` 的首屏与路由往返，确认 hydration 报错不再出现。

## Iteration 2.34（2026-03-05）：拆分 chat store 并收敛文件行数（<=200）

### 目标

- 解决“单一 chat store 过粗”和 `use-chat-controller.ts` 超 200 行的问题，按职责拆分状态管理并保持行为不变。

### 主要改动

- store 按职责拆分：
  - 新增 `apps/web/src/app/chat/stores/chat-session-store.ts`：会话域状态（session/model/sending/loading）；
  - 新增 `apps/web/src/app/chat/stores/chat-ui-store.ts`：UI 域状态（input/notice/toast/sidebar）；
  - 新增 `apps/web/src/app/chat/stores/chat-edit-store.ts`：编辑域状态（editingMessageId/editingValue）；
  - 新增 `apps/web/src/app/chat/stores/types.ts`（共享 `Updater` 类型）；
  - 删除旧的单体 `chat-store.ts`。
- 控制器继续模块化：
  - 新增 `apps/web/src/app/chat/hooks/use-chat-controller-store.ts` 统一聚合多 store selector；
  - 新增 `apps/web/src/app/chat/hooks/use-chat-controller-effects.ts` 管理初始化/响应式副作用；
  - 新增 `apps/web/src/app/chat/hooks/use-chat-controller-actions.ts` 管理事件处理器；
  - `apps/web/src/app/chat/hooks/use-chat-controller.ts` 收敛为组装层（153 行）。
- 行数约束结果：
  - `use-chat-controller.ts` 与新增模块文件均控制在 200 行以内，符合 AGENTS 约束。

### 迁移/破坏性变更

- 无接口破坏；仅状态管理结构调整（单 store -> 多 store）。

### 下一步

- 可继续按同样方式把 chat 子组件中的 props 进一步收敛，逐步减少跨层参数传递。

## Iteration 2.33（2026-03-05）：聊天页状态迁移到 zustand（全局状态收敛）

### 目标

- 在不改变现有业务行为的前提下，把聊天页分散的本地状态收敛为统一的全局状态管理，降低后续扩展成本。

### 主要改动

- 引入 zustand：
  - `apps/web/package.json` 新增依赖 `zustand`；
  - `apps/web/src/app/chat/stores/chat-store.ts` 新增 chat store，统一管理会话、输入、发送态、提示态、侧栏态、编辑态。
- 控制器改造：
  - `apps/web/src/app/chat/hooks/use-chat-controller.ts` 从 `useState` 迁移为基于 zustand 的 selector + actions（`useShallow`）；
  - 保留原有发送/编辑/复制业务逻辑，仅替换状态读写来源。
- 编辑态进一步收敛：
  - `apps/web/src/app/chat/ChatClient.tsx` 移除本地编辑状态，改为由 controller（底层 store）统一提供；
  - 新增 `start/cancel/submit` 编辑动作，避免页面层散落状态逻辑。
- 类型同步：
  - `apps/web/src/app/chat/hooks/chat-controller.types.ts` 补充编辑态与编辑动作类型，保证组件侧类型约束一致。

### 迁移/破坏性变更

- 无接口破坏；前端行为保持一致，仅状态管理实现方式从 React 本地状态改为 zustand。

### 下一步

- 可继续把 `ChatComposer` / `ChatMessageList` 逐步改为直接按 selector 读取 store，进一步减少 props drilling。

## Iteration 2.32（2026-03-05）：消息“就地编辑 + 复制 Toast”对齐参考交互

### 目标

- 使用 Playwright 对比参考 chat 页后，将用户消息“编辑/复制”行为对齐为更接近目标站点的交互体验。

### 主要改动

- 编辑交互改为“消息气泡内就地编辑”：
  - `apps/web/src/app/chat/components/chat-message-item.tsx` 新增编辑态（输入框 + `Cancel/Send`）；
  - `apps/web/src/app/chat/ChatClient.tsx` 增加编辑态管理；
  - `apps/web/src/app/chat/hooks/use-edit-message.ts` 新增编辑发送链路（流式）。
- 编辑后重生成能力补齐：
  - 新增 API：`apps/web/src/app/api/chat/sessions/[sessionId]/messages/[messageId]/edit/stream/route.ts`；
  - `apps/web/src/lib/server/chat-store.ts` 新增 `truncateSessionFromUserMessage`，用于从被编辑消息处截断会话，再基于新内容重生成后续回复。
- 流式能力复用与收敛：
  - 新增 `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/stream-utils.ts`，抽离 provider 选择、SSE 事件格式化等通用逻辑；
  - 新增 `apps/web/src/app/chat/hooks/stream-event-handler.ts`，统一前端 SSE 事件处理。
- 复制反馈对齐：
  - `apps/web/src/app/chat/hooks/use-chat-controller.ts` 增加短暂 toast 状态；
  - 复制成功/失败改为顶部短时 toast（`Copied to clipboard!` / `Copy failed...`），不再依赖底部文案提示。

### 迁移/破坏性变更

- 新增编辑流式接口路径：`/api/chat/sessions/:sessionId/messages/:messageId/edit/stream`。
- 旧的“编辑后回填到底部输入框”交互已替换为“消息气泡内就地编辑”。

### 下一步

- 可继续补齐“编辑中键盘快捷键（Enter 提交 / Shift+Enter 换行）”与操作按钮 hover 动效，以进一步贴近参考站点细节。

## Iteration 2.31（2026-03-05）：补齐用户消息“编辑/复制”交互

### 目标

- 修复聊天区用户消息的“编辑/复制”交互不可用或体验不一致问题，并向目标站点交互靠齐。

### 主要改动

- 编辑能力补齐：
  - `apps/web/src/app/chat/ChatClient.tsx` 新增输入框 ref；
  - 点击用户消息“编辑”后会把原文填入输入框，并自动聚焦到输入框末尾，便于直接改写重发。
- 复制能力增强：
  - `apps/web/src/app/chat/hooks/use-chat-controller.ts` 增加 `copyToClipboard`；
  - 优先使用 `navigator.clipboard`，在非安全上下文下自动回退到 `document.execCommand('copy')`，减少“点击复制无效果”问题。
- 组件能力补齐：
  - `apps/web/src/components/ui/textarea.tsx` 改为 `forwardRef`，支持从父组件进行聚焦与光标控制；
  - `apps/web/src/app/chat/components/chat-composer.tsx` 支持透传 `inputRef`。

### 迁移/破坏性变更

- 无；仅交互增强与兼容性修复。

### 下一步

- 可继续对齐“消息操作区”的 hover/显隐动画与反馈样式（例如 toast 样式与持续时间）。

## Iteration 2.30（2026-03-05）：修复 `tw-animate-css` 模块解析失败

### 目标

- 解决 `pnpm dev:web` 报错 `Module not found: Can't resolve 'tw-animate-css'`。

### 主要改动

- 根因修复：
  - `apps/web/src/app/globals.css` 的导入被自动改成 `@import url(...)` 后，包级 CSS 导入解析异常；
  - 已回退为 Tailwind v4 推荐写法：
    - `@import 'tailwindcss';`
    - `@import 'tw-animate-css';`
- 规则收敛：
  - `stylelint.strict.config.mjs` 将 `import-notation` 设为 `null`，避免严格修复再次把上述导入改坏。
- 验证：
  - 本地首页可正常返回 200，样式可编译输出（不再出现该模块找不到错误）。

### 迁移/破坏性变更

- 无；仅 CSS 导入写法与样式规则兼容性修复。

### 下一步

- 若后续继续做样式自动修复，优先保留 Tailwind v4 官方导入语法，避免与通用 CSS 规则冲突。

## Iteration 2.29（2026-03-05）：修复首页 `suggestCanonicalClasses` 提示

### 目标

- 清理 `apps/web/src/app/page.tsx` 中 Tailwind IntelliSense 的 canonical class 提示，保持类名写法规范一致。

### 主要改动

- `apps/web/src/app/page.tsx`：
  - 将 `!px-8` 改为 `px-8!`；
  - 将 `!w-fit` 改为 `w-fit!`；
  - 将 `aspect-[16/9]` 改为语义等价的 `aspect-video`。
- 同步收敛：
  - 底部“开始对话”按钮移除 `flex-1`，避免与 `w-fit!` 产生宽度策略冲突。

### 迁移/破坏性变更

- 无；仅样式类名规范化与轻微布局收敛。

### 下一步

- 若继续提示 canonical class，可在其他页面按同一规则批量收敛。

## Iteration 2.28（2026-03-05）：补充 cSpell 词典词条（Segoe）

### 目标

- 消除编辑器中 `Segoe` 的拼写误报，统一 CLI 与 VS Code 体验。

### 主要改动

- 更新 `cspell.json` 词典：
  - 新增 `Segoe` 到 `words` 列表，避免 `Segoe UI` 字体名被标记为 unknown。

### 迁移/破坏性变更

- 无；仅拼写词典增强。

### 下一步

- 若后续出现其他字体/品牌词误报，按同样方式补充到词典即可。

## Iteration 2.27（2026-03-05）：VS Code Tailwind 语法提示噪音收敛

### 目标

- 解决 VS Code 中 `Unknown at rule @custom-variant css(unknownAtRules)` 的编辑器提示噪音。

### 主要改动

- 更新 `.vscode/settings.json`：
  - 新增 `files.associations`：`*.css -> tailwindcss`；
  - 新增 `css.lint.unknownAtRules: ignore`，避免内置 CSS 校验误报 Tailwind v4 at-rule。

### 迁移/破坏性变更

- 无；仅编辑器工作区体验优化。

### 下一步

- 若个别成员仍有提示噪音，建议确认已安装并启用 Tailwind CSS IntelliSense 扩展。

## Iteration 2.26（2026-03-05）：修复当前 CSS 严格检查告警（lint:style）

### 目标

- 先把 `lint:style` 当前报出的样式告警清掉，确保严格检查可通过。

### 主要改动

- 执行 `pnpm lint:style:fix` 并落地修复：
  - `apps/web/src/app/globals.css`：规范 `@import` 写法、hex 长度、font-family 引号与空行规则；
  - `apps/admin/src/app/globals.css`：修复 `font-family-name-quotes`；
  - `apps/admin/src/app/page.module.css`：媒体查询改为区间语法（`width <= 900px`）。
- 验证：
  - `pnpm lint:style` 现已通过（0 报错）。

### 迁移/破坏性变更

- 无；仅样式规范修复，不涉及业务逻辑。

### 下一步

- 后续可将 `lint:style` 纳入 CI 非阻断检查，持续收敛样式规范。

## Iteration 2.25（2026-03-05）：新增 `lint:style` 严格样式检查命令

### 目标

- 提供一个可单独执行的样式检查命令，用于集中发现当前 CSS 规范问题（包括你提到的 warning/告警项）。

### 主要改动

- 新增严格 Stylelint 配置：
  - `stylelint.strict.config.mjs`（基于 `stylelint-config-standard`）；
  - 保留 Tailwind 自定义 at-rule 白名单，避免误报。
- 新增脚本命令：
  - `pnpm lint:style`：使用严格配置扫描 `**/*.css`；
  - `pnpm lint:style:fix`：在严格配置下尝试自动修复可修复问题。
- 保持现有流程不变：
  - `lint:css` 继续走当前“兼容现状”的配置，用于日常提交流程稳定性。

### 迁移/破坏性变更

- 无；新增命令，不影响原有命令行为。

### 下一步

- 可按 `lint:style` 报告逐步收敛规则，再决定是否把严格检查并入默认 `lint`。

## Iteration 2.24（2026-03-05）：补齐 CSS 格式化/Lint 与 Tailwind 类名自动排序

### 目标

- 支持 CSS 的 Prettier 与 lint，并让 Tailwind 类名在保存和提交时自动按规范顺序整理。

### 主要改动

- Prettier（根配置）：
  - `/.prettierrc.cjs` 接入 `prettier-plugin-tailwindcss`；
  - 配置 `tailwindFunctions: ['cn']`，支持 `cn(...)` 内 class 排序；
  - 配置 Tailwind v4 样式入口 `tailwindStylesheet: './apps/web/src/app/globals.css'`。
- CSS lint：
  - 新增 `stylelint.config.mjs`（基于 `stylelint-config-standard`）；
  - 对 Tailwind 自定义 at-rule（如 `@theme`、`@custom-variant`、`@apply`）做白名单兼容。
- 脚本与提交流程：
  - `package.json` 新增 `lint:css` / `lint:css:fix`；
  - 根 `lint` 串联 `pnpm lint:css`；
  - `lint-staged` 新增 `*.css`：`prettier --write` + `stylelint --fix`，提交时自动修复。
- 保存即格式化（VS Code）：
  - 新增 `.vscode/settings.json`，开启 `formatOnSave` 并默认使用 Prettier；
  - 新增 `.vscode/extensions.json` 推荐 Prettier 与 Tailwind CSS 插件。

### 迁移/破坏性变更

- 无 API 变更；仅工程配置增强。

### 下一步

- 可选：若你希望提交前同时跑 CSS 检查，可把 `pnpm lint` 挂到 CI 必跑链路。

## Iteration 2.23（2026-03-05）：回退“开始对话”为 Link 跳转实现

### 目标

- 按最新确认，撤回 `Button onClick` 跳转方案，恢复为 `Link` 导航实现。

### 主要改动

- `apps/web/src/app/page.tsx`：
  - 底部 CTA 从 `<StartChatButton />` 回退为 `Button asChild + Link`；
  - 保持现有样式（`!w-fit + shrink-0 + px-8`）不变，仅回退跳转方式。
- 删除不再需要的组件：
  - `apps/web/src/components/start-chat-button.tsx`。

### 迁移/破坏性变更

- 无；仅页面跳转实现方式回退。

### 下一步

- 如需继续定位宽度展示异常，建议在本地清理旧进程后做一次浏览器无缓存验证。

## Iteration 2.22（2026-03-05）：首页“开始对话”改为 Button onClick 跳转

### 目标

- 按最新交互要求，移除“开始对话”按钮内的 `Link`，改为 `Button` 直接 `onClick` 跳转。

### 主要改动

- 新增客户端组件 `apps/web/src/components/start-chat-button.tsx`：
  - 使用 `useRouter`（`next/navigation`）实现 `onClick => router.push('/chat')`；
  - 保持 `secondary` 视觉样式与 `!w-fit + px-8` 宽度/内边距策略。
- `apps/web/src/app/page.tsx`：
  - 底部 CTA 区由 `Button asChild + Link` 改为 `<StartChatButton />`。

### 迁移/破坏性变更

- 无；仅按钮跳转实现方式调整。

### 下一步

- Playwright MCP 恢复后补首页按钮点击跳转与宽度样式的自动化回归。

## Iteration 2.21（2026-03-05）：首页 CTA 宽度改为强制 `!w-fit`

### 目标

- 继续收敛首页 CTA 宽度问题，避免任何潜在宽度类覆盖导致按钮看起来仍为整行宽度。

### 主要改动

- `apps/web/src/app/page.tsx`：
  - 将两个 CTA 的 `w-fit` 升级为 `!w-fit`（高优先级）；
  - 保持 `shrink-0` 与 `px-8`，确保按钮按内容宽度渲染且左右内边距稳定。

### 迁移/破坏性变更

- 无；仅样式优先级增强。

### 下一步

- Playwright MCP 可用后，补首页 CTA 的截图与像素对比验收。

## Iteration 2.20（2026-03-05）：显式固定首页 CTA 为 `w-fit` 规避按钮宽度歧义

### 目标

- 在“去掉固定宽度”基础上，进一步显式约束首页两个 CTA 为内容宽度，避免样式继承或布局上下文导致误解。

### 主要改动

- `apps/web/src/app/page.tsx`：
  - Hero 区“立即开始”按钮增加 `w-fit shrink-0`；
  - 底部“开始对话”按钮增加 `w-fit shrink-0`；
  - 两者均保留 `px-8`（32px）与现有视觉样式。
- 验证方式：
  - 通过本地渲染 HTML 确认两个按钮 class 已包含 `w-fit` 且不再含 `w-full/sm:w-auto`。

### 迁移/破坏性变更

- 无；仅样式行为收敛。

### 下一步

- 若需严格像素验收，可在 Playwright MCP 恢复后补一组首页 CTA 的截图回归。

## Iteration 2.19（2026-03-04）：首页主 CTA 宽度改为内容自适应

### 目标

- 修复首页主按钮“立即开始”仍然占满容器宽度的问题，改为自适应内容宽度。

### 主要改动

- `apps/web/src/app/page.tsx`：
  - 移除 Hero 区“立即开始”按钮上的 `w-full` 与 `sm:w-auto`；
  - 保留 `!px-8 + has-[>svg]:!px-8`，确保按钮宽度由内容与内边距共同决定。

### 迁移/破坏性变更

- 无；仅样式行为修复。

### 下一步

- 若后续希望首页 CTA 行为统一，可继续明确“主按钮/次按钮在移动端是否都保持内容宽度”规范。

## Iteration 2.18（2026-03-04）：首页“开始对话”按钮宽度改为内容自适应

### 目标

- 修复首页“开始对话”按钮宽度不符合预期的问题，改为不指定固定宽度，随内容自动伸展。

### 主要改动

- `apps/web/src/app/page.tsx`：
  - 移除底部 CTA “开始对话”按钮的 `w-full` 与 `sm:w-auto`；
  - 保留 `h-11` 与 `px-8`，按钮宽度改为组件默认 auto 行为（随内容自适应）。

### 迁移/破坏性变更

- 无；仅样式调整。

### 下一步

- 若需要同一视觉规范，可继续统一首页两个 CTA 的宽度策略（都内容自适应或都容器对齐）。

## Iteration 2.17（2026-03-04）：修复首页主 CTA padding 被按钮基类覆盖

### 目标

- 解决“立即开始”按钮设置 `px-8` 后视觉仍未生效的问题，确保左右内边距稳定为 32px。

### 主要改动

- 根因定位：
  - `Button` 默认尺寸样式包含 `has-[>svg]:px-3`，而“立即开始”按钮内含 `ArrowRight` 图标，导致原 `px-8` 被覆盖。
- 修复：
  - 在 `apps/web/src/app/page.tsx` 为该按钮增加强制覆盖类：
    - `!px-8`
    - `has-[>svg]:!px-8`
  - 这样无论是否包含图标，横向内边距都固定为 32px。

### 迁移/破坏性变更

- 无；仅首页按钮样式修复。

### 下一步

- 如需全站统一，可评估是否调整 `Button` 基类的 `has-[>svg]:px-*` 策略，避免类似覆盖问题重复出现。

## Iteration 2.16（2026-03-04）：首页主 CTA 横向内边距调整为 32px

### 目标

- 按设计要求把首页“立即开始”按钮左右内边距统一为 32px。

### 主要改动

- `apps/web/src/app/page.tsx`：
  - 将 Hero 区“立即开始”按钮 class 从 `px-10 sm:px-12` 调整为 `px-8`（即 32px）。

### 迁移/破坏性变更

- 无；仅样式调整。

### 下一步

- 如需继续视觉对齐，可再微调按钮高度、字重与图标间距。

## Iteration 2.15（2026-03-04）：首页 Guest 菜单补齐主题切换与登录入口

### 目标

- 让首页右上角 Guest 入口与聊天页保持一致，支持主题切换和登录跳转，统一用户入口体验。

### 主要改动

- 抽离并复用 Guest 菜单组件：
  - 新增 `apps/web/src/components/guest-menu.tsx`；
  - 支持 `menuPlacement`（上弹/下弹）以适配侧栏与首页头部两种布局。
- 首页头部接入 Guest 下拉菜单：
  - `apps/web/src/app/page.tsx` 右上角由静态按钮改为可交互菜单；
  - 支持 `Toggle light/dark mode` 与 `Login to your account`（跳转 `/login`）。
- 聊天页侧栏改为使用共享 Guest 组件：
  - `apps/web/src/app/chat/components/chat-sidebar.tsx` 改为引用 `@/components/guest-menu`；
  - 删除原聊天目录下重复实现，减少维护分叉。

### 迁移/破坏性变更

- 无 API 变更；仅前端组件复用与交互增强。

### 下一步

- 真实认证接入后，为 Guest 菜单补充登录态头像、用户信息与 Sign out 分支。

## Iteration 2.14（2026-03-04）：按钮精简与 Guest 菜单二次对齐

### 目标

- 继续收敛页面入口与交互，移除冗余按钮，并把侧栏 Guest 菜单进一步对齐到目标样式与行为。

### 主要改动

- 聊天页顶部精简：
  - 移除 `/chat` 顶部“使用指南”按钮及对应入口，保留核心聊天操作链路。
- Guest 菜单二次对齐（`apps/web/src/app/chat/components/guest-menu.tsx`）：
  - 按目标站结构调整为：用户入口按钮 + 下拉菜单；
  - 菜单项改为 `Toggle light/dark mode` 单项切换；
  - 增加认证动作入口 `Login to your account`（跳转 `/login`）；
  - 增加访客状态加载占位（头像/文本 pulse + spinner）。
- 首页 CTA 精简与视觉优化：
  - 移除 Hero 区“查看功能”按钮；
  - “立即开始”按钮左右内边距加大（`px-10 / sm:px-12`）以提升视觉平衡。
- 新增登录占位页：
  - `apps/web/src/app/login/page.tsx`，避免 Guest 菜单登录入口落入 404。

### 迁移/破坏性变更

- 无 API 变更；仅页面结构与入口调整。

### 下一步

- 若后续接入真实认证（如 Auth.js），可直接复用当前 Guest 菜单结构替换登录/登出动作。

## Iteration 2.13（2026-03-04）：主题切换与助手回复 Loading 体验补齐

### 目标

- 对齐聊天页的体验细节：补齐访客菜单内主题切换能力、补齐 AI 首段回复前的 loading 态。

### 主要改动

- 主题系统：
  - `apps/web/src/app/layout.tsx` 接入全局 `ThemeProvider`，支持 `light/dark/system`；
  - 新增 `apps/web/src/components/theme-provider.tsx`（基于 `next-themes`）；
  - 聊天侧栏访客菜单新增主题切换入口：`apps/web/src/app/chat/components/guest-menu.tsx`；
  - `Guest` 按钮点击后弹出菜单，可切换浅色 / 深色 / 跟随系统。
- 回复 loading：
  - 新增 `apps/web/src/app/chat/components/chat-loading-indicator.tsx`；
  - 当发送后助手占位消息还未收到首个 token 时，显示“思考中”动态 loading；
  - 一旦收到流式内容，自动切换为正常 Markdown 消息渲染。
- 依赖：
  - `apps/web/package.json` 新增 `next-themes`。

### 迁移/破坏性变更

- 无外部 API 变更；仅前端展示与主题管理增强。

### 下一步

- 可选：把主题切换入口同步到首页头部，保证全站入口一致。

## Iteration 2.12（2026-03-04）：聊天页模块化重构 + 输入/滚动/Markdown 体验增强

### 目标

- 提升聊天页与核心包的可维护性（控制单文件行数，避免超长文件持续膨胀）。
- 补齐关键交互体验：回车发送、自动滚底、Markdown + 代码高亮。

### 主要改动

- 聊天页重构（`apps/web/src/app/chat`）：
  - 将原 `ChatClient.tsx`（超长）拆分为 `components/*`、`hooks/*`、`lib/*`；
  - 新增 `use-chat-controller`、`use-send-message`，把会话状态、SSE 消费、发送流程从 UI 层抽离；
  - 新增 `use-auto-scroll`，在消息条数变化、最后一条内容变化、流式发送过程中都自动滚动到底部。
- 输入交互增强：
  - `Enter` 直接发送；
  - `Shift + Enter` 保留换行；
  - 处理输入法组合态（`isComposing`）避免误发送。
- Markdown 渲染与代码高亮：
  - 新增 `ChatMarkdown` 组件；
  - 接入 `react-markdown + remark-gfm + react-syntax-highlighter`；
  - 支持列表、标题、行内代码、fenced code block 语法高亮。
- 核心包拆分（控制文件规模）：
  - `packages/interview-engine` 拆分为 `session-core`、`scoring`、`process-helpers`、`process-session-message`、`session-factory`；
  - `packages/shared` 拆分为 `contracts/defaults/utils`；
  - `packages/question-bank` 拆分为 `question-data/plan-builder`。
- 验证：
  - 通过 Playwright 对 `/chat` 进行交互回归，确认回车发送、Shift+Enter 换行、自动滚底及 Markdown 渲染均生效。

### 迁移/破坏性变更

- 无外部 API 破坏性变更；主要是内部模块重组与前端体验增强。

### 下一步

- 增加聊天消息渲染层的单元测试（Markdown/code block/长文本回归）。
- 为 SSE 流程补充取消请求与重试策略（Abort + retry/backoff）。

## Iteration 2.11（2026-03-03）：环境配置收敛为统一变量名（同名变量、不同环境值）

### 目标

- 简化配置复杂度，移除代码中的 `DEV_*/PROD_*` 分流逻辑，改为“同名变量 + 不同环境注入值”。

### 主要改动

- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/route.ts`：
  - 移除 `APP_ENV` + `DEV_/PROD_` 读取逻辑；
  - 统一只读取 `LLM_PROVIDER`、`OLLAMA_*`、`DEEPSEEK_*`。
- `env.example`：
  - 重写为单一变量模板，明确“本地 `.env.local` / 线上平台同名变量”实践。
- 新增文档：
  - `docs/EnvDeployment.md`，补充本地配置与 Docker Compose 线上注入示例。
- 清理：
  - 删除 `env.development.example` 与 `env.production.example`，避免配置入口分散。

### 迁移/破坏性变更

- 若此前依赖 `DEV_*` / `PROD_*` 覆盖变量，需要改回同名通用变量。

### 下一步

- 增加 provider 启动时配置校验（缺少关键变量时输出更明确的错误提示）。

## Iteration 2.10（2026-03-03）：双环境配置（开发/线上）与 APP_ENV 分流

### 目标

- 支持本地开发与线上环境使用不同配置，并通过环境变量自动选择生效配置。

### 主要改动

- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/route.ts`：
  - 新增 `RuntimeProfile`（`development` / `production`）与 `resolveRuntimeProfile`。
  - 新增 `readEnvByProfile`：优先读取 `DEV_*` 或 `PROD_*`，不存在时回退通用变量。
  - provider 选择与模型参数读取统一走 profile 分流（Ollama / DeepSeek 均支持）。
  - SSE `start` 事件附带当前 profile，便于调试确认环境命中。
- 环境配置模板：
  - 重写 `env.example`，移除真实密钥并补齐 `APP_ENV + DEV_/PROD_` 变量约定。
  - 新增 `env.development.example`（本地示例）与 `env.production.example`（线上示例）。

### 迁移/破坏性变更

- 无破坏性变更；旧的通用变量（如 `LLM_PROVIDER`、`DEEPSEEK_*`）仍可继续使用。

### 下一步

- 补充一页“部署环境变量清单”文档，包含 Vercel/服务器两套示例。

## Iteration 2.9（2026-03-02）：支持通过环境变量切换 Ollama / DeepSeek 付费 API

### 目标

- 在不改动前端 SSE 协议的前提下，通过环境变量切换底层模型提供方（本地 Ollama / DeepSeek 付费 API）。

### 主要改动

- `packages/llm/src/index.ts`：
  - 新增 `DeepSeekStreamChatProvider`，使用 OpenAI-compatible `chat/completions` 流式接口。
  - 解析 DeepSeek SSE chunk（`data: ...` + `[DONE]`），按 `choices[0].delta.content` 增量输出 token。
- `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/route.ts`：
  - 抽象 `createStreamProvider`，根据 `LLM_PROVIDER` 动态选择 `ollama` 或 `deepseek`。
  - 统一保留 SSE 事件协议（`start/delta/done/error/end`），前端无感切换。
  - 根据会话模型选择映射到 `DEEPSEEK_MODEL` / `DEEPSEEK_REASONER_MODEL`。
- `env.example`：
  - 明确 `LLM_PROVIDER` 可选值；
  - 增加 `DEEPSEEK_REASONER_MODEL`，补齐双模型映射配置。

### 迁移/破坏性变更

- 无破坏性变更；仅增加 provider 切换能力。

### 下一步

- 增加 provider 级重试与超时配置（按模型维度可配置）。
- 为 DeepSeek 流式解析补充单元测试。

## Iteration 2.8（2026-03-02）：接入 Ollama + SSE 流式聊天（基础对话能力）

### 目标

- 基于现有架构落地“可用的 AI 对话”主链路，支持服务端 SSE 流式输出，便于本地用 Ollama 调试。

### 主要改动

- 服务端流式接口：
  - 新增 `apps/web/src/app/api/chat/sessions/[sessionId]/messages/stream/route.ts`。
  - 使用 `ReadableStream + text/event-stream` 向前端持续推送 `start/delta/done/error/end` 事件。
  - 将 Ollama 的 NDJSON 流式响应（`/api/chat`）转换为 SSE delta 推送。
- LLM Provider 扩展：
  - `packages/llm/src/index.ts` 新增 `OllamaStreamChatProvider`，抽象 `streamChat` 能力。
  - 兼容 Ollama `message.content` / `response` 两种 chunk 字段格式。
- 会话存储扩展：
  - `apps/web/src/lib/server/chat-store.ts` 新增 `appendChatExchange`，用于把“用户消息 + 助手回复”持久化到会话内存存储。
- 前端流式渲染：
  - `apps/web/src/app/chat/ChatClient.tsx` 将发送逻辑改为调用 SSE 接口并按 `delta` 增量更新最后一条助手消息。
  - 保留发送中状态、错误提示与会话列表刷新。
- 配置与依赖：
  - `env.example` 新增 Ollama 相关变量（`OLLAMA_BASE_URL`、`OLLAMA_MODEL`、`OLLAMA_REASONER_MODEL`），默认 `LLM_PROVIDER=ollama`。
  - `apps/web/package.json` 增加 `@mianshitong/llm` 依赖。
  - `cspell.json` 补充 `ollama`、`ndjson` 词条。

### 迁移/破坏性变更

- `POST /api/chat/sessions/[sessionId]/messages` 仍保留（兼容旧逻辑），前端主链路已切换到新的 SSE 接口。

### 下一步

- 增加 DeepSeek 付费 API Provider，实现与 Ollama 同一接口下的可切换部署。
- 补充 SSE 解析与流式 provider 的单元测试覆盖。

## Iteration 2.7（2026-03-02）：/chat 消息区视觉对齐与发送后稳定性回归（第六轮）

### 目标

- 继续收敛 `/chat` 页面与目标样式的差异，重点修复“发送后排版观感不一致”的问题。

### 主要改动

- `apps/web/src/app/chat/ChatClient.tsx`：
  - 侧栏默认策略改为桌面端初始展开（移动端首屏自动收起），与主内容宽度分配一致。
  - 顶栏移除冗余 `New Chat` 按钮，收敛为“侧栏开关 + Private + 使用指南”主链路。
  - 消息区重构为更接近目标形态：
    - 用户消息：右侧小气泡 + 编辑/复制操作；
    - 助手消息：左侧图标 + 文本流 + 复制/反馈操作。
  - 保持“消息区滚动 + 底部输入区固定”结构不变，避免回归此前发送后输入区上浮问题。
- Playwright 回归验证：
  - 发送消息后再次核对输入区底部位置与消息区滚动边界，确认布局稳定。

### 迁移/破坏性变更

- 无，属于前端展示层与交互细节收敛。

### 下一步

- 继续优化移动端按钮触达面积与顶部间距，完成本轮像素级收尾。

## Iteration 2.6（2026-03-02）：/chat 发送后布局错乱修复

### 目标

- 修复 `/chat` 页面在发送消息后输入区上浮、消息区与输入区层级错乱的问题。

### 主要改动

- `apps/web/src/app/chat/ChatClient.tsx`：
  - 将聊天主体改为稳定的 `flex` 纵向布局：消息区 `flex-1 + overflow-y-auto`，输入区固定在底部容器。
  - 移除导致错位的 `absolute + sticky` 组合，改为“滚动消息区 + 底部输入区”结构。
  - 保留既有消息渲染逻辑与会话接口调用，确保仅修复布局，不影响业务流程。
- Playwright 验证：
  - 在本地复现“发送消息后布局错乱”问题并截图；
  - 修复后再次发送消息，确认布局稳定且输入区保持底部对齐。

### 迁移/破坏性变更

- 无，属于前端布局修复。

### 下一步

- 继续做移动端细节（按钮间距与触达面积）收尾优化。

## Iteration 2.5（2026-03-02）：聊天输入区与会话列表细节微调（第五轮）

### 目标

- 继续收敛聊天页细节，提升首屏观感一致性与交互紧凑度。

### 主要改动

- `apps/web/src/app/chat/ChatClient.tsx`：
  - 快捷问题按钮改为左对齐并优化行高，长文本可读性更稳定。
  - 会话列表项去除右侧时间标签，统一列表视觉节奏。
  - 输入区底部控件布局收紧，移除冗余文件入口显示，聚焦模型选择与发送动作。
  - 文本域补齐宽度约束，避免窄屏下出现输入区域错位。
  - 顶栏边框样式回收，保持与内容区过渡更自然。

### 迁移/破坏性变更

- 无业务协议变化，仅聊天页 UI 细节调整。

### 下一步

- 继续优化移动端侧栏开关与顶部按钮触达区域，完成本阶段像素级收尾。

## Iteration 2.4（2026-03-02）：聊天页侧栏与布局微调（第四轮）

### 目标

- 在不改动业务逻辑的前提下，继续优化聊天页布局细节与交互一致性。

### 主要改动

- 聊天页微调（`apps/web/src/app/chat/ChatClient.tsx`）：
  - 侧栏改为 `translate` 方式收起/展开，统一桌面与移动端 off-canvas 过渡表现。
  - 主区域增加最小高度约束，避免折叠状态下出现跳动感。
  - 顶部工具栏补齐底边框，强化层级分隔。
  - 根容器增加横向溢出保护，避免动画期间出现横向滚动条。

### 迁移/破坏性变更

- 无，均为样式与交互层微调。

### 下一步

- 继续细调消息卡片与输入区间距，完成最后一轮像素级打磨。

## Iteration 2.3（2026-03-02）：品牌与文案去竞品化清理

### 目标

- 移除仓库内与外部网站相关的命名、链接与描述，统一为面试通自身品牌表达。

### 主要改动

- 品牌文案统一：
  - 将页面与聊天页中的品牌名统一为“面试通”，移除历史命名。
- 外部链接清理：
  - 首页 CTA 与页脚外链改为项目内文案/占位链接，移除第三方站点引用。
  - 聊天页顶部入口统一为“使用指南”并指向站内页面。
- 文档去竞品化：
  - `docs/ProjectContext.md`、`docs/IterationLog.md` 中移除对外部网站与“仿站/对齐”描述，改为项目自有迭代叙述。
- 配置同步：
  - `cspell.json` 移除历史外部品牌词条，保持词库与当前品牌一致。

### 迁移/破坏性变更

- 无业务逻辑变更，属于文案与配置层清理。

### 下一步

- 继续进行 UI 微调与交互打磨，保持品牌文案与视觉规范一致。

## Iteration 2.2（2026-03-02）：Tailwind + shadcn UI 精修（第三轮）

### 目标

- 在不改动现有聊天业务闭环（会话 API / Interview Engine）的前提下，继续做高保真像素级打磨。
- 将前端样式体系统一到 Tailwind + shadcn 组件形态，减少手写样式偏差。

### 主要改动

- `apps/web` UI 继续优化：
  - 重写首页 `src/app/page.tsx`，统一容器节奏、Hero 结构、功能卡片、CTA 与页脚布局。
  - 重写聊天页 `src/app/chat/ChatClient.tsx`，统一侧栏/顶部工具栏/消息区/建议提问/输入卡片的尺寸与层级。
  - 将全局主题变量 `src/app/globals.css` 收敛为统一语义色板与圆角体系（Tailwind token 收敛）。
- shadcn 组件增强：
  - 新增 `sidebar/sheet/tooltip/skeleton/use-mobile` 相关组件与 hook。
  - 同步更新 `button/input/separator` 以匹配 shadcn 最新生成结构。
- 文案与细节同步：
  - `packages/shared/src/index.ts` 的快捷提问文案统一为项目默认提示。
  - `cspell.json` 新增 `shadcn`、`nums` 词典，修复拼写检查报错。

### 迁移/破坏性变更

- 无业务协议变更（API 与数据结构保持兼容）。
- UI 结构有较大改动，属于前端展示层重构。

### 下一步

- 继续做细节打磨：侧栏折叠动画、输入区微间距、移动端按钮排序与 hover/active 态。
- 补齐剩余像素差异（尤其 chat 首屏和会话项状态样式）。

## Iteration 2.1（2026-02-28）：UI 高保真优化（第二轮）

### 目标

- 将 `apps/web` 的视觉与交互进一步统一，从“风格接近”提升到“结构与细节更完整”。

### 主要改动

- Landing 页二次重构：
  - 调整为更完整的产品版式（顶部导航、居中 Hero、四个亮点标签、核心功能卡片、演示区、深色 CTA、底部链接区）。
  - 统一字体尺寸、边框半径、色值与间距节奏，移除上一版偏强的渐变风格。
- `/chat` 页二次重构：
  - 新增可折叠左侧栏（含品牌、会话列表、Guest 区域），并按桌面/移动端适配显示。
  - 顶部工具栏样式优化为统一布局（图标按钮 + Private 标签 + 功能入口）。
  - 调整消息区与输入区结构：快捷提问胶囊、文件入口、输入卡片、上下文按钮、模型选择与发送圆按钮。
- 全局视觉变量微调：
  - `apps/web/src/app/globals.css` 更新为统一的中性色与边框体系。

### 迁移/破坏性变更

- 无

### 下一步

- 继续做“像素级”细节打磨（图标、hover 动效、阴影层级、响应式断点下的间距微调）。

## Iteration 2（2026-02-28）：Web UI + 面试闭环（Mock Provider）

### 目标

- 按既有 monorepo 架构实现可运行的“首页 + Chat + 面试流程 + 报告”闭环。
- 在不引入后端独立服务的前提下，用 `apps/web` BFF 路由串起会话与面试状态。

### 主要改动

- `apps/web`：
  - 重做首页 UI（Hero、功能卡片、CTA、页脚链接），统一视觉与信息架构。
  - 新增 `/chat` 页面（侧边会话列表、New Chat、Private 切换、快捷提问、模型选择、文件选择入口、消息流）。
  - 新增 API 路由：`/api/chat/sessions`、`/api/chat/sessions/[sessionId]`、`/api/chat/sessions/[sessionId]/messages`。
  - 新增服务端内存会话存储：`src/lib/server/chat-store.ts`（MVP 阶段无数据库依赖）。
- `packages/shared`：
  - 落地领域类型：会话、消息、面试配置、评分维度、报告结构、API 请求/响应协议。
  - 增加默认配置与快捷提示词常量。
- `packages/question-bank`：
  - 落地静态题库（前端/React/Vue/工程化/性能/网络/安全/Node）。
  - 增加按 topic + level + questionCount 的选题计划函数。
- `packages/llm`：
  - 增加 `LlmProvider` 抽象与 `MockLlmProvider`，支持普通问答、开场、追问、单题反馈、总结报告文案生成。
- `packages/interview-engine`：
  - 实现会话状态机：`idle -> interviewing -> completed`。
  - 实现追问判定、单题评估、维度评分聚合、报告生成、会话摘要转换。
  - 新增单元测试覆盖“启动面试 + 追问 + 完成总结”主流程。
- 工程配置：
  - 根 `eslint.config.mjs` 增加 TypeScript 解析能力（`typescript-eslint`），修复 packages 下 `.ts` lint 解析问题。
  - `apps/web` / `apps/admin` 补充 `tsconfig` 路径别名，确保 `@/*` 在 App Router 中可解析。

### 迁移/破坏性变更

- 无破坏性变更。
- 当前会话存储为内存态，服务重启后会话会清空（MVP 预期行为）。

### 下一步

- 对接 `DeepSeekProvider`（真实模型调用、失败重试、结构化输出校验）。
- 接入 Prisma + PostgreSQL 持久化会话与题库，并在 `apps/admin` 实现题库 CRUD。

## Iteration 1（2026-02-27）：Monorepo 工程骨架 + 规范工具落地

### 目标

- 搭建可持续迭代的仓库骨架：轻量 monorepo（pnpm workspaces）+ 两个 Next.js 应用（web/admin）+ 可复用 packages。
- 先把工程规范与质量工具跑通：格式化、Lint、拼写检查、提交规范、单测、TypeScript typecheck。

### 主要改动

- Monorepo 结构落地：`apps/web`、`apps/admin`、`packages/*`（含 placeholder）。
- 新增协作约定：根目录 `AGENTS.md`，约束“每次改动后必须更新文档 + 跑规范命令 + 第三方库使用 Context7 查最新文档”。
- 各 workspace 包支持绝对导入：为 `apps/*` 与 `packages/*` 的 `tsconfig.json` 增加 `baseUrl` + `paths`（`@/* -> ./src/*`），便于在各自 `src/` 下使用 `@/` 前缀导入。
- Docker 部署骨架：启用 Next.js `output: 'standalone'`，新增根 `Dockerfile` + `compose.yaml`（web/admin/db），并补充 `.dockerignore`。
- 调整默认模板：移除 `next/font/google`（避免构建时从 Google Fonts 拉取资源导致 `pnpm build`/Docker build 在受限网络下失败）。
- 配置复用收敛：新增 `packages/config`（共享 tsconfig 模板），apps/packages 的 `tsconfig.json` 统一 extend 该模板，减少重复配置与漂移。
- 规范工具：
  - Prettier：`.prettierrc.cjs`、`.prettierignore`、`pnpm format/*`
  - ESLint（flat config）：根 `eslint.config.mjs` + apps 内 `eslint.config.mjs`
  - cSpell：`cspell.json` + `pnpm spellcheck`
  - Git hooks：Husky（`.husky/*`）+ lint-staged（pre-commit）
  - 提交规范：commitlint（`commitlint.config.cjs` + commit-msg hook）
  - 单测：Vitest（`vitest.config.ts` + `packages/shared` 示例测试）
- 基础 TS 配置：`tsconfig.base.json`，apps 的 `tsconfig.json` 继承 base。
- Next.js monorepo 适配：在 `apps/*/next.config.ts` 配置 `outputFileTracingRoot`，并预留 `transpilePackages`。

### 迁移/破坏性变更

- 无

### 下一步

- 开始 MVP 闭环编码：以 `apps/web` 的 API 为入口，接入 `packages/interview-engine` + `packages/llm`（先 MockProvider）。

## Iteration 0.1（2026-02-27）：架构选型讨论记录（Monorepo vs 单体）

### 目标

- 开始讨论整体项目架构与仓库形态，并把讨论上下文沉淀到文档，避免后续反复对齐。

### 主要改动

- 更新 `docs/ProjectContext.md`：记录 monorepo 与单体架构的备选方案、初步倾向与待确认问题。

### 迁移/破坏性变更

- 无

### 下一步

- 已确认：会做 admin/题库后台；后端先放在 Next.js；未来可能复用。
- 下一步：落地 pnpm workspaces 的轻量 monorepo 目录结构（`apps/web` + `apps/admin` + `packages/*`），并以 `apps/web` 先跑通 MVP 闭环。

## Iteration 0（2026-02-26）：文档初始化 + 项目约束落地

### 目标

- 明确产品定位与 MVP 范围
- 固化评分与结构化输出协议
- 建立“上下文/迭代”沉淀机制

### 主要改动

- 新增 PRD：`docs/PRD.md`
- 新增评分 Rubric：`docs/Rubric.md`
- 新增 Prompt 规范：`docs/PromptSpec.md`
- 新增长期上下文沉淀：`docs/ProjectContext.md`
- 新增迭代记录：`docs/IterationLog.md`
- 新增 `env.example` 与 `.gitignore`（禁止提交 `.env.local` 等密钥文件）

### 关键决定（本迭代确认）

- 产品名与定位：面试通（mianshitong）= 你的专属 AI Agent 面试官；专注编程领域/前端；涵盖简历优化、模拟面试、面试题解答（MVP 先做模拟面试闭环）
- 模型与接口：DeepSeek，OpenAI-compatible，Base URL `https://api.deepseek.com`，模型 `deepseek-chat`
- 默认体验：中文；面试结束统一总结（非每题即时反馈）
- 规划技术栈：Next.js + Prisma + PostgreSQL + Docker

### 迁移/破坏性变更

- 无

### 下一步

- 决策 AI 编排框架：LangChainJS vs LangGraphJS（可组合）
- 进入编码迭代：搭建 Next.js + Prisma + PostgreSQL + Docker 的最小可运行闭环

## Iteration 2.80（2026-03-08）

### 目标

- 把聊天页自动滚动行为向 `zhitalk.chat` 对齐，避免流式生成时抢走用户滚动控制权。

### 主要改动

- 通过 Playwright 实测确认参考站行为：AI 回复持续生成时，若用户手动上滚离开底部，页面不会再强制自动跟随到底部。
- `use-auto-scroll` 新增“是否贴底”判断：仅当用户仍停留在底部附近时，消息流式更新才自动跟随；用户手动上滚超过阈值后，自动跟随立即暂停。
- 会话切换时仍然保持自动定位到底部，保证进入已有长会话时的默认阅读位置不受影响。

### 迁移/破坏性变更

- 无。

### 下一步

- 如果后续还要继续向参考站收口，可以再补一个“回到底部”按钮作为离底状态下的显式恢复入口。

## Iteration 2.81（2026-03-08）

### 目标

- 继续向 `zhitalk.chat` 收口，补充离底状态下的“回到底部”按钮。

### 主要改动

- `use-auto-scroll` 现在对外暴露 `isPinnedToBottom` 与 `scrollToBottom`，用于驱动离底状态下的显式恢复入口。
- 聊天页在“已有对话且用户离开底部”时，会在输入区上方显示圆形“回到底部”按钮；点击后立即回到底部，并恢复自动跟随。
- 按钮仅在当前不贴底、且不是会话切换空白过渡时出现，避免无意义干扰。

### 迁移/破坏性变更

- 无。

### 下一步

- 如果后续还要继续微调，可以再根据体验决定按钮位置是否更靠中间，或是否补极轻的显隐动效。

## Iteration 2.82（2026-03-08）

### 目标

- 修复“生成中轻微上滚仍会被自动滚动抢回去”的剩余问题。

### 主要改动

- 根因确认：此前虽然加入了贴底阈值判断，但只要用户仍处于底部附近，系统仍会继续视为“可自动跟随”，这与参考站“用户一旦开始向上滚就立即让权”的行为不一致。
- `use-auto-scroll` 现改为更严格的用户优先策略：在 AI 流式生成期间，只要检测到滚动容器的 `scrollTop` 出现向上变化，就立刻退出自动跟随；只有用户重新滚回底部附近或点击“回到底部”按钮时，才恢复自动跟随。
- 同时保留“切换会话时自动定位到底部”的独立逻辑，避免影响已有会话的默认进入体验。

### 迁移/破坏性变更

- 无。

### 下一步

- 继续观察是否还需要为移动端触摸拖拽补更细的体验微调，但当前基于 `scrollTop` 向上变化的策略已经能覆盖主流输入方式。

## Iteration 2.83（2026-03-08）

### 目标

- 修复“长会话中用户离底发送消息不会自动回到底部”以及“回到底部按钮位置与参考站不一致”的问题。

### 主要改动

- 聊天页提交消息时不再只依赖 `use-auto-scroll` 的被动 effect，而是在用户点击发送或点击预设问题时主动执行一次 `scrollToBottom`，确保长会话离底发送时会立刻跳到最新消息区域。
- 将“回到底部”按钮改为相对输入区定位，使其位置更接近 `zhitalk.chat` 的“底部居中、悬浮于输入框上方”样式。
- 本地用 Playwright 复测：发送前将会话区滚到顶部后再发送，发送瞬间已能直接滚到底部。

### 迁移/破坏性变更

- 无。

### 下一步

- 继续观察真实流式回复场景下的滚动行为，如果后续还有极端场景，再决定是否把滚动触发进一步下沉到消息流控制层。

## Iteration 2.84（2026-03-08）

### 目标

- 修复“AI 返回纯代码文本时，前端无法展示为代码块”的问题。

### 主要改动

- 新增服务端公共工具 `chat-response-format.ts`，统一负责两件事：向模型注入“代码必须使用 fenced code block 输出”的系统指令，以及在回复完成后对“整段几乎全是代码”的纯文本进行保守兜底包裹。
- 登录态消息流、游客消息流、编辑消息重生成三条链路都接入该工具，保证最终落库内容和前端最终展示内容保持一致。
- 兜底策略仅处理“代码占比很高、说明性语句极少”的回复，避免把普通解释性段落误判成代码块。

### 迁移/破坏性变更

- 无。

### 下一步

- 如果后续要进一步提升稳定性，可以考虑把这套格式约束继续下沉到更明确的 Prompt 模板或模型输出协议层。

## Iteration 2.85（2026-03-08）

### 目标

- 继续提升纯代码文本兜底时的语言识别准确率，并修复“半残 fenced code”导致的代码块脏内容问题。

### 主要改动

- 扩展服务端格式化规则，对 `vue / yaml / sql / bash / css / html / jsx / tsx / typescript / json` 等常见代码类型补充更细的特征识别。
- 增加对“不成对 fenced code”的清洗：如果模型只输出了开头的残缺 fence 而未正确闭合，服务端会先去除残缺 fence，再做语言推断和安全包裹，避免最终代码块里出现裸露的反引号字面量。
- 用 Playwright 做多组真实聊天回归，`javascript / vue / sql / bash / yaml / tsx` 场景均已验证代码块可正确展示。

### 迁移/破坏性变更

- 无。

### 下一步

- 如果后续还要继续收口，可以考虑在渲染层把 `typescript + JSX` 的展示标签进一步细化为 `tsx`，但这不影响当前代码块展示与复制下载功能。

## Iteration 2.86（2026-03-08）

### 目标

- 收敛侧边栏会话列表的信息密度，不再展示最近一条 AI 回复摘要，改为展示会话发起时间。

### 主要改动

- 侧边栏会话列表从“标题 + 最近 AI 摘要”改为“标题 + 创建时间”。
- 视觉上保留简洁单列布局，减少摘要信息带来的噪音。

### 迁移/破坏性变更

- 无。

### 下一步

- 继续观察时间展示是否真的优于更简洁的列表，如果用户偏好更强的做减法，可以进一步去掉时间展示。

## Iteration 2.87（2026-03-08）

### 目标

- 让侧边栏会话列表排序更稳定，避免旧会话因为新回复而频繁跳动。

### 主要改动

- 会话列表排序改为按 `createdAt desc` 为主，而不是按最近 `updatedAt` 变化排序。
- 用 Playwright 验证：旧会话即使收到新消息，也不会直接跳到顶部，列表位置更稳定。

### 迁移/破坏性变更

- 无。

### 下一步

- 在更简洁的产品方向下，继续评估是否彻底去掉时间并补充置顶能力。

## Iteration 2.88（2026-03-08）：侧边栏会话列表做减法并补充置顶能力

### 目标

- 侧边栏会话列表向更简洁的产品思路收口：去掉时间展示与“最近会话”标题，并补充会话置顶能力。

### 主要改动

- 侧边栏列表展示收敛：
  - 去掉会话创建时间展示；
  - 去掉“最近会话”标题文案；
  - 会话列表默认按 `createdAt desc` 稳定排序，不再因为最近回复时间变化而频繁跳动。
- 新增会话置顶能力：
  - 单条会话 `...` 菜单增加“置顶 / 取消置顶”；
  - 置顶后该会话提升到列表最上方；
  - 置顶项标题尾部常驻展示图钉图标。
- 置顶状态持久化策略：
  - 游客态写入浏览器 IndexDB；
  - 登录态复用服务端会话持久化链路，把 `pinnedAt` 编码进现有 `runtime.__chatUi`，避免本轮额外引入 Prisma schema 迁移。
- 排序规则统一：
  - 置顶组按 `pinnedAt desc`；
  - 非置顶组按 `createdAt desc`；
  - 前后端与本地存储共用同一比较器，避免排序漂移。

### 迁移/破坏性变更

- 无数据库 schema 迁移；服务端现有会话会在后续保存时自然带上 UI 状态字段。

### 下一步

- 如果后续还要继续打磨侧边栏体验，可以再评估是否补“拖拽排序”或“置顶分组分隔线”，但当前版本优先保持简洁与稳定。

## Iteration 2.89（2026-03-08）：收敛共享契约漂移并恢复全仓 TypeScript 编译

### 目标

- 清理此前阻塞 `pnpm typecheck` 的跨包类型漂移，让 monorepo 回到全量可编译状态。

### 主要改动

- 收敛 `packages/shared` 与下游领域包的契约差异：
  - `FeedbackMode` 恢复兼容 `per_question | end_summary`；
  - `MessageKind` 恢复兼容 `feedback`；
  - `InterviewQuestion` 补回 `level / title / keyPoints` 等题库与引擎依赖字段；
  - `QuestionAssessment` 与 `InterviewReport` 补齐 `questionTitle / answer / feedback / overallScore / level / summary` 等旧链路仍在使用的字段。
- 题库顺序常量收口：移除未被共享主题类型覆盖的 `frontend` 项，避免无效 topic 继续污染编译。
- `packages/interview-engine/src/scoring.ts` 输出结构补齐新旧两套摘要字段，保证共享类型与 mock provider、引擎实现一致。
- 最终恢复全仓 `pnpm typecheck` 通过。

### 迁移/破坏性变更

- 无运行时破坏性迁移；本轮以类型兼容恢复为主。

### 下一步

- 如果后续要继续收口领域模型，可以再单独做一轮“共享契约瘦身”，把当前兼容字段分阶段淘汰，而不是再次让下游包静态失配。

## Iteration 2.90（2026-03-08）：共享契约瘦身第一阶段

### 目标

- 在不破坏现有聊天与面试链路的前提下，收缩 `packages/shared` 中明确重复的契约字段，降低后续继续演化时的认知负担。

### 主要改动

- 收敛 `QuestionAssessment`：移除重复的 `answer / feedback` 字段，仅保留 `summary` 作为题目级总结字段。
- 收敛 `InterviewReport`：移除与 `overallSummary` 语义重复的 `summary` 字段，统一使用 `overallSummary`。
- 收敛 `InterviewQuestion`：移除未被任何下游实际使用的 `expectedPoints`，统一保留 `keyPoints`。
- 清理 `packages/shared/src/contracts.ts` 中未被导出的死代码：删除重复定义的 `InterviewSettings / DEFAULT_INTERVIEW_SETTINGS / QUICK_PROMPTS / normalizeInterviewConfig`，避免共享契约文件继续承担默认值与工具函数职责。
- 下游同步切换到单一 canonical 字段：
  - `packages/interview-engine/src/scoring.ts` 只输出 `summary / overallSummary`；
  - `packages/llm/src/mock-provider.ts` 改为读取 `assessment.summary` 与 `report.overallSummary`。

### 迁移/破坏性变更

- 当前仓库内无破坏性影响；但如果未来有外部消费者直接依赖被删除的冗余字段，需要同步改为读取 `summary / overallSummary / keyPoints`。

### 下一步

- 第二阶段可以继续评估是否把 `contracts.ts` 中剩余的“纯常量/纯默认值”进一步外移，只保留真正的共享契约类型定义。

## Iteration 2.91（2026-03-08）：共享契约瘦身第二阶段

### 目标

- 让 `packages/shared/src/contracts.ts` 回归“只定义共享类型”，进一步清晰 shared 包内部职责边界。

### 主要改动

- 新增 `packages/shared/src/constants.ts`：承载 `APP_NAME / APP_SLUG / MODEL_OPTIONS / INTERVIEW_TOPICS / QUICK_PROMPTS` 等纯常量。
- `packages/shared/src/contracts.ts` 只保留类型定义与响应体类型，不再混放常量。
- `packages/shared/src/defaults.ts` 收敛为单一职责，仅保留 `DEFAULT_INTERVIEW_CONFIG`。
- `packages/shared/src/index.ts` 重新整理对外导出：
  - 类型从 `contracts.ts` 暴露；
  - 常量从 `constants.ts` 暴露；
  - 默认配置从 `defaults.ts` 暴露；
  - 工具函数继续从 `utils.ts` 暴露。

### 迁移/破坏性变更

- 对仓库内现有调用方无破坏性影响；shared 包的公共导出名保持不变。

### 下一步

- 如果后续还要继续收口，可以再评估是否为 `shared` 增加更细的目录分层（如 `types / constants / defaults / utils`），但当前扁平文件数仍可接受。

## Iteration 2.92（2026-03-08）：shared 包目录结构升级

### 目标

- 将 `packages/shared/src` 从“多文件并列”升级为更清晰的职责目录结构，同时保持公共导出方式不变。

### 主要改动

- 新建目录：
  - `packages/shared/src/types`
  - `packages/shared/src/constants`
  - `packages/shared/src/defaults`
  - `packages/shared/src/utils`
- 文件迁移：
  - 共享类型迁入 `types/index.ts`
  - 常量迁入 `constants/index.ts`
  - 默认配置迁入 `defaults/index.ts`
  - 工具函数迁入 `utils/index.ts`
- 根出口 `packages/shared/src/index.ts` 保持统一导出职责，因此仓库内现有 `@mianshitong/shared` 调用方式无需调整。
- 删除旧的并列文件：`contracts.ts / constants.ts / defaults.ts / utils.ts`。

### 迁移/破坏性变更

- 对仓库内无破坏性影响；若外部未来直接引用 shared 内部文件路径，需要改为新的目录路径，但当前项目内未发现此类用法。

### 下一步

- 当前 shared 包已经具备继续扩展的基本目录骨架；后续如新增 schema 校验或 response mapper，可直接按职责落到对应目录，而不需要再堆到根目录。

## Iteration 2.94（2026-03-08）：微调侧栏会话项的置顶位与激活态

### 目标

- 针对侧栏单条会话项，按参考图细调右侧操作位、置顶图钉展示方式、激活态背景与三点热区大小。

### 主要改动

- 置顶会话项的图钉从标题尾部移动到右侧操作位，与 `...` 共用同一位置；默认显示图钉，hover 时切换为 `...`。
- 会话项激活态改为纯背景高亮，不再使用边框与阴影强调。
- 右侧 `...` 操作按钮的热区缩小，收口到更接近参考图的轻量小方块尺寸。

### 迁移/破坏性变更

- 无功能性破坏，仅样式细调。

### 下一步

- 如果还要继续压细节，可以再按截图逐项微调激活态背景明度、右侧图标垂直位置与 hover 过渡时长。

## Iteration 2.95（2026-03-09）：本地 Ollama 默认模型切换为 DeepSeek R1 8B

### 目标

- 让本地免费调试时的默认模型风格更接近线上 DeepSeek 方向，降低每次都要手动覆写 Ollama 模型的成本。

### 主要改动

- 将聊天流式链路里的 Ollama 默认模型从 `llama3.2:latest` 调整为 `deepseek-r1:8b`。
- 将 `packages/llm` 内部 `OllamaStreamChatProvider` 的默认模型同步调整为 `deepseek-r1:8b`。
- 更新 `env.example` 中的 `OLLAMA_MODEL / OLLAMA_REASONER_MODEL` 推荐值，统一为 `deepseek-r1:8b`。

### 迁移/破坏性变更

- 仅影响未显式配置 `OLLAMA_MODEL` 的本地默认行为；如果已有 `.env.local` 指定模型，则仍以本地环境变量为准。

### 下一步

- 如果后续需要进一步贴近生产效果，建议直接补一套 `LLM_PROVIDER=deepseek` 的本地联调配置，并在 UI 上增加当前实际 provider / model 的调试展示。

## Iteration 2.96（2026-03-09）：聊天代码块主题向 ZhiTalk 收口

### 目标

- 让 AI 回复中的代码块背景色、边框与亮暗主题更贴近 `zhitalk.chat` 当前实现。

### 主要改动

- 新增 `chat-code-theme.ts`，将代码高亮主题从分散的全局 CSS 变量收口为两套固定主题对象。
- 聊天代码块改为使用更接近 `zhitalk.chat` 的容器结构：`rounded-xl border` 外框、独立头部工具条、代码区顶部单独分隔线。
- 亮色主题代码区改为 `#ffffff / #24292e`；暗色主题代码区改为 `#24292e / #e1e4e8`，并同步收紧关键词、字符串、函数名、参数等 token 颜色。
- 代码块工具按钮改为更轻量的图标按钮视觉，弱化 hover 背景，保留下载与复制能力。

### 迁移/破坏性变更

- 无接口变更；仅调整聊天代码块的视觉样式与高亮主题。

### 下一步

- 如仍需继续逼近 `zhitalk.chat`，下一步可再针对滚动条样式、横向滚动行为与代码字体做像素级微调。

## Iteration 2.97（2026-03-09）：聊天代码块切换到 Shiki GitHub 双主题

### 目标

- 用现成的 GitHub 系主题替换手写 token 配色，让聊天代码块更稳定地贴近 `zhitalk.chat`，并降低后续维护成本。

### 主要改动

- `@mianshitong/web` 新增 `shiki`，移除 `react-syntax-highlighter` 及其类型依赖。
- 新增 `chat-shiki.ts`，使用 `shiki/bundle/web` 的 `codeToHtml` 生成双主题高亮 HTML。
- 代码块主题切换改为 `github-light + github-dark` 组合，通过 Shiki 官方双主题 CSS 变量实现，不再手写整套 token 颜色。
- `globals.css` 中删除旧的 `.hljs` 大段主题规则，收敛为少量 Shiki 容器样式与 dark mode 覆写。

### 迁移/破坏性变更

- 无接口变更；代码块渲染实现从 `react-syntax-highlighter` 切换为 `shiki`。

### 下一步

- 如果后续仍需进一步逼近 `zhitalk.chat`，可以继续微调 `github-dark` 与 `github-dark-default / dimmed` 的取舍，或再细调工具条尺寸与间距。

## Iteration 2.98（2026-03-09）：修复 markdown 包裹代码块与继续收口代码块细节

### 目标

- 修复 AI 回复把真正的 fenced code 包在外层 `markdown` fence 中时，前端显示成“代码里的代码”问题。
- 继续把聊天代码块的头部按钮和代码区排版向 `zhitalk.chat` 做像素级收口。

### 主要改动

- 新增 `chat-markdown-normalization.ts`，统一处理“外层 `markdown/md` 包裹内层 Markdown 内容”的解包逻辑。
- 服务端 `normalizeAssistantMarkdown` 接入该解包逻辑，确保新生成的回复在落库前就被规范化。
- 客户端 `ChatMarkdown` 渲染前也接入同样的解包逻辑，兼容历史会话中的旧数据。
- 代码块样式继续微调：
  - 工具按钮去掉圆角，与参考站保持一致；
  - 代码区行高收口到 `12px / 16px`；
  - 补齐 monospace 字体栈，保持与参考站更接近的密度与观感。
- 使用 Playwright 复测“用 JS 写一个冒泡排序，返回 markdown 代码块”场景，确认现在会直接展示为 `js` 代码块，不再出现外层 `markdown` 包裹。

### 迁移/破坏性变更

- 无接口变更；仅调整 Markdown 规范化与代码块视觉细节。

### 下一步

- 如果后续仍发现极少数模型回复以异常 fence 形式输出，可继续补更细的 fence 恢复规则，但当前主路径问题已被双层兜底覆盖。

## Iteration 2.99（2026-03-09）：清理未使用的代码与静态资源

### 目标

- 删除当前仓库中已不再被代码引用的孤儿源码文件与模板静态资源，降低噪音与后续维护成本。

### 主要改动

- 删除未被任何运行链路引用的源码文件：
  - `apps/web/src/lib/server/chat-response-code-detection.ts`
  - `apps/web/src/app/chat/components/chat-conversation-skeleton.tsx`
- 删除 `apps/web/public` 下未被项目引用的默认模板 SVG：
  - `window.svg`
  - `globe.svg`
  - `next.svg`
  - `vercel.svg`
  - `file.svg`
- 删除仓库根目录下未被项目引用的临时截图参考文件：
  - `image.png`
  - `image2.png`
  - `zhitalk-code-block-ref.png`

### 迁移/破坏性变更

- 无运行时破坏；本轮仅清理已确认无引用的孤儿文件。

### 下一步

- 如果后续还要继续做减法，可以再单独评估“未使用导出函数/类型”的粒度，但这类清理需要更强的静态分析，不建议和本轮文件级清理混做。

## Iteration 3.00（2026-03-09）：侧栏会话标题左侧基线对齐品牌标题

### 目标

- 让左侧会话列表标题的文字起点与顶部“面试通”品牌标题左端对齐，降低侧栏视觉上的轻微参差感。

### 主要改动

- 收紧 `chat-sidebar-session-item` 的左侧内边距：
  - 去掉会话项外层多余的水平内边距；
  - 去掉会话按钮自身的水平内边距；
- 通过 Playwright 实测对比，当前首条会话标题与“面试通”标题的左边距差值已从 `8px` 收敛为 `0px`。

### 迁移/破坏性变更

- 无，仅为侧栏会话项的视觉微调。

### 下一步

- 如果后续还要继续打磨左侧栏，可再单独评估会话项 hover/active 状态的纵向节奏是否还要进一步压缩。

## Iteration 3.01（2026-03-09）：侧栏会话项 hover 与激活态背景再加深一档

### 目标

- 让左侧会话项的 hover 与选中态背景更有存在感，同时保持当前布局和间距不变。

### 主要改动

- 将会话项选中态背景从 `bg-sidebar-accent/65` 调整为 `bg-sidebar-accent/78`。
- 将会话项 hover 背景从 `hover:bg-sidebar-accent/45` 调整为 `hover:bg-sidebar-accent/58`。

### 迁移/破坏性变更

- 无，仅为侧栏会话项背景色细调。

## Iteration 3.02（2026-03-09）：侧栏会话项背景色拉满到 accent 基准色

### 目标

- 直接查看侧栏会话项在当前主题色板下的“最实色” hover 与选中态效果，便于后续决定是否回退到更浅的透明度版本。

### 主要改动

- 将会话项选中态背景从 `bg-sidebar-accent/78` 调整为 `bg-sidebar-accent`。
- 将会话项 hover 背景从 `hover:bg-sidebar-accent/58` 调整为 `hover:bg-sidebar-accent`。

### 迁移/破坏性变更

- 无，仅为会话项背景色试验性微调。
