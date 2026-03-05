export default {
  extends: ['stylelint-config-standard'],
  ignoreFiles: ['**/node_modules/**', '**/.next/**', '**/dist/**', '**/build/**', '**/coverage/**'],
  rules: {
    'at-rule-no-unknown': [
      true,
      {
        ignoreAtRules: ['theme', 'custom-variant', 'tailwind', 'apply', 'layer', 'utility'],
      },
    ],
    // Keep current code style; focus on error-prevention linting first.
    'color-hex-length': null,
    'font-family-name-quotes': null,
    'import-notation': null,
    'media-feature-range-notation': null,
    'rule-empty-line-before': null,
  },
};
