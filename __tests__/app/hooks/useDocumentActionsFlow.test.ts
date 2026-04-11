import { Alert } from 'react-native';

import { useDocumentActionsFlow } from '../../../src/app/hooks';
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

function buildParams(overrides: Record<string, unknown> = {}) {
  return {
    isGuest: false,
    userUid: 'user-1',
    setDocuments: jest.fn(),
    setSelectedDoc: jest.fn(),
    setUploadStatus: jest.fn(),
    setScreen: jest.fn(),
    hasInternetAccess: jest.fn(async () => true),
    saveDocumentOffline: jest.fn(async (doc: VaultDocument) => doc),
    saveDocumentToFirebase: jest.fn(async (doc: VaultDocument) => doc),
    removeLocalDocumentCopy: jest.fn(async () => makeDoc()),
    deleteDocumentFromFirebase: jest.fn(async () => undefined),
    removeFirebaseReferences: jest.fn(() => makeDoc({references: [{source: 'local', name: 'a', size: 1, type: 'x'}]})),
    ...overrides,
  };
}

describe('useDocumentActionsFlow', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('blocks cloud save in guest mode', async () => {
    const params = buildParams({isGuest: true});
    const flow = useDocumentActionsFlow(params as never);

    await flow.handleSaveToFirebase(makeDoc());

    expect(params.setUploadStatus).toHaveBeenCalledWith('Cloud save is unavailable in guest mode.');
  });

  it('blocks cloud save when offline', async () => {
    const params = buildParams({hasInternetAccess: jest.fn(async () => false)});
    const flow = useDocumentActionsFlow(params as never);

    await flow.handleSaveToFirebase(makeDoc({owner: 'user-1'}));

    expect(params.setUploadStatus).toHaveBeenCalledWith('no internet access');
  });

  it('cancels local delete when destructive confirmation is rejected', async () => {
    const params = buildParams();
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const cancel = (buttons ?? []).find(button => button.text === 'Cancel');
      cancel?.onPress?.();
    });
    const flow = useDocumentActionsFlow(params as never);

    await flow.handleDeleteLocal(makeDoc({references: [{source: 'local', name: 'a', size: 1, type: 'x'}]}));

    expect(params.removeLocalDocumentCopy).not.toHaveBeenCalled();
  });

  it('keeps local encrypted copy when firebase delete removes cloud refs only', async () => {
    const params = buildParams();
    const flow = useDocumentActionsFlow(params as never);

    await flow.handleDeleteFromFirebase(
      makeDoc({references: [{source: 'firebase', name: 'a', size: 1, type: 'x'}, {source: 'local', name: 'a', size: 1, type: 'x'}]}),
    );

    expect(params.deleteDocumentFromFirebase).toHaveBeenCalled();
    expect(params.setUploadStatus).toHaveBeenLastCalledWith('Doc deleted from Cloud (Firebase). Local encrypted copy remains.');
  });
});
