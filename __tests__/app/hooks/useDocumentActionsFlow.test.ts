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

  function acceptDeletePrompt() {
    jest.spyOn(Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const destructive = (buttons ?? []).find(button => button.style === 'destructive');
      destructive?.onPress?.();
    });
  }

  it('blocks cloud save in guest mode', async () => {
    const params = buildParams({isGuest: true});
    const flow = useDocumentActionsFlow(params as never);

    await flow.handleSaveToFirebase(makeDoc());

    expect(params.setUploadStatus).toHaveBeenCalledWith('Cloud save is unavailable in guest mode.');
  });

  it('saves offline successfully and clears the selected document status', async () => {
    const params = buildParams();
    const flow = useDocumentActionsFlow(params as never);

    await flow.handleSaveOffline(makeDoc());

    expect(params.saveDocumentOffline).toHaveBeenCalledTimes(1);
    expect(params.setUploadStatus).toHaveBeenLastCalledWith('Doc is now available offline.');
  });

  it('surfaces offline save failures', async () => {
    const params = buildParams({
      saveDocumentOffline: jest.fn(async () => {
        throw new Error('offline failed');
      }),
    });
    const flow = useDocumentActionsFlow(params as never);

    await flow.handleSaveOffline(makeDoc());

    expect(params.setUploadStatus).toHaveBeenLastCalledWith('offline failed');
  });

  it('blocks cloud save when offline', async () => {
    const params = buildParams({hasInternetAccess: jest.fn(async () => false)});
    const flow = useDocumentActionsFlow(params as never);

    await flow.handleSaveToFirebase(makeDoc({owner: 'user-1'}));

    expect(params.setUploadStatus).toHaveBeenCalledWith('no internet access');
  });

  it('blocks cloud save when user uid is missing or document ownership does not match', async () => {
    const missingUidParams = buildParams({userUid: undefined});
    const missingUidFlow = useDocumentActionsFlow(missingUidParams as never);
    await missingUidFlow.handleSaveToFirebase(makeDoc({owner: 'user-1'}));
    expect(missingUidParams.setUploadStatus).toHaveBeenCalledWith('Sign in before saving to Cloud (Firebase).');

    const ownerMismatchParams = buildParams();
    const ownerMismatchFlow = useDocumentActionsFlow(ownerMismatchParams as never);
    await ownerMismatchFlow.handleSaveToFirebase(makeDoc({owner: 'other-user'}));
    expect(ownerMismatchParams.setUploadStatus).toHaveBeenCalledWith(
      'Only owner documents or local guest documents can be saved to your Cloud (Firebase) vault.',
    );
  });

  it('saves to firebase successfully for owner documents', async () => {
    const params = buildParams();
    const flow = useDocumentActionsFlow(params as never);

    await flow.handleSaveToFirebase(makeDoc({owner: 'user-1'}));

    expect(params.saveDocumentToFirebase).toHaveBeenCalledWith(expect.objectContaining({owner: 'user-1'}), 'user-1');
    expect(params.setUploadStatus).toHaveBeenLastCalledWith('Doc is now saved in Cloud (Firebase).');
  });

  it('surfaces firebase save failures', async () => {
    const params = buildParams({
      saveDocumentToFirebase: jest.fn(async () => {
        throw new Error('firebase failed');
      }),
    });
    const flow = useDocumentActionsFlow(params as never);

    await flow.handleSaveToFirebase(makeDoc({owner: 'user-1'}));

    expect(params.setUploadStatus).toHaveBeenLastCalledWith('firebase failed');
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

  it('deletes the last offline copy after confirmation', async () => {
    acceptDeletePrompt();
    const params = buildParams({
      removeLocalDocumentCopy: jest.fn(async () => makeDoc({references: []})),
    });
    const flow = useDocumentActionsFlow(params as never);

    await flow.handleDeleteLocal(makeDoc());

    expect(params.removeLocalDocumentCopy).toHaveBeenCalledTimes(1);
    expect(params.setScreen).toHaveBeenCalledWith('main');
    expect(params.setUploadStatus).toHaveBeenLastCalledWith('Doc deleted permanently.');
  });

  it('blocks firebase delete in guest mode', async () => {
    const params = buildParams({isGuest: true});
    const flow = useDocumentActionsFlow(params as never);

    await flow.handleDeleteFromFirebase(makeDoc());

    expect(params.setUploadStatus).toHaveBeenCalledWith('Cloud (Firebase) delete is unavailable in guest mode.');
  });

  it('deletes from firebase permanently when no local copy remains', async () => {
    acceptDeletePrompt();
    const params = buildParams({
      removeFirebaseReferences: jest.fn(() => null),
    });
    const flow = useDocumentActionsFlow(params as never);

    await flow.handleDeleteFromFirebase(makeDoc({references: [{source: 'firebase', name: 'a', size: 1, type: 'x'}]}));

    expect(params.deleteDocumentFromFirebase).toHaveBeenCalledTimes(1);
    expect(params.setScreen).toHaveBeenCalledWith('main');
    expect(params.setUploadStatus).toHaveBeenLastCalledWith('Doc deleted permanently.');
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
