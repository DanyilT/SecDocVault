module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-community|react-native-svg|react-native-view-shot|react-native-heroicons)/)',
  ],
  moduleNameMapper: {
    'react-native-gesture-handler': '<rootDir>/__mocks__/react-native-gesture-handler.js',
  },
};
