import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Monorepo: make file tracing aware of workspace root.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Local workspace packages that need transpilation can be listed here.
  transpilePackages: [
    '@mianshitong/db',
    '@mianshitong/interview-engine',
    '@mianshitong/llm',
    '@mianshitong/question-bank',
    '@mianshitong/shared',
  ],
};

export default nextConfig;
