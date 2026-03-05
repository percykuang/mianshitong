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
    // Tailwind v4 recommends @import 'tailwindcss' / package imports without url(...)
    'import-notation': null,
  },
};
