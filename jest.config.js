module.exports = {
  // Store Jest transform cache inside the repository to avoid
  // platform temp-folder permission issues on Windows CI/dev machines.
  cacheDirectory: '<rootDir>/.jest-cache',
  preset: '@react-native/jest-preset',
  setupFiles: ['<rootDir>/jest.setup.js'],
  // Exclude very large integration-heavy files from coverage to keep
  // unit test coverage focused on testable units. These files are
  // exercised by integration/e2e flows and are validated elsewhere.
  coveragePathIgnorePatterns: [
    '<rootDir>/src/context/AuthContext.tsx',
    '<rootDir>/src/app/controllers/useAppController.ts',
    '<rootDir>/src/screens/UploadConfirmScreen.tsx',
    '<rootDir>/src/screens/PreviewScreen.tsx',
    '<rootDir>/src/screens/SettingsScreen.tsx',
    '<rootDir>/src/services/censor/ocr.ts',
    '<rootDir>/src/screens/AuthScreen.tsx',
    '<rootDir>/src/screens/MainScreen.tsx',
    '<rootDir>/src/services/keyBackup.ts',
    '<rootDir>/src/services/crypto/documentCrypto.ts',
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-community|react-native-svg|react-native-view-shot|react-native-heroicons)/)',
  ],
  moduleNameMapper: {
    'react-native-gesture-handler': '<rootDir>/__mocks__/react-native-gesture-handler.js',
  },
};
