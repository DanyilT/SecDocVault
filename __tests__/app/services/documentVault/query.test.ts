import {
  getDocumentMetadataFromVault,
  listVaultDocumentsFromFirebase,
  listVaultDocumentsSharedWithUser,
} from '../../../../src/services/documentVault/query';

import { getDoc, getDocs, collectionGroup, collection } from '@react-native-firebase/firestore';

jest.mock('@react-native-firebase/app', () => ({
  getApp: jest.fn(() => ({})),
}));

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  collectionGroup: jest.fn(),
  doc: jest.fn(),
  query: jest.fn(),
  where: jest.fn(),
  getDoc: jest.fn(),
  getDocs: jest.fn(),
}));

describe('Document Vault Query Services', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('getDocumentMetadataFromVault', () => {
    it('returns null if doc does not exist', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });
      const result = await getDocumentMetadataFromVault('non-existent');
      expect(result).toBeNull();
    });

    it('returns normalized vault document when doc exists', async () => {
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        id: 'doc-123',
        data: () => ({
          name: 'My Doc',
          description: 'A test doc',
          size: '1.0 KB',
          references: [{ source: 'firebase', size: 1024, type: 'text/plain', fileHash: 'hash1' }],
        }),
      });

      const result = await getDocumentMetadataFromVault('doc-123');
      expect(result?.id).toBe('doc-123');
      expect(result?.name).toBe('My Doc');
      expect(result?.description).toBe('A test doc');
      expect(result?.references.length).toBe(1);
      expect(result?.size).toBe('1.0 KB'); // toSizeLabel(1024)
    });
  });

  describe('listVaultDocumentsFromFirebase', () => {
    it('returns empty array when permission denied', async () => {
      (getDocs as jest.Mock).mockRejectedValueOnce({ code: 'permission-denied' });
      const result = await listVaultDocumentsFromFirebase('user-1');
      expect(result).toEqual([]);
    });

    it('returns empty array on index error', async () => {
      (getDocs as jest.Mock).mockRejectedValueOnce({ message: 'FAILED_PRECONDITION: index required' });
      const result = await listVaultDocumentsFromFirebase('user-1');
      expect(result).toEqual([]);
    });

    it('throws unknown errors', async () => {
      const error = new Error('Unknown error');
      (getDocs as jest.Mock).mockRejectedValueOnce(error);
      await expect(listVaultDocumentsFromFirebase('user-1')).rejects.toThrow('Unknown error');
    });

    it('returns sorted normalized documents', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce([
        {
          id: 'doc-1',
          data: () => ({ name: 'Doc 1', uploadedAt: '2023-01-01', owner: 'user-1' }),
        },
        {
          id: 'doc-2',
          data: () => ({ name: 'Doc 2', uploadedAt: '2023-01-02', owner: 'user-1' }),
        },
      ]);

      const result = await listVaultDocumentsFromFirebase('user-1');
      expect(result.length).toBe(2);
      // Should sort descending by uploadedAt
      expect(result[0].id).toBe('doc-2');
      expect(result[1].id).toBe('doc-1');
    });
  });

  describe('listVaultDocumentsSharedWithUser', () => {
    it('returns empty array if identifiers are empty', async () => {
      const result = await listVaultDocumentsSharedWithUser([]);
      expect(result).toEqual([]);
    });

    it('returns documents found via grants', async () => {
      // Mock collectionGroup matches (UID and Email)
      (getDocs as jest.Mock)
        .mockResolvedValueOnce([ // collectionGroup matches for UID
          {
            ref: { parent: { parent: { id: 'doc-1' } } },
            data: () => ({
              recipientUid: 'user-2',
              createdAt: new Date().toISOString(),
              expiresAt: new Date(Date.now() + 10000).toISOString(),
            }),
          },
        ])
        .mockResolvedValueOnce([]) // collectionGroup matches for Email
        .mockResolvedValueOnce([]) // fallback query matches
        .mockResolvedValueOnce([]); // fallback query matches

      // Mock getDoc for the matched docId
      (getDoc as jest.Mock).mockResolvedValueOnce({
        exists: () => true,
        id: 'doc-1',
        data: () => ({ name: 'Shared Doc', owner: 'user-1' }),
      });

      const result = await listVaultDocumentsSharedWithUser(['user-2']);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('doc-1');
      expect(result[0].name).toBe('Shared Doc');
    });

    it('returns documents found via fallback queries', async () => {
      // Mock collectionGroup permission denied
      (getDocs as jest.Mock)
        .mockRejectedValueOnce({ code: 'permission-denied' }) // UID (Email is empty so no getDocs called for it)
        .mockResolvedValueOnce([ // Fallback UID matches
          {
            id: 'doc-fallback',
            data: () => ({ name: 'Fallback Doc', owner: 'user-1', sharedWith: ['user-2'] }),
          },
        ]);

      const result = await listVaultDocumentsSharedWithUser(['user-2']);
      expect(result.length).toBe(1);
      expect(result[0].id).toBe('doc-fallback');
    });
  });
});
