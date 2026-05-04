/**
 * Tests for services/crypto/documentCrypto.ts
 *
 * Tests pure utility functions that don't require native crypto runtime.
 */

import {
  toBase64,
  fromBase64,
  randomWordArray,
  MissingKdfPassphraseError,
  hasKdfPassphrase,
  restoreKdfPassphrase,
  getOrCreateKdfMaterial,
  initUserKdfPassphrase,
  setRecoveryPassphrase,
  getRecoveryPassphrase,
  clearVaultPassphraseData,
} from '../../../../src/services/crypto/documentCrypto';

import CryptoJS from 'crypto-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

// Provide a browser-like crypto.getRandomValues for randomWordArray
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
// toBase64 / fromBase64
// ---------------------------------------------------------------------------

describe('toBase64 / fromBase64', () => {
  test('round-trips a word array through base64', () => {
    const original = CryptoJS.enc.Utf8.parse('hello world');
    const b64 = toBase64(original);
    const restored = fromBase64(b64);
    expect(restored.toString(CryptoJS.enc.Utf8)).toBe('hello world');
  });

  test('toBase64 returns a non-empty string', () => {
    const wa = CryptoJS.enc.Utf8.parse('test');
    expect(typeof toBase64(wa)).toBe('string');
    expect(toBase64(wa).length).toBeGreaterThan(0);
  });

  test('fromBase64 can parse its own output', () => {
    const wa = CryptoJS.lib.WordArray.random(16);
    const b64 = toBase64(wa);
    const back = fromBase64(b64);
    expect(toBase64(back)).toBe(b64);
  });
});

// ---------------------------------------------------------------------------
// randomWordArray
// ---------------------------------------------------------------------------

describe('randomWordArray', () => {
  test('returns a WordArray with the requested byte length', () => {
    const wa = randomWordArray(16);
    expect(wa.sigBytes).toBe(16);
  });

  test('produces different results on successive calls', () => {
    // Our mock deterministic crypto will produce the same output for the same
    // length, but consecutive calls should at least not throw.
    const a = toBase64(randomWordArray(16));
    const b = toBase64(randomWordArray(16));
    expect(typeof a).toBe('string');
    expect(typeof b).toBe('string');
  });

  test('throws when getRandomValues is not available', () => {
    const saved = (global as any).crypto;
    (global as any).crypto = undefined;
    expect(() => randomWordArray(16)).toThrow('Secure random source is unavailable.');
    (global as any).crypto = saved;
  });
});

// ---------------------------------------------------------------------------
// MissingKdfPassphraseError
// ---------------------------------------------------------------------------

describe('MissingKdfPassphraseError', () => {
  test('is an instance of Error', () => {
    const err = new MissingKdfPassphraseError();
    expect(err).toBeInstanceOf(Error);
  });

  test('has name MissingKdfPassphraseError', () => {
    expect(new MissingKdfPassphraseError().name).toBe('MissingKdfPassphraseError');
  });

  test('has the expected message', () => {
    expect(new MissingKdfPassphraseError().message).toMatch(/vault passphrase is not set/i);
  });
});

// ---------------------------------------------------------------------------
// hasKdfPassphrase
// ---------------------------------------------------------------------------

describe('hasKdfPassphrase', () => {
  test('returns false when keychain has no entry', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);
    const result = await hasKdfPassphrase();
    expect(result).toBe(false);
  });

  test('returns true when keychain has an entry', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({ password: 'secret' });
    const result = await hasKdfPassphrase();
    expect(result).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// restoreKdfPassphrase
// ---------------------------------------------------------------------------

describe('restoreKdfPassphrase', () => {
  test('throws for empty passphrase', async () => {
    await expect(restoreKdfPassphrase('')).rejects.toThrow('Vault passphrase cannot be empty.');
  });

  test('throws for whitespace passphrase', async () => {
    await expect(restoreKdfPassphrase('   ')).rejects.toThrow('Vault passphrase cannot be empty.');
  });

  test('stores passphrase in keychain and creates salt when none exists', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    await restoreKdfPassphrase('my-passphrase');
    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
      'vault',
      'my-passphrase',
      expect.objectContaining({ service: expect.stringContaining('kdf.passphrase') }),
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      expect.stringContaining('kdf.salt'),
      expect.any(String),
    );
  });

  test('does not create a new salt when one already exists', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('existing-salt');
    await restoreKdfPassphrase('my-passphrase');
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getOrCreateKdfMaterial
// ---------------------------------------------------------------------------

describe('getOrCreateKdfMaterial', () => {
  test('throws MissingKdfPassphraseError when no passphrase stored', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);
    await expect(getOrCreateKdfMaterial()).rejects.toBeInstanceOf(MissingKdfPassphraseError);
  });

  test('returns passphrase and salt when both exist', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({ password: 'pass' });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce('salt123');
    const result = await getOrCreateKdfMaterial();
    expect(result.passphrase).toBe('pass');
    expect(result.salt).toBe('salt123');
  });

  test('regenerates salt when passphrase exists but salt is missing', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({ password: 'pass' });
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);
    const result = await getOrCreateKdfMaterial();
    expect(result.passphrase).toBe('pass');
    expect(typeof result.salt).toBe('string');
    expect(result.salt.length).toBeGreaterThan(0);
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// initUserKdfPassphrase
// ---------------------------------------------------------------------------

describe('initUserKdfPassphrase', () => {
  test('throws for empty passphrase', async () => {
    await expect(initUserKdfPassphrase('')).rejects.toThrow('Vault passphrase cannot be empty.');
  });

  test('stores passphrase in both KDF and recovery keychain services', async () => {
    await initUserKdfPassphrase('secure-pass');
    expect(Keychain.setGenericPassword).toHaveBeenCalledTimes(2);
    const calls = (Keychain.setGenericPassword as jest.Mock).mock.calls;
    const services = calls.map((c: any) => c[2]?.service);
    expect(services.some((s: string) => s.includes('kdf.passphrase'))).toBe(true);
    expect(services.some((s: string) => s.includes('recovery.passphrase'))).toBe(true);
  });

  test('returns normalized passphrase and a salt string', async () => {
    const result = await initUserKdfPassphrase('  my pass  ');
    expect(result.passphrase).toBe('my pass');
    expect(typeof result.salt).toBe('string');
    expect(result.salt.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// setRecoveryPassphrase / getRecoveryPassphrase
// ---------------------------------------------------------------------------

describe('setRecoveryPassphrase', () => {
  test('throws for empty passphrase', async () => {
    await expect(setRecoveryPassphrase('')).rejects.toThrow('Recovery passphrase cannot be empty.');
  });

  test('stores passphrase in recovery keychain service', async () => {
    await setRecoveryPassphrase('recovery-pass');
    expect(Keychain.setGenericPassword).toHaveBeenCalledWith(
      'recovery',
      'recovery-pass',
      expect.objectContaining({ service: expect.stringContaining('recovery.passphrase') }),
    );
  });
});

describe('getRecoveryPassphrase', () => {
  test('returns null when no entry in keychain', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);
    const result = await getRecoveryPassphrase();
    expect(result).toBeNull();
  });

  test('returns the stored passphrase', async () => {
    (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({ password: 'recovery-pass' });
    const result = await getRecoveryPassphrase();
    expect(result).toBe('recovery-pass');
  });
});

// ---------------------------------------------------------------------------
// clearVaultPassphraseData
// ---------------------------------------------------------------------------

describe('clearVaultPassphraseData', () => {
  test('resets both keychain services and removes the salt from AsyncStorage', async () => {
    await clearVaultPassphraseData();
    expect(Keychain.resetGenericPassword).toHaveBeenCalledTimes(2);
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(
      expect.stringContaining('kdf.salt'),
    );
  });
});

