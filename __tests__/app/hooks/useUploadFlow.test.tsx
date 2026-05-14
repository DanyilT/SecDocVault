import { useUploadFlow } from '../../../src/app/hooks';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async () => undefined),
}));

describe('useUploadFlow', () => {
  function buildParams(overrides: Record<string, unknown> = {}) {
    return {
      uploadDiscardWarningPrefKey: 'upload.warn',
      uploadCanUseCloud: true,
      recoverableByDefault: false,
      saveOfflineByDefault: true,
      maxFilesPerDocument: 10,
      isUploading: false,
      pendingUploadDraft: null,
      pendingUploadName: 'Document',
      pendingUploadDescription: '',
      pendingUploadRecoverable: false,
      pendingUploadToCloud: true,
      pendingUploadAlsoSaveLocal: true,
      documents: [],
      userUid: 'user-1',
      setIsUploading: jest.fn(),
      setUploadStatus: jest.fn(),
      setPendingUploadDraft: jest.fn(),
      setPendingUploadName: jest.fn(),
      setPendingUploadDescription: jest.fn(),
      setPendingUploadRecoverable: jest.fn(),
      setPendingUploadToCloud: jest.fn(),
      setPendingUploadAlsoSaveLocal: jest.fn(),
      setPendingUploadPreviewIndex: jest.fn(),
      setShowUploadDiscardWarning: jest.fn(),
      setDontShowUploadDiscardWarningAgain: jest.fn(),
      setSkipUploadDiscardWarning: jest.fn(),
      setDocuments: jest.fn(),
      setScreen: jest.fn(),
      skipUploadDiscardWarning: false,
      dontShowUploadDiscardWarningAgain: false,
      isPickingFileRef: { current: false },
      getLocalDocuments: jest.fn(async () => []),
      saveLocalDocuments: jest.fn(async () => undefined),
      scanDocumentForUpload: jest.fn(async () => ({
        uri: 'file:///tmp/a.jpg',
        name: 'a.jpg',
        size: 100,
        type: 'image/jpeg',
      })),
      pickDocumentForUpload: jest.fn(async () => ({
        uri: 'file:///tmp/b.jpg',
        name: 'b.jpg',
        size: 100,
        type: 'image/jpeg',
      })),
      documentSaveLocal: jest.fn(async () => ({
        document: {
          id: 'doc-1',
          name: 'Document',
          hash: 'hash',
          size: '100 B',
          uploadedAt: new Date().toISOString(),
          saveMode: 'local',
          references: [],
        },
      })),
      uploadDocumentToFirebase: jest.fn(async () => ({
        document: {
          id: 'doc-1',
          name: 'Document',
          hash: 'hash',
          size: '100 B',
          uploadedAt: new Date().toISOString(),
          references: [{source: 'firebase', name: 'a.jpg', size: 100, type: 'image/jpeg'}],
        },
      })),
      ...overrides,
    };
  }

  it('leaves upload screen directly when no draft exists', () => {
    const params = buildParams({pendingUploadDraft: null});
    const api = useUploadFlow(params as never);

    api.handleLeaveUploadScreen();

    expect(params.setScreen).toHaveBeenCalledWith('main');
  });

  it('shows discard warning when draft exists and warning is enabled', () => {
    const params = buildParams({
      pendingUploadDraft: {
        name: 'Draft',
        files: [{uri: 'file:///tmp/a.jpg', name: 'a.jpg', size: 100, type: 'image/jpeg'}],
      },
      skipUploadDiscardWarning: false,
    });
    const api = useUploadFlow(params as never);

    api.handleLeaveUploadScreen();

    expect(params.setShowUploadDiscardWarning).toHaveBeenCalledWith(true);
  });

  it('clears draft immediately when leaving upload screen and skip warning is enabled', () => {
    const params = buildParams({
      pendingUploadDraft: {
        name: 'Draft',
        files: [{uri: 'file:///tmp/a.jpg', name: 'a.jpg', size: 100, type: 'image/jpeg'}],
      },
      skipUploadDiscardWarning: true,
    });
    const api = useUploadFlow(params as never);

    api.handleLeaveUploadScreen();

    expect(params.setPendingUploadDraft).toHaveBeenCalledWith(null);
    expect(params.setPendingUploadName).toHaveBeenCalledWith('Document');
    expect(params.setPendingUploadDescription).toHaveBeenCalledWith('');
    expect(params.setPendingUploadRecoverable).toHaveBeenCalledWith(false);
    expect(params.setPendingUploadToCloud).toHaveBeenCalledWith(true);
    expect(params.setPendingUploadAlsoSaveLocal).toHaveBeenCalledWith(true);
    expect(params.setScreen).toHaveBeenCalledWith('main');
  });

  it('confirms discard upload draft and persists preference', async () => {
    const params = buildParams({
      dontShowUploadDiscardWarningAgain: true,
      pendingUploadDraft: {
        name: 'Draft',
        files: [{uri: 'file:///tmp/a.jpg', name: 'a.jpg', size: 100, type: 'image/jpeg'}],
      },
    });
    const api = useUploadFlow(params as never);

    await api.confirmDiscardUploadDraft();

    expect(AsyncStorage.setItem).toHaveBeenCalledWith('upload.warn', '1');
    expect(params.setSkipUploadDiscardWarning).toHaveBeenCalledWith(true);
    expect(params.setShowUploadDiscardWarning).toHaveBeenCalledWith(false);
    expect(params.setPendingUploadDraft).toHaveBeenCalledWith(null);
    expect(params.setScreen).toHaveBeenCalledWith('main');
  });

  it('rejects commit when no files are present', async () => {
    const params = buildParams();
    const api = useUploadFlow(params as never);

    await api.commitUploadDocument({name: 'Draft', files: []});

    expect(params.setUploadStatus).toHaveBeenCalledWith('Add at least one file before uploading.');
  });

  it('selectUploadDocument opens scan and updates draft', async () => {
    const params = buildParams();
    const api = useUploadFlow(params as never);

    await api.selectUploadDocument('scan');

    expect(params.scanDocumentForUpload).toHaveBeenCalled();
    expect(params.setPendingUploadDraft).toHaveBeenCalled();
    expect(params.setScreen).toHaveBeenCalledWith('upload');
  });

  it('selectUploadDocument appends to draft and respects max file limit', async () => {
    const params = buildParams({
      pendingUploadDraft: {
        name: 'Draft',
        files: new Array(10).fill(0).map((_, i) => ({uri: `file:///tmp/${i}.jpg`, name: `${i}.jpg`, size: 100, type: 'image/jpeg'})),
      },
    });
    const api = useUploadFlow(params as never);

    await api.selectUploadDocument('pick', true);

    expect(params.setUploadStatus).toHaveBeenCalledWith('A document can contain at most 10 files.');
    expect(params.pickDocumentForUpload).not.toHaveBeenCalled();
  });

  it('selectUploadDocument surfaces selection failures', async () => {
    const params = buildParams({
      pickDocumentForUpload: jest.fn(async () => {
        throw new Error('Selection failed');
      }),
    });
    const api = useUploadFlow(params as never);

    await api.selectUploadDocument('pick');

    expect(params.setUploadStatus).toHaveBeenCalledWith('Selection failed');
    expect(params.setScreen).not.toHaveBeenCalledWith('upload');
  });

  it('commitUploadDocument handles cloud upload success', async () => {
    const params = buildParams({
      pendingUploadToCloud: true,
      pendingUploadAlsoSaveLocal: false,
    });
    const api = useUploadFlow(params as never);

    await api.commitUploadDocument({
      name: 'Test Doc',
      files: [{ uri: 'file://a.jpg', name: 'a.jpg', size: 1024, type: 'image/jpeg' }],
    });

    expect(params.uploadDocumentToFirebase).toHaveBeenCalled();
    expect(params.setUploadStatus).toHaveBeenCalledWith(expect.stringContaining('uploaded to Firebase Storage'));
    expect(params.setScreen).toHaveBeenCalledWith('main');
  });

  it('commitUploadDocument saves locally when cloud is disabled', async () => {
    const params = buildParams({
      pendingUploadToCloud: false,
      pendingUploadAlsoSaveLocal: true,
    });
    const api = useUploadFlow(params as never);

    await api.commitUploadDocument({
      name: 'Local Doc',
      files: [{ uri: 'file://a.jpg', name: 'a.jpg', size: 1024, type: 'image/jpeg' }],
    });

    expect(params.documentSaveLocal).toHaveBeenCalled();
    expect(params.setUploadStatus).toHaveBeenCalledWith(expect.stringContaining('encrypted and saved locally'));
    expect(params.setScreen).toHaveBeenCalledWith('main');
  });

  it('commitUploadDocument falls back to local save when firebase modules are unavailable', async () => {
    const params = buildParams({
      pendingUploadToCloud: true,
      pendingUploadAlsoSaveLocal: true,
      uploadDocumentToFirebase: jest.fn(async () => {
        throw new Error('Firebase storage native module could not be found');
      }),
    });
    const api = useUploadFlow(params as never);

    await api.commitUploadDocument({
      name: 'Cloud Doc',
      files: [{ uri: 'file://a.jpg', name: 'a.jpg', size: 1024, type: 'image/jpeg' }],
    });

    expect(params.documentSaveLocal).toHaveBeenCalled();
    expect(params.setUploadStatus).toHaveBeenCalledWith('Cloud upload unavailable. Saving encrypted files locally instead...');
  });

  it('commitUploadDocument still falls back to local save when cloud upload is disabled', async () => {
    const params = buildParams({
      pendingUploadToCloud: false,
      pendingUploadAlsoSaveLocal: false,
    });
    const api = useUploadFlow(params as never);

    await api.commitUploadDocument({
      name: 'No Destinations',
      files: [{ uri: 'file://a.jpg', name: 'a.jpg', size: 1024, type: 'image/jpeg' }],
    });

    expect(params.documentSaveLocal).toHaveBeenCalled();
    expect(params.uploadDocumentToFirebase).not.toHaveBeenCalled();
    expect(params.setUploadStatus).toHaveBeenCalledWith(expect.stringContaining('encrypted and saved locally'));
    expect(params.setScreen).toHaveBeenCalledWith('main');
  });

  it('commitUploadDocument rejects oversized files before upload', async () => {
    const params = buildParams({ pendingUploadToCloud: true, pendingUploadAlsoSaveLocal: true });
    const api = useUploadFlow(params as never);

    await api.commitUploadDocument({
      name: 'Big File',
      files: [{ uri: 'file://a.jpg', name: 'a.jpg', size: 11 * 1024 * 1024, type: 'image/jpeg' }],
    });

    expect(params.setUploadStatus).toHaveBeenCalledWith('File a.jpg is larger than 10 MB. Reduce size and retry.');
    expect(params.setIsUploading).toHaveBeenCalledWith(false);
  });

  it('handleRemoveUploadFile removes file and clears draft if empty', () => {
    const params = buildParams();
    const api = useUploadFlow(params as never);

    // Mock setPendingUploadDraft to capture the callback
    const setDraftMock = params.setPendingUploadDraft;
    
    api.handleRemoveUploadFile(0);

    expect(setDraftMock).toHaveBeenCalled();
    const callback = setDraftMock.mock.calls[0][0];
    
    // Test the callback logic
    const draft = { name: 'Test', files: [{ uri: '1' }] };
    expect(callback(draft)).toBeNull(); // Should be null if files become empty
    expect(params.setScreen).toHaveBeenCalledWith('main');
  });

  it('handleReorderUploadFiles reorders files', () => {
    const params = buildParams();
    const api = useUploadFlow(params as never);

    const setDraftMock = params.setPendingUploadDraft;
    api.handleReorderUploadFiles(0, 1);

    expect(setDraftMock).toHaveBeenCalled();
    const callback = setDraftMock.mock.calls[0][0];
    const draft = { name: 'Test', files: [{ uri: '1' }, { uri: '2' }] };
    const result = callback(draft);
    expect(result.files[0].uri).toBe('2');
    expect(result.files[1].uri).toBe('1');
  });

  it('handleReorderUploadFiles ignores invalid indexes', () => {
    const params = buildParams({
      pendingUploadDraft: { name: 'Test', files: [{ uri: '1' }, { uri: '2' }] },
    });
    const api = useUploadFlow(params as never);

    api.handleReorderUploadFiles(0, 0);
    api.handleReorderUploadFiles(-1, 1);
    api.handleReorderUploadFiles(0, 5);

    expect(params.setPendingUploadDraft).toHaveBeenCalledTimes(3);
    const firstCallback = params.setPendingUploadDraft.mock.calls[0][0];
    expect(firstCallback({ name: 'Test', files: [{ uri: '1' }, { uri: '2' }] })).toEqual({ name: 'Test', files: [{ uri: '1' }, { uri: '2' }] });
  });
});
