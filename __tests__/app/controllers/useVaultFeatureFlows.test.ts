import { useVaultFeatureFlows } from '../../../src/app/controllers/useVaultFeatureFlows';

jest.mock('../../../src/services/documentVault', () => ({
  canCurrentUserExportDocument: jest.fn(() => true),
  createDocumentShareGrant: jest.fn(),
  deleteDocumentFromFirebase: jest.fn(),
  decryptDocumentPayload: jest.fn(),
  documentSaveLocal: jest.fn(),
  exportDocumentToDevice: jest.fn(),
  MAX_FILES_PER_DOCUMENT: 10,
  pickDocumentForUpload: jest.fn(),
  removeFirebaseReferences: jest.fn(),
  removeLocalDocumentCopy: jest.fn(),
  revokeDocumentShareGrant: jest.fn(),
  saveDocumentOffline: jest.fn(),
  saveDocumentToFirebase: jest.fn(),
  scanDocumentForUpload: jest.fn(),
  uploadDocumentToFirebase: jest.fn(),
}));

jest.mock('../../../src/services/connectivity', () => ({
  hasInternetAccess: jest.fn(async () => true),
}));

jest.mock('../../../src/storage/localVault', () => ({
  getLocalDocuments: jest.fn(async () => []),
  saveLocalDocuments: jest.fn(async () => undefined),
}));

const mockUsePreviewFlow = jest.fn(_props => ({
  previewImageUri: null,
  previewStatus: '',
  previewFileOrder: 0,
  isPreviewDecrypting: false,
  isCurrentFileDecrypted: false,
  preparePreviewForDocument: jest.fn(),
  openPreview: jest.fn(),
  handleSelectPreviewFile: jest.fn(),
  handleDecryptPreview: jest.fn(async () => undefined),
  handleExportDocument: jest.fn(async () => undefined),
}));

const mockUseShareFlow = jest.fn(_props => ({
  shareTarget: '',
  allowDownload: true,
  shareExpiryDays: '30',
  shareStatus: '',
  isShareSubmitting: false,
  setShareTarget: jest.fn(),
  setAllowDownload: jest.fn(),
  setShareExpiryDays: jest.fn(),
  openShare: jest.fn(),
  handleCreateShare: jest.fn(async () => undefined),
  handleRevokeShare: jest.fn(async () => undefined),
  handleRevokeShareForRecipient: jest.fn(async () => undefined),
}));

const mockUseUploadFlow = jest.fn(_props => ({
  handleLeaveUploadScreen: jest.fn(),
  confirmDiscardUploadDraft: jest.fn(async () => undefined),
  commitUploadDocument: jest.fn(async () => undefined),
  handleScanAndUpload: jest.fn(),
  handlePickAndUpload: jest.fn(),
  handleRemoveUploadFile: jest.fn(),
  handleReorderUploadFiles: jest.fn(),
}));

const mockUseDocumentActionsFlow = jest.fn(_props => ({
  handleSaveOffline: jest.fn(async () => undefined),
  handleSaveToFirebase: jest.fn(async () => undefined),
  handleDeleteLocal: jest.fn(async () => undefined),
  handleDeleteFromFirebase: jest.fn(async () => undefined),
}));

jest.mock('../../../src/app/hooks', () => ({
  usePreviewFlow: (params: any) => mockUsePreviewFlow(params),
  useShareFlow: (params: any) => mockUseShareFlow(params),
  useUploadFlow: (params: any) => mockUseUploadFlow(params),
  useDocumentActionsFlow: (params: any) => mockUseDocumentActionsFlow(params),
}));

function makeDoc(id: string) {
  return {
    id,
    name: `Doc ${id}`,
    hash: `hash-${id}`,
    size: '1KB',
    uploadedAt: '2026-01-01T00:00:00.000Z',
    references: [],
  } as any;
}

function baseParams(overrides: Record<string, unknown> = {}) {
  return {
    uploadDiscardWarningPrefKey: 'upload.warn',
    isGuest: false,
    userUid: 'u1',
    screen: 'main',
    shareOriginScreen: 'main',
    setShareOriginScreen: jest.fn(),
    uploadCanUseCloud: true,
    recoverableByDefault: false,
    saveOfflineByDefault: true,
    isUploading: false,
    pendingUploadDraft: null,
    pendingUploadName: 'Document',
    pendingUploadDescription: '',
    pendingUploadRecoverable: false,
    pendingUploadToCloud: false,
    pendingUploadAlsoSaveLocal: true,
    documents: [makeDoc('1')],
    selectedDoc: makeDoc('1'),
    skipUploadDiscardWarning: false,
    dontShowUploadDiscardWarningAgain: false,
    setDocuments: jest.fn(),
    setSelectedDoc: jest.fn(),
    setScreen: jest.fn(),
    setUploadStatus: jest.fn(),
    setBackupStatus: jest.fn(),
    setAccountStatus: jest.fn(),
    setIsUploading: jest.fn(),
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
    handleToggleDocumentRecovery: jest.fn(async () => undefined),
    ...overrides,
  } as any;
}

describe('useVaultFeatureFlows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('wires child hooks and returns composed API', () => {
    const params = baseParams();
    const api = useVaultFeatureFlows(params);

    expect(mockUsePreviewFlow).toHaveBeenCalled();
    expect(mockUseShareFlow).toHaveBeenCalled();
    expect(mockUseUploadFlow).toHaveBeenCalled();
    expect(mockUseDocumentActionsFlow).toHaveBeenCalled();

    expect(api).toEqual(
      expect.objectContaining({
        openPreview: expect.any(Function),
        openShare: expect.any(Function),
        handleScanAndUpload: expect.any(Function),
        handleSaveOffline: expect.any(Function),
      }),
    );
  });

  it('reports status when toggling document backup for missing document', async () => {
    const params = baseParams({documents: []});
    const api = useVaultFeatureFlows(params);

    await api.handleToggleDocBackupFromSettings('missing-doc', true);

    expect(params.setAccountStatus).toHaveBeenCalledWith('Document not found. Reload and try again.');
    expect(params.handleToggleDocumentRecovery).not.toHaveBeenCalled();
  });

  it('delegates document backup toggle when document exists', async () => {
    const doc = makeDoc('doc-1');
    const params = baseParams({documents: [doc]});
    const api = useVaultFeatureFlows(params);

    await api.handleToggleDocBackupFromSettings('doc-1', false);

    expect(params.handleToggleDocumentRecovery).toHaveBeenCalledWith(doc, false);
  });
});
