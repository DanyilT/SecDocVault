import React from 'react';
import TestRenderer from 'react-test-renderer';
const { act } = TestRenderer;

import { AppScreenRouter } from '../../../src/app/components/AppScreenRouter';

const mockAuthGateRouter = jest.fn((_props) => null);
const mockVaultRouter = jest.fn((_props) => null);

jest.mock('../../../src/app/components/AuthGateRouter', () => ({
  AuthGateRouter: (props: any) => mockAuthGateRouter(props),
}));

jest.mock('../../../src/app/components/VaultRouter', () => ({
  VaultRouter: (props: any) => mockVaultRouter(props),
}));

function baseProps() {
  return {
    screen: 'main',
    authGateStage: 'hero',
    isInitializing: false,
    isAuthenticated: true,
    isVaultLocked: false,
    shouldShowCompleteAuthSetup: false,
    firebaseProjectId: 'demo',
    transitionOpacity: {setValue: jest.fn()},
    transitionTranslateY: {setValue: jest.fn()},
    preferredProtection: 'none',
    pinBiometricEnabled: false,
    canUseUnlockButton: false,
    isSubmitting: false,
    isTransitioningToAuth: false,
    authError: null,
    onUnlock: jest.fn(async () => undefined),
    onUnlockWithPin: jest.fn(async () => undefined),
    onGoToAuthFromUnlock: jest.fn(),
    onGoToAuthFromLocked: jest.fn(),
    onLogin: jest.fn(),
    onGuest: jest.fn(),
    authMode: 'login',
    email: '',
    password: '',
    confirmPassword: '',
    canSubmitAuth: false,
    authNotice: null,
    emailVerifiedForRegistration: false,
    verificationCooldown: 0,
    verificationLinkInput: '',
    accessMode: 'login',
    setAccessMode: jest.fn(),
    setAuthMode: jest.fn(),
    setEmail: jest.fn(),
    setPassword: jest.fn(),
    setConfirmPassword: jest.fn(),
    setVerificationLinkInput: jest.fn(),
    onResendVerificationEmail: jest.fn(async () => undefined),
    onVerifyEmailLinkManually: jest.fn(async () => undefined),
    onResetPassword: jest.fn(async () => undefined),
    onAuth: jest.fn(async () => undefined),
    onBackToHero: jest.fn(),
    onCompleteAuthSetup: jest.fn(async () => undefined),
    userUid: 'u1',
    userEmail: 'a@b.com',
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
  } as any;
}

describe('AppScreenRouter', () => {
  const renderRouter = (props: any) => {
    act(() => {
      TestRenderer.create(<AppScreenRouter {...props} />);
    });
  };

  beforeEach(() => {
    mockAuthGateRouter.mockClear();
    mockVaultRouter.mockClear();
  });

  it('renders auth gate when still initializing', () => {
    const props = baseProps();
    props.isInitializing = true;

    renderRouter(props);

    expect(mockAuthGateRouter).toHaveBeenCalled();
    expect(mockVaultRouter).not.toHaveBeenCalled();
  });

  it('renders auth gate when authenticated but vault is locked', () => {
    const props = baseProps();
    props.isVaultLocked = true;

    renderRouter(props);

    expect(mockAuthGateRouter).toHaveBeenCalledTimes(1);
    expect(mockVaultRouter).not.toHaveBeenCalled();
  });

  it('renders vault router when authenticated and unlocked', () => {
    const props = baseProps();

    renderRouter(props);

    expect(mockVaultRouter).toHaveBeenCalledTimes(1);
    expect(mockAuthGateRouter).not.toHaveBeenCalled();
  });
});
