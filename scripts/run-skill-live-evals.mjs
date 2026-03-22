import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..');
const envFiles = ['.env', '.env.local'];

function loadLocalEnvFiles() {
  for (const filename of envFiles) {
    const filepath = resolve(repoRoot, filename);
    if (!existsSync(filepath)) {
      continue;
    }

    process.loadEnvFile(filepath);
  }
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`运行 live eval 前缺少环境变量 ${name}。已自动尝试加载 .env / .env.local。`);
  }
}

async function main() {
  loadLocalEnvFiles();

  process.env.RUN_LLM_EVALS = '1';
  process.env.LLM_PROVIDER = 'deepseek';

  requireEnv('DEEPSEEK_API_KEY');

  if (process.argv.includes('--check-env')) {
    console.log('DeepSeek live eval 环境已就绪。');
    return;
  }

  const command = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
  const child = spawn(
    command,
    ['exec', 'vitest', 'run', 'packages/evals/src/skill-live-evals.test.ts'],
    {
      cwd: repoRoot,
      env: process.env,
      stdio: 'inherit',
    },
  );

  await new Promise((resolvePromise, reject) => {
    child.on('error', reject);
    child.on('exit', (code, signal) => {
      if (signal) {
        reject(new Error(`live eval 被信号 ${signal} 中断。`));
        return;
      }

      resolvePromise(code ?? 1);
    });
  }).then((code) => {
    process.exitCode = Number(code);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
