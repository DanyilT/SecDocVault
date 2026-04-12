module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Allow explicit fire-and-forget async calls like `void someAsyncAction()`.
    'no-void': ['error', {allowAsStatement: true}],
    // Inline styles are currently used widely in screen components.
    'react-native/no-inline-styles': 'off',
    // Bitwise ops are used intentionally in hashing/word-array helpers.
    'no-bitwise': 'off',
    // Avoid false positives with Firestore helper names like `doc`.
    '@typescript-eslint/no-shadow': 'off',
  },
};
