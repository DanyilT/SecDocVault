import { generateRecoveryPassphrase } from '../src/services/keyBackup';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('@react-native-firebase/app', () => ({
  getApp: jest.fn(() => ({ name: '[DEFAULT]' })),
}));

jest.mock('@react-native-firebase/firestore/lib/modular', () => ({
  doc: jest.fn(() => ({})),
  deleteDoc: jest.fn(async () => undefined),
  getDoc: jest.fn(async () => ({ exists: () => false })),
  getFirestore: jest.fn(() => ({})),
  setDoc: jest.fn(async () => undefined),
}));

jest.mock('@react-native-firebase/firestore/lib/modular/FieldValue', () => ({
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

describe('generateRecoveryPassphrase', () => {
  test('returns high-entropy hex groups', () => {
    const passphrase = generateRecoveryPassphrase();

    expect(passphrase).toMatch(/^[a-f0-9]{8}(?:-[a-f0-9]{8}){4}$/);
  });

  test('produces different values across invocations', () => {
    const samples = new Set(Array.from({ length: 20 }, () => generateRecoveryPassphrase()));
    expect(samples.size).toBeGreaterThan(1);
  });
});

