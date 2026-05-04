/**
 * Unit tests for services/keyBackup.ts (non-Firebase utility functions)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

import {
  setAutoKeySyncEnabled,
  getAutoKeySyncEnabled,
  getRecoveryPassphraseForSettings,
  ensureRecoveryPassphrase,
  clearKeyBackupData,
  restoreDocumentKeysFromPassphrase,
} from '../../../src/services/keyBackup';

// Provide deterministic crypto for the underlying documentCrypto module
beforeAll(() => {
  (global as any).crypto = {
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) arr[i] = (i * 37 + 13) % 256;
      return arr;
    },
  };
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// setAutoKeySyncEnabled / getAutoKeySyncEnabled
// ---------------------------------------------------------------------------

describe('setAutoKeySyncEnabled', () => {
  test('writes "1" to AsyncStorage when enabled is true', async () => {
    await setAutoKeySyncEnabled(true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      expect.stringContaining('autoSync.enabled'),
      '1',
    );
  });

  test('writes "0" to AsyncStorage when enabled is false', async () => {
    await setAutoKeySyncEnabled(false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      expect.stringContaining('autoSync.enabled'),
      '0',
    );
  });
});

describe('getAutoKeySyncEnabled', () => {
  test('returns true when stored value is "1"', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('1');
    expect(await getAutoKeySyncEnabled()).toBe(true);
  });

  test('returns false when stored value is "0"', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('0');
    expect(await getAutoKeySyncEnabled()).toBe(false);
  });

  test('returns false when nothing stored', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    expect(await getAutoKeySyncEnabled()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getRecoveryPassphraseForSettings
// ---------------------------------------------------------------------------

describe('getRecoveryPassphraseForSettings', () => {
  test('returns null when no passphrase stored in keychain', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);
    expect(await getRecoveryPassphraseForSettings()).toBeNull();
  });

  test('returns the stored passphrase', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({ password: 'recovery-pass' });
    expect(await getRecoveryPassphraseForSettings()).toBe('recovery-pass');
  });
});

// ---------------------------------------------------------------------------
// ensureRecoveryPassphrase
// ---------------------------------------------------------------------------

describe('ensureRecoveryPassphrase', () => {
  test('returns existing recovery passphrase when stored', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({ password: 'existing-pass' });
    const result = await ensureRecoveryPassphrase();
    expect(result).toBe('existing-pass');
  });

  test('falls back to KDF passphrase when no recovery passphrase exists', async () => {
    // First call: getRecoveryPassphrase (recovery service) -> null
    // Second call: getOrCreateKdfMaterial -> getGenericPassword (kdf service) -> found
    // Third call: getGenericPassword for salt -> (AsyncStorage mock)
    (Keychain.getGenericPassword as jest.Mock)
      .mockResolvedValueOnce(false)                    // recovery passphrase = null
      .mockResolvedValueOnce({ password: 'kdf-pass' }); // KDF passphrase
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('salt123'); // KDF salt

    const result = await ensureRecoveryPassphrase();
    expect(result).toBe('kdf-pass');
  });

  test('throws when neither recovery nor KDF passphrase available', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValue(false);
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    await expect(ensureRecoveryPassphrase()).rejects.toThrow(
      'No recovery passphrase found',
    );
  });
});

// ---------------------------------------------------------------------------
// clearKeyBackupData
// ---------------------------------------------------------------------------

describe('clearKeyBackupData', () => {
  test('removes autoSync key from AsyncStorage', async () => {
    await clearKeyBackupData();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      expect.stringContaining('autoSync.enabled'),
    );
  });

  test('resets autoSync passphrase from Keychain', async () => {
    await clearKeyBackupData();
    expect(Keychain.resetGenericPassword).toHaveBeenCalledWith(
      expect.objectContaining({ service: expect.stringContaining('autoSync') }),
    );
  });
});

// ---------------------------------------------------------------------------
// restoreDocumentKeysFromPassphrase
// ---------------------------------------------------------------------------

describe('restoreDocumentKeysFromPassphrase', () => {
  test('throws when passphrase is empty', async () => {
    await expect(restoreDocumentKeysFromPassphrase([], '')).rejects.toThrow(
      'Vault passphrase is required.',
    );
  });

  test('throws when passphrase is whitespace only', async () => {
    await expect(restoreDocumentKeysFromPassphrase([], '   ')).rejects.toThrow(
      'Vault passphrase is required.',
    );
  });

  test('returns 0 when there are no candidate documents', async () => {
    // No documents -> restores KDF passphrase and returns 0
    const count = await restoreDocumentKeysFromPassphrase([], 'valid-pass');
    expect(count).toBe(0);
    // Should have stored the passphrase via restoreKdfPassphrase
    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
      'vault',
      'valid-pass',
      expect.any(Object),
    );
  });

  test('returns 0 when all documents have recovery wrapMode (no device candidates)', async () => {
    const docs = [
      {
        id: 'doc1',
        name: 'Doc',
        encryptedDocKey: {
          cipher: 'c', iv: 'i', salt: 's', wrapMode: 'recovery',
          algorithm: 'AES-256-GCM', iterations: 100000,
        },
      },
    ] as any[];
    const count = await restoreDocumentKeysFromPassphrase(docs, 'valid-pass');
    expect(count).toBe(0);
  });
});

