/**
 * services/crypto/documentCrypto.ts
 *
 * Core cryptographic helpers used by the vault implementation. This module
 * centralizes:
 * - KDF material management
 * - document key wrapping/unwrapping
 * - payload encryption/decryption (AES-GCM/CBC variants)
 * - utilities to convert between formats (base64, word arrays, etc.)
 *
 * WARNING: Cryptography is subtle. Keep this module small, well-tested, and
 * avoid re-implementing protocols without a clear reference. Use tested
 * primitives when available.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';
import * as Keychain from 'react-native-keychain';
import { Buffer } from 'buffer';

import { encodeBase64 } from './base64';

type CryptoRuntime = {
  randomBytes: (size: number) => Buffer;
  createCipheriv: (algorithm: string, key: Buffer, iv: Buffer) => any;
  createDecipheriv: (algorithm: string, key: Buffer, iv: Buffer) => any;
  pbkdf2Sync: (password: string, salt: Buffer, iterations: number, keylen: number, digest: string) => Buffer;
};

const runtimeCrypto: CryptoRuntime = (() => {
  try {
    const quickCryptoModule = require('react-native-quick-crypto');
    return (quickCryptoModule.default ?? quickCryptoModule) as CryptoRuntime;
  } catch {
    // Fallback shim for non-native runtimes; crypto methods throw if actually invoked.
    const unavailable = () => {
      throw new Error('Crypto runtime is unavailable. Ensure react-native-quick-crypto is installed and rebuilt.');
    };

    return {
      randomBytes: unavailable as unknown as CryptoRuntime['randomBytes'],
      createCipheriv: unavailable as unknown as CryptoRuntime['createCipheriv'],
      createDecipheriv: unavailable as unknown as CryptoRuntime['createDecipheriv'],
      pbkdf2Sync: unavailable as unknown as CryptoRuntime['pbkdf2Sync'],
    };
  }
})();

/** AsyncStorage key for persisted PBKDF2 salt. */
const KDF_SALT_KEY = 'secdocvault.kdf.salt';
/** Keychain service for persisted random KDF passphrase. */
const KDF_PASSPHRASE_SERVICE = 'secdocvault.kdf.passphrase';
/** Keychain service for user recovery passphrase (portable across devices). */
const RECOVERY_PASSPHRASE_SERVICE = 'secdocvault.recovery.passphrase';
const SHARE_KEY_PRIVATE_SERVICE_PREFIX = 'secdocvault.share.private';
const SHARE_KEY_PUBLIC_STORAGE_PREFIX = 'secdocvault.share.public';

/**
 * Generates a cryptographically secure CryptoJS `WordArray` of the requested byte length.
 *
 * It reads secure randomness from `globalThis.crypto.getRandomValues` (polyfilled in React Native
 * by `react-native-get-random-values`), then packs bytes into CryptoJS word format.
 *
 * @param bytes Number of random bytes to generate.
 * @returns A CryptoJS `WordArray` containing `bytes` random bytes.
 * @throws {Error} If a secure random source is not available in the runtime.
 * @private
 */
export function randomWordArray(bytes: number) {
  const cryptoApi = (globalThis as { crypto?: { getRandomValues: (arr: Uint8Array) => Uint8Array } }).crypto;
  if (!cryptoApi?.getRandomValues) {
    throw new Error('Secure random source is unavailable.');
  }

  const values = new Uint8Array(bytes);
  cryptoApi.getRandomValues(values);

  const words: number[] = [];
  for (let i = 0; i < values.length; i += 1) {
    words[i >>> 2] = (words[i >>> 2] || 0) | (values[i] << (24 - (i % 4) * 8));
  }

  return CryptoJS.lib.WordArray.create(words, bytes);
}

/**
 * Encodes a CryptoJS word array as Base64.
 *
 * @param wordArray - Input binary data.
 * @returns Base64-encoded string.
 * @private
 */
export function toBase64(wordArray: CryptoJS.lib.WordArray) {
  return CryptoJS.enc.Base64.stringify(wordArray);
}

/**
 * Decodes a Base64 string into a CryptoJS word array.
 *
 * @param value - Base64 string.
 * @returns Decoded CryptoJS word array.
 * @private
 */
export function fromBase64(value: string) {
  return CryptoJS.enc.Base64.parse(value);
}


function base64ToBytes(value: string) {
  return Buffer.from(value, 'base64');
}

function bytesToBase64(value: Uint8Array | Buffer) {
  return encodeBase64(Buffer.from(value));
}

function utf8ToBytes(value: string) {
  return Buffer.from(value, 'utf8');
}

function bytesToUtf8(value: Uint8Array | Buffer) {
  return Buffer.from(value).toString('utf8');
}

function randomBytes(length: number) {
  return runtimeCrypto.randomBytes(length);
}

async function aesGcmEncryptUtf8(plainText: string, keyB64?: string) {
  const keyBytes = keyB64 ? base64ToBytes(keyB64) : randomBytes(32);
  const ivBytes = randomBytes(12);
  const cipher = runtimeCrypto.createCipheriv('aes-256-gcm', keyBytes, ivBytes);
  const encrypted = Buffer.concat([cipher.update(utf8ToBytes(plainText)), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    cipher: bytesToBase64(encrypted),
    iv: bytesToBase64(ivBytes),
    key: bytesToBase64(keyBytes),
    authTag: bytesToBase64(authTag),
  };
}

async function aesGcmDecryptUtf8(cipherB64: string, ivB64: string, keyB64: string, authTagB64?: string) {
  if (!authTagB64) {
    throw new Error('Missing AES-GCM auth tag for integrity verification.');
  }

  const keyBytes = base64ToBytes(keyB64);
  const ivBytes = base64ToBytes(ivB64);
  const cipherBytes = base64ToBytes(cipherB64);
  const authTag = base64ToBytes(authTagB64);

  const decipher = runtimeCrypto.createDecipheriv('aes-256-gcm', keyBytes, ivBytes);
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([decipher.update(cipherBytes), decipher.final()]);
  return bytesToUtf8(decrypted);
}

function deriveWrappingKeyBytes(passphrase: string, salt: string, iterations: number) {
  return runtimeCrypto.pbkdf2Sync(passphrase, Buffer.from(salt, 'base64'), iterations, 32, 'sha256');
}

function decryptLegacyCbc(cipherB64: string, ivB64: string, keyB64: string) {
  const key = fromBase64(keyB64);
  const iv = fromBase64(ivB64);
  const cipherParams = CryptoJS.lib.CipherParams.create({ciphertext: fromBase64(cipherB64)});
  const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

/**
 * Reads or creates PBKDF2 material used to wrap document keys.
 *
 * - Passphrase is stored in Keychain.
 * - Salt is stored in AsyncStorage.
 *
 * @returns Existing or newly-created `{ passphrase, salt }` pair.
 * @private
 */
export async function getOrCreateKdfMaterial() {
  const existing = await Keychain.getGenericPassword({service: KDF_PASSPHRASE_SERVICE});
  const storedSalt = await AsyncStorage.getItem(KDF_SALT_KEY);

  if (existing && storedSalt) {
    return {passphrase: existing.password, salt: storedSalt};
  }

  const passphrase = toBase64(randomWordArray(32));
  const salt = toBase64(randomWordArray(16));

  await Keychain.setGenericPassword('vault', passphrase, {
    service: KDF_PASSPHRASE_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await AsyncStorage.setItem(KDF_SALT_KEY, salt);

  return {passphrase, salt};
}

export async function setRecoveryPassphrase(passphrase: string) {
  const normalized = passphrase.trim();
  if (!normalized) {
    throw new Error('Recovery passphrase cannot be empty.');
  }

  await Keychain.setGenericPassword('recovery', normalized, {
    service: RECOVERY_PASSPHRASE_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function getRecoveryPassphrase() {
  const existing = await Keychain.getGenericPassword({service: RECOVERY_PASSPHRASE_SERVICE});
  return existing ? existing.password : null;
}

/**
 * Encrypts a Base64\-encoded payload using AES\-256\-CBC with PKCS\#7 padding.
 *
 * If `keyB64` is not provided, a new random 32\-byte key is generated.
 *
 * @param base64Payload - Payload encoded as a Base64 string.
 * @param keyB64 - Optional Base64\-encoded 32\-byte AES key.
 * @returns Encryption result containing Base64 ciphertext, IV, and key.
 */
export async function encryptBase64Payload(base64Payload: string, keyB64?: string) {
  const encrypted = await aesGcmEncryptUtf8(base64Payload, keyB64);
  return {
    ...encrypted,
    algorithm: 'AES-256-GCM',
    version: 2,
  };
}

/**
 * Decrypts an AES\-256\-CBC encrypted Base64 payload.
 *
 * @param cipherB64 - Base64\-encoded ciphertext.
 * @param ivB64 - Base64\-encoded IV used for encryption.
 * @param keyB64 - Base64\-encoded 32\-byte AES key.
 * @param algorithm
 * @param authTagB64
 * @returns Decrypted payload as a UTF\-8 string.
 */
export async function decryptBase64Payload(
  cipherB64: string,
  ivB64: string,
  keyB64: string,
  algorithm = 'AES-256-CBC',
  authTagB64?: string,
) {
  if (algorithm.includes('GCM')) {
    return aesGcmDecryptUtf8(cipherB64, ivB64, keyB64, authTagB64);
  }

  return decryptLegacyCbc(cipherB64, ivB64, keyB64);
}

/**
 * Wraps a document key with a key derived from a passphrase and salt.
 *
 * Uses PBKDF2 with SHA-256 to derive an AES-256-CBC key, then encrypts the
 * document key using a random IV.
 *
 * @param documentKeyB64 - Base64-encoded document key to wrap.
 * @param passphrase - Passphrase used for key derivation.
 * @param salt - Base64-encoded PBKDF2 salt.
 * @param options
 * @returns Metadata and ciphertext for the wrapped document key.
 */
export async function wrapDocumentKey(
  documentKeyB64: string,
  passphrase: string,
  salt?: string,
  options?: {
    iterations?: number;
    wrapMode?: 'device' | 'recovery';
  },
) {
  const resolvedSalt = salt ?? toBase64(randomWordArray(16));
  const iterations = options?.iterations ?? 100000;
  const wrappingKeyB64 = bytesToBase64(deriveWrappingKeyBytes(passphrase, resolvedSalt, iterations));
  const encrypted = await aesGcmEncryptUtf8(documentKeyB64, wrappingKeyB64);

  return {
    cipher: encrypted.cipher,
    iv: encrypted.iv,
    authTag: encrypted.authTag,
    salt: resolvedSalt,
    iterations,
    algorithm: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    wrapMode: options?.wrapMode ?? 'device',
  };
}

/**
 * Unwraps a previously wrapped document key using PBKDF2-derived AES key material.
 *
 * Derives an AES-256 key from the provided passphrase and Base64 salt using
 * PBKDF2-SHA256 with 100000 iterations, then decrypts the wrapped key with
 * AES-CBC and PKCS\#7 padding.
 *
 * @param wrappedCipherB64 - Base64-encoded wrapped document key ciphertext.
 * @param wrappedIvB64 - Base64-encoded IV used during key wrapping.
 * @param passphrase - Passphrase used for PBKDF2 key derivation.
 * @param salt - Base64-encoded PBKDF2 salt.
 * @param algorithm
 * @param iterations
 * @param authTagB64
 * @returns The original Base64 document key as a UTF-8 string.
 */
export async function unwrapDocumentKey(
  wrappedCipherB64: string,
  wrappedIvB64: string,
  passphrase: string,
  salt: string,
  algorithm = 'AES-256-CBC',
  iterations = 100000,
  authTagB64?: string,
) {
  if (algorithm.includes('GCM')) {
    const wrappingKeyB64 = bytesToBase64(deriveWrappingKeyBytes(passphrase, salt, iterations));
    return aesGcmDecryptUtf8(wrappedCipherB64, wrappedIvB64, wrappingKeyB64, authTagB64);
  }

  const derivedKey = CryptoJS.PBKDF2(passphrase, fromBase64(salt), {
    keySize: 256 / 32,
    iterations,
    hasher: CryptoJS.algo.SHA256,
  });
  const iv = fromBase64(wrappedIvB64);
  const cipherParams = CryptoJS.lib.CipherParams.create({ciphertext: fromBase64(wrappedCipherB64)});
  const decrypted = CryptoJS.AES.decrypt(cipherParams, derivedKey, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });
  return decrypted.toString(CryptoJS.enc.Utf8);
}

export async function getOrCreateSharingKeyPair(userId: string) {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    throw new Error('Missing user ID for sharing key generation.');
  }

  const service = `${SHARE_KEY_PRIVATE_SERVICE_PREFIX}.${normalizedUserId}`;
  const existing = await Keychain.getGenericPassword({service});
  const existingPublic = await AsyncStorage.getItem(`${SHARE_KEY_PUBLIC_STORAGE_PREFIX}.${normalizedUserId}`);
  if (existing && existingPublic) {
    return {
      publicKey: existingPublic,
      privateKey: existing.password,
      algorithm: 'RSA-OAEP-SHA256',
    };
  }

  const quickCryptoModule = require('react-native-quick-crypto');
  const quickCrypto = (quickCryptoModule.default ?? quickCryptoModule) as {
    generateKeyPairSync: (algorithm: string, options: Record<string, unknown>) => {publicKey: string; privateKey: string};
    publicEncrypt: (options: Record<string, unknown>, buffer: Buffer) => Buffer;
    privateDecrypt: (options: Record<string, unknown>, buffer: Buffer) => Buffer;
    constants: Record<string, number>;
  };
  const generated = quickCrypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: {type: 'spki', format: 'pem'},
    privateKeyEncoding: {type: 'pkcs8', format: 'pem'},
  });
  const publicKey = generated.publicKey;
  const privateKey = generated.privateKey;

  await Keychain.setGenericPassword(normalizedUserId, privateKey, {
    service,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  await AsyncStorage.setItem(`${SHARE_KEY_PUBLIC_STORAGE_PREFIX}.${normalizedUserId}`, publicKey);

  return {
    publicKey,
    privateKey,
    algorithm: 'RSA-OAEP-SHA256',
  };
}

export async function wrapDocumentKeyForRecipient(
  documentKeyB64: string,
  recipientPublicKeyPem: string,
) {
  const recipientPublicKey = recipientPublicKeyPem.trim();
  if (!recipientPublicKey) {
    throw new Error('Recipient public key is missing.');
  }

  const quickCryptoModule = require('react-native-quick-crypto');
  const quickCrypto = (quickCryptoModule.default ?? quickCryptoModule) as {
    publicEncrypt: (options: Record<string, unknown>, buffer: Buffer) => Buffer;
    constants: Record<string, number>;
  };
  const cipherBuffer = quickCrypto.publicEncrypt(
    {
      key: recipientPublicKey,
      padding: quickCrypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha256',
    },
    Buffer.from(documentKeyB64, 'base64'),
  );

  return {
    wrappedKeyCipher: encodeBase64(cipherBuffer),
    keyWrapAlgorithm: 'RSA-OAEP-SHA256' as const,
  };
}

export async function unwrapDocumentKeyFromShareEnvelope(
  userId: string,
  envelope: {
    wrappedKeyCipher: string;
    keyWrapAlgorithm?: string;
  },
) {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    throw new Error('Missing current user for share key unwrap.');
  }

  const privateEntry = await Keychain.getGenericPassword({
    service: `${SHARE_KEY_PRIVATE_SERVICE_PREFIX}.${normalizedUserId}`,
  });
  if (!privateEntry) {
    throw new Error('Recipient private key is missing. Ask recipient to register sharing keys first.');
  }

  const quickCryptoModule = require('react-native-quick-crypto');
  const quickCrypto = (quickCryptoModule.default ?? quickCryptoModule) as {
    privateDecrypt: (options: Record<string, unknown>, buffer: Buffer) => Buffer;
    constants: Record<string, number>;
  };

  try {
    const plainBuffer = quickCrypto.privateDecrypt(
      {
        key: privateEntry.password,
        padding: quickCrypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(envelope.wrappedKeyCipher, 'base64'),
    );

    // Use our local safe utility instead of relying on Buffer or global shims that might be missing
    return encodeBase64(new Uint8Array(plainBuffer));
  } catch (error) {
    // If the standard OAEP-SHA256 fails, it might be due to an older version of the share
    // that used a different padding or hash. Or the cipher is corrupted.
    console.error('RSADecrypt error details:', error);
    throw new Error(`Decryption failed: could not unwrap document key using recipient's private key. (${String(error)})`);
  }
}
