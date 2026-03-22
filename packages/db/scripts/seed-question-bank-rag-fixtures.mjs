import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const DEFAULT_DATABASE_URL =
  'postgresql://mianshitong:mianshitong@127.0.0.1:5432/mianshitong?schema=public';
const QUESTION_ID_PREFIX = 'rag_fixture_';
const ORDER_BASE = 9000;

const LEVEL_CONFIG = {
  junior: {
    label: '初级',
    promptFocus: '请先讲清楚概念，再给一个你能落地的简单业务例子。',
    answerFocus: '回答应覆盖基础概念、常见坑点和简单实践。',
    followUpFocus: '如果你要继续追问初级候选人，会重点看哪些基础点？',
  },
  mid: {
    label: '中级',
    promptFocus: '请从原理、调试方式和项目落地经验三个层面展开。',
    answerFocus: '回答应覆盖原理分析、排查路径和工程实践。',
    followUpFocus: '如果进入深入追问，你会怎么评估方案权衡？',
  },
  senior: {
    label: '高级',
    promptFocus: '请把它放到复杂系统或团队协作场景里，说明你的设计和取舍。',
    answerFocus: '回答应覆盖架构权衡、稳定性和团队级治理方式。',
    followUpFocus: '如果这是核心链路，你会如何做技术决策和风险兜底？',
  },
};

const TOPICS = [
  {
    key: 'javascript',
    label: 'JavaScript',
    baseTags: ['javascript', 'frontend'],
    variants: [
      {
        slug: 'event-loop',
        title: '事件循环与微任务调度',
        secondaryTags: ['browser'],
        prompt:
          '请解释宏任务、微任务、Promise、setTimeout 在浏览器中的执行顺序，以及你会如何排查异步时序 bug。',
        answer: '参考思路应覆盖调用栈、任务队列、微任务优先级，以及常见的竞态和时序问题排查方法。',
        keyPoints: ['事件循环', '微任务', '宏任务', 'Promise', 'setTimeout'],
      },
      {
        slug: 'closure-memory',
        title: '闭包与内存泄漏排查',
        secondaryTags: ['performance'],
        prompt:
          '请说明闭包的本质、典型使用场景，以及闭包在定时器、监听器或缓存中如何导致内存泄漏。',
        answer: '参考思路应覆盖词法作用域、闭包保留变量环境、监听器解绑和大对象释放等实践。',
        keyPoints: ['闭包', '作用域链', '垃圾回收', '监听器解绑', '内存泄漏'],
      },
    ],
  },
  {
    key: 'typescript',
    label: 'TypeScript',
    baseTags: ['typescript', 'frontend'],
    variants: [
      {
        slug: 'generic-design',
        title: '泛型约束与类型设计',
        secondaryTags: ['engineering'],
        prompt: '请结合一个通用组件或请求 SDK，讲讲你如何设计泛型、约束和返回值推导。',
        answer: '参考思路应覆盖泛型参数、extends 约束、infer 推导和类型复用策略。',
        keyPoints: ['泛型', 'extends', 'infer', '类型推导', '复用'],
      },
      {
        slug: 'type-guard',
        title: '类型守卫与运行时校验',
        secondaryTags: ['javascript'],
        prompt:
          '请说明 TypeScript 类型在运行时不存在后，你会如何通过类型守卫和 schema 校验保证接口安全。',
        answer: '参考思路应覆盖 unknown、类型守卫、判别联合和运行时校验边界。',
        keyPoints: ['类型守卫', '判别联合', 'unknown', '运行时校验', '接口安全'],
      },
    ],
  },
  {
    key: 'react',
    label: 'React',
    baseTags: ['react', 'frontend'],
    variants: [
      {
        slug: 'rendering-performance',
        title: '渲染链路与重渲染优化',
        secondaryTags: ['performance'],
        prompt:
          '请结合真实项目说明 React 组件为什么会重复渲染，以及你如何用 memo、拆分状态和 Profiler 去定位问题。',
        answer: '参考思路应覆盖父子渲染传递、引用稳定性、Profiler 观察和优化前后验证。',
        keyPoints: ['重渲染', 'memo', 'Profiler', '引用稳定', '状态拆分'],
      },
      {
        slug: 'hooks-side-effects',
        title: 'Hooks 副作用与闭包陷阱',
        secondaryTags: ['javascript'],
        prompt:
          '请说明 useEffect、useMemo、useCallback 的使用边界，以及 stale closure 和依赖项遗漏会带来什么问题。',
        answer: '参考思路应覆盖副作用模型、依赖数组、闭包陷阱和 eslint hook 规则。',
        keyPoints: ['useEffect', 'useMemo', 'useCallback', 'stale closure', '依赖数组'],
      },
    ],
  },
  {
    key: 'vue',
    label: 'Vue',
    baseTags: ['vue', 'frontend'],
    variants: [
      {
        slug: 'reactivity-core',
        title: '响应式系统与依赖收集',
        secondaryTags: ['javascript'],
        prompt:
          '请解释 Vue 3 响应式系统的核心机制，以及 reactive、ref、computed 在工程中的使用差异。',
        answer: '参考思路应覆盖 Proxy、track/trigger、ref unwrap 和 computed 缓存。',
        keyPoints: ['Proxy', 'reactive', 'ref', 'computed', '依赖收集'],
      },
      {
        slug: 'component-communication',
        title: '组件通信与状态治理',
        secondaryTags: ['engineering'],
        prompt:
          '请说明 props、emit、provide/inject、Pinia 各自适合什么场景，以及状态边界如何划分。',
        answer: '参考思路应覆盖组件边界、局部状态、全局状态和可维护性权衡。',
        keyPoints: ['props', 'emit', 'provide/inject', 'Pinia', '状态边界'],
      },
    ],
  },
  {
    key: 'engineering',
    label: '工程化',
    baseTags: ['engineering', 'frontend'],
    variants: [
      {
        slug: 'build-pipeline',
        title: '构建链路与包体优化',
        secondaryTags: ['performance'],
        prompt: '请说明你如何分析前端构建慢和包体大问题，并结合 Vite 或 Webpack 给出优化路径。',
        answer: '参考思路应覆盖 bundle 分析、代码分割、缓存和依赖治理。',
        keyPoints: ['构建分析', '代码分割', '缓存', 'tree shaking', '依赖治理'],
      },
      {
        slug: 'monorepo-ci',
        title: 'Monorepo 与 CI 质量门禁',
        secondaryTags: ['typescript'],
        prompt:
          '请结合团队协作说明 Monorepo 的收益与成本，以及你如何设计 lint、typecheck、test 和发布流水线。',
        answer: '参考思路应覆盖 workspace 依赖边界、增量构建、质量门禁和版本发布。',
        keyPoints: ['Monorepo', 'CI', 'lint', 'typecheck', '发布流水线'],
      },
    ],
  },
  {
    key: 'performance',
    label: '性能优化',
    baseTags: ['performance', 'frontend'],
    variants: [
      {
        slug: 'web-vitals',
        title: 'Web Vitals 指标治理',
        secondaryTags: ['browser'],
        prompt: '请说明 LCP、CLS、INP 分别代表什么，以及你会如何在真实页面里分析和优化它们。',
        answer: '参考思路应覆盖性能指标含义、监控采集、瓶颈定位和优化手段。',
        keyPoints: ['LCP', 'CLS', 'INP', '性能监控', '首屏优化'],
      },
      {
        slug: 'large-list',
        title: '长列表与高频交互卡顿',
        secondaryTags: ['react'],
        prompt: '请结合长列表或数据大屏场景，说明你如何处理渲染卡顿、滚动抖动和高频事件开销。',
        answer: '参考思路应覆盖虚拟列表、分片更新、节流防抖和渲染批量化。',
        keyPoints: ['虚拟列表', '节流', '防抖', '分片更新', '卡顿排查'],
      },
    ],
  },
  {
    key: 'network',
    label: '网络',
    baseTags: ['network', 'frontend'],
    variants: [
      {
        slug: 'http-cache',
        title: 'HTTP 缓存与协商缓存',
        secondaryTags: ['performance'],
        prompt: '请解释强缓存、协商缓存、CDN 缓存的区别，以及前端静态资源版本策略如何设计。',
        answer: '参考思路应覆盖 Cache-Control、ETag、Last-Modified 和版本化发布。',
        keyPoints: ['强缓存', '协商缓存', 'Cache-Control', 'ETag', 'CDN'],
      },
      {
        slug: 'realtime-connection',
        title: '实时连接与断线重连策略',
        secondaryTags: ['node'],
        prompt:
          '请说明 WebSocket、SSE、轮询的适用边界，以及弱网环境下你如何设计断线重连和消息一致性。',
        answer: '参考思路应覆盖连接模型、重试退避、心跳和幂等处理。',
        keyPoints: ['WebSocket', 'SSE', '重连', '心跳', '幂等'],
      },
    ],
  },
  {
    key: 'browser',
    label: '浏览器',
    baseTags: ['browser', 'frontend'],
    variants: [
      {
        slug: 'render-pipeline',
        title: '浏览器渲染流水线',
        secondaryTags: ['css'],
        prompt:
          '请讲讲从 HTML、CSS、JS 到最终页面展示的关键步骤，以及 reflow、repaint 什么时候发生。',
        answer: '参考思路应覆盖解析、样式计算、布局、绘制和合成层。',
        keyPoints: ['DOM', 'CSSOM', '布局', '重排', '重绘'],
      },
      {
        slug: 'storage-cross-tab',
        title: '多标签页状态同步与存储',
        secondaryTags: ['javascript'],
        prompt:
          '请说明 localStorage、sessionStorage、IndexedDB、BroadcastChannel 在前端状态同步中的使用差异。',
        answer: '参考思路应覆盖存储容量、同步机制、跨标签通信和一致性问题。',
        keyPoints: ['localStorage', 'IndexedDB', 'BroadcastChannel', '跨标签', '一致性'],
      },
    ],
  },
  {
    key: 'node',
    label: 'Node.js',
    baseTags: ['node', 'frontend'],
    variants: [
      {
        slug: 'event-loop-stream',
        title: 'Node 事件循环与流式背压',
        secondaryTags: ['javascript'],
        prompt:
          '请说明 Node 事件循环与浏览器的差异，以及在文件处理或代理服务里如何处理 stream 背压。',
        answer: '参考思路应覆盖事件循环阶段、stream 管道和 backpressure 控制。',
        keyPoints: ['Node 事件循环', 'stream', 'backpressure', 'pipe', '性能'],
      },
      {
        slug: 'bff-boundary',
        title: 'BFF 边界与服务端错误治理',
        secondaryTags: ['engineering'],
        prompt: '请结合 Next.js 或 Node BFF，说明接口聚合、鉴权透传、日志追踪和错误隔离该怎么做。',
        answer: '参考思路应覆盖 BFF 价值、鉴权边界、日志链路和降级策略。',
        keyPoints: ['BFF', '鉴权', '日志追踪', '错误隔离', '降级'],
      },
    ],
  },
  {
    key: 'css',
    label: 'CSS',
    baseTags: ['css', 'frontend'],
    variants: [
      {
        slug: 'layout-system',
        title: '现代布局与响应式体系',
        secondaryTags: ['browser'],
        prompt: '请说明 Flex、Grid、容器查询和响应式断点在复杂后台系统中的布局策略。',
        answer: '参考思路应覆盖布局模型选择、响应式边界和可维护性。',
        keyPoints: ['Flex', 'Grid', '容器查询', '响应式', '布局体系'],
      },
      {
        slug: 'stacking-context',
        title: '层叠上下文与疑难样式排查',
        secondaryTags: ['performance'],
        prompt: '请解释层叠上下文、z-index、BFC 以及你如何排查遮挡、滚动和粘性定位类样式问题。',
        answer: '参考思路应覆盖层叠规则、BFC、sticky 限制和 DevTools 排查方式。',
        keyPoints: ['层叠上下文', 'z-index', 'BFC', 'sticky', 'DevTools'],
      },
    ],
  },
];

function resolveDatabaseUrl() {
  return process.env.DATABASE_URL || DEFAULT_DATABASE_URL;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function buildFixtureRecords() {
  const records = [];
  let order = ORDER_BASE;

  for (const topic of TOPICS) {
    for (const [level, levelConfig] of Object.entries(LEVEL_CONFIG)) {
      for (const variant of topic.variants) {
        const tags = [...new Set([...topic.baseTags, ...variant.secondaryTags])];
        const title = `${topic.label}${levelConfig.label}：${variant.title}`;
        records.push({
          questionId: `${QUESTION_ID_PREFIX}${topic.key}_${level}_${variant.slug}`,
          level,
          title,
          prompt: `${variant.prompt}\n${levelConfig.promptFocus}`,
          answer: `${variant.answer}\n${levelConfig.answerFocus}`,
          keyPoints: [...variant.keyPoints],
          followUps: [
            levelConfig.followUpFocus,
            `如果这是 ${topic.label} 相关核心链路，你会优先看哪几个指标或排查点？`,
          ],
          tags,
          order,
          isActive: true,
        });
        order += 1;
      }
    }
  }

  return records;
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: resolveDatabaseUrl(),
  }),
  log: ['error'],
});

try {
  const cleanupOnly = hasFlag('--cleanup');
  const resetFirst = hasFlag('--reset');

  if (cleanupOnly) {
    const deleted = await prisma.questionBankItem.deleteMany({
      where: { questionId: { startsWith: QUESTION_ID_PREFIX } },
    });
    console.log(`已删除 ${deleted.count} 条 RAG 测试题库夹具。`);
    process.exit(0);
  }

  if (resetFirst) {
    const deleted = await prisma.questionBankItem.deleteMany({
      where: { questionId: { startsWith: QUESTION_ID_PREFIX } },
    });
    console.log(`已重置旧夹具 ${deleted.count} 条。`);
  }

  const records = buildFixtureRecords();
  let createdCount = 0;
  let updatedCount = 0;

  for (const record of records) {
    const existing = await prisma.questionBankItem.findUnique({
      where: { questionId: record.questionId },
      select: { id: true },
    });

    await prisma.questionBankItem.upsert({
      where: { questionId: record.questionId },
      update: record,
      create: record,
    });

    if (existing) {
      updatedCount += 1;
    } else {
      createdCount += 1;
    }
  }

  const totalFixtures = await prisma.questionBankItem.count({
    where: { questionId: { startsWith: QUESTION_ID_PREFIX } },
  });

  console.log(
    `RAG 测试题库夹具已写入完成。新增 ${createdCount} 条，更新 ${updatedCount} 条，当前夹具总数 ${totalFixtures} 条。`,
  );
} finally {
  await prisma.$disconnect();
}
