/**
 * Tests for updateDocumentMetadata in services/documentVault/storage.ts
 */

import { updateDocumentMetadata } from '../../../../src/services/documentVault';
import { VaultDocument } from '../../../../src/types/vault';

const firestore = jest.requireMock('@react-native-firebase/firestore');
const auth = jest.requireMock('@react-native-firebase/auth');

function makeDoc(overrides: Partial<VaultDocument> = {}): VaultDocument {
  return {
    id: 'doc-1',
    name: 'Original Name',
    description: 'Original description',
    hash: 'hash',
    size: '1 KB',
    uploadedAt: '2026-04-11',
    owner: 'owner-uid',
    references: [
      {
        name: 'file.jpg',
        size: 123,
        type: 'image/jpeg',
        source: 'firebase',
        storagePath: 'vault/owner-uid/doc-1/file.enc',
        order: 0,
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  auth.getAuth.mockReturnValue({ currentUser: { uid: 'owner-uid', email: 'owner@example.com' } });
});

describe('updateDocumentMetadata', () => {
  test('returns updated document with normalized name and description', async () => {
    const doc = makeDoc();

    const result = await updateDocumentMetadata(doc, {
      name: '  New Name  ',
      description: '  New description  ',
    });

    expect(result.id).toBe(doc.id);
    expect(result.name).toBe('New Name');
    expect(result.description).toBe('New description');
  });

  test('preserves all non-edited fields on the returned document', async () => {
    const doc = makeDoc();

    const result = await updateDocumentMetadata(doc, { name: 'Renamed', description: 'Redescribed' });

    expect(result.id).toBe(doc.id);
    expect(result.hash).toBe(doc.hash);
    expect(result.size).toBe(doc.size);
    expect(result.uploadedAt).toBe(doc.uploadedAt);
    expect(result.owner).toBe(doc.owner);
    expect(result.references).toBe(doc.references);
  });

  test('falls back to a default name when the provided name is empty', async () => {
    const doc = makeDoc();

    const result = await updateDocumentMetadata(doc, { name: '   ', description: 'some' });

    expect(result.name).toBe('Document');
  });

  test('coerces missing description to empty string', async () => {
    const doc = makeDoc();

    const result = await updateDocumentMetadata(doc, { name: 'Keep', description: undefined });

    expect(result.description).toBe('Original description');
  });

  test('persists changes to Firestore when current user is the owner and a cloud copy exists', async () => {
    const doc = makeDoc();

    await updateDocumentMetadata(doc, { name: 'New', description: 'Newer' });

    expect(firestore.setDoc).toHaveBeenCalledTimes(1);
    const [, payload, options] = firestore.setDoc.mock.calls[0];
    expect(payload.name).toBe('New');
    expect(payload.description).toBe('Newer');
    expect(typeof payload.updatedAt).toBe('string');
    expect(options).toEqual({ merge: true });
  });

  test('does not write to Firestore when the current user is not the owner', async () => {
    auth.getAuth.mockReturnValue({ currentUser: { uid: 'someone-else', email: 'x@y.com' } });
    const doc = makeDoc();

    const result = await updateDocumentMetadata(doc, { name: 'X', description: 'Y' });

    expect(firestore.setDoc).not.toHaveBeenCalled();
    expect(result.name).toBe('X');
    expect(result.description).toBe('Y');
  });

  test('does not write to Firestore when the document has no firebase reference', async () => {
    const doc = makeDoc({
      references: [
        {
          name: 'file.jpg',
          size: 123,
          type: 'image/jpeg',
          source: 'local',
          localPath: '/tmp/file.enc',
          order: 0,
        },
      ],
    });

    await updateDocumentMetadata(doc, { name: 'X', description: 'Y' });

    expect(firestore.setDoc).not.toHaveBeenCalled();
  });

  test('does not write to Firestore when there is no signed-in user', async () => {
    auth.getAuth.mockReturnValue({ currentUser: null });
    const doc = makeDoc();

    await updateDocumentMetadata(doc, { name: 'X', description: 'Y' });

    expect(firestore.setDoc).not.toHaveBeenCalled();
  });

  test('keeps existing values when updates omit fields', async () => {
    const doc = makeDoc({ name: 'Keep me', description: 'Also me' });

    const result = await updateDocumentMetadata(doc, {});

    expect(result.name).toBe('Keep me');
    expect(result.description).toBe('Also me');
  });
});
