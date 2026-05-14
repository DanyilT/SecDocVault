import React from 'react';
import TestRenderer from 'react-test-renderer';
const { act } = TestRenderer;

import { VaultRouter } from '../../../src/app/components/VaultRouter';

const mockMainScreen = jest.fn(_props => null);
const mockSettingsScreen = jest.fn(_props => null);
const mockUploadConfirmScreen = jest.fn(_props => null);
const mockShareScreen = jest.fn(_props => null);
const mockPreviewScreen = jest.fn(_props => null);
const mockShareDetailsScreen = jest.fn(_props => null);
const mockKeyRecoveryScreen = jest.fn(_props => null);
const mockDocumentRecoveryScreen = jest.fn(_props => null);

jest.mock('../../../src/screens', () => ({
  MainScreen: (props: any) => mockMainScreen(props),
  SettingsScreen: (props: any) => mockSettingsScreen(props),
  UploadConfirmScreen: (props: any) => mockUploadConfirmScreen(props),
  ShareScreen: (props: any) => mockShareScreen(props),
  PreviewScreen: (props: any) => mockPreviewScreen(props),
  ShareDetailsScreen: (props: any) => mockShareDetailsScreen(props),
  KeyRecoveryScreen: (props: any) => mockKeyRecoveryScreen(props),
  DocumentRecoveryScreen: (props: any) => mockDocumentRecoveryScreen(props),
  BackupScreen: () => null,
  KeyBackupScreen: () => null,
}));

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    screen: 'main',
    userUid: 'u1',
    userEmail: 'u1@test.com',
    isGuest: false,
    isUploading: false,
    uploadStatus: '',
    documents: [],
    incomingShareDecisionsForCurrentUser: {},
    openPreview: jest.fn(),
    openShare: jest.fn(),
    onScanAndUpload: jest.fn(),
    onPickAndUpload: jest.fn(),
    onReloadDocuments: jest.fn(async () => undefined),
    onSaveOffline: jest.fn(async () => undefined),
    onSaveToFirebase: jest.fn(async () => undefined),
    onDeleteLocal: jest.fn(async () => undefined),
    onDeleteFromFirebase: jest.fn(async () => undefined),
    onExportFromMain: jest.fn(async () => undefined),
    onToggleRecovery: jest.fn(async () => undefined),
    onAcceptIncomingShare: jest.fn(),
    onDeclineIncomingShare: jest.fn(),
    authError: null,
    preferredProtection: 'passkey',
    pinBiometricEnabled: false,
    hasSavedPasskey: false,
    isSubmitting: false,
    accountStatus: '',
    pendingNewEmail: '',
    saveOfflineByDefault: false,
    recoverableByDefault: false,
    keyBackupEnabled: false,
    backedUpDocs: [],
    notBackedUpDocs: [],
    onSetSaveOfflineByDefault: jest.fn(),
    onSetRecoverableByDefault: jest.fn(),
    onSetKeyBackupEnabled: jest.fn(),
    onResetBackupPassphrase: jest.fn(async () => undefined),
    onOpenRecoverKeys: jest.fn(),
    onOpenDocumentRecovery: jest.fn(),
    onUpdateUnlockMethod: jest.fn(async () => undefined),
    onChangeGuestPassword: jest.fn(async () => true),
    onResetPassword: jest.fn(async () => undefined),
    onSetPendingNewEmail: jest.fn(),
    onRequestEmailChange: jest.fn(async () => undefined),
    onDeleteAccountAndData: jest.fn(),
    onUpgradeToCloud: jest.fn(),
    selectedDoc: null,
    previewFileOrder: 0,
    previewImageUri: null,
    previewStatus: '',
    isPreviewDecrypting: false,
    isCurrentFileDecrypted: false,
    onDecryptPreview: jest.fn(async () => undefined),
    onExportPreview: jest.fn(async () => undefined),
    onSelectPreviewFile: jest.fn(),
    pendingUploadDraft: null,
    pendingUploadPreviewIndex: 0,
    pendingUploadName: 'Document',
    pendingUploadDescription: '',
    pendingUploadRecoverable: false,
    pendingUploadToCloud: false,
    pendingUploadAlsoSaveLocal: true,
    uploadCanUseCloud: true,
    setPendingUploadPreviewIndex: jest.fn(),
    setPendingUploadName: jest.fn(),
    setPendingUploadDescription: jest.fn(),
    setPendingUploadRecoverable: jest.fn(),
    setPendingUploadToCloud: jest.fn(),
    setPendingUploadAlsoSaveLocal: jest.fn(),
    onRemoveUploadFile: jest.fn(),
    onReorderUploadFiles: jest.fn(),
    onConfirmUpload: jest.fn(async () => undefined),
    onRequestEnableKeyBackup: jest.fn(),
    shareTarget: '',
    allowDownload: true,
    shareStatus: '',
    isShareSubmitting: false,
    shareExpiryDays: '30',
    setShareTarget: jest.fn(),
    setAllowDownload: jest.fn(),
    setShareExpiryDays: jest.fn(),
    onCreateShare: jest.fn(async () => undefined),
    onRevokeShare: jest.fn(async () => undefined),
    onOpenShareOptions: jest.fn(),
    onRevokeShareForRecipient: jest.fn(),
    backupCloud: true,
    backupLocal: false,
    backupStatus: '',
    setBackupCloud: jest.fn(),
    setBackupLocal: jest.fn(),
    runBackup: jest.fn(),
    onOpenKeyBackup: jest.fn(),
    keyBackupStatus: '',
    recoverableDocsCount: 0,
    totalDocsCount: 0,
    displayPassphrase: null,
    onBackupKeys: jest.fn(async () => undefined),
    onClearPassphrase: jest.fn(),
    onCopyPassphrase: jest.fn(async () => undefined),
    onDownloadPassphrase: jest.fn(async () => undefined),
    onDownloadBackupFile: jest.fn(async () => undefined),
    onRestoreKeys: jest.fn(async () => undefined),
    onToggleDocBackupFromSettings: jest.fn(async () => undefined),
    ...overrides,
  } as any;
}

describe('VaultRouter', () => {
  const renderRouter = (props: any) => {
    act(() => {
      TestRenderer.create(<VaultRouter {...props} />);
    });
  };

  beforeEach(() => {
    mockMainScreen.mockClear();
    mockSettingsScreen.mockClear();
    mockUploadConfirmScreen.mockClear();
    mockShareScreen.mockClear();
    mockPreviewScreen.mockClear();
    mockShareDetailsScreen.mockClear();
    mockKeyRecoveryScreen.mockClear();
    mockDocumentRecoveryScreen.mockClear();
  });

  it('does not render upload screen when upload draft is missing', () => {
    renderRouter(baseProps({screen: 'upload', pendingUploadDraft: null}));

    expect(mockUploadConfirmScreen).not.toHaveBeenCalled();
  });

  it('renders upload screen when upload draft exists', () => {
    const draft = {
      name: 'Draft',
      description: '',
      files: [{name: 'a.jpg', uri: 'file:///a.jpg', type: 'image/jpeg', size: 100}],
    };

    renderRouter(baseProps({screen: 'upload', pendingUploadDraft: draft}));

    expect(mockUploadConfirmScreen).toHaveBeenCalledTimes(1);
    expect(mockUploadConfirmScreen.mock.calls[0][0].files).toEqual(draft.files);
  });

  it('renders share screen with canManageShares=true for owner with firebase copy', () => {
    const selectedDoc = {
      id: 'doc-1',
      name: 'Doc',
      hash: 'h',
      size: '1KB',
      uploadedAt: '2026-01-01T00:00:00.000Z',
      owner: 'u1',
      references: [{source: 'firebase', name: 'a', size: 1, type: 'image/jpeg'}],
    };

    renderRouter(
      baseProps({
        screen: 'share',
        selectedDoc,
        userUid: 'u1',
      }),
    );

    expect(mockShareScreen).toHaveBeenCalledTimes(1);
    expect(mockShareScreen.mock.calls[0][0].canManageShares).toBe(true);
  });

  it('passes keyBackupEnabled to MainScreen', () => {
    renderRouter(baseProps({ screen: 'main', keyBackupEnabled: true }));
    expect(mockMainScreen).toHaveBeenCalledWith(expect.objectContaining({ keyBackupEnabled: true }));

    mockMainScreen.mockClear();
    renderRouter(baseProps({ screen: 'main', keyBackupEnabled: false }));
    expect(mockMainScreen).toHaveBeenCalledWith(expect.objectContaining({ keyBackupEnabled: false }));
  });

  it('renders settings screen with guest-session defaults when email is missing', () => {
    renderRouter(baseProps({ screen: 'settings', isGuest: true, userEmail: undefined }));

    expect(mockSettingsScreen).toHaveBeenCalledWith(
      expect.objectContaining({
        accountLabel: 'Guest session',
        sessionMode: 'guest',
      }),
    );
  });

  it('renders preview screen with share/save capability flags', () => {
    const selectedDoc = {
      id: 'doc-2',
      name: 'Doc',
      hash: 'h',
      size: '1KB',
      uploadedAt: '2026-01-01T00:00:00.000Z',
      owner: 'u1',
      references: [
        {source: 'local', name: 'a', size: 1, type: 'image/jpeg'},
        {source: 'firebase', name: 'a', size: 1, type: 'image/jpeg'},
      ],
    };

    renderRouter(baseProps({ screen: 'preview', selectedDoc }));

    expect(mockPreviewScreen).toHaveBeenCalledWith(
      expect.objectContaining({
        canShareDocument: true,
        canSaveOfflineDocument: true,
        hasLocalCopy: true,
        hasFirebaseCopy: true,
      }),
    );
  });

  it('renders share screen with recipient match detection', () => {
    const selectedDoc = {
      id: 'doc-3',
      name: 'Doc',
      hash: 'h',
      size: '1KB',
      uploadedAt: '2026-01-01T00:00:00.000Z',
      owner: 'u1',
      references: [{source: 'firebase', name: 'a', size: 1, type: 'image/jpeg'}],
      sharedWith: ['recipient@example.com'],
    };

    renderRouter(
      baseProps({
        screen: 'share',
        selectedDoc,
        shareTarget: 'RECIPIENT@EXAMPLE.COM',
      }),
    );

    expect(mockShareScreen).toHaveBeenCalledWith(
      expect.objectContaining({
        canManageShares: true,
        isSharedWithTarget: true,
      }),
    );
  });

   it('renders share details, key recovery, and document recovery screens', () => {
     const selectedDoc = {
       id: 'doc-4',
       name: 'Doc',
       hash: 'h',
       size: '1KB',
       uploadedAt: '2026-01-01T00:00:00.000Z',
     };

     renderRouter(
       baseProps({
         screen: 'sharedetails',
         selectedDoc,
       }),
     );
     expect(mockShareDetailsScreen).toHaveBeenCalledWith(expect.objectContaining({ selectedDoc }));

     renderRouter(baseProps({ screen: 'recoverkeys' }));
     expect(mockKeyRecoveryScreen).toHaveBeenCalledWith(expect.objectContaining({ isGuest: false }));

     renderRouter(baseProps({ screen: 'recoverydocs' }));
     expect(mockDocumentRecoveryScreen).toHaveBeenCalledWith(expect.objectContaining({ keyBackupEnabled: false }));
   });

   it('calls onSaveOffline when MainScreen triggers save offline', () => {
     const onSaveOffline = jest.fn(async () => undefined);
     const mockDoc = { id: 'doc-1', name: 'Test', owner: 'u1' };

     renderRouter(baseProps({
       screen: 'main',
       onSaveOffline,
     }));

     expect(mockMainScreen).toHaveBeenCalled();
     const mainProps = mockMainScreen.mock.calls[0][0];

     act(() => {
       mainProps.onSaveOffline(mockDoc);
     });

     expect(onSaveOffline).toHaveBeenCalledWith(mockDoc);
   });

   it('calls onSaveToFirebase when MainScreen triggers save to firebase', () => {
     const onSaveToFirebase = jest.fn(async () => undefined);
     const mockDoc = { id: 'doc-1', name: 'Test', owner: 'u1' };

     renderRouter(baseProps({
       screen: 'main',
       onSaveToFirebase,
     }));

     const mainProps = mockMainScreen.mock.calls[0][0];

     act(() => {
       mainProps.onSaveToFirebase(mockDoc);
     });

     expect(onSaveToFirebase).toHaveBeenCalledWith(mockDoc);
   });

   it('calls onDeleteLocal when MainScreen triggers delete local', () => {
     const onDeleteLocal = jest.fn(async () => undefined);
     const mockDoc = { id: 'doc-1', name: 'Test', owner: 'u1' };

     renderRouter(baseProps({
       screen: 'main',
       onDeleteLocal,
     }));

     const mainProps = mockMainScreen.mock.calls[0][0];

     act(() => {
       mainProps.onDeleteLocal(mockDoc);
     });

     expect(onDeleteLocal).toHaveBeenCalledWith(mockDoc);
   });

   it('calls onDeleteFromFirebase when MainScreen triggers delete from firebase', () => {
     const onDeleteFromFirebase = jest.fn(async () => undefined);
     const mockDoc = { id: 'doc-1', name: 'Test', owner: 'u1' };

     renderRouter(baseProps({
       screen: 'main',
       onDeleteFromFirebase,
     }));

     const mainProps = mockMainScreen.mock.calls[0][0];

     act(() => {
       mainProps.onDeleteFromFirebase(mockDoc);
     });

     expect(onDeleteFromFirebase).toHaveBeenCalledWith(mockDoc);
   });

   it('renders preview screen without shareability when not owner', () => {
     const selectedDoc = {
       id: 'doc-5',
       name: 'Doc',
       hash: 'h',
       size: '1KB',
       uploadedAt: '2026-01-01T00:00:00.000Z',
       owner: 'other-user',
       references: [{source: 'firebase', name: 'a', size: 1, type: 'image/jpeg'}],
     };

     renderRouter(baseProps({ screen: 'preview', selectedDoc, userUid: 'u1' }));

     expect(mockPreviewScreen).toHaveBeenCalledWith(
       expect.objectContaining({
         canShareDocument: false,
       }),
     );
   });

   it('renders preview screen without local copy when not available', () => {
     const selectedDoc = {
       id: 'doc-6',
       name: 'Doc',
       hash: 'h',
       size: '1KB',
       uploadedAt: '2026-01-01T00:00:00.000Z',
       references: [{source: 'firebase', name: 'a', size: 1, type: 'image/jpeg'}],
     };

     renderRouter(baseProps({ screen: 'preview', selectedDoc }));

     expect(mockPreviewScreen).toHaveBeenCalledWith(
       expect.objectContaining({
         hasLocalCopy: false,
       }),
     );
   });

   it('renders share screen with canManageShares=false when not owner', () => {
     const selectedDoc = {
       id: 'doc-7',
       name: 'Doc',
       hash: 'h',
       size: '1KB',
       uploadedAt: '2026-01-01T00:00:00.000Z',
       owner: 'other-user',
       references: [{source: 'firebase', name: 'a', size: 1, type: 'image/jpeg'}],
     };

     renderRouter(
       baseProps({
         screen: 'share',
         selectedDoc,
         userUid: 'u1',
       }),
     );

     expect(mockShareScreen).toHaveBeenCalledWith(
       expect.objectContaining({
         canManageShares: false,
       }),
     );
   });

   it('renders settings screen for cloud user', () => {
     renderRouter(baseProps({ screen: 'settings', isGuest: false, userEmail: 'user@test.com' }));

     expect(mockSettingsScreen).toHaveBeenCalledWith(
       expect.objectContaining({
         accountLabel: 'user@test.com',
         sessionMode: 'cloud',
       }),
     );
   });

   it('does not render preview when selectedDoc is null', () => {
     renderRouter(baseProps({ screen: 'preview', selectedDoc: null }));

     expect(mockPreviewScreen).not.toHaveBeenCalled();
   });

   it('does not render share when selectedDoc is null', () => {
     renderRouter(baseProps({ screen: 'share', selectedDoc: null }));

     expect(mockShareScreen).not.toHaveBeenCalled();
   });

   it('does not render sharedetails when selectedDoc is null', () => {
     renderRouter(baseProps({ screen: 'sharedetails', selectedDoc: null }));

     expect(mockShareDetailsScreen).not.toHaveBeenCalled();
   });
});
