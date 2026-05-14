import {
  createDocumentShareGrant,
  revokeDocumentShareGrant,
  enforceExpiredShareRevocations,
  ensureCurrentUserSharePublicKey,
  canCurrentUserExportDocument,
  deleteUserShareProfile,
  clearDocumentKeychainEntries,
} from '../../../../src/services/documentVault';

import { getDoc, getDocs, setDoc, deleteDoc } from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import * as Keychain from 'react-native-keychain';
import { getDownloadURL, uploadString } from '@react-native-firebase/storage';
import { wrapDocumentKeyForRecipient } from '../../../../src/services/crypto/documentCrypto';
import { Buffer } from 'buffer';
import RNFS from 'react-native-fs';

jest.mock('@react-native-firebase/app', () => ({
  getApp: jest.fn(() => ({})),
}));

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({
    currentUser: { uid: 'owner-uid', email: 'owner@example.com' },
  })),
}));

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(() => ({ id: 'mock-doc-ref' })),
  query: jest.fn(),
  where: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  deleteDoc: jest.fn(),
}));

jest.mock('@react-native-firebase/storage', () => ({
  getStorage: jest.fn(),
  ref: jest.fn(),
  getDownloadURL: jest.fn(),
  uploadString: jest.fn(),
}));

jest.mock('react-native-keychain', () => ({
  getGenericPassword: jest.fn(),
  setGenericPassword: jest.fn().mockResolvedValue(true),
  resetGenericPassword: jest.fn().mockResolvedValue(true),
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'mock-accessible' },
}));

jest.mock('react-native-fs', () => ({
  readFile: jest.fn(),
}));

jest.mock('../../../../src/services/crypto/documentCrypto', () => ({
  getOrCreateSharingKeyPair: jest.fn(() => Promise.resolve({ publicKey: 'mock-pub-key', privateKey: 'mock-priv-key' })),
  wrapDocumentKeyForRecipient: jest.fn(),
  unwrapDocumentKeyFromShareEnvelope: jest.fn(),
  unwrapDocumentKey: jest.fn(),
  getOrCreateKdfMaterial: jest.fn(),
  getRecoveryPassphrase: jest.fn(),
  toBase64: jest.fn(() => 'mock-base64'),
  randomWordArray: jest.fn(() => []),
  encryptBase64Payload: jest.fn(),
  decryptBase64Payload: jest.fn(),
  wrapDocumentKey: jest.fn(),
}));

describe('Document Vault Sharing Services', () => {
  const mockDocMeta = {
    id: 'doc-123',
    owner: 'owner-uid',
    name: 'Secret Doc',
    description: '',
    hash: 'hash',
    size: '1 KB',
    uploadedAt: '2023-01-01',
    sharedWith: [],
    sharedKeyGrants: [],
    references: [],
    saveMode: 'firebase' as const,
    offlineAvailable: false,
    recoverable: false,
  };

  beforeEach(() => {
    jest.resetAllMocks();
    const crypto = jest.requireMock('../../../../src/services/crypto/documentCrypto');
    (crypto.getOrCreateSharingKeyPair as jest.Mock).mockResolvedValue({
      publicKey: 'mock-pub-key',
      privateKey: 'mock-priv-key',
    });
    (crypto.wrapDocumentKeyForRecipient as jest.Mock).mockResolvedValue({
      wrappedKeyCipher: 'wrapped',
      keyWrapAlgorithm: 'RSA-OAEP-SHA256',
    });
    (getAuth as jest.Mock).mockReturnValue({
      currentUser: { uid: 'owner-uid', email: 'owner@example.com' },
    });
    (getDoc as jest.Mock).mockResolvedValue({ exists: () => false });
  });

  describe('ensureCurrentUserSharePublicKey', () => {
    it('generates and stores public key', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ sharePublicKey: 'mock-pub-key' }),
      });

      const key = await ensureCurrentUserSharePublicKey('owner-uid', 'owner@example.com');
      expect(key).toBe('mock-pub-key');
      expect(setDoc).toHaveBeenCalled();
    });

    it('throws if verification fails', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ sharePublicKey: 'different-key' }),
      });

      await expect(ensureCurrentUserSharePublicKey('owner-uid')).rejects.toThrow('Share key could not be verified');
    });
  });

  describe('createDocumentShareGrant', () => {
    it('throws if not owner', async () => {
      await expect(
        createDocumentShareGrant({ ...mockDocMeta, owner: 'other-uid' }, 'owner-uid', 'test@test.com', true)
      ).rejects.toThrow('Only the document owner can create share keys.');
    });

    it('throws if sharing with self', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({
        empty: false,
        docs: [{ id: 'owner-uid', data: () => ({ emailLower: 'owner@example.com', sharePublicKey: 'pub-key' }) }],
      });
      await expect(
        createDocumentShareGrant(mockDocMeta, 'owner-uid', 'owner@example.com', true)
      ).rejects.toThrow('You cannot share a document with yourself.');
    });

    it('throws if recipient not found', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({ empty: true });
      await expect(
        createDocumentShareGrant(mockDocMeta, 'owner-uid', 'nobody@test.com', true)
      ).rejects.toThrow('Recipient key not found.');
    });

    it('throws for invalid recipient email format', async () => {
      await expect(createDocumentShareGrant(mockDocMeta, 'owner-uid', 'invalid-email', true)).rejects.toThrow(
        'Enter a valid recipient email.',
      );
    });

    it('throws when recipient profile has no public key', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({
        empty: false,
        docs: [{ id: 'recipient-uid', data: () => ({ emailLower: 'recipient@test.com' }) }],
      });

      await expect(createDocumentShareGrant(mockDocMeta, 'owner-uid', 'recipient@test.com', true)).rejects.toThrow(
        'Recipient has no sharing public key yet.',
      );
    });

    it('creates share grant successfully', async () => {
      // Mock recipient lookup
      (getDocs as jest.Mock)
        .mockResolvedValueOnce({ // getRecipientShareProfileByEmail
          empty: false,
          docs: [{ id: 'recipient-uid', data: () => ({ emailLower: 'recipient@test.com', sharePublicKey: 'rec-pub-key' }) }],
        })
        .mockResolvedValueOnce({ // syncDocumentShareIndex -> listDocShareGrants
          docs: [{
            data: () => ({
              recipientUid: 'recipient-uid',
              recipientEmail: 'recipient@test.com',
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 100000).toISOString(),
            }),
          }],
        });

      // Mock Keychain for document key (32 bytes = 44 base64 chars)
      (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({ password: 'A'.repeat(43) + '=' });
      (wrapDocumentKeyForRecipient as jest.Mock).mockResolvedValueOnce({ wrappedKeyCipher: 'wrapped', keyWrapAlgorithm: 'RSA' });

      const result = await createDocumentShareGrant(mockDocMeta, 'owner-uid', 'recipient@test.com', true);
      expect(result.sharedWith).toContain('recipient-uid');
      expect(setDoc).toHaveBeenCalledTimes(2); // once for the grant, once for sync index
    });

    it('throws when document key metadata is missing and no keychain key is available', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce({
        empty: false,
        docs: [{ id: 'recipient-uid', data: () => ({ emailLower: 'recipient@test.com', sharePublicKey: 'rec-pub-key' }) }],
      });
      (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);

      await expect(
        createDocumentShareGrant({ ...mockDocMeta, encryptedDocKey: undefined as any }, 'owner-uid', 'recipient@test.com', true),
      ).rejects.toThrow('Missing encrypted key metadata for this document.');
    });

    it('resolves key via active inline share grant for current user', async () => {
      const crypto = jest.requireMock('../../../../src/services/crypto/documentCrypto');
      (getAuth as jest.Mock).mockReturnValueOnce({
        currentUser: { uid: 'owner-uid', email: 'owner@example.com' },
      });
      (getDocs as jest.Mock)
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ id: 'recipient-uid', data: () => ({ emailLower: 'recipient@test.com', sharePublicKey: 'rec-pub-key' }) }],
        })
        .mockResolvedValueOnce({ docs: [] });
      (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);
      (crypto.unwrapDocumentKeyFromShareEnvelope as jest.Mock).mockResolvedValueOnce(Buffer.alloc(32).toString('base64'));
      (wrapDocumentKeyForRecipient as jest.Mock).mockResolvedValueOnce({ wrappedKeyCipher: 'wrapped', keyWrapAlgorithm: 'RSA' });

      const now = new Date();
      const result = await createDocumentShareGrant(
        {
          ...mockDocMeta,
          sharedKeyGrants: [
            {
              recipientUid: 'owner-uid',
              recipientEmail: 'owner@example.com',
              allowExport: true,
              wrappedKeyCipher: 'inline-wrapped',
              keyWrapAlgorithm: 'RSA-OAEP-SHA256',
              createdAt: now.toISOString(),
              expiresAt: new Date(now.getTime() + 60_000).toISOString(),
            } as any,
          ],
        },
        'owner-uid',
        'recipient@test.com',
        true,
      );

      expect(crypto.unwrapDocumentKeyFromShareEnvelope).toHaveBeenCalled();
      expect(setDoc).toHaveBeenCalled();
      expect(result.sharedKeyGrants).toEqual([]);
    });

    it('resolves key by unwrapping encryptedDocKey with device KDF passphrase', async () => {
      const crypto = jest.requireMock('../../../../src/services/crypto/documentCrypto');
      (getDocs as jest.Mock)
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ id: 'recipient-uid', data: () => ({ emailLower: 'recipient@test.com', sharePublicKey: 'rec-pub-key' }) }],
        })
        .mockResolvedValueOnce({ docs: [] });
      (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);
      (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });
      (crypto.getOrCreateKdfMaterial as jest.Mock).mockResolvedValueOnce({ passphrase: 'kdf-pass', salt: 'kdf-salt' });
      (crypto.unwrapDocumentKey as jest.Mock).mockResolvedValueOnce(Buffer.alloc(32).toString('base64'));
      (crypto.wrapDocumentKeyForRecipient as jest.Mock).mockResolvedValueOnce({ wrappedKeyCipher: 'wrapped', keyWrapAlgorithm: 'RSA' });

      const result = await createDocumentShareGrant(
        {
          ...mockDocMeta,
          encryptedDocKey: {
            cipher: 'owner-cipher',
            iv: 'owner-iv',
            salt: 'owner-salt',
            algorithm: 'AES-256-CBC',
            iterations: 100000,
            authTag: 'owner-tag',
            wrapMode: 'device',
          },
        } as any,
        'owner-uid',
        'recipient@test.com',
        true,
      );

      expect(crypto.unwrapDocumentKey).toHaveBeenCalled();
      expect(setDoc).toHaveBeenCalled();
      expect(result.sharedKeyGrants).toEqual([]);
    });

    it('falls back to recovery unwrap and throws when recovery passphrase is missing', async () => {
      const crypto = jest.requireMock('../../../../src/services/crypto/documentCrypto');
      (getAuth as jest.Mock).mockReturnValueOnce({ currentUser: null });
      (getDocs as jest.Mock).mockResolvedValueOnce({
        empty: false,
        docs: [{ id: 'recipient-uid', data: () => ({ emailLower: 'recipient@test.com', sharePublicKey: 'rec-pub-key' }) }],
      });
      (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);
      (crypto.getOrCreateKdfMaterial as jest.Mock).mockRejectedValueOnce(new Error('kdf unavailable'));
      (crypto.getRecoveryPassphrase as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        createDocumentShareGrant(
          {
            ...mockDocMeta,
            encryptedDocKey: {
              cipher: 'owner-cipher',
              iv: 'owner-iv',
              salt: 'owner-salt',
              algorithm: 'AES-256-CBC',
              iterations: 100000,
              authTag: 'owner-tag',
              wrapMode: 'device',
            },
          } as any,
          'owner-uid',
          'recipient@test.com',
          true,
        ),
      ).rejects.toThrow('Missing recovery passphrase.');
    });

    it('throws when recovery unwrapped key has invalid format', async () => {
      const crypto = jest.requireMock('../../../../src/services/crypto/documentCrypto');
      (getAuth as jest.Mock).mockReturnValueOnce({ currentUser: null });
      (getDocs as jest.Mock).mockResolvedValueOnce({
        empty: false,
        docs: [{ id: 'recipient-uid', data: () => ({ emailLower: 'recipient@test.com', sharePublicKey: 'rec-pub-key' }) }],
      });
      (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);
      (crypto.getRecoveryPassphrase as jest.Mock).mockResolvedValueOnce('recovery-pass');
      (crypto.unwrapDocumentKey as jest.Mock).mockResolvedValueOnce('invalid-key-format');

      await expect(
        createDocumentShareGrant(
          {
            ...mockDocMeta,
            encryptedDocKey: {
              cipher: 'owner-cipher',
              iv: 'owner-iv',
              salt: 'owner-salt',
              algorithm: 'AES-256-CBC',
              iterations: 100000,
              authTag: 'owner-tag',
              wrapMode: 'recovery',
            },
          } as any,
          'owner-uid',
          'recipient@test.com',
          true,
        ),
      ).rejects.toThrow('Recovered key has invalid format.');
    });
  });

  describe('revokeDocumentShareGrant', () => {
    it('throws if not owner', async () => {
      await expect(
        revokeDocumentShareGrant({ ...mockDocMeta, owner: 'other' }, 'owner-uid', 'test@test.com')
      ).rejects.toThrow('Only the document owner can revoke share keys.');
    });

    it('throws if no active grant', async () => {
      (getDocs as jest.Mock)
        .mockResolvedValueOnce({ // getRecipientShareProfileByEmail
          empty: false,
          docs: [{ id: 'recipient-uid', data: () => ({ emailLower: 'test@test.com', sharePublicKey: 'pub-key-123' }) }],
        })
        .mockResolvedValue({ // syncDocumentShareIndex and other calls
          empty: true,
          docs: [],
        });
      (getDoc as jest.Mock).mockResolvedValue({
        exists: () => false, // No active grant found for current user
      });

      await expect(revokeDocumentShareGrant(mockDocMeta, 'owner-uid', 'test@test.com'))
        .rejects.toThrow('No active share key found for this recipient.');
    });

    it('throws when recipient email is blank', async () => {
      await expect(revokeDocumentShareGrant(mockDocMeta, 'owner-uid', '   ')).rejects.toThrow(
        'Provide recipient email to revoke sharing.',
      );
    });

    it('revokes active grant and rotates document key', async () => {
      const crypto = jest.requireMock('../../../../src/services/crypto/documentCrypto');
      const now = new Date();
      const activeGrant = {
        recipientUid: 'recipient-uid',
        recipientEmail: 'recipient@test.com',
        recipientPublicKey: 'recipient-pub',
        allowExport: true,
        wrappedKeyCipher: 'wrapped-old',
        keyWrapAlgorithm: 'RSA-OAEP-SHA256',
        createdAt: now.toISOString(),
        expiresAt: new Date(now.getTime() + 3600_000).toISOString(),
      };

      (getDocs as jest.Mock)
        // getRecipientShareProfileByEmail
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ id: 'recipient-uid', data: () => ({ emailLower: 'recipient@test.com', sharePublicKey: 'recipient-pub' }) }],
        })
        // syncDocumentShareIndex (inside rotateDocumentKeyAfterShareChange)
        .mockResolvedValueOnce({
          docs: [
            { data: () => activeGrant },
            {
              data: () => ({
                ...activeGrant,
                recipientUid: 'no-pub',
                recipientPublicKey: undefined,
              }),
            },
          ],
        })
        // syncDocumentShareIndex (after rotation)
        .mockResolvedValueOnce({ docs: [{ data: () => activeGrant }] });

      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => activeGrant,
      });

      (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({
        password: Buffer.alloc(32).toString('base64'),
      });

      (getDownloadURL as jest.Mock).mockResolvedValueOnce('https://example.com/encrypted');
      (globalThis as any).fetch = jest.fn(async () => ({
        text: async () => JSON.stringify({ iv: 'iv1', cipher: 'cipher1', algorithm: 'AES-256-CBC', authTag: 'tag1' }),
      }));

      (crypto.decryptBase64Payload as jest.Mock).mockResolvedValueOnce('base64-plain');
      (crypto.encryptBase64Payload as jest.Mock).mockResolvedValueOnce({
        version: 1,
        algorithm: 'AES-256-CBC',
        iv: 'new-iv',
        cipher: 'new-cipher',
        authTag: 'new-tag',
        key: Buffer.alloc(32).toString('base64'),
      });
      (crypto.wrapDocumentKeyForRecipient as jest.Mock).mockResolvedValueOnce({
        wrappedKeyCipher: 'new-wrapped',
        keyWrapAlgorithm: 'RSA-OAEP-SHA256',
      });
      (crypto.getRecoveryPassphrase as jest.Mock).mockResolvedValueOnce('recovery-passphrase');
      (crypto.wrapDocumentKey as jest.Mock).mockResolvedValueOnce({
        cipher: 'owner-cipher',
        iv: 'owner-iv',
        salt: 'owner-salt',
        algorithm: 'AES-256-CBC',
        iterations: 100000,
        authTag: 'owner-tag',
        wrapMode: 'recovery',
      });

      const result = await revokeDocumentShareGrant(
        {
          ...mockDocMeta,
          encryptedDocKey: {
            cipher: 'old-owner-cipher',
            iv: 'old-owner-iv',
            salt: 'old-owner-salt',
            algorithm: 'AES-256-CBC',
            iterations: 100000,
            authTag: 'old-owner-tag',
            wrapMode: 'recovery',
          },
          references: [
            {
              source: 'firebase',
              storagePath: 'vault/owner-uid/doc-123/file.txt.enc',
              name: 'file.txt',
              size: 10,
              type: 'text/plain',
            },
          ],
        } as any,
        'owner-uid',
        'recipient@test.com',
      );

      expect(uploadString).toHaveBeenCalled();
      expect(result.sharedKeyGrants.length).toBeGreaterThan(0);
    });
  });

  describe('profile and keychain helpers', () => {
    it('deletes user share profile', async () => {
      await deleteUserShareProfile('owner-uid');
      expect(deleteDoc).toHaveBeenCalled();
    });

    it('clears keychain entries for each document id', async () => {
      await clearDocumentKeychainEntries(['doc-1', 'doc-2']);
      expect(Keychain.resetGenericPassword).toHaveBeenCalledTimes(2);
    });
  });

  describe('enforceExpiredShareRevocations', () => {
    it('returns original doc when current user is not owner', async () => {
      const result = await enforceExpiredShareRevocations(mockDocMeta as any, 'other-owner');
      expect(result).toEqual(mockDocMeta);
    });

    it('returns active grants without rotation when none are expired', async () => {
      const active = {
        recipientUid: 'recipient-uid',
        recipientEmail: 'recipient@test.com',
        allowExport: true,
        wrappedKeyCipher: 'wrapped',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };
      (getDocs as jest.Mock).mockResolvedValueOnce({ docs: [{ data: () => active }] });

      const result = await enforceExpiredShareRevocations(mockDocMeta as any, 'owner-uid');
      expect(result.sharedKeyGrants).toHaveLength(1);
      expect(setDoc).not.toHaveBeenCalled();
    });

    it('revokes expired grants and rotates key using device wrap fallback', async () => {
      const crypto = jest.requireMock('../../../../src/services/crypto/documentCrypto');
      const expired = {
        recipientUid: 'recipient-uid',
        recipientEmail: 'recipient@test.com',
        recipientPublicKey: 'recipient-pub',
        allowExport: true,
        wrappedKeyCipher: 'wrapped-old',
        keyWrapAlgorithm: 'RSA-OAEP-SHA256',
        createdAt: new Date(Date.now() - 120_000).toISOString(),
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      };

      (getDocs as jest.Mock)
        // listDocShareGrants (existing grants)
        .mockResolvedValueOnce({ docs: [{ data: () => expired }] })
        // syncDocumentShareIndex inside rotate
        .mockResolvedValueOnce({ docs: [{ data: () => expired }] })
        // syncDocumentShareIndex after rotation
        .mockResolvedValueOnce({ docs: [] });

      (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({
        password: Buffer.alloc(32).toString('base64'),
      });
      (getDownloadURL as jest.Mock).mockResolvedValueOnce('https://example.com/encrypted');
      (globalThis as any).fetch = jest.fn(async () => ({
        text: async () => JSON.stringify({ iv: 'iv1', cipher: 'cipher1', algorithm: 'AES-256-CBC', authTag: 'tag1' }),
      }));

      (crypto.decryptBase64Payload as jest.Mock).mockResolvedValueOnce('base64-plain');
      (crypto.encryptBase64Payload as jest.Mock).mockResolvedValueOnce({
        version: 1,
        algorithm: 'AES-256-CBC',
        iv: 'new-iv',
        cipher: 'new-cipher',
        authTag: 'new-tag',
        key: Buffer.alloc(32).toString('base64'),
      });
      (crypto.wrapDocumentKeyForRecipient as jest.Mock).mockResolvedValueOnce({
        wrappedKeyCipher: 'new-wrapped',
        keyWrapAlgorithm: 'RSA-OAEP-SHA256',
      });
      // recovery passphrase missing => fallback to device wrap branch
      (crypto.getRecoveryPassphrase as jest.Mock).mockResolvedValueOnce(null);
      (crypto.getOrCreateKdfMaterial as jest.Mock).mockResolvedValueOnce({ passphrase: 'kdf-pass', salt: 'kdf-salt' });
      (crypto.wrapDocumentKey as jest.Mock).mockResolvedValueOnce({
        cipher: 'owner-cipher',
        iv: 'owner-iv',
        salt: 'owner-salt',
        algorithm: 'AES-256-CBC',
        iterations: 100000,
        authTag: 'owner-tag',
        wrapMode: 'device',
      });

      const result = await enforceExpiredShareRevocations(
        {
          ...mockDocMeta,
          encryptedDocKey: {
            cipher: 'old-owner-cipher',
            iv: 'old-owner-iv',
            salt: 'old-owner-salt',
            algorithm: 'AES-256-CBC',
            iterations: 100000,
            authTag: 'old-owner-tag',
            wrapMode: 'recovery',
          },
          references: [
            {
              source: 'firebase',
              storagePath: 'vault/owner-uid/doc-123/file.txt.enc',
              name: 'file.txt',
              size: 10,
              type: 'text/plain',
            },
          ],
        } as any,
        'owner-uid',
      );

      expect(setDoc).toHaveBeenCalled();
      expect(uploadString).toHaveBeenCalled();
      expect(result.sharedKeyGrants).toEqual([]);
    });
  });

  describe('share-key resolution edge paths', () => {
    it('throws when shared grant is present but revoked/expired', async () => {
      const now = new Date();
      (getDocs as jest.Mock).mockResolvedValueOnce({
        empty: false,
        docs: [{ id: 'recipient-uid', data: () => ({ emailLower: 'recipient@test.com', sharePublicKey: 'recipient-pub' }) }],
      });
      (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce(false);
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          recipientUid: 'owner-uid',
          recipientEmail: 'owner@example.com',
          allowExport: true,
          wrappedKeyCipher: 'wrapped',
          keyWrapAlgorithm: 'RSA-OAEP-SHA256',
          createdAt: new Date(now.getTime() - 120_000).toISOString(),
          expiresAt: new Date(now.getTime() - 60_000).toISOString(),
        }),
      });

      await expect(createDocumentShareGrant(mockDocMeta as any, 'owner-uid', 'recipient@test.com', true)).rejects.toThrow(
        'Your shared access has expired or was revoked.',
      );
    });

    it('skips payload re-upload when only local references exist', async () => {
      const crypto = jest.requireMock('../../../../src/services/crypto/documentCrypto');
      const activeGrant = {
        recipientUid: 'recipient-uid',
        recipientEmail: 'recipient@test.com',
        recipientPublicKey: 'recipient-pub',
        allowExport: true,
        wrappedKeyCipher: 'wrapped-old',
        keyWrapAlgorithm: 'RSA-OAEP-SHA256',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      };

      (getDocs as jest.Mock)
        .mockResolvedValueOnce({
          empty: false,
          docs: [{ id: 'recipient-uid', data: () => ({ emailLower: 'recipient@test.com', sharePublicKey: 'recipient-pub' }) }],
        })
        .mockResolvedValueOnce({ docs: [{ data: () => activeGrant }] })
        .mockResolvedValueOnce({ docs: [] });
      (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => true, data: () => activeGrant });
      (Keychain.getGenericPassword as jest.Mock).mockResolvedValueOnce({ password: Buffer.alloc(32).toString('base64') });
      (RNFS.readFile as jest.Mock).mockResolvedValueOnce(
        JSON.stringify({ iv: 'iv1', cipher: 'cipher1', algorithm: 'AES-256-CBC', authTag: 'tag1' }),
      );
      (crypto.decryptBase64Payload as jest.Mock).mockResolvedValueOnce('base64-plain');
      (crypto.encryptBase64Payload as jest.Mock).mockResolvedValueOnce({
        version: 1,
        algorithm: 'AES-256-CBC',
        iv: 'new-iv',
        cipher: 'new-cipher',
        authTag: 'new-tag',
        key: Buffer.alloc(32).toString('base64'),
      });
      (crypto.wrapDocumentKeyForRecipient as jest.Mock).mockResolvedValueOnce({ wrappedKeyCipher: 'new-wrapped', keyWrapAlgorithm: 'RSA-OAEP-SHA256' });
      (crypto.getOrCreateKdfMaterial as jest.Mock).mockResolvedValueOnce({ passphrase: 'kdf-pass', salt: 'kdf-salt' });
      (crypto.wrapDocumentKey as jest.Mock).mockResolvedValueOnce({
        cipher: 'owner-cipher',
        iv: 'owner-iv',
        salt: 'owner-salt',
        algorithm: 'AES-256-CBC',
        iterations: 100000,
        authTag: 'owner-tag',
        wrapMode: 'device',
      });

      await revokeDocumentShareGrant(
        {
          ...mockDocMeta,
          encryptedDocKey: {
            cipher: 'old-owner-cipher',
            iv: 'old-owner-iv',
            salt: 'old-owner-salt',
            algorithm: 'AES-256-CBC',
            iterations: 100000,
            authTag: 'old-owner-tag',
            wrapMode: 'device',
          },
          references: [
            {
              source: 'local',
              localPath: '/tmp/local.enc.json',
              name: 'file.txt',
              size: 10,
              type: 'text/plain',
            },
          ],
        } as any,
        'owner-uid',
        'recipient@test.com',
      );

      expect(RNFS.readFile).not.toHaveBeenCalled();
      expect(uploadString).not.toHaveBeenCalled();
    });
  });

  describe('canCurrentUserExportDocument', () => {
    it('returns true if no current user', () => {
      (getAuth as jest.Mock).mockReturnValueOnce({ currentUser: null });
      expect(canCurrentUserExportDocument(mockDocMeta)).toBe(true);
    });

    it('returns true if current user is owner', () => {
      expect(canCurrentUserExportDocument(mockDocMeta)).toBe(true);
    });

    it('returns true if grant allows export', () => {
      (getAuth as jest.Mock).mockReturnValueOnce({ currentUser: { uid: 'recipient-uid', email: 'test@test.com' } });
      const docWithGrant = {
        ...mockDocMeta,
        sharedKeyGrants: [{
          recipientUid: 'recipient-uid',
          allowExport: true,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 100000).toISOString(),
        }] as any,
      };
      expect(canCurrentUserExportDocument(docWithGrant)).toBe(true);
    });

    it('returns false if grant denies export', () => {
      (getAuth as jest.Mock).mockReturnValue({ currentUser: { uid: 'recipient-uid', email: 'test@test.com' } });
      const docWithGrant = {
        ...mockDocMeta,
        sharedKeyGrants: [{
          recipientUid: 'recipient-uid',
          allowExport: false,
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 100000).toISOString(),
        }] as any,
      };
      expect(canCurrentUserExportDocument(docWithGrant)).toBe(false);
    });
  });
});
