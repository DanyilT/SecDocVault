import { ensureRecoveryPassphrase } from '../../../src/services/keyBackup';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('@react-native-firebase/app', () => ({
  getApp: jest.fn(() => ({ name: '[DEFAULT]' })),
}));

jest.mock('@react-native-firebase/firestore', () => ({
  doc: jest.fn(() => ({})),
  deleteDoc: jest.fn(async () => undefined),
  getDoc: jest.fn(async () => ({ exists: () => false })),
  getFirestore: jest.fn(() => ({})),
  setDoc: jest.fn(async () => undefined),
  serverTimestamp: jest.fn(() => 'mock-timestamp'),
}));

jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  },
  getGenericPassword: jest.fn(async () => false),
  setGenericPassword: jest.fn(async () => true),
  resetGenericPassword: jest.fn(async () => true),
}));

jest.mock('react-native-fs', () => ({
  DownloadDirectoryPath: '/tmp',
  DocumentDirectoryPath: '/tmp',
  writeFile: jest.fn(async () => undefined),
}));

describe('ensureRecoveryPassphrase', () => {
  test('throws when no recovery passphrase is stored', async () => {
    await expect(ensureRecoveryPassphrase()).rejects.toThrow(
      'No recovery passphrase configured',
    );
  });
});
