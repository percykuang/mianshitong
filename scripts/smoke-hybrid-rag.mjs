import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const DEFAULT_PORT = 3100;
const HOST = '127.0.0.1';
const DEFAULT_DATABASE_URL = `postgresql://mianshitong:mianshitong@${HOST}:5432/mianshitong?schema=public`;
const DEFAULT_OLLAMA_BASE_URL = `http://${HOST}:11434`;
const START_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 1_000;
const OLLAMA_TIMEOUT_MS = 10_000;
const PORT_SEARCH_LIMIT = 20;
const SMOKE_DIST_ROOT = '.next-smoke';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const webAppRoot = resolve(repoRoot, 'apps/web');
const nextEnvPath = resolve(webAppRoot, 'next-env.d.ts');
const require = createRequire(import.meta.url);
const nextBinPath = require.resolve('next/dist/bin/next', { paths: [webAppRoot] });
const requestedPort = Number(process.env.WEB_PLANNING_SMOKE_PORT ?? DEFAULT_PORT);
let resolvedPort = requestedPort;
let baseUrl = `http://${HOST}:${resolvedPort}`;
let smokeDistDir = '';
let originalNextEnvContent = null;

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
    expectedProfileTags: ['react', 'typescript', 'engineering'],
    expectedBlueprintTags: ['react', 'engineering'],
    expectedQuestionTags: ['react', 'engineering'],
    profileMinHits: 2,
    blueprintMinHits: 2,
    questionMinHits: 2,
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
    expectedProfileTags: ['vue', 'javascript'],
    expectedBlueprintTags: ['vue'],
    expectedQuestionTags: ['vue', 'engineering'],
    profileMinHits: 1,
    blueprintMinHits: 1,
    questionMinHits: 2,
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
    expectedProfileTags: ['performance', 'network', 'javascript'],
    expectedBlueprintTags: ['performance', 'network'],
    expectedQuestionTags: ['performance', 'network'],
    profileMinHits: 2,
    blueprintMinHits: 2,
    questionMinHits: 2,
  },
];

function sleep(ms) {
  return new Promise((resolvePromise) => {
    setTimeout(resolvePromise, ms);
  });
}

function waitForChildExit(child, timeoutMs = 5_000) {
  if (child.exitCode !== null) {
    return Promise.resolve();
  }

  return new Promise((resolvePromise) => {
    const cleanup = () => {
      clearTimeout(timer);
      child.off('exit', handleExit);
      child.off('close', handleExit);
    };

    const handleExit = () => {
      cleanup();
      resolvePromise();
    };

    const timer = setTimeout(() => {
      cleanup();
      resolvePromise();
    }, timeoutMs);

    child.once('exit', handleExit);
    child.once('close', handleExit);
  });
}

function loadLocalEnvFiles() {
  for (const filename of ['.env', '.env.local']) {
    const filepath = resolve(repoRoot, filename);
    if (!existsSync(filepath)) {
      continue;
    }

    process.loadEnvFile(filepath);
  }
}

function configureSmokeEnv() {
  process.env.DATABASE_URL = process.env.DATABASE_URL?.trim() || DEFAULT_DATABASE_URL;
  process.env.OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_BASE_URL;
  process.env.EMBEDDING_PROVIDER = 'ollama';
  process.env.LLM_PROVIDER = 'ollama';
  process.env.NEXT_TELEMETRY_DISABLED = '1';
  smokeDistDir = `${SMOKE_DIST_ROOT}/web-planning-${process.pid}-${Date.now()}`;
  process.env.NEXT_DIST_DIR = smokeDistDir;
}

function checkPortAvailability(port) {
  return new Promise((resolvePromise, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', (error) => {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
        resolvePromise(false);
        return;
      }

      reject(error);
    });
    server.listen(port, HOST, () => {
      server.close(() => {
        resolvePromise(true);
      });
    });
  });
}

async function resolveSmokePort() {
  for (let offset = 0; offset < PORT_SEARCH_LIMIT; offset += 1) {
    const candidate = requestedPort + offset;
    if (await checkPortAvailability(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `从端口 ${requestedPort} 开始连续尝试了 ${PORT_SEARCH_LIMIT} 个端口，仍未找到可用端口。`,
  );
}

function printEnvSummary() {
  console.log('Web 端真实出题 smoke 环境已就绪。');
  console.log(`- DATABASE_URL: ${process.env.DATABASE_URL ? 'configured' : 'missing'}`);
  console.log(`- OLLAMA_BASE_URL: ${process.env.OLLAMA_BASE_URL}`);
  console.log(`- EMBEDDING_PROVIDER: ${process.env.EMBEDDING_PROVIDER}`);
  console.log(`- LLM_PROVIDER: ${process.env.LLM_PROVIDER}`);
  console.log(`- WEB_PLANNING_SMOKE_PORT: ${resolvedPort}`);
  console.log(`- NEXT_DIST_DIR: ${process.env.NEXT_DIST_DIR}`);
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
      followUpTrace: [],
      assessmentTrace: [],
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

async function checkOllamaReady() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const response = await fetch(`${process.env.OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Ollama embedding 服务不可达：${message}。请确认 Ollama 已启动，并且 ${process.env.OLLAMA_BASE_URL} 可访问。`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForServer(child) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < START_TIMEOUT_MS) {
    if (child.exitCode !== null) {
      throw new Error(`web 服务启动失败，退出码 ${child.exitCode}`);
    }

    try {
      const response = await fetch(baseUrl, { method: 'GET' });
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
    process.execPath,
    [nextBinPath, 'dev', '-p', String(resolvedPort), '-H', HOST],
    {
      cwd: webAppRoot,
      env: process.env,
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

function cleanupPreviousSmokeDistDir() {
  const smokeDistRootPath = resolve(webAppRoot, SMOKE_DIST_ROOT);
  if (!existsSync(smokeDistRootPath)) {
    return;
  }

  rmSync(smokeDistRootPath, { recursive: true, force: true });
}

function snapshotNextEnvFile() {
  if (!existsSync(nextEnvPath)) {
    originalNextEnvContent = null;
    return;
  }

  originalNextEnvContent = readFileSync(nextEnvPath, 'utf8');
}

function restoreNextEnvFile() {
  if (originalNextEnvContent === null || !existsSync(nextEnvPath)) {
    return;
  }

  const currentContent = readFileSync(nextEnvPath, 'utf8');
  if (currentContent === originalNextEnvContent) {
    return;
  }

  writeFileSync(nextEnvPath, originalNextEnvContent, 'utf8');
}

function collectProfileTags(resumeProfile) {
  if (!resumeProfile || typeof resumeProfile !== 'object') {
    return new Set();
  }

  const primaryTags = Array.isArray(resumeProfile.primaryTags)
    ? resumeProfile.primaryTags.flatMap((item) =>
        item && typeof item === 'object' && typeof item.tag === 'string' ? [item.tag] : [],
      )
    : [];
  const secondaryTags = Array.isArray(resumeProfile.secondaryTags)
    ? resumeProfile.secondaryTags.flatMap((item) =>
        item && typeof item === 'object' && typeof item.tag === 'string' ? [item.tag] : [],
      )
    : [];
  const projectTags = Array.isArray(resumeProfile.projectTags)
    ? resumeProfile.projectTags.filter((item) => typeof item === 'string')
    : [];

  return new Set([...primaryTags, ...secondaryTags, ...projectTags].map(normalizeTag));
}

function collectBlueprintTags(interviewBlueprint) {
  if (!interviewBlueprint || typeof interviewBlueprint !== 'object') {
    return new Set();
  }

  const tagDistribution = Array.isArray(interviewBlueprint.tagDistribution)
    ? interviewBlueprint.tagDistribution.flatMap((item) =>
        item && typeof item === 'object' && typeof item.tag === 'string' ? [item.tag] : [],
      )
    : [];
  const mustIncludeTags = Array.isArray(interviewBlueprint.mustIncludeTags)
    ? interviewBlueprint.mustIncludeTags.filter((item) => typeof item === 'string')
    : [];
  const optionalTags = Array.isArray(interviewBlueprint.optionalTags)
    ? interviewBlueprint.optionalTags.filter((item) => typeof item === 'string')
    : [];

  return new Set([...tagDistribution, ...mustIncludeTags, ...optionalTags].map(normalizeTag));
}

function collectQuestionTags(questionPlan) {
  return new Set(
    questionPlan.flatMap((question) =>
      Array.isArray(question.tags) ? question.tags.map((tag) => normalizeTag(tag)) : [],
    ),
  );
}

function assertMinimumTagHits(input) {
  const matched = input.expectedTags.filter((tag) => input.availableTags.has(normalizeTag(tag)));
  if (matched.length < input.minHits) {
    throw new Error(
      `场景 ${input.scenarioId} 的 ${input.label} 标签命中不足：实际命中 ${matched.join(', ') || '无'}，至少应命中 ${input.minHits} 个。`,
    );
  }
}

function assertPlanningTrace(runtime, scenarioId, questionPlan) {
  if (!runtime?.planningTrace || !Array.isArray(runtime.planningTrace.steps)) {
    throw new Error(`场景 ${scenarioId} 缺少 planningTrace。`);
  }

  if (runtime.planningTrace.steps.length !== questionPlan.length) {
    throw new Error(
      `场景 ${scenarioId} 的 planningTrace 步数异常：实际 ${runtime.planningTrace.steps.length}，题单数量 ${questionPlan.length}。`,
    );
  }

  for (const [index, question] of questionPlan.entries()) {
    const step = runtime.planningTrace.steps[index];
    if (!step || step.selectedQuestionId !== question.id) {
      throw new Error(
        `场景 ${scenarioId} 的 planningTrace 与题单不一致：第 ${index + 1} 题期望 ${question.id}，实际 ${step?.selectedQuestionId ?? 'null'}。`,
      );
    }
  }
}

function explainNonVectorStrategy(strategy, scenarioId) {
  if (strategy === 'hybrid-lexical-v1') {
    throw new Error(
      `场景 ${scenarioId} 未命中 hybrid-vector-v1，实际为 hybrid-lexical-v1。通常意味着题库 embedding 未回填、Ollama embedding 服务不可用，或当前 embedding 配置与库中向量版本不一致。`,
    );
  }

  throw new Error(`场景 ${scenarioId} 未命中 hybrid-vector-v1，实际为 ${strategy ?? 'null'}。`);
}

async function runScenario(scenario) {
  const response = await fetch(`${baseUrl}/api/chat/stream`, {
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
  const errorEvent = events.find((event) => event.type === 'error');
  if (errorEvent?.data?.message) {
    throw new Error(`场景 ${scenario.id} 返回错误：${errorEvent.data.message}`);
  }

  const doneEvent = events.find((event) => event.type === 'done');
  if (!doneEvent?.data?.session) {
    throw new Error(`场景 ${scenario.id} 没有拿到 done session。`);
  }

  const session = doneEvent.data.session;
  const runtime = session.runtime ?? {};
  const strategy = runtime.planningTrace?.strategy;
  if (strategy !== 'hybrid-vector-v1') {
    explainNonVectorStrategy(strategy, scenario.id);
  }

  const questionPlan = Array.isArray(runtime.questionPlan) ? runtime.questionPlan : [];
  if (questionPlan.length !== scenario.config.questionCount) {
    throw new Error(
      `场景 ${scenario.id} 题单数量异常：期望 ${scenario.config.questionCount}，实际 ${questionPlan.length}。`,
    );
  }

  if (!runtime.resumeProfile || !runtime.interviewBlueprint) {
    throw new Error(`场景 ${scenario.id} 缺少 resumeProfile 或 interviewBlueprint。`);
  }

  assertPlanningTrace(runtime, scenario.id, questionPlan);

  assertMinimumTagHits({
    scenarioId: scenario.id,
    label: '画像',
    availableTags: collectProfileTags(runtime.resumeProfile),
    expectedTags: scenario.expectedProfileTags,
    minHits: scenario.profileMinHits,
  });
  assertMinimumTagHits({
    scenarioId: scenario.id,
    label: '蓝图',
    availableTags: collectBlueprintTags(runtime.interviewBlueprint),
    expectedTags: scenario.expectedBlueprintTags,
    minHits: scenario.blueprintMinHits,
  });
  assertMinimumTagHits({
    scenarioId: scenario.id,
    label: '题单',
    availableTags: collectQuestionTags(questionPlan),
    expectedTags: scenario.expectedQuestionTags,
    minHits: scenario.questionMinHits,
  });

  console.log(`\n[Smoke] ${scenario.id}`);
  console.log(`strategy: ${strategy}`);
  console.log(`profile seniority: ${runtime.resumeProfile.seniority}`);
  console.log(
    `mustIncludeTags: ${
      Array.isArray(runtime.interviewBlueprint.mustIncludeTags)
        ? runtime.interviewBlueprint.mustIncludeTags.join(', ')
        : 'none'
    }`,
  );
  for (const [index, question] of questionPlan.entries()) {
    console.log(
      `${index + 1}. [${question.level}] ${question.title} | tags=${question.tags.join(', ')}`,
    );
  }
}

let webServer;

try {
  loadLocalEnvFiles();
  snapshotNextEnvFile();
  cleanupPreviousSmokeDistDir();
  configureSmokeEnv();

  if (process.argv.includes('--check-env')) {
    printEnvSummary();
    process.exit(0);
  }

  resolvedPort = await resolveSmokePort();
  baseUrl = `http://${HOST}:${resolvedPort}`;

  if (resolvedPort !== requestedPort) {
    console.log(
      `端口 ${requestedPort} 已占用，Web planning smoke 将改用空闲端口 ${resolvedPort}。`,
    );
  }

  await checkOllamaReady();
  webServer = startWebServer();
  await waitForServer(webServer);

  for (const scenario of SCENARIOS) {
    await runScenario(scenario);
  }

  console.log(`\nWeb 端真实出题 smoke 通过。已校验 ${SCENARIOS.length} 个端到端场景。`);
} finally {
  if (webServer) {
    if (webServer.exitCode === null) {
      webServer.kill('SIGTERM');
      await waitForChildExit(webServer, 3_000);
    }

    if (webServer.exitCode === null) {
      webServer.kill('SIGKILL');
      await waitForChildExit(webServer, 3_000);
    }
  }

  restoreNextEnvFile();
  cleanupPreviousSmokeDistDir();
}
