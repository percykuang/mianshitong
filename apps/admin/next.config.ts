import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Monorepo: make file tracing aware of workspace root.
  outputFileTracingRoot: path.join(__dirname, '../../'),
  // Only transpile workspace packages actually imported by admin.
  transpilePackages: ['@mianshitong/db'],
};

export default nextConfig;
