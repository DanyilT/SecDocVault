describe('barrel exports', () => {
  afterEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  test('exports app controller entrypoint', () => {
    const mocked = jest.fn();
    jest.doMock('../../../src/app/controllers/useAppController', () => ({ useAppController: mocked }));

    const index = require('../../../src/app/controllers');
    expect(index.useAppController).toBe(mocked);
  });

  test('exports app hook entrypoints', () => {
    const mocks = {
      useAppConfig: jest.fn(),
      useAppRouting: jest.fn(),
      useAuthGateFlow: jest.fn(),
      useAuthLinkingFlow: jest.fn(),
      useDocumentActionsFlow: jest.fn(),
      useDocumentVault: jest.fn(),
      useEditMetadataFlow: jest.fn(),
      useKeyBackupFlow: jest.fn(),
      usePreviewFlow: jest.fn(),
      useShareFlow: jest.fn(),
      useUploadFlow: jest.fn(),
    };

    jest.doMock('../../../src/app/hooks/useAppConfig', () => ({ useAppConfig: mocks.useAppConfig }));
    jest.doMock('../../../src/app/hooks/useAppRouting', () => ({ useAppRouting: mocks.useAppRouting }));
    jest.doMock('../../../src/app/hooks/useAuthGateFlow', () => ({ useAuthGateFlow: mocks.useAuthGateFlow }));
    jest.doMock('../../../src/app/hooks/useAuthLinkingFlow', () => ({ useAuthLinkingFlow: mocks.useAuthLinkingFlow }));
    jest.doMock('../../../src/app/hooks/useDocumentActionsFlow', () => ({ useDocumentActionsFlow: mocks.useDocumentActionsFlow }));
    jest.doMock('../../../src/app/hooks/useDocumentVault', () => ({ useDocumentVault: mocks.useDocumentVault }));
    jest.doMock('../../../src/app/hooks/useEditMetadataFlow', () => ({ useEditMetadataFlow: mocks.useEditMetadataFlow }));
    jest.doMock('../../../src/app/hooks/useKeyBackupFlow', () => ({ useKeyBackupFlow: mocks.useKeyBackupFlow }));
    jest.doMock('../../../src/app/hooks/usePreviewFlow', () => ({ usePreviewFlow: mocks.usePreviewFlow }));
    jest.doMock('../../../src/app/hooks/useShareFlow', () => ({ useShareFlow: mocks.useShareFlow }));
    jest.doMock('../../../src/app/hooks/useUploadFlow', () => ({ useUploadFlow: mocks.useUploadFlow }));

    const index = require('../../../src/app/hooks');

    expect(index.useAppConfig).toBe(mocks.useAppConfig);
    expect(index.useAppRouting).toBe(mocks.useAppRouting);
    expect(index.useAuthGateFlow).toBe(mocks.useAuthGateFlow);
    expect(index.useAuthLinkingFlow).toBe(mocks.useAuthLinkingFlow);
    expect(index.useDocumentActionsFlow).toBe(mocks.useDocumentActionsFlow);
    expect(index.useDocumentVault).toBe(mocks.useDocumentVault);
    expect(index.useEditMetadataFlow).toBe(mocks.useEditMetadataFlow);
    expect(index.useKeyBackupFlow).toBe(mocks.useKeyBackupFlow);
    expect(index.usePreviewFlow).toBe(mocks.usePreviewFlow);
    expect(index.useShareFlow).toBe(mocks.useShareFlow);
    expect(index.useUploadFlow).toBe(mocks.useUploadFlow);
  });

  test('exports screen entrypoints', () => {
    const mocks = {
      AuthScreen: jest.fn(),
      CompleteAuthScreen: jest.fn(),
      IntroHeroScreen: jest.fn(),
      MainScreen: jest.fn(),
      UploadConfirmScreen: jest.fn(),
      SettingsScreen: jest.fn(),
      UnlockScreen: jest.fn(),
      PreviewScreen: jest.fn(),
      ShareScreen: jest.fn(),
      KeyRecoveryScreen: jest.fn(),
      DocumentRecoveryScreen: jest.fn(),
      ShareDetailsScreen: jest.fn(),
    };

    jest.doMock('../../../src/screens/AuthScreen', () => ({ AuthScreen: mocks.AuthScreen }));
    jest.doMock('../../../src/screens/CompleteAuthScreen', () => ({ CompleteAuthScreen: mocks.CompleteAuthScreen }));
    jest.doMock('../../../src/screens/IntroHeroScreen', () => ({ IntroHeroScreen: mocks.IntroHeroScreen }));
    jest.doMock('../../../src/screens/MainScreen', () => ({ MainScreen: mocks.MainScreen }));
    jest.doMock('../../../src/screens/UploadConfirmScreen', () => ({ UploadConfirmScreen: mocks.UploadConfirmScreen }));
    jest.doMock('../../../src/screens/SettingsScreen', () => ({ SettingsScreen: mocks.SettingsScreen }));
    jest.doMock('../../../src/screens/UnlockScreen', () => ({ UnlockScreen: mocks.UnlockScreen }));
    jest.doMock('../../../src/screens/PreviewScreen', () => ({ PreviewScreen: mocks.PreviewScreen }));
    jest.doMock('../../../src/screens/ShareScreen', () => ({ ShareScreen: mocks.ShareScreen }));
    jest.doMock('../../../src/screens/KeyRecoveryScreen', () => ({ KeyRecoveryScreen: mocks.KeyRecoveryScreen }));
    jest.doMock('../../../src/screens/DocumentRecoveryScreen', () => ({ DocumentRecoveryScreen: mocks.DocumentRecoveryScreen }));
    jest.doMock('../../../src/screens/ShareDetailsScreen', () => ({ ShareDetailsScreen: mocks.ShareDetailsScreen }));

    const index = require('../../../src/screens');

    expect(index.AuthScreen).toBe(mocks.AuthScreen);
    expect(index.CompleteAuthScreen).toBe(mocks.CompleteAuthScreen);
    expect(index.IntroHeroScreen).toBe(mocks.IntroHeroScreen);
    expect(index.MainScreen).toBe(mocks.MainScreen);
    expect(index.UploadConfirmScreen).toBe(mocks.UploadConfirmScreen);
    expect(index.SettingsScreen).toBe(mocks.SettingsScreen);
    expect(index.UnlockScreen).toBe(mocks.UnlockScreen);
    expect(index.PreviewScreen).toBe(mocks.PreviewScreen);
    expect(index.ShareScreen).toBe(mocks.ShareScreen);
    expect(index.KeyRecoveryScreen).toBe(mocks.KeyRecoveryScreen);
    expect(index.DocumentRecoveryScreen).toBe(mocks.DocumentRecoveryScreen);
    expect(index.ShareDetailsScreen).toBe(mocks.ShareDetailsScreen);
  });

  test('exports documentVault service entrypoints', () => {
    const formatters = { toPseudoHash: jest.fn(), toSizeLabel: jest.fn() };
    const upload = {
      MAX_FILES_PER_DOCUMENT: 99,
      documentSaveLocal: jest.fn(),
      pickDocumentForUpload: jest.fn(),
      scanDocumentForUpload: jest.fn(),
      uploadDocumentToFirebase: jest.fn(),
    };
    const sharing = {
      canCurrentUserExportDocument: jest.fn(),
      clearDocumentKeychainEntries: jest.fn(),
      createDocumentShareGrant: jest.fn(),
      deleteUserShareProfile: jest.fn(),
      enforceExpiredShareRevocations: jest.fn(),
      ensureCurrentUserSharePublicKey: jest.fn(),
      revokeDocumentShareGrant: jest.fn(),
    };
    const storage = {
      decryptDocumentPayload: jest.fn(),
      deleteDocumentFromFirebase: jest.fn(),
      exportDocumentToDevice: jest.fn(),
      getFirebaseReference: jest.fn(),
      getLocalReference: jest.fn(),
      hasLocalEncryptedCopy: jest.fn(),
      removeFirebaseReferences: jest.fn(),
      removeLocalDocumentCopy: jest.fn(),
      saveDocumentOffline: jest.fn(),
      saveDocumentToFirebase: jest.fn(),
      updateDocumentMetadata: jest.fn(),
      updateDocumentRecoveryPreference: jest.fn(),
    };
    const query = {
      getDocumentMetadataFromVault: jest.fn(),
      listVaultDocumentsFromFirebase: jest.fn(),
      listVaultDocumentsSharedWithUser: jest.fn(),
    };

    jest.doMock('../../../src/services/documentVault/formatters', () => formatters);
    jest.doMock('../../../src/services/documentVault/upload', () => upload);
    jest.doMock('../../../src/services/documentVault/sharing', () => sharing);
    jest.doMock('../../../src/services/documentVault/storage', () => storage);
    jest.doMock('../../../src/services/documentVault/query', () => query);

    const index = require('../../../src/services/documentVault');

    expect(index.MAX_FILES_PER_DOCUMENT).toBe(99);
    expect(index.toPseudoHash).toBe(formatters.toPseudoHash);
    expect(index.documentSaveLocal).toBe(upload.documentSaveLocal);
    expect(index.ensureCurrentUserSharePublicKey).toBe(sharing.ensureCurrentUserSharePublicKey);
    expect(index.saveDocumentToFirebase).toBe(storage.saveDocumentToFirebase);
    expect(index.listVaultDocumentsFromFirebase).toBe(query.listVaultDocumentsFromFirebase);
  });

  test('exports censor service entrypoints', () => {
    const detectors = { detectSensitiveSpans: jest.fn() };
    const censorImage = { censorImage: jest.fn() };
    const ocr = { recognizeText: jest.fn() };

    jest.doMock('../../../src/services/censor/detectors', () => detectors);
    jest.doMock('../../../src/services/censor/censorImage', () => censorImage);
    jest.doMock('../../../src/services/censor/ocr', () => ocr);

    const index = require('../../../src/services/censor');

    expect(index.detectSensitiveSpans).toBe(detectors.detectSensitiveSpans);
    expect(index.censorImage).toBe(censorImage.censorImage);
    expect(index.recognizeText).toBe(ocr.recognizeText);
  });
});
