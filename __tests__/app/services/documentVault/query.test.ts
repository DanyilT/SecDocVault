import {
  getDocumentMetadataFromVault,
  listVaultDocumentsFromFirebase,
  listVaultDocumentsSharedWithUser,
} from '../../../../src/services/documentVault';

import { getDoc, getDocs } from '@react-native-firebase/firestore';

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
      expect(result?.references?.length).toBe(1);
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

    it('normalizes offline flag and size from first reference when size is not a string', async () => {
      (getDocs as jest.Mock).mockResolvedValueOnce([
        {
          id: 'doc-local-ref',
          data: () => ({
            name: 'Doc with local ref',
            uploadedAt: '2023-01-03',
            owner: 'user-1',
            size: 2048,
            references: [{ source: 'local', size: 2048, type: 'text/plain', order: 0 }],
          }),
        },
      ]);

      const result = await listVaultDocumentsFromFirebase('user-1');
      expect(result).toHaveLength(1);
      expect(result[0].size).toBe('2.0 KB');
      expect(result[0].offlineAvailable).toBe(true);
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

    it('returns empty when both grant queries are denied and fallback has no data', async () => {
      (getDocs as jest.Mock)
        // loadGrantMatches recipientUid
        .mockRejectedValueOnce({ code: 'permission-denied' })
        // loadGrantMatches recipientEmail
        .mockRejectedValueOnce({ code: 'permission-denied' })
        // fallback sharedWith query for uid
        .mockRejectedValueOnce({ code: 'permission-denied' })
        // fallback sharedWith query for email
        .mockRejectedValueOnce({ code: 'permission-denied' });

      const result = await listVaultDocumentsSharedWithUser(['recipient-uid', 'recipient@example.com']);
      expect(result).toEqual([]);
    });

    it('handles index errors and warns for collectionGroup and fallback queries', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      (getDocs as jest.Mock)
        // loadGrantMatches recipientUid -> index error
        .mockRejectedValueOnce({ message: 'FAILED_PRECONDITION: index required' })
        // fallback query -> index error
        .mockRejectedValueOnce({ message: 'FAILED_PRECONDITION: index required' });

      const result = await listVaultDocumentsSharedWithUser(['recipient-uid']);
      expect(result).toEqual([]);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('keeps fallback docs when getDoc for grant is permission denied', async () => {
      const activeGrant = {
        recipientUid: 'recipient-uid',
        recipientEmail: 'recipient@example.com',
        allowExport: true,
        wrappedKeyCipher: 'wrapped',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };

      (getDocs as jest.Mock)
        // loadGrantMatches for uid
        .mockResolvedValueOnce({
          forEach: (cb: (item: any) => void) =>
            cb({
              ref: { parent: { parent: { id: 'doc-grant' } } },
              data: () => activeGrant,
            }),
        })
        // fallback sharedWith query
        .mockResolvedValueOnce({
          forEach: (cb: (item: any) => void) =>
            cb({
              id: 'doc-fallback-only',
              data: () => ({ uploadedAt: '2025-01-01', owner: 'owner-a', sharedWith: ['recipient-uid'] }),
            }),
        });

      (getDoc as jest.Mock).mockRejectedValueOnce({ code: 'permission-denied' });

      const result = await listVaultDocumentsSharedWithUser(['recipient-uid']);
      expect(result.map(item => item.id)).toContain('doc-fallback-only');
    });

    it('drops inactive grants and ignores non-existing grant docs', async () => {
      const expiredGrant = {
        recipientUid: 'recipient-uid',
        recipientEmail: 'recipient@example.com',
        allowExport: true,
        wrappedKeyCipher: 'wrapped',
        createdAt: new Date(Date.now() - 120_000).toISOString(),
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      };

      const activeGrant = {
        recipientUid: 'recipient-uid',
        recipientEmail: 'recipient@example.com',
        allowExport: true,
        wrappedKeyCipher: 'wrapped',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };

      (getDocs as jest.Mock)
        // loadGrantMatches for uid with one expired and one active entry
        .mockResolvedValueOnce({
          forEach: (cb: (item: any) => void) => {
            cb({
              ref: { parent: { parent: { id: 'doc-expired' } } },
              data: () => expiredGrant,
            });
            cb({
              ref: { parent: { parent: { id: 'doc-missing' } } },
              data: () => activeGrant,
            });
          },
        })
        // fallback query returns none
        .mockResolvedValueOnce({ forEach: (_cb: (item: any) => void) => undefined });

      (getDoc as jest.Mock).mockResolvedValueOnce({ exists: () => false });

      const result = await listVaultDocumentsSharedWithUser(['recipient-uid']);
      expect(result).toEqual([]);
    });

    it('merges duplicate fallback documents across identifiers', async () => {
      (getDocs as jest.Mock)
        // loadGrantMatches recipientUid
        .mockResolvedValueOnce({ forEach: (_cb: (item: any) => void) => undefined })
        // loadGrantMatches recipientEmail
        .mockResolvedValueOnce({ forEach: (_cb: (item: any) => void) => undefined })
        // fallback for uid identifier
        .mockResolvedValueOnce({
          forEach: (cb: (item: any) => void) =>
            cb({
              id: 'dup-doc',
              data: () => ({
                owner: 'owner-1',
                uploadedAt: '2025-01-01',
                sharedWith: ['recipient-uid'],
                references: [{ source: 'firebase', storagePath: 'vault/a', order: 1 }],
              }),
            }),
        })
        // fallback for email identifier (same doc id, local reference)
        .mockResolvedValueOnce({
          forEach: (cb: (item: any) => void) =>
            cb({
              id: 'dup-doc',
              data: () => ({
                owner: 'owner-1',
                uploadedAt: '2025-01-02',
                sharedWith: ['recipient@example.com'],
                references: [{ source: 'local', localPath: '/tmp/x', order: 0 }],
              }),
            }),
        });

      const result = await listVaultDocumentsSharedWithUser(['recipient-uid', 'recipient@example.com']);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('dup-doc');
      expect(result[0].references?.length).toBe(2);
      expect(result[0].offlineAvailable).toBe(true);
      expect(result[0].sharedWith).toEqual(expect.arrayContaining(['recipient-uid', 'recipient@example.com']));
    });

    it('throws unknown errors from collectionGroup lookup', async () => {
      (getDocs as jest.Mock).mockRejectedValueOnce(new Error('group lookup failed'));
      await expect(listVaultDocumentsSharedWithUser(['recipient-uid'])).rejects.toThrow('group lookup failed');
    });

    it('throws unknown errors from fallback sharedWith lookup', async () => {
      (getDocs as jest.Mock)
        // loadGrantMatches recipientUid succeeds with no grant docs
        .mockResolvedValueOnce({ forEach: (_cb: (item: any) => void) => undefined })
        // fallback query throws unknown
        .mockRejectedValueOnce(new Error('fallback lookup failed'));

      await expect(listVaultDocumentsSharedWithUser(['recipient-uid'])).rejects.toThrow('fallback lookup failed');
    });

    it('throws unknown errors while loading document metadata from deduped grants', async () => {
      const activeGrant = {
        recipientUid: 'recipient-uid',
        recipientEmail: 'recipient@example.com',
        allowExport: true,
        wrappedKeyCipher: 'wrapped',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
      };

      (getDocs as jest.Mock)
        // loadGrantMatches recipientUid -> one active grant
        .mockResolvedValueOnce({
          forEach: (cb: (item: any) => void) =>
            cb({
              ref: { parent: { parent: { id: 'doc-grant' } } },
              data: () => activeGrant,
            }),
        })
        // fallback query returns no docs
        .mockResolvedValueOnce({ forEach: (_cb: (item: any) => void) => undefined });

      (getDoc as jest.Mock).mockRejectedValueOnce(new Error('getDoc failed'));
      await expect(listVaultDocumentsSharedWithUser(['recipient-uid'])).rejects.toThrow('getDoc failed');
    });
  });
});
