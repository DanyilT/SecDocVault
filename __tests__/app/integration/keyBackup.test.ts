import {
  ensureRecoveryPassphrase,
  checkIfKeyBackupExistsInFirebase,
  setAutoKeySyncEnabled,
  getAutoKeySyncEnabled,
  deleteKeyBackupFromFirebase,
  clearKeyBackupData,
  restoreDocumentKeysFromPassphrase,
} from '../../../src/services/keyBackup';

const AsyncStorage = require('@react-native-async-storage/async-storage');
const Keychain = require('react-native-keychain');
const Firestore = require('@react-native-firebase/firestore');

// Set up mocks BEFORE importing keyBackup
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

jest.mock('../../../src/services/crypto/documentCrypto.ts', () => ({
  getOrCreateKdfMaterial: jest.fn(async () => ({ passphrase: 'test-passphrase' })),
  getRecoveryPassphrase: jest.fn(async () => null),
  setRecoveryPassphrase: jest.fn(async () => undefined),
  clearVaultPassphraseData: jest.fn(async () => undefined),
  randomWordArray: jest.fn(() => ({
    sigBytes: 16,
    toString: jest.fn(() => 'random-bytes'),
  })),
  toBase64: jest.fn(x => 'base64-encoded'),
  validateRecoveryPassphrase: jest.fn(x => {
    // Must be exactly 5 words separated by hyphens, lowercase and numbers only
    const normalized = String(x).trim();
    if (!normalized) return false;
    if (!/^[a-z0-9-]+$/.test(normalized)) return false;
    const words = normalized.split('-');
    if (words.length !== 5) return false;
    return words.every(word => word.length > 0);
  }),
  wrapDocumentKey: jest.fn(async () => ({
    cipher: 'cipher-text',
    iv: 'iv-value',
    salt: 'salt-value',
    algorithm: 'AES-256-GCM',
    iterations: 100000,
    authTag: 'tag',
  })),
  unwrapDocumentKey: jest.fn(async () => 'unwrapped-key'),
  restoreKdfPassphrase: jest.fn(async () => undefined),
}));

jest.mock('../../../src/services/documentVault/formatters.ts', () => ({
  normalizeDocumentKeyB64: jest.fn(x => x),
}));

describe('keyBackup service', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('ensureRecoveryPassphrase', () => {
    test('throws when no recovery passphrase is stored', async () => {
      const crypto = require('../../../src/services/crypto/documentCrypto.ts');
      (crypto.getRecoveryPassphrase as jest.Mock).mockResolvedValueOnce(null);
      (crypto.getOrCreateKdfMaterial as jest.Mock).mockRejectedValueOnce(new Error('No KDF'));

      await expect(ensureRecoveryPassphrase()).rejects.toThrow(
        'No recovery passphrase found. Please log in and enter your vault passphrase.',
      );
    });

    test('returns existing passphrase when available', async () => {
      const crypto = require('../../../src/services/crypto/documentCrypto.ts');
      (crypto.getRecoveryPassphrase as jest.Mock).mockResolvedValueOnce('existing-passphrase');

      const result = await ensureRecoveryPassphrase();
      expect(result).toBe('existing-passphrase');
    });
  });

  describe('checkIfKeyBackupExistsInFirebase', () => {
    test('returns false for missing owner ID', async () => {
      const result = await checkIfKeyBackupExistsInFirebase('');
      expect(result).toBe(false);
    });

    test('returns true when backup exists', async () => {
      Firestore.getDoc.mockResolvedValueOnce({ exists: () => true });
      const result = await checkIfKeyBackupExistsInFirebase('uid1');
      expect(result).toBe(true);
    });

    test('returns false when backup does not exist', async () => {
      Firestore.getDoc.mockResolvedValueOnce({ exists: () => false });
      const result = await checkIfKeyBackupExistsInFirebase('uid1');
      expect(result).toBe(false);
    });
  });

  describe('setAutoKeySyncEnabled / getAutoKeySyncEnabled', () => {
    test('stores sync enabled state', async () => {
      await setAutoKeySyncEnabled(true);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    test('stores sync disabled state', async () => {
      await setAutoKeySyncEnabled(false);
      expect(AsyncStorage.setItem).toHaveBeenCalled();
    });

    test('retrieves sync enabled state', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce('1');
      const result = await getAutoKeySyncEnabled();
      expect(result).toBe(true);
    });

    test('retrieves sync disabled state', async () => {
      AsyncStorage.getItem.mockResolvedValueOnce('0');
      const result = await getAutoKeySyncEnabled();
      expect(result).toBe(false);
    });
  });

  describe('deleteKeyBackupFromFirebase', () => {
    test('deletes backup document', async () => {
      await deleteKeyBackupFromFirebase('uid1');
      expect(Firestore.deleteDoc).toHaveBeenCalled();
    });
  });

  describe('clearKeyBackupData', () => {
    test('clears all backup data', async () => {
      await clearKeyBackupData();
      expect(AsyncStorage.removeItem).toHaveBeenCalled();
      expect(Keychain.resetGenericPassword).toHaveBeenCalled();
    });
  });

  describe('restoreDocumentKeysFromPassphrase', () => {
    test('rejects empty passphrase', async () => {
      await expect(restoreDocumentKeysFromPassphrase([], '')).rejects.toThrow(
        'Vault passphrase is required.'
      );
    });

    test('returns 0 when no candidates', async () => {
      const result = await restoreDocumentKeysFromPassphrase([], 'passphrase');
      expect(result).toBe(0);
    });
  });
});
