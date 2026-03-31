import path from 'node:path';
import type { NextConfig } from 'next';

const distDir = process.env.NEXT_DIST_DIR?.trim();

const nextConfig: NextConfig = {
  output: 'standalone',
  // Monorepo: make file tracing aware of workspace root.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  ...(distDir ? { distDir } : {}),
  // Only transpile workspace packages actually imported by admin.
  transpilePackages: ['@mianshitong/db'],
};

export default nextConfig;
