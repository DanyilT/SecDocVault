import { useUploadFlow } from '../../../src/app/hooks';

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
});
