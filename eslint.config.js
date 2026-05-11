/** @type {import('eslint').Linter.Config[]} */

const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

const commonGlobals = {
  __dirname: 'readonly',
  __filename: 'readonly',
  Buffer: 'readonly',
  clearInterval: 'readonly',
  clearTimeout: 'readonly',
  console: 'readonly',
  global: 'readonly',
  process: 'readonly',
  setInterval: 'readonly',
  setTimeout: 'readonly',
};

const testGlobals = {
  describe: 'readonly',
  test: 'readonly',
  it: 'readonly',
  expect: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  afterAll: 'readonly',
  jest: 'readonly',
};

module.exports = [
  {
    ignores: [
      'node_modules/**',
      'Pods/**',
      'android/**',
      'ios/**',
      'build/**',
      'coverage/**',
      'dist/**',
      '**/*.config.js',
    ],
  },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: commonGlobals,
    },
  },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: commonGlobals,
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
    },
    rules: {
      '@typescript-eslint/no-shadow': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: ['jest.setup.js', '**/*.test.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: testGlobals,
    },
  },
  {
    rules: {
      // Allow explicit fire-and-forget async calls like `void someAsyncAction()`.
      'no-void': ['error', { allowAsStatement: true }],
      // Inline styles are currently used widely in screen components.
      'react-native/no-inline-styles': 'off',
      // Bitwise ops are used intentionally in hashing/word-array helpers.
      'no-bitwise': 'off',
    },
  },
];
