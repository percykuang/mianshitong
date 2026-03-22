import { spawn } from 'node:child_process';
import process from 'node:process';

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const START_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 1_000;

const SCENARIOS = [
  {
    id: 'react-typescript-engineering',
    content:
      '开始模拟面试，我有 4 年前端经验，主要做 React、TypeScript 和工程化，负责组件库、构建优化和 Monorepo 流水线。',
    config: {
      level: 'mid',
      topics: ['react', 'javascript', 'engineering'],
      questionCount: 4,
      feedbackMode: 'end_summary',
    },
    expectedTags: ['react', 'engineering'],
  },
  {
    id: 'vue-reactivity-state',
    content:
      '开始模拟面试，我最近主要在做 Vue 3、Pinia 和组合式 API，项目里经常遇到响应式和组件通信问题。',
    config: {
      level: 'mid',
      topics: ['vue', 'javascript', 'engineering'],
      questionCount: 4,
      feedbackMode: 'end_summary',
    },
    expectedTags: ['vue', 'engineering'],
  },
  {
    id: 'performance-network-browser',
    content:
      '开始模拟面试，我最近重点做首屏性能优化、HTTP 缓存、LCP 和浏览器渲染问题排查，想做一场偏性能和网络的前端面试。',
    config: {
      level: 'senior',
      topics: ['performance', 'network', 'javascript'],
      questionCount: 4,
      feedbackMode: 'end_summary',
    },
    expectedTags: ['performance', 'network'],
  },
];

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeTag(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s._/-]+/g, '');
}

function parseSsePayload(text) {
  const events = [];
  for (const block of text.split('\n\n')) {
    const lines = block
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      continue;
    }

    const eventLine = lines.find((line) => line.startsWith('event:'));
    const dataLines = lines.filter((line) => line.startsWith('data:'));
    if (!eventLine || dataLines.length === 0) {
      continue;
    }

    const type = eventLine.slice('event:'.length).trim();
    const dataText = dataLines.map((line) => line.slice('data:'.length).trim()).join('\n');
    events.push({
      type,
      data: JSON.parse(dataText),
    });
  }

  return events;
}

function buildSession(config) {
  return {
    id: `rag-smoke-${crypto.randomUUID()}`,
    title: '新的对话',
    modelId: 'deepseek-chat',
    isPrivate: true,
    status: 'idle',
    config,
    messages: [],
    report: null,
    runtime: {
      questionPlan: [],
      currentQuestionIndex: 0,
      followUpRound: 0,
      activeQuestionAnswers: [],
      assessments: [],
      resumeProfile: null,
      interviewBlueprint: null,
      planningSummary: null,
      planGeneratedAt: null,
      planningTrace: null,
      reportTrace: null,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pinnedAt: null,
  };
}

async function waitForServer(child) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < START_TIMEOUT_MS) {
    if (child.exitCode !== null) {
      throw new Error(`web 服务启动失败，退出码 ${child.exitCode}`);
    }

    try {
      const response = await fetch(BASE_URL, { method: 'GET' });
      if (response.ok) {
        return;
      }
    } catch {}

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(`等待 web 服务启动超时（${START_TIMEOUT_MS}ms）`);
}

function startWebServer() {
  const child = spawn(
    'pnpm',
    ['-C', 'apps/web', 'exec', 'next', 'dev', '-p', String(PORT), '-H', '127.0.0.1'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        EMBEDDING_PROVIDER: 'ollama',
        NEXT_TELEMETRY_DISABLED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  child.stdout.on('data', (chunk) => {
    process.stdout.write(chunk);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(chunk);
  });

  return child;
}

async function runScenario(scenario) {
  const response = await fetch(`${BASE_URL}/api/chat/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      modelId: 'deepseek-chat',
      messages: [{ role: 'user', content: scenario.content }],
      session: buildSession(scenario.config),
    }),
  });

  if (!response.ok) {
    throw new Error(`场景 ${scenario.id} 请求失败：HTTP ${response.status}`);
  }

  const text = await response.text();
  const events = parseSsePayload(text);
  const doneEvent = events.find((event) => event.type === 'done');
  if (!doneEvent?.data?.session) {
    throw new Error(`场景 ${scenario.id} 没有拿到 done session。`);
  }

  const session = doneEvent.data.session;
  const strategy = session.runtime?.planningTrace?.strategy;
  if (strategy !== 'hybrid-vector-v1') {
    throw new Error(`场景 ${scenario.id} 未命中 hybrid-vector-v1，实际为 ${strategy ?? 'null'}`);
  }

  const questionPlan = Array.isArray(session.runtime?.questionPlan)
    ? session.runtime.questionPlan
    : [];
  if (questionPlan.length !== scenario.config.questionCount) {
    throw new Error(
      `场景 ${scenario.id} 题单数量异常，期望 ${scenario.config.questionCount}，实际 ${questionPlan.length}`,
    );
  }

  const tagUniverse = new Set(
    questionPlan.flatMap((question) =>
      Array.isArray(question.tags) ? question.tags.map((tag) => normalizeTag(tag)) : [],
    ),
  );
  const missingTags = scenario.expectedTags.filter((tag) => !tagUniverse.has(tag));
  if (missingTags.length > 0) {
    throw new Error(
      `场景 ${scenario.id} 题单未覆盖预期标签：${missingTags.join(', ')}。实际题单标签：${[
        ...tagUniverse,
      ].join(', ')}`,
    );
  }

  console.log(`\n[Smoke] ${scenario.id}`);
  console.log(`strategy: ${strategy}`);
  for (const [index, question] of questionPlan.entries()) {
    console.log(
      `${index + 1}. [${question.level}] ${question.title} | tags=${question.tags.join(', ')}`,
    );
  }
}

let webServer;

try {
  webServer = startWebServer();
  await waitForServer(webServer);

  for (const scenario of SCENARIOS) {
    await runScenario(scenario);
  }

  console.log(`\nHybrid RAG smoke 通过。已校验 ${SCENARIOS.length} 个端到端场景。`);
} finally {
  if (webServer && webServer.exitCode === null) {
    webServer.kill('SIGTERM');
    await sleep(1_000);
    if (webServer.exitCode === null) {
      webServer.kill('SIGKILL');
    }
  }
}
