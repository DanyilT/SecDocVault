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
});
