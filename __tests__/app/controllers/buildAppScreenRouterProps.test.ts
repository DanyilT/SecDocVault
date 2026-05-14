import { buildAppScreenRouterProps } from '../../../src/app/controllers/buildAppScreenRouterProps';

function baseInput(overrides: Record<string, unknown> = {}) {
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
    preferredProtection: 'passkey',
    pinBiometricEnabled: false,
    hasSavedPasskey: false,
    canUseUnlockButton: true,
    isSubmitting: false,
    isTransitioningToAuth: false,
    authError: null,
    onUnlockWithPin: jest.fn(async () => undefined),
    onGoToAuthFromUnlock: jest.fn(),
    onGoToAuthFromLocked: jest.fn(),
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
    backupCloud: true,
    backupLocal: false,
    backupStatus: '',
    setBackupCloud: jest.fn(),
    setBackupLocal: jest.fn(),
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

    handleBiometricUnlock: jest.fn(async () => undefined),
    handlePasskeyUnlock: jest.fn(async () => undefined),
    handleGoToAuth: jest.fn(),
    preparePreviewForDocument: jest.fn(),
    handleExportDocument: jest.fn(async () => undefined),
    commitUploadDocument: jest.fn(async () => undefined),
    setKeyBackupStatus: jest.fn(),
    setScreen: jest.fn(),
    handleRevokeShareForRecipient: jest.fn(async () => undefined),
    runBackup: jest.fn(),
    screenParams: {},
    ...overrides,
  } as any;
}

describe('buildAppScreenRouterProps', () => {
  it('keeps required passthrough props used by vault routing', () => {
    const input = baseInput({
      pendingUploadDraft: {name: 'd', description: '', files: [{name: 'a'}]},
    });

    const props = buildAppScreenRouterProps(input);

    expect(props.pendingUploadDraft).toBe(input.pendingUploadDraft);
    expect(props.setPendingUploadRecoverable).toBe(input.setPendingUploadRecoverable);
    expect(props.setShareTarget).toBe(input.setShareTarget);
  });

  it('chooses biometric unlock callback when preferred pin with biometric enabled', async () => {
    const input = baseInput({
      preferredProtection: 'pin',
      pinBiometricEnabled: true,
    });

    const props = buildAppScreenRouterProps(input);
    await props.onUnlock();

    expect(input.handleBiometricUnlock).toHaveBeenCalledTimes(1);
    expect(input.handlePasskeyUnlock).not.toHaveBeenCalled();
  });

  it('chooses passkey unlock when pin biometric is disabled', async () => {
    const input = baseInput({
      preferredProtection: 'pin',
      pinBiometricEnabled: false,
    });

    const props = buildAppScreenRouterProps(input);
    await props.onUnlock();

    expect(input.handlePasskeyUnlock).toHaveBeenCalledTimes(1);
    expect(input.handleBiometricUnlock).not.toHaveBeenCalled();
  });

  it('routes auth navigation wrappers and recover-key helpers', async () => {
    const input = baseInput({
      screenParams: {recoverkeys: {onSkipForNow: jest.fn()}},
    });

    const props = buildAppScreenRouterProps(input);
    props.onLogin();
    props.onGuest();
    props.onOpenRecoverKeys();
    props.onOpenDocumentRecovery();

    expect(input.handleGoToAuth).toHaveBeenCalledWith('login');
    expect(input.handleGoToAuth).toHaveBeenCalledWith('guest');
    expect(input.setKeyBackupStatus).toHaveBeenCalledWith('');
    expect(input.setScreen).toHaveBeenCalledWith('recoverkeys');
    expect(input.setScreen).toHaveBeenCalledWith('recoverydocs');
    expect(props.onSkipForNow).toBe(input.screenParams.recoverkeys?.onSkipForNow);
  });

  it('exports after preparing the selected document and commits pending uploads', async () => {
    const input = baseInput({
      pendingUploadDraft: {name: 'Draft', files: [{name: 'a'}]},
    });

    const props = buildAppScreenRouterProps(input);
    const doc = {id: 'doc-1'};

    await props.onExportFromMain(doc as never);
    await props.onConfirmUpload();

    expect(input.preparePreviewForDocument).toHaveBeenCalledWith(doc);
    expect(input.handleExportDocument).toHaveBeenCalledTimes(1);
    expect(input.commitUploadDocument).toHaveBeenCalledWith(input.pendingUploadDraft);
  });

  it('does not commit upload when a draft is absent and preserves skip-for-now', async () => {
    const skipForNow = jest.fn();
    const input = baseInput({
      pendingUploadDraft: null,
      screenParams: {recoverkeys: {onSkipForNow: skipForNow}},
    });

    const props = buildAppScreenRouterProps(input);
    await props.onConfirmUpload();

    expect(input.commitUploadDocument).not.toHaveBeenCalled();
    expect(props.onSkipForNow).toBe(skipForNow);
  });

  it('does not commit upload when no pending upload draft exists', async () => {
    const input = baseInput({pendingUploadDraft: null});

    const props = buildAppScreenRouterProps(input);
    await props.onConfirmUpload();

    expect(input.commitUploadDocument).not.toHaveBeenCalled();
  });

  it('revoke-share wrapper updates target before revoke call', () => {
    const input = baseInput();
    const props = buildAppScreenRouterProps(input);

    props.onRevokeShareForRecipient('alice@example.com');

    expect(input.setShareTarget).toHaveBeenCalledWith('alice@example.com');
    expect(input.handleRevokeShareForRecipient).toHaveBeenCalledWith('alice@example.com');
  });
});
