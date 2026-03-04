// ESLint v9 flat config (repo root)
// Keep this lightweight; app-specific rules live in Next.js defaults.
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/dist/**',
      '**/build/**',
      '**/out/**',
      '**/coverage/**',
    ],
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    ...js.configs.recommended,
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ['**/*.{ts,tsx,mts,cts}'],
  })),
  {
    files: ['**/*.{js,cjs,mjs,ts,tsx,mts,cts}'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Avoid style conflicts with Prettier.
      ...{},
    },
  },
];
