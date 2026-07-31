/* eslint-env node */
module.exports = {
  root: true,
  env: { browser: true, es2022: true },
  parser: '@typescript-eslint/parser',
  parserOptions: { ecmaVersion: 'latest', sourceType: 'module', ecmaFeatures: { jsx: true } },
  plugins: ['@typescript-eslint', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', 'node_modules', 'playwright-report', 'test-results', 'src/api/generated'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'off',
    '@typescript-eslint/no-unused-vars': [
      'error',
      { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
    ],
    'no-restricted-globals': [
      'error',
      { name: 'localStorage', message: 'Refresh token tidak boleh disimpan di localStorage.' },
    ],
    'no-console': ['error', { allow: ['warn', 'error'] }],
    eqeqeq: ['error', 'smart'],
  },
  overrides: [
    {
      files: ['src/app/theme-context.tsx', 'src/i18n/**/*.ts'],
      // Tema dan preferensi bahasa memang disimpan pada localStorage.
      rules: { 'no-restricted-globals': 'off' },
    },
    {
      files: ['src/test/**/*.ts', 'src/test/**/*.tsx', 'e2e/**/*.ts'],
      env: { node: true },
      rules: { 'no-restricted-globals': 'off' },
    },
    {
      // Naskah pembangun aset berjalan di Node, bukan di peramban, dan memang
      // melaporkan kemajuannya ke konsol — itu satu-satunya keluarannya.
      files: ['scripts/**/*.mjs'],
      env: { node: true, browser: false },
      rules: { 'no-console': 'off' },
    },
  ],
};
