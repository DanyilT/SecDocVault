import {
  createDocumentShareGrant,
  revokeDocumentShareGrant,
  enforceExpiredShareRevocations,
  ensureCurrentUserSharePublicKey,
  canCurrentUserExportDocument,
} from '../../../../src/services/documentVault/sharing';

import { getDoc, getDocs, setDoc, deleteDoc } from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import * as Keychain from 'react-native-keychain';
import { wrapDocumentKeyForRecipient } from '../../../../src/services/crypto/documentCrypto';

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
  getOrCreateKdfMaterial: jest.fn(),
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
    jest.clearAllMocks();
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
