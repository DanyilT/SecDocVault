import { mergeDocumentReferences, mergeVaultDocuments } from '../../../src/app/hooks/useDocumentVault.ts';
import { VaultDocument } from '../../../src/types/vault';

function makeDoc(overrides: Partial<VaultDocument> = {}): VaultDocument {
  return {
    id: 'doc-1',
    name: 'Doc',
    hash: 'hash',
    size: '10 KB',
    uploadedAt: '2026-04-10T00:00:00.000Z',
    references: [],
    ...overrides,
  };
}

describe('useDocumentVault helpers', () => {
  it('deduplicates reference entries', () => {
    const ref = {source: 'firebase', name: 'a.jpg', size: 100, type: 'image/jpeg'} as const;
    const merged = mergeDocumentReferences([ref], [ref]);

    expect(merged).toHaveLength(1);
  });

  it('merges docs and preserves local offline availability', () => {
    const firebaseDoc = makeDoc({
      id: 'doc-1',
      references: [{source: 'firebase', name: 'a.jpg', size: 100, type: 'image/jpeg'}],
    });
    const localDoc = makeDoc({
      id: 'doc-1',
      references: [{source: 'local', name: 'a.jpg', size: 100, type: 'image/jpeg', localPath: '/tmp/a.jpg'}],
    });

    const merged = mergeVaultDocuments([firebaseDoc], [], [localDoc]);

    expect(merged).toHaveLength(1);
    expect(merged[0].offlineAvailable).toBe(true);
    expect(merged[0].references?.some(item => item.source === 'local')).toBe(true);
  });

  it('sorts merged docs by uploadedAt descending', () => {
    const older = makeDoc({id: 'doc-old', uploadedAt: '2026-01-01T00:00:00.000Z'});
    const newer = makeDoc({id: 'doc-new', uploadedAt: '2026-03-01T00:00:00.000Z'});

    const merged = mergeVaultDocuments([older, newer], [], []);

    expect(merged[0].id).toBe('doc-new');
    expect(merged[1].id).toBe('doc-old');
  });

  it('merges shared documents with owner documents', () => {
    const ownerDoc = makeDoc({
      id: 'doc-1',
      owner: 'owner-uid',
      references: [{source: 'firebase', name: 'a.jpg', size: 100, type: 'image/jpeg'}],
    });
    const sharedDoc = makeDoc({
      id: 'doc-2',
      owner: 'other-uid',
      references: [{source: 'firebase', name: 'shared.jpg', size: 200, type: 'image/jpeg'}],
    });

    const merged = mergeVaultDocuments([ownerDoc], [sharedDoc], []);

    expect(merged).toHaveLength(2);
    expect(merged.map(d => d.id)).toEqual(['doc-1', 'doc-2']);
  });

  it('deduplicates shared recipients in merged documents', () => {
    const doc1 = makeDoc({
      id: 'doc-1',
      sharedWith: ['user1@example.com', 'user2@example.com'],
    });
    const doc2 = makeDoc({
      id: 'doc-1',
      sharedWith: ['user2@example.com', 'user3@example.com'],
    });

    const merged = mergeVaultDocuments([doc1, doc2], [], []);

    expect(merged).toHaveLength(1);
    expect(merged[0].sharedWith?.sort()).toEqual(['user1@example.com', 'user2@example.com', 'user3@example.com']);
  });

   it('deduplicates shared key grants in merged documents', () => {
     const doc1 = makeDoc({
       id: 'doc-1',
       sharedKeyGrants: [
         {recipientUid: 'uid-1', recipientEmail: 'user1@example.com', createdAt: '2026-01-01T00:00:00.000Z', expiresAt: '2026-02-01T00:00:00.000Z', allowExport: true, wrappedKeyCipher: 'cipher1', keyWrapAlgorithm: 'RSA-OAEP'},
         {recipientUid: 'uid-2', recipientEmail: 'user2@example.com', createdAt: '2026-01-01T00:00:00.000Z', expiresAt: '2026-02-01T00:00:00.000Z', allowExport: true, wrappedKeyCipher: 'cipher2', keyWrapAlgorithm: 'RSA-OAEP'},
       ],
     });
     const doc2 = makeDoc({
       id: 'doc-1',
       sharedKeyGrants: [
         {recipientUid: 'uid-2', recipientEmail: 'user2@example.com', createdAt: '2026-01-01T00:00:00.000Z', expiresAt: '2026-02-01T00:00:00.000Z', allowExport: true, wrappedKeyCipher: 'cipher2', keyWrapAlgorithm: 'RSA-OAEP'},
       ],
     });

    const merged = mergeVaultDocuments([doc1, doc2], [], []);

    expect(merged).toHaveLength(1);
    expect(merged[0].sharedKeyGrants).toHaveLength(2);
  });

  it('merges document references from multiple sources', () => {
    const ref1 = {source: 'firebase', name: 'a.jpg', size: 100, type: 'image/jpeg'} as const;
    const ref2 = {source: 'local', name: 'a.jpg', size: 100, type: 'image/jpeg', localPath: '/tmp/a.jpg'} as const;

    const merged = mergeDocumentReferences([ref1], [ref2]);

    expect(merged).toHaveLength(2);
    expect(merged.some(r => r.source === 'firebase')).toBe(true);
    expect(merged.some(r => r.source === 'local')).toBe(true);
  });

   it('handles document with fallback encryptedDocKey, saveMode, recoverable', () => {
     const doc1 = makeDoc({
       id: 'doc-1',
       encryptedDocKey: {cipher: 'key1', iv: 'iv1', salt: 'salt1', iterations: 10000, algorithm: 'AES-256-GCM', kdf: 'pbkdf2'},
       saveMode: 'firebase',
       recoverable: true,
     });
     const doc2 = makeDoc({
       id: 'doc-1',
       encryptedDocKey: {cipher: 'key2', iv: 'iv2', salt: 'salt2', iterations: 10000, algorithm: 'AES-256-GCM', kdf: 'pbkdf2'},
       saveMode: 'local',
       recoverable: false,
     });

     const merged = mergeVaultDocuments([doc1, doc2], [], []);

     expect(merged).toHaveLength(1);
     expect(merged[0].encryptedDocKey?.cipher).toBe('key1');
     expect(merged[0].saveMode).toBe('firebase');
     expect(merged[0].recoverable).toBe(true);
  });

  it('filters null sharedWith entries', () => {
    const doc1 = makeDoc({
      id: 'doc-1',
      sharedWith: ['user1@example.com', null as unknown as string],
    });
    const doc2 = makeDoc({
      id: 'doc-1',
      sharedWith: [undefined as unknown as string, 'user2@example.com'],
    });

    const merged = mergeVaultDocuments([doc1, doc2], [], []);

    expect(merged).toHaveLength(1);
    expect(merged[0].sharedWith?.every(item => item && item.length > 0)).toBe(true);
  });

  it('handles documents with merge references containing order field', () => {
    const ref1 = {source: 'firebase', order: 0, name: 'a.jpg', size: 100, type: 'image/jpeg'} as const;
    const ref2 = {source: 'firebase', order: 1, name: 'b.jpg', size: 100, type: 'image/jpeg'} as const;

    const merged = mergeDocumentReferences([ref1], [ref2]);

    expect(merged).toHaveLength(2);
  });

  it('handles documents with storagePath and localPath in references', () => {
    const ref1 = {source: 'firebase', name: 'a.jpg', size: 100, type: 'image/jpeg', storagePath: 'docs/a.jpg'} as const;
    const ref2 = {source: 'firebase', name: 'a.jpg', size: 100, type: 'image/jpeg', storagePath: 'docs/a.jpg'} as const;

    const merged = mergeDocumentReferences([ref1], [ref2]);

    expect(merged).toHaveLength(1);
  });

  it('preserves references with different locations', () => {
    const doc = makeDoc({
      id: 'doc-1',
      references: [
        {source: 'firebase', name: 'a.jpg', size: 100, type: 'image/jpeg', storagePath: 'path1'},
        {source: 'firebase', name: 'a.jpg', size: 100, type: 'image/jpeg', storagePath: 'path2'},
      ],
    });

    const merged = mergeVaultDocuments([doc], [], []);

    expect(merged[0].references).toHaveLength(2);
  });

  it('marks document as offline available when local references exist', () => {
    const doc = makeDoc({
      id: 'doc-1',
      offlineAvailable: false,
      references: [{source: 'local', name: 'a.jpg', size: 100, type: 'image/jpeg', localPath: '/tmp/a.jpg'}],
    });

    const merged = mergeVaultDocuments([], [], [doc]);

    expect(merged[0].offlineAvailable).toBe(true);
  });

  it('handles empty document arrays', () => {
    const merged = mergeVaultDocuments([], [], []);

    expect(merged).toHaveLength(0);
  });

  it('handles documents with no references', () => {
    const doc = makeDoc({
      id: 'doc-1',
      references: undefined,
    });

    const merged = mergeVaultDocuments([doc], [], []);

    expect(merged).toHaveLength(1);
  });
});
