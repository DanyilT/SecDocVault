import React from 'react';
import TestRenderer from 'react-test-renderer';
const { act } = TestRenderer;

import { VaultRouter } from '../../../src/app/components/VaultRouter';

const mockMainScreen = jest.fn(_props => null);
const mockSettingsScreen = jest.fn(_props => null);
const mockUploadConfirmScreen = jest.fn(_props => null);
const mockShareScreen = jest.fn(_props => null);

jest.mock('../../../src/screens', () => ({
  MainScreen: (props: any) => mockMainScreen(props),
  SettingsScreen: (props: any) => mockSettingsScreen(props),
  UploadConfirmScreen: (props: any) => mockUploadConfirmScreen(props),
  ShareScreen: (props: any) => mockShareScreen(props),
  BackupScreen: () => null,
  DocumentRecoveryScreen: () => null,
  KeyBackupScreen: () => null,
  KeyRecoveryScreen: () => null,
  PreviewScreen: () => null,
  ShareDetailsScreen: () => null,
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
    recoveryPassphraseForSettings: null,
    backedUpDocs: [],
    notBackedUpDocs: [],
    onSetSaveOfflineByDefault: jest.fn(),
    onSetRecoverableByDefault: jest.fn(),
    onSetKeyBackupEnabled: jest.fn(),
    onCopyRecoveryPassphrase: jest.fn(async () => undefined),
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
});
