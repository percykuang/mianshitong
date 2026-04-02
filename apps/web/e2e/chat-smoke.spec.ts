import { expect, test } from '@playwright/test';
import {
  cleanupKnowledgeDocumentFixture,
  cleanupInterviewPlaybookKnowledgeDocumentFixture,
  cleanupResumeKnowledgeDocumentFixture,
  createConfiguredSession,
  createRemoteConversationSession,
  createRemoteSession,
  openChat,
  seedKnowledgeDocumentFixture,
  seedInterviewPlaybookKnowledgeDocumentFixture,
  seedResumeKnowledgeDocumentFixture,
} from './support/chat-e2e-fixtures';

const LONG_INTERVIEW_RESUME_PROMPT = [
  '这是我的简历，请开始面试吧：',
  '个人优势',
  '● 扎实的前端基础知识：对 Event Loop, 浏览器渲染原理，渲染帧，垃圾回收机制，ast 语法树掌握',
  '● 深入理解 Vue，React 原理，并研究过其内部实现',
  '● 对 Vue2/3 响应式原理实现包括对象、数组等数据类型的监听有深入研究',
  '● 对 Vue3 相对于 Vue2 的性能优化提升，例如 diff 算法优化、静态标记和提升、事件监听缓存有自己的理解',
  '● 掌握 Vue 和 React 框架的 diff 算法，理解组件粒度的更新渲染机制',
  '● 对 React 架构的演进（React15-18）有深入研究，例如 Scheduler 调度器、Reconciler 协调器、Renderer 渲染器、Fiber 架构',
  '● 有丰富的微信小程序与 H5 开发经验，对冷启动、热启动、离线缓存方案、增量更新、H5 和 Native 混合开发有一定经验，了解 JSBridge 实现原理',
  '● 熟悉 webpack、rollup、vite 的使用，通过实现 loader、plugins 解决业务问题，把抽象出来的功能打包成 npm 包赋能团队业务',
  '● 对 JavaScript 编译器、swc 和 babel 有一定理解',
  '● 掌握 node 的基本使用，可做工具和 web 服务。熟悉 monorepo 开发及包管理器之间的差异',
  '● 熟悉面向对象、函数式等编程范式，深入理解单元测试、TDD 等开发模式',
  '● 良好的 git 操作，清晰的 commit 提交和 code review，保证代码质量',
  '● 日常使用工具：charles、chrome、vscode 开发及调试',
  '● 对流行的 AI 相关概念 Agent、LLM 应用、RAG 等有一定了解',
  '● 对生成式 AI 概念有扎实理解，了解 LangChain、LangGraph 等框架的使用',
  '工作经历',
  'a 公司',
  'web 前端',
  '2023 - 至今',
  '工作描述：围绕 XXX 业务线进行迭代开发，参与公司基础架构开发，推动 TypeScript 迁移，开发搭建一整套 monorepo 体系。积极参与公司的技术分享会，吸收并输出自己的理解。',
  '技术栈：Vue 生态，微信生态，TypeScript，jest，SSR',
  'b 公司',
  'web 前端',
  '2021 - 2023',
  '工作描述：一家泛金融公司，主要负责业务开发，参与公司的组件库开发与 UI 统一规范，迭代脚手架模板，对新项目进行技术选型，为解决业务痛点封装多个库用于业务上。',
  '技术栈：Vue 生态，微信生态，银行 SDK',
  'c 公司',
  'web 前端',
  '2020 - 2021',
  '工作描述：业务范围较广，针对业务造轮子解决痛点：小程序版 axios、受 koa 启发，通过中间件方式加发布订阅拆解业务。',
  '技术栈：React 生态，微信生态',
  '项目经验',
  'A 项目',
  '前端项目负责人',
  '技术：rollup + JavaScript + 小程序',
  '项目背景：项目复用包原先采用 git 子模块形式管理，为了高效复用和重构，决定用 monorepo 体系来维护并发布 npm 包。',
  '工作内容：搭建多包管理体系，把核心模块抽离出来，进行开发、维护和重构。',
  '1. 基于对 monorepo 的理解，实现了新的 monorepo CLI，配合 pnpm 统筹项目整体，并提供了更智能化的人性功能。',
  '2. 随着项目迭代，构建时间逐渐变慢，采用 swc 替代 babel 优化打包，使构建速度提升 2 倍，并试验性使用 esbuild，使构建进一步接近 3 倍，构建物降低 26%。',
  '3. 抽离出来的包比较简陋，为了提升开发和维护体验，使用 TypeScript 重构，并补充文档，编写测试提供可维护性，权衡之下使用 vitest 替换 jest 编写单元测试。',
  '4. 通过 eslint、commitlint 和 husky 统一项目开发与代码提交风格。',
  '5. 基于 rollup 编写通用配置骨架，为包提供开箱即用功能，同时具备灵活配置。',
  'B 项目',
  '核心开发',
  '项目背景：该项目主要分为二十多个模块，其中日志模块和监控模块是项目重点。',
  '1. 负责前端业务迭代维护，优化脚手架，抽离复用组件，优化业务流程，并指导实习生分担任务。',
  '2. 客户端新开页面频繁，白屏问题明显，使用 vite + egg 搭建服务端渲染，提升用户体验。',
  '3. 对活动数据结构与玩法做沉淀，进行渐进式拆解，抽离常量到后台 JSON 配置，将页面级组件转换成后台运营可编辑能力。',
  '4. 后台管理系统业务模块众多，开发环境构建时间过长，通过指定业务模块构建，将构建时间从分钟级降低为秒级。',
  '5. 因为第三方数据问题，后端做排序会很影响性能，全量数据返回到前端处理。前端使用 IndexedDB 接收数据做分页排序，并基于表格 render 数据结构定义本地数据库表结构、表单渲染与数据导出。',
  'C 项目',
  '前端项目负责人',
  '技术栈：React、Taro、TypeScript、UmiJS、ProComponents、Ant Design、NutUI、monorepo、pnpm、turbo、xgplayer、xlsx、decimal、Sentry 等。',
  '项目介绍：这是一套微短剧内容分发及管理系统，涵盖抖音/微信小程序端和 Web 管理后台，支持多平台、多马甲包统一构建与投放策略配置。',
  '工作职责与项目难点：对系统技术版本升级改造，升级 Vue2 到 Vue3、Vuex 到 Pinia、webpack4 到 webpack5、babel 到 swc，大幅提升系统性能和可维护性。',
  '基于监控平台指标优化首页白屏时间，从 4 秒优化到 1 秒左右，FCP、LCP 得到优化，包体积减少 30%。',
  '自定义 vite / webpack 插件优化图片 preload 和 prefetch。',
  '封装扩展了多文件预览功能组件，目前支持 xls、pdf、word、图片、video、ppt。',
  '主导传统部署方式迁移到 CI/CD，包括自动化 shell 脚本和基于 gitlab / github 的流水线构建。',
  '将基于 JavaScript 的 Vite 构建工具替换为基于 Rust 的 Rsbuild，使项目打包构建时间从 2 分多钟缩短到 20 秒。',
  'D 项目',
  '项目描述：OMS 后台管理系统是一个综合性的管理平台，主要用于管理住房状态、合同签约、账单处理、工单管理、巡检任务、动态定价和智能设备等。',
  '技术栈：React、TypeScript、MobX、Ant Design、ProComponents、qs、xlsx、d3、react-scroll、p-queue、qrcode.react',
  '工作职责：负责需求迭代与新功能开发，封装多个公共组件和模块，提升代码复用性并降低冗余。',
  '封装埋点 SDK 实现数据采集和上报，实现信息加密方案，保障平台数据安全性。',
  '针对用户交互进行了优化，在界面响应速度和操作流畅度上显著提升系统易用性。',
  '落地多项最佳前端实践，例如 tree shaking、uglify 压缩、代码分割、按需加载和懒加载，将首屏加载速度提升约 30%。',
  '重构表单组件，提升可维护性与开发效率；通过 ES6 代理解决表单字段与 store 的绑定问题，并通过单例模式优化筛选字段的记忆和共享。',
  '封装 ProTable 列表组件，结合装饰器思路维护搜索筛选状态，生成适用于 ProTable 的 model schema，提高复用性和扩展性。',
  ...Array.from({ length: 18 }, (_, index) => {
    return `补充说明 ${index + 1}：持续负责前端工程化、性能优化、业务交付、团队协作与技术分享。`;
  }),
].join('\n');

test('新建会话后发送预设消息会走真实流式接口并渲染 provider 输出', async ({ page }) => {
  await openChat(page);
  const prompt = '可以帮我优化简历吗？';
  const streamRequestPromise = page.waitForRequest((request) => {
    return (
      request.method() === 'POST' &&
      /\/api\/chat\/sessions\/[0-9a-f]{32}\/messages\/stream$/.test(new URL(request.url()).pathname)
    );
  });

  await page.getByRole('button', { name: prompt }).click();

  const streamRequest = await streamRequestPromise;
  expect(streamRequest.postDataJSON()).toMatchObject({
    content: prompt,
    modelId: 'deepseek-chat',
  });

  await expect(page).toHaveURL(/\/chat\/[0-9a-f]{32}$/);
  await expect(page.getByTestId('multimodal-input')).toHaveValue('');
  await expect(page.getByRole('main')).toContainText(prompt);
  await expect(page.getByRole('main')).toContainText(
    '[web-e2e] 已按真实模型链路处理：可以帮我优化简历吗？',
  );
  await expect(page.getByRole('main')).not.toContainText('不过，我还没有看到你的简历内容');
  await expect(page.getByTestId('suggested-actions')).toHaveCount(0);
});

test('切换会话时应展示对应会话内容', async ({ page }) => {
  const firstSession = await createRemoteSession(page, '帮我分析 React 列表卡顿问题');
  const secondSession = await createRemoteSession(page, '请帮我优化前端简历');

  await page.goto(`/chat/${firstSession.id}`);

  await expect(page.getByRole('main')).toContainText(firstSession.assistantContent);
  await page.getByRole('button', { name: secondSession.title }).click();

  await expect(page).toHaveURL(new RegExp(`/chat/${secondSession.id}$`));
  await expect(page.getByRole('main')).toContainText(secondSession.assistantContent);
  await expect(page.getByRole('main')).not.toContainText(firstSession.assistantContent);
});

test('删除当前会话后应回到空聊天页', async ({ page }) => {
  const session = await createRemoteSession(page, '这条会话用于删除测试');
  await page.goto(`/chat/${session.id}`);

  const sessionButton = page.getByRole('button', { name: session.title });
  await expect(sessionButton).toBeVisible();
  await sessionButton.hover();
  await page.getByLabel('更多会话操作').click();
  await page.getByRole('menuitem', { name: '删除', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '删除', exact: true }).click();

  await expect(page).toHaveURL(/\/chat$/);
  await expect(page.getByText(session.title)).toHaveCount(0);
  await expect(page.getByText('新建一个会话后，你的聊天记录会展示在这里。')).toBeVisible();
});

test('侧边栏顶部按钮 hover 时不再显示 tooltip', async ({ page }) => {
  await openChat(page);

  await page.getByRole('button', { name: '删除所有会话记录' }).hover();
  await expect(page.getByRole('tooltip')).toHaveCount(0);

  await page.getByRole('button', { name: '新建会话' }).hover();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
});

test('消息复制应仅更新局部 copied 状态，不切换基础文案也不触发顶部反馈条', async ({ page }) => {
  const session = await createRemoteSession(page, '请帮我优化这段项目经历');
  await page.goto(`/chat/${session.id}`);

  const assistantCopy = page.getByTestId('assistant-message-copy');

  await expect(assistantCopy).toHaveAttribute('aria-label', '复制');
  await assistantCopy.click();
  await expect(assistantCopy).toHaveAttribute('data-copy-state', 'copied');
  await expect(assistantCopy).toHaveAttribute('aria-label', '复制');
  await expect(page.getByText('Copied to clipboard!')).toHaveCount(0);
});

test('消息 like/dislike 应支持三态切换和填充图标', async ({ page }) => {
  const session = await createRemoteSession(page, '请帮我优化简历');
  await page.goto(`/chat/${session.id}`);

  const upvote = page.getByTestId('message-upvote');
  const downvote = page.getByTestId('message-downvote');

  await downvote.click();
  await expect(downvote).toBeEnabled();
  await expect(downvote).toHaveAttribute('aria-pressed', 'true');
  await expect(downvote).toHaveAttribute('data-icon-variant', 'fill');

  await downvote.click();
  await expect(downvote).toHaveAttribute('aria-pressed', 'false');
  await expect(downvote).toHaveAttribute('data-icon-variant', 'line');

  await upvote.click();
  await expect(upvote).toBeEnabled();
  await expect(upvote).toHaveAttribute('aria-pressed', 'true');
  await expect(upvote).toHaveAttribute('data-icon-variant', 'fill');
});

test('已有远端会话时停止生成仍应保留本轮用户消息', async ({ page }) => {
  const session = await createRemoteSession(page, '你好');
  const prompt = '第二条消息发送后立刻停止：请详细解释 React Fiber 的工作原理。';

  await page.goto(`/chat/${session.id}`);
  await page.getByTestId('multimodal-input').fill(prompt);
  await page.getByTestId('send-button').click();

  const stopButton = page.getByRole('button', { name: '停止生成' });
  await expect(stopButton).toBeVisible();
  await stopButton.click();

  await page.waitForTimeout(1200);
  await expect(page.getByRole('main')).toContainText(prompt);
  await expect(page.getByRole('main')).not.toContainText('思考中');
});

test('首条超长消息发送后，聊天区应持续自动跟随到底部', async ({ page }) => {
  const session = await createConfiguredSession(page, {
    config: {
      topics: ['engineering'],
      level: 'mid',
      questionCount: 1,
      feedbackMode: 'per_question',
    },
  });

  await page.goto(`/chat/${session.id}`);
  await page.getByTestId('multimodal-input').fill(LONG_INTERVIEW_RESUME_PROMPT);
  await page.getByTestId('send-button').click();

  await expect(page.getByRole('main')).toContainText('第一个问题', { timeout: 15_000 });

  const scrollContainer = page.getByTestId('chat-scroll-container');
  const readDistanceToBottom = async () =>
    scrollContainer.evaluate((element) =>
      Math.max(0, element.scrollHeight - element.clientHeight - element.scrollTop),
    );

  await expect.poll(readDistanceToBottom).toBeLessThanOrEqual(96);
  await page.waitForTimeout(600);
  await expect.poll(readDistanceToBottom).toBeLessThanOrEqual(96);
});

test('停止生成后应保留并持久化已输出的 assistant 部分内容', async ({ page }) => {
  await openChat(page);
  const prompt =
    '请非常详细地解释 React Fiber、调度优先级、可中断渲染、lane 模型，以及它们之间的关系，要求分很多段展开。';

  await page.getByTestId('multimodal-input').fill(prompt);
  await page.getByTestId('send-button').click();
  await expect(page).toHaveURL(/\/chat\/[0-9a-f]{32}$/);

  const stopButton = page.getByRole('button', { name: '停止生成' });
  const latestAssistantMessage = page.locator('article').last();

  await expect(stopButton).toBeVisible();
  await expect(latestAssistantMessage).toContainText('[web-e2e]');
  await stopButton.click();

  await expect(latestAssistantMessage).toContainText('已停止生成');
  await expect(latestAssistantMessage).toContainText('[web-e2e]');

  await page.reload();

  const persistedAssistantMessage = page.locator('article').last();
  await expect(persistedAssistantMessage).toContainText('已停止生成');
  await expect(persistedAssistantMessage).toContainText('[web-e2e]');
});

test('只有最后一条用户消息显示编辑按钮', async ({ page }) => {
  const conversation = await createRemoteConversationSession(page, [
    { user: '第一条问题：解释闭包' },
    { user: '第二条问题：解释事件循环' },
    { user: '第三条问题：解释 React Fiber' },
  ]);

  await page.goto(`/chat/${conversation.id}`);

  const articles = page.locator('article');
  const firstUserArticle = articles.filter({ hasText: '第一条问题：解释闭包' }).first();
  const lastUserArticle = articles.filter({ hasText: '第三条问题：解释 React Fiber' }).first();
  await firstUserArticle.hover();
  await expect(firstUserArticle.getByLabel('编辑消息')).toHaveCount(0);

  await lastUserArticle.hover();
  await expect(lastUserArticle.getByLabel('编辑消息')).toBeVisible();
});

test('编辑最后一条用户消息后仍可正常重生成', async ({ page }) => {
  const conversation = await createRemoteConversationSession(page, [
    { user: '第一条原始问题：解释 React 协调过程' },
    { user: '最后一条原始问题：解释 diff 策略' },
  ]);

  await page.goto(`/chat/${conversation.id}`);

  const lastUserArticle = page
    .locator('article')
    .filter({ hasText: '最后一条原始问题：解释 diff 策略' })
    .first();
  await lastUserArticle.hover();
  await lastUserArticle.getByLabel('编辑消息').click();

  await page.locator('article textarea').fill('最后一条编辑后问题：重新解释 diff 策略，尽量详细');
  await page.getByRole('button', { name: '确定' }).click();

  await expect(page.getByRole('main')).toContainText('第一条原始问题：解释 React 协调过程');
  await expect(page.getByRole('main')).toContainText(
    '[web-e2e] 已按真实模型链路处理：第一条原始问题：解释 React 协调过程',
  );
  await expect(page.getByRole('main')).toContainText(
    '最后一条编辑后问题：重新解释 diff 策略，尽量详细',
  );
  await expect(page.getByRole('main')).toContainText(
    '[web-e2e] 已按真实模型链路处理：最后一条编辑后问题：重新解释 diff 策略，尽量详细',
  );
});

test('模拟面试应按阶段依次进入破冰、技术题和项目深挖', async ({ page }) => {
  test.setTimeout(90_000);
  const session = await createConfiguredSession(page, {
    config: {
      topics: ['engineering'],
      level: 'mid',
      questionCount: 1,
      feedbackMode: 'per_question',
    },
  });

  await page.goto(`/chat/${session.id}`);

  await test.step('启动模拟面试并进入破冰问题', async () => {
    await page
      .getByTestId('multimodal-input')
      .fill(
        '开始模拟面试，我有 4 年前端经验，最近主要做 monorepo、构建优化和前端工程化，负责推进 swc 替换 babel。',
      );
    await page.getByTestId('send-button').click();

    await expect(page.getByRole('main')).not.toContainText('本场共');
    await expect(page.getByRole('main')).not.toContainText('反馈模式');
    await expect(page.getByRole('main')).not.toContainText('已根据你的输入生成本场面试计划');
    await expect(page.getByRole('main')).not.toContainText('重点经历集中在 engineering');
    await expect(page.locator('article').last()).not.toContainText('点评：');
    await expect(page.getByRole('main')).toContainText('开始模拟面试吧');
    await expect(page.getByRole('main')).toContainText('第一个问题');
    await expect(page.getByRole('main')).toContainText(/第一个问题：\s*你先做个简短自我介绍吧/);
    await expect(page.getByRole('main')).not.toContainText('（engineering）');
    await expect(page.getByRole('main')).toContainText('你先做个简短自我介绍吧');
    await expect(page.getByRole('main')).toContainText('（重点讲讲最近几段经历的主线');
    const latestAssistantText = await page.locator('article').last().innerText();
    expect(latestAssistantText).toMatch(
      /第一个问题：\s*你先做个简短自我介绍吧。\n+（重点讲讲最近几段经历的主线/,
    );
    await expect(page.getByRole('main')).not.toContainText('重点讲清三件事');
  });

  await test.step('回答破冰问题后应进入技术题', async () => {
    await page
      .getByTestId('multimodal-input')
      .fill(
        '我最近几段经历的主线都是前端工程化和构建优化，最能代表我的项目是推动 swc 替换 babel 和 monorepo 体系落地，这次想找更偏平台化的机会。',
      );
    await page.getByTestId('send-button').click();

    await expect(page.getByRole('main')).toContainText('点评：', { timeout: 10_000 });
    await expect(page.getByRole('main')).not.toContainText('我最有代表性的项目是 X');
    await expect(page.getByRole('main')).toContainText('第二个问题', { timeout: 10_000 });
  });

  await test.step('完成若干道技术题后应进入项目深挖', async () => {
    const projectPrompt = page.getByText('我们接下来做一轮项目深挖。');
    let enteredProjectStage = false;

    for (let index = 0; index < 10; index += 1) {
      await page
        .getByTestId('multimodal-input')
        .fill(
          '我会先做构建分析定位瓶颈，再从代码分割、缓存、tree shaking、依赖治理和增量构建这些方向优化；在 monorepo 里还会处理 workspace 依赖边界、CI 质量门禁和版本发布。',
        );
      await page.getByTestId('send-button').click();
      await expect
        .poll(async () => page.getByTestId('send-button').getAttribute('aria-label'), {
          timeout: 30_000,
          message: '等待本轮面试回复流式结束',
        })
        .toBe('发送消息');

      try {
        await projectPrompt.waitFor({ state: 'visible', timeout: 1500 });
        enteredProjectStage = true;
        break;
      } catch {
        enteredProjectStage = false;
      }
    }

    expect(enteredProjectStage).toBe(true);
    await expect(page.getByRole('main')).toContainText('工程化或基础设施项目');
    await expect(page.getByRole('main')).not.toContainText('engineering');
    await expect(page.getByRole('main')).not.toContainText('按 STAR 的思路讲清楚');
  });
});

test('模拟面试在开场回答不完整时，应先追问再进入技术题', async ({ page }) => {
  const session = await createConfiguredSession(page, {
    config: {
      topics: ['engineering'],
      level: 'mid',
      questionCount: 1,
      feedbackMode: 'per_question',
    },
  });

  await page.goto(`/chat/${session.id}`);

  await page
    .getByTestId('multimodal-input')
    .fill(
      '开始模拟面试，我有 4 年前端经验，最近主要做 monorepo、构建优化和前端工程化，负责推进 swc 替换 babel。',
    );
  await page.getByTestId('send-button').click();
  await expect(page.getByRole('main')).toContainText('第一个问题');

  await page.getByTestId('multimodal-input').fill('我做前端很多年，也想看看新的机会。');
  await page.getByTestId('send-button').click();

  await expect(page.getByRole('main')).toContainText('点评：', { timeout: 10_000 });
  await expect(page.getByRole('main')).toContainText('真正串起来的主线', {
    timeout: 10_000,
  });
  await expect(page.getByRole('main')).toContainText('我先确认一下', { timeout: 10_000 });
  await expect(page.getByRole('main')).toContainText('主线更偏哪条', {
    timeout: 10_000,
  });
  await expect(page.getByRole('main')).not.toContainText('能力上限');
  await expect(page.getByRole('main')).not.toContainText('我先追一个点');
  await expect(page.getByRole('main')).not.toContainText('沿着什么主线在积累');
  await expect(page.getByRole('main')).not.toContainText('第二个问题');

  await page
    .getByTestId('multimodal-input')
    .fill(
      '最近几段经历的主线还是前端工程化，我最能代表自己的项目是推动 swc 替换 babel 和 monorepo 体系落地，这次想找更偏平台化的机会。',
    );
  await page.getByTestId('send-button').click();

  await expect(page.getByRole('main')).toContainText('第二个问题', { timeout: 10_000 });
  await expect(page.locator('article').last()).toContainText('第二个问题', { timeout: 10_000 });
  await expect(page.locator('article').last()).not.toContainText('第一个问题');
});

test('模拟面试在真实流式回复中停止生成后，仍应保留已输出的 assistant 部分内容', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const session = await createConfiguredSession(page, {
    config: {
      topics: ['engineering'],
      level: 'mid',
      questionCount: 1,
      feedbackMode: 'per_question',
    },
  });

  await page.goto(`/chat/${session.id}`);
  await page
    .getByTestId('multimodal-input')
    .fill(
      '开始模拟面试，我有 4 年前端经验，最近主要做 monorepo、构建优化和前端工程化，负责推进 swc 替换 babel。',
    );
  await page.getByTestId('send-button').click();
  await expect(page.getByRole('main')).toContainText('第一个问题');

  await page
    .getByTestId('multimodal-input')
    .fill(
      '我最近几段经历的主线都是前端工程化和构建优化，最能代表我的项目是推动 swc 替换 babel 和 monorepo 体系落地，这次想找更偏平台化的机会。',
    );
  await page.getByTestId('send-button').click();
  await expect(page.getByRole('main')).toContainText('第二个问题', { timeout: 10_000 });

  await page
    .getByTestId('multimodal-input')
    .fill(
      '浏览器事件循环里，宏任务和微任务都会进入调度队列。一次事件循环通常先执行一个宏任务，宏任务结束后会清空微任务队列，Promise.then 属于微任务，setTimeout 回调属于宏任务。',
    );
  await page.getByTestId('send-button').click();

  const stopButton = page.getByRole('button', { name: '停止生成' });
  const latestAssistantMessage = page.locator('article').last();

  await expect(stopButton).toBeVisible();
  await expect
    .poll(async () => (await latestAssistantMessage.innerText()).trim(), {
      timeout: 10_000,
      message: '等待面试 assistant 开始输出部分内容',
    })
    .toContain('点评：');
  await stopButton.click();

  await expect(page.getByRole('button', { name: '发送消息' })).toBeVisible({ timeout: 8_000 });
  await expect(latestAssistantMessage).toContainText('已停止生成', { timeout: 8_000 });
  await expect(latestAssistantMessage).not.toHaveText(/^$/);

  await page.reload();
  await expect(page.locator('article').last()).toContainText('已停止生成');
  await expect(page.locator('article').last()).not.toHaveText(/^$/);
});

test('命中文档知识时应把知识上下文注入到真实聊天链路', async ({ page }) => {
  const fixture = await seedKnowledgeDocumentFixture();

  try {
    await openChat(page);
    await page.getByTestId('multimodal-input').fill(fixture.prompt);
    await page.getByTestId('send-button').click();

    await expect(page).toHaveURL(/\/chat\/[0-9a-f]{32}$/);
    await expect(page.getByRole('main')).toContainText(fixture.prompt);
    await expect(page.getByRole('main')).toContainText(
      `[web-e2e] 已按真实模型链路处理：${fixture.prompt}`,
    );
    await expect(page.getByRole('main')).toContainText(fixture.expectedKnowledgeHitText);
  } finally {
    await cleanupKnowledgeDocumentFixture();
  }
});

test('简历优化里夹带技术关键词时，真实聊天链路仍应命中 project resume 文档', async ({ page }) => {
  const fixture = await seedResumeKnowledgeDocumentFixture();

  try {
    await openChat(page);
    await page.getByTestId('multimodal-input').fill(fixture.prompt);
    await page.getByTestId('send-button').click();

    await expect(page).toHaveURL(/\/chat\/[0-9a-f]{32}$/);
    await expect(page.getByRole('main')).toContainText(fixture.prompt);
    await expect(page.getByRole('main')).toContainText(
      `[web-e2e] 已按真实模型链路处理：${fixture.prompt}`,
    );
    await expect(page.getByRole('main')).toContainText(fixture.expectedKnowledgeHitText);
  } finally {
    await cleanupResumeKnowledgeDocumentFixture();
  }
});

test('面试流程问题应命中 interview playbook 文档', async ({ page }) => {
  const fixture = await seedInterviewPlaybookKnowledgeDocumentFixture();

  try {
    await openChat(page);
    await page.getByTestId('multimodal-input').fill(fixture.prompt);
    await page.getByTestId('send-button').click();

    await expect(page).toHaveURL(/\/chat\/[0-9a-f]{32}$/);
    await expect(page.getByRole('main')).toContainText(fixture.prompt);
    await expect(page.getByRole('main')).toContainText(
      `[web-e2e] 已按真实模型链路处理：${fixture.prompt}`,
    );
    await expect(page.getByRole('main')).toContainText(fixture.expectedKnowledgeHitText);
  } finally {
    await cleanupInterviewPlaybookKnowledgeDocumentFixture();
  }
});
