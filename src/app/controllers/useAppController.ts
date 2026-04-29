/**
 * app/controllers/useAppController.ts
 *
 * Main application controller hook. Encapsulates app-level state, side effects
 * and interactions between authentication, document vault, upload flows and
 * UI routing. Designed to return a stable set of props consumable by
 * `buildAppScreenRouterProps` and `AppScreenRouter`.
 */

import React, { useEffect, useRef } from 'react';
import { Animated } from 'react-native';

import { AppHeaderController } from '../components/AppHeaderController';
import { AppOverlays } from '../components/AppOverlays';
import { AppScreenRouter } from '../components/AppScreenRouter';
import { buildAppScreenRouterProps } from './buildAppScreenRouterProps';
import { useAppControllerActions } from './useAppControllerActions';
import { useAuthFeatureFlows } from './useAuthFeatureFlows';
import {
  useBackedUpDocs,
  useCurrentShareDecisionOwnerKey,
  useCurrentUserIdentifiers,
  useNotBackedUpDocs,
  useRecoverableDocsCount,
} from './useAppControllerSelectors';
import { useIncomingShareDecisions } from './useIncomingShareDecisions';
import { useDocumentLifecycleEffects } from './useDocumentLifecycleEffects';
import { useVaultLockLifecycle } from './useVaultLockLifecycle';
import { useVaultShellTransitionEffect } from './useVaultShellTransitionEffect';
import { useAppControllerState } from './useAppControllerState';
import { APP_SCREEN_TITLES } from '../navigation/constants';
import {
  useAppConfig,
  useAppRouting,
  useDocumentVault,
  useKeyBackupFlow,
} from '../hooks';
import { useVaultFeatureFlows } from './useVaultFeatureFlows';
import { useAuth } from '../../context/AuthContext';
import { FIREBASE_PROJECT_ID } from '../../firebase/project';
import {
  ensureCurrentUserSharePublicKey,
  enforceExpiredShareRevocations,
  listVaultDocumentsFromFirebase,
  listVaultDocumentsSharedWithUser,
  updateDocumentRecoveryPreference,
} from '../../services/documentVault';
import {
  backupKeysToFirebase,
  deleteKeyBackupFromFirebase,
  downloadKeyBackupFile,
  downloadPassphraseFile,
  ensureRecoveryPassphrase,
  restoreDocumentKeysFromPassphrase,
  restoreKeysFromFirebase,
  setAutoKeySyncEnabled,
} from '../../services/keyBackup';
import {
  getLocalDocuments,
  saveVaultPreferences,
} from '../../storage/localVault';

export type UseAppControllerApi = {
  showVaultShell: boolean;
  transitionOpacity: Animated.Value;
  transitionTranslateY: Animated.Value;
  appScreenRouterProps: React.ComponentProps<typeof AppScreenRouter>;
  headerControllerProps: React.ComponentProps<typeof AppHeaderController>;
  overlaysProps: React.ComponentProps<typeof AppOverlays>;
};

/**
 * useAppController
 *
 * Main application controller hook that composes app-wide state, side effects
 * and feature flows into three structured prop objects consumed by the UI:
 * - `appScreenRouterProps` for routing and screen handlers
 * - `headerControllerProps` for the header controller
 * - `overlaysProps` for top-level overlays and modals
 *
 * @returns an object with `showVaultShell`, animation values and the three
 * standardized prop objects consumed by the app shell
 */
export function useAppController(): UseAppControllerApi {
  const UPLOAD_DISCARD_WARNING_PREF_KEY = 'secdocvault.upload.skipDiscardWarning';
  const COMPLETE_AUTH_PENDING_KEY = 'secdocvault.auth.complete.pending';

  const {
    screen,
    authGateStage,
    shareOriginScreen,
    setScreen,
    setAuthReturnStage,
    setShareOriginScreen,
    goToAuth: routeToAuth,
    returnFromAuth: returnFromAuthGate,
    resetToHero,
  } = useAppRouting();

  const {
    user,
    isAuthenticated,
    isGuest,
    isInitializing,
    isSubmitting,
    hasSavedPasskey,
    pinBiometricEnabled,
    preferredProtection,
    authError,
    signIn,
    signUp,
    resendVerificationEmail,
    completeEmailLinkRegistration,
    sendPasswordResetEmail,
    requestEmailChange,
    deleteAccountAndData,
    hasGuestAccount,
    registerGuestAccount,
    loginGuestAccount,
    changeGuestPassword,
    unlockWithSavedPasskey,
    unlockWithPin,
    unlockWithBiometric,
    updateUnlockMethod,
    signOut,
    clearError,
  } = useAuth();

  const {
    authMode,
    setAuthMode,
    accessMode,
    setAccessMode,
    showCompleteAuthSetup,
    setShowCompleteAuthSetup,
    isCompletingAuthFlow,
    setIsCompletingAuthFlow,
    authCredentialSnapshot,
    setAuthCredentialSnapshot,
    email,
    setEmail,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    vaultPassphrase,
    setVaultPassphrase,
    confirmVaultPassphrase,
    setConfirmVaultPassphrase,
    emailVerifiedForRegistration,
    setEmailVerifiedForRegistration,
    verificationLinkInput,
    setVerificationLinkInput,
    verificationCooldown,
    setVerificationCooldown,
    documents,
    setDocuments,
    selectedDoc,
    setSelectedDoc,
    backupCloud,
    setBackupCloud,
    backupLocal,
    setBackupLocal,
    backupStatus,
    setBackupStatus,
    isUploading,
    setIsUploading,
    uploadStatus,
    setUploadStatus,
    pendingUploadDraft,
    setPendingUploadDraft,
    pendingUploadName,
    setPendingUploadName,
    pendingUploadDescription,
    setPendingUploadDescription,
    pendingUploadRecoverable,
    setPendingUploadRecoverable,
    pendingUploadToCloud,
    setPendingUploadToCloud,
    pendingUploadAlsoSaveLocal,
    setPendingUploadAlsoSaveLocal,
    pendingUploadPreviewIndex,
    setPendingUploadPreviewIndex,
    showUploadDiscardWarning,
    setShowUploadDiscardWarning,
    dontShowUploadDiscardWarningAgain,
    setDontShowUploadDiscardWarningAgain,
    isVaultLocked,
    setIsVaultLocked,
    hasUnlockedThisLaunch,
    setHasUnlockedThisLaunch,
    isTransitioningToAuth,
    setIsTransitioningToAuth,
    accountStatus,
    setAccountStatus,
    pendingNewEmail,
    setPendingNewEmail,
    authNotice,
    setAuthNotice,
    guestAccountExists,
    setGuestAccountExists,
    showVaultPassphrasePrompt,
    setShowVaultPassphrasePrompt,
    vaultPassphrasePromptInput,
    setVaultPassphrasePromptInput,
    vaultPassphrasePromptAttemptsLeft,
    setVaultPassphrasePromptAttemptsLeft,
    isVaultPassphrasePromptSubmitting,
    setIsVaultPassphrasePromptSubmitting,
    vaultPassphrasePromptError,
    setVaultPassphrasePromptError,
    transitionOpacity,
    transitionTranslateY,
  } = useAppControllerState();

  const {
    incomingShareDecisionStore,
    setIncomingShareDecisionStore,
    saveOfflineByDefault,
    setSaveOfflineByDefault,
    recoverableByDefault,
    setRecoverableByDefault,
    autoSyncKeys,
    setAutoSyncKeys,
    keyBackupEnabled,
    setKeyBackupEnabled,
    recoveryPassphraseForSettings,
    setRecoveryPassphraseForSettings,
    skipUploadDiscardWarning,
    setSkipUploadDiscardWarning,
  } = useAppConfig({
    uploadDiscardWarningPrefKey: UPLOAD_DISCARD_WARNING_PREF_KEY,
    hasGuestAccount,
    onGuestAccountChange: setGuestAccountExists,
  });

  const currentUserIdentifiers = useCurrentUserIdentifiers(user);
  const currentShareDecisionOwnerKey = useCurrentShareDecisionOwnerKey(user);

  const {
    incomingShareDecisionsForCurrentUser,
    handleAcceptIncomingShare,
    handleDeclineIncomingShare,
  } = useIncomingShareDecisions({
    currentShareDecisionOwnerKey,
    incomingShareDecisionStore,
    setIncomingShareDecisionStore,
    setUploadStatus,
    onDeclineSuccess: () => {
      if (screen === 'preview') {
        setScreen('main');
      }
    },
  });

  const isPickingFileRef = useRef(false);

  const uploadCanUseCloud = !isGuest && backupCloud && Boolean(user?.uid);

  const openVaultPassphrasePrompt = () => {
    setVaultPassphrasePromptInput('');
    setVaultPassphrasePromptError(null);
    setVaultPassphrasePromptAttemptsLeft(3);
    setShowVaultPassphrasePrompt(true);
  };

  const handleVaultPassphraseSubmit = async (passphrase: string) => {
    setIsVaultPassphrasePromptSubmitting(true);
    setVaultPassphrasePromptError(null);
    try {
      await restoreDocumentKeysFromPassphrase(documents, passphrase);
      setShowVaultPassphrasePrompt(false);
      setVaultPassphrasePromptInput('');
    } catch (error) {
      const remaining = vaultPassphrasePromptAttemptsLeft - 1;
      if (remaining <= 0) {
        setShowVaultPassphrasePrompt(false);
        setVaultPassphrasePromptInput('');
      } else {
        setVaultPassphrasePromptAttemptsLeft(remaining);
        const message = error instanceof Error ? error.message : 'Incorrect passphrase.';
        setVaultPassphrasePromptError(message);
      }
    } finally {
      setIsVaultPassphrasePromptSubmitting(false);
    }
  };
  const shouldRequireUnlock = isAuthenticated;

  const resetAuthForm = () => {
    setAuthMode('login');
    setAccessMode('login');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setVaultPassphrase('');
    setConfirmVaultPassphrase('');
    setEmailVerifiedForRegistration(false);
    setVerificationLinkInput('');
    setVerificationCooldown(0);
    setAuthNotice(null);
    clearError();
  };

  useEffect(() => {
    if (!isAuthenticated || isGuest || !user?.uid) {
      return;
    }

    void ensureCurrentUserSharePublicKey(user.uid, user.email).catch(error => {
      const message = error instanceof Error ? error.message : 'Failed to publish sharing public key.';
      setUploadStatus(message);
    });
  }, [isAuthenticated, isGuest, setUploadStatus, user?.email, user?.uid]);

  const {
    displayPassphrase,
    setDisplayPassphrase,
    keyBackupStatus,
    setKeyBackupStatus,
    showKeyBackupSetupModal,
    requestKeyBackupSetup,
    confirmKeyBackupSetup,
    cancelKeyBackupSetup,
    handleToggleDocumentRecovery,
    handleSetKeyBackupEnabled,
    handleBackupKeys,
    handleRestoreKeys,
    handleDownloadPassphrase,
    handleDownloadBackupFile,
    handleCopyPassphrase,
  } = useKeyBackupFlow({
    isGuest,
    userUid: user?.uid,
    documents,
    saveOfflineByDefault,
    recoverableByDefault,
    keyBackupEnabled,
    recoveryPassphraseForSettings,
    setKeyBackupEnabled,
    setAutoSyncKeys,
    setRecoveryPassphraseForSettings,
    setDocuments,
    setSelectedDoc,
    setUploadStatus,
    setAccountStatus,
    saveVaultPreferences,
    setAutoKeySyncEnabled,
    ensureRecoveryPassphrase,
    deleteKeyBackupFromFirebase,
    backupKeysToFirebase,
    updateDocumentRecoveryPreference,
    restoreKeysFromFirebase,
    downloadPassphraseFile,
    downloadKeyBackupFile,
  });

  const { reloadDocuments } = useDocumentVault({
    isAuthenticated,
    isInitializing,
    isGuest,
    backupCloud,
    userUid: user?.uid,
    currentUserIdentifiers,
    setDocuments,
    setSelectedDoc,
    setHasUnlockedThisLaunch,
    setUploadStatus,
    getLocalDocuments,
    listVaultDocumentsFromFirebase,
    listVaultDocumentsSharedWithUser,
    enforceExpiredShareRevocations,
  });

  useVaultShellTransitionEffect({
    transitionOpacity,
    transitionTranslateY,
    accessMode,
    authGateStage,
    authMode,
    screen,
    isAuthenticated,
    isVaultLocked,
  });

  useDocumentLifecycleEffects({
    isInitializing,
    isAuthenticated,
    isGuest,
    userUid: user?.uid,
    documents,
    selectedDoc,
    autoSyncKeys,
    hasUnlockedThisLaunch,
    reloadDocuments,
    setSelectedDoc,
    setKeyBackupStatus,
    setIsVaultLocked,
    onPassphraseMissing: openVaultPassphrasePrompt,
  });

  useVaultLockLifecycle({
    completeAuthPendingKey: COMPLETE_AUTH_PENDING_KEY,
    isInitializing,
    transitionOpacity,
    authGateStage,
    screen,
    shareOriginScreen,
    isAuthenticated,
    isVaultLocked,
    isCompletingAuthFlow,
    isTransitioningToAuth,
    shouldRequireUnlock,
    preferredProtection,
    pendingUploadDraft,
    recoverableByDefault,
    uploadCanUseCloud,
    skipUploadDiscardWarning,
    isPickingFileRef,
    setIsVaultLocked,
    setIsTransitioningToAuth,
    setIsCompletingAuthFlow,
    setShowCompleteAuthSetup,
    setAuthCredentialSnapshot,
    setHasUnlockedThisLaunch,
    setScreen,
    setPendingUploadDraft,
    setPendingUploadName,
    setPendingUploadDescription,
    setPendingUploadRecoverable,
    setPendingUploadToCloud,
    setPendingUploadAlsoSaveLocal,
    setPendingUploadPreviewIndex,
    setDontShowUploadDiscardWarningAgain,
    setShowUploadDiscardWarning,
    returnFromAuthGate,
    routeToAuth,
    resetAuthForm,
    signOut,
    updateUnlockMethod,
  });
  const {
    canSubmitAuth,
    canUseUnlockButton,
    handleAuth,
    handleCompleteAuthSetup,
    handlePasskeyUnlock,
    handleBiometricUnlock,
    handlePinUnlock,
    goToAuthForm,
    switchAuthMode,
    handleGoToAuth,
    returnFromAuth,
    handleGoToAuthFromLocked,
    handleUpgradeGuestToCloud,
    updateEmail,
    updatePassword,
    updateConfirmPassword,
    updateVaultPassphrase,
    updateConfirmVaultPassphrase,
    handleResendVerificationEmail,
    handleManualVerificationLink,
    handleResetPassword,
  } = useAuthFeatureFlows({
    completeAuthPendingKey: COMPLETE_AUTH_PENDING_KEY,
    authMode,
    accessMode,
    email,
    password,
    confirmPassword,
    vaultPassphrase,
    confirmVaultPassphrase,
    setVaultPassphrase,
    setConfirmVaultPassphrase,
    emailVerifiedForRegistration,
    verificationLinkInput,
    verificationCooldown,
    authCredentialSnapshot,
    isTransitioningToAuth,
    setAuthMode,
    setAccessMode,
    setEmail,
    setPassword,
    setConfirmPassword,
    setEmailVerifiedForRegistration,
    setVerificationLinkInput,
    setVerificationCooldown,
    setAuthNotice,
    setShowCompleteAuthSetup,
    setIsCompletingAuthFlow,
    setAuthCredentialSnapshot,
    setIsTransitioningToAuth,
    setHasUnlockedThisLaunch,
    setIsVaultLocked,
    setScreen,
    setAuthReturnStage,
    routeToAuth,
    returnFromAuthGate,
    resetAuthForm,
    clearError,
    isGuest,
    user,
    preferredProtection,
    signIn,
    signUp,
    resendVerificationEmail,
    completeEmailLinkRegistration,
    sendPasswordResetEmail,
    registerGuestAccount,
    loginGuestAccount,
    unlockWithSavedPasskey,
    unlockWithPin,
    unlockWithBiometric,
    updateUnlockMethod,
    signOut,
    guestAccountExists,
    setGuestAccountExists,
    setAccountStatus,
  });

  const shouldShowCompleteAuthSetup = isAuthenticated && (showCompleteAuthSetup || isCompletingAuthFlow);
  const totalDocsCount = documents.length;
  const recoverableDocsCount = useRecoverableDocsCount(documents);

  const backedUpDocs = useBackedUpDocs(documents);
  const notBackedUpDocs = useNotBackedUpDocs(documents);
  const {
    previewImageUri,
    previewStatus,
    previewFileOrder,
    isPreviewDecrypting,
    isCurrentFileDecrypted,
    preparePreviewForDocument,
    openPreview,
    handleSelectPreviewFile,
    handleDecryptPreview,
    handleExportDocument,
    shareTarget,
    allowDownload,
    shareExpiryDays,
    shareStatus,
    isShareSubmitting,
    setShareTarget,
    setAllowDownload,
    setShareExpiryDays,
    openShare,
    handleCreateShare,
    handleRevokeShare,
    handleRevokeShareForRecipient,
    handleToggleDocBackupFromSettings,
    handleLeaveUploadScreen,
    confirmDiscardUploadDraft,
    commitUploadDocument,
    handleScanAndUpload,
    handlePickAndUpload,
    handleAddScanToUpload,
    handleAddPickToUpload,
    handleRemoveUploadFile,
    handleReorderUploadFiles,
    handleSaveOffline,
    handleSaveToFirebase,
    handleDeleteLocal,
    handleDeleteFromFirebase,
  } = useVaultFeatureFlows({
    uploadDiscardWarningPrefKey: UPLOAD_DISCARD_WARNING_PREF_KEY,
    isGuest,
    userUid: user?.uid,
    screen,
    shareOriginScreen,
    setShareOriginScreen,
    uploadCanUseCloud,
    recoverableByDefault,
    saveOfflineByDefault,
    isUploading,
    pendingUploadDraft,
    pendingUploadName,
    pendingUploadDescription,
    pendingUploadRecoverable,
    pendingUploadToCloud,
    pendingUploadAlsoSaveLocal,
    documents,
    selectedDoc,
    skipUploadDiscardWarning,
    dontShowUploadDiscardWarningAgain,
    setDocuments,
    setSelectedDoc,
    setScreen,
    setUploadStatus,
    setBackupStatus,
    setAccountStatus,
    setIsUploading,
    setPendingUploadDraft,
    setPendingUploadName,
    setPendingUploadDescription,
    setPendingUploadRecoverable,
    setPendingUploadToCloud,
    setPendingUploadAlsoSaveLocal,
    setPendingUploadPreviewIndex,
    setShowUploadDiscardWarning,
    setDontShowUploadDiscardWarningAgain,
    setSkipUploadDiscardWarning,
    isPickingFileRef,
    handleToggleDocumentRecovery,
    onMissingPassphrase: openVaultPassphrasePrompt,
  });

  const {
    runBackup,
    onCopyPassphrase,
    handleChangeGuestPassword,
    handleRequestEmailChange,
    handleDeleteAccountAndData,
    handleHeaderLogout,
    handleSetSaveOfflineByDefault,
    handleSetRecoverableByDefault,
    handleSetPendingUploadToCloud,
    handleSetPendingUploadAlsoSaveLocal,
    handleUpdateUnlockMethod,
  } = useAppControllerActions({
    completeAuthPendingKey: COMPLETE_AUTH_PENDING_KEY,
    isGuest,
    backupCloud,
    backupLocal,
    pendingNewEmail,
    recoverableByDefault,
    saveOfflineByDefault,
    keyBackupEnabled,
    uploadCanUseCloud,
    pendingUploadToCloud,
    pendingUploadAlsoSaveLocal,
    userEmail: user?.email ?? undefined,
    setAccountStatus,
    setPendingNewEmail,
    setBackupStatus,
    setSaveOfflineByDefault,
    setRecoverableByDefault,
    setPendingUploadToCloud,
    setPendingUploadAlsoSaveLocal,
    setIsVaultLocked,
    setHasUnlockedThisLaunch,
    setScreen,
    resetToHero,
    resetAuthForm,
    requestEmailChange,
    changeGuestPassword,
    deleteAccountAndData,
    signOut,
    saveVaultPreferences,
    updateUnlockMethod,
    handleCopyPassphrase,
  });

  const showVaultShell = isAuthenticated && !isVaultLocked && !shouldShowCompleteAuthSetup && !isInitializing;

  const appScreenRouterProps: React.ComponentProps<typeof AppScreenRouter> = buildAppScreenRouterProps({
    screen,
    authGateStage,
    isInitializing,
    isAuthenticated,
    isVaultLocked,
    shouldShowCompleteAuthSetup,
    firebaseProjectId: FIREBASE_PROJECT_ID,
    transitionOpacity,
    transitionTranslateY,
    preferredProtection,
    pinBiometricEnabled,
    hasSavedPasskey,
    canUseUnlockButton,
    isSubmitting,
    isTransitioningToAuth,
    authError,
    handleBiometricUnlock,
    handlePasskeyUnlock,
    onUnlockWithPin: handlePinUnlock,
    onGoToAuthFromUnlock: goToAuthForm,
    onGoToAuthFromLocked: handleGoToAuthFromLocked,
    handleGoToAuth,
    authMode,
    email,
    password,
    confirmPassword,
    vaultPassphrase,
    confirmVaultPassphrase,
    setVaultPassphrase: updateVaultPassphrase,
    setConfirmVaultPassphrase: updateConfirmVaultPassphrase,
    canSubmitAuth,
    authNotice,
    emailVerifiedForRegistration,
    verificationCooldown,
    verificationLinkInput,
    accessMode,
    setAccessMode,
    setAuthMode: switchAuthMode,
    setEmail: updateEmail,
    setPassword: updatePassword,
    setConfirmPassword: updateConfirmPassword,
    setVerificationLinkInput,
    onResendVerificationEmail: handleResendVerificationEmail,
    onVerifyEmailLinkManually: handleManualVerificationLink,
    onResetPassword: handleResetPassword,
    onAuth: handleAuth,
    onBackToHero: returnFromAuth,
    onCompleteAuthSetup: handleCompleteAuthSetup,
    userUid: user?.uid,
    userEmail: user?.email ?? undefined,
    isGuest,
    isUploading,
    uploadStatus,
    documents,
    incomingShareDecisionsForCurrentUser,
    openPreview,
    openShare,
    onScanAndUpload: handleScanAndUpload,
    onPickAndUpload: handlePickAndUpload,
    onAddScanToUpload: handleAddScanToUpload,
    onAddPickToUpload: handleAddPickToUpload,
    onReloadDocuments: reloadDocuments,
    onSaveOffline: handleSaveOffline,
    onSaveToFirebase: handleSaveToFirebase,
    onDeleteLocal: handleDeleteLocal,
    onDeleteFromFirebase: handleDeleteFromFirebase,
    preparePreviewForDocument,
    handleExportDocument,
    onToggleRecovery: handleToggleDocumentRecovery,
    onAcceptIncomingShare: handleAcceptIncomingShare,
    onDeclineIncomingShare: handleDeclineIncomingShare,
    accountStatus,
    pendingNewEmail,
    saveOfflineByDefault,
    recoverableByDefault,
    keyBackupEnabled,
    recoveryPassphraseForSettings,
    backedUpDocs,
    notBackedUpDocs,
    onSetSaveOfflineByDefault: handleSetSaveOfflineByDefault,
    onSetRecoverableByDefault: handleSetRecoverableByDefault,
    onSetKeyBackupEnabled: handleSetKeyBackupEnabled,
    setKeyBackupStatus,
    setScreen,
    onUpdateUnlockMethod: handleUpdateUnlockMethod,
    onChangeGuestPassword: handleChangeGuestPassword,
    onSetPendingNewEmail: setPendingNewEmail,
    onRequestEmailChange: handleRequestEmailChange,
    onDeleteAccountAndData: handleDeleteAccountAndData,
    onUpgradeToCloud: handleUpgradeGuestToCloud,
    selectedDoc,
    previewFileOrder,
    previewImageUri,
    previewStatus,
    isPreviewDecrypting,
    isCurrentFileDecrypted,
    onDecryptPreview: handleDecryptPreview,
    onExportPreview: handleExportDocument,
    onSelectPreviewFile: handleSelectPreviewFile,
    pendingUploadDraft,
    pendingUploadPreviewIndex,
    pendingUploadName,
    pendingUploadDescription,
    pendingUploadRecoverable,
    pendingUploadToCloud,
    pendingUploadAlsoSaveLocal,
    uploadCanUseCloud,
    setPendingUploadPreviewIndex,
    setPendingUploadName,
    setPendingUploadDescription,
    setPendingUploadRecoverable,
    setPendingUploadToCloud: handleSetPendingUploadToCloud,
    setPendingUploadAlsoSaveLocal: handleSetPendingUploadAlsoSaveLocal,
    onRemoveUploadFile: handleRemoveUploadFile,
    onReorderUploadFiles: handleReorderUploadFiles,
    commitUploadDocument,
    requestKeyBackupSetup,
    shareTarget,
    allowDownload,
    shareStatus,
    isShareSubmitting,
    shareExpiryDays,
    setShareTarget,
    setAllowDownload,
    setShareExpiryDays,
    onCreateShare: handleCreateShare,
    onRevokeShare: handleRevokeShare,
    handleRevokeShareForRecipient,
    backupCloud,
    backupLocal,
    backupStatus,
    setBackupCloud,
    setBackupLocal,
    runBackup,
    keyBackupStatus,
    recoverableDocsCount,
    totalDocsCount,
    displayPassphrase,
    onBackupKeys: handleBackupKeys,
    onClearPassphrase: () => setDisplayPassphrase(null),
    onCopyPassphrase: onCopyPassphrase,
    onDownloadPassphrase: handleDownloadPassphrase,
    onDownloadBackupFile: handleDownloadBackupFile,
    onRestoreKeys: handleRestoreKeys,
    onToggleDocBackupFromSettings: handleToggleDocBackupFromSettings,
  } as any);

  const headerControllerProps: React.ComponentProps<typeof AppHeaderController> = {
    screen,
    shareOriginScreen,
    onLeaveUploadScreen: handleLeaveUploadScreen,
    onSetScreen: setScreen,
    onLogout: handleHeaderLogout,
    title: APP_SCREEN_TITLES[screen],
  };

  const overlaysProps: React.ComponentProps<typeof AppOverlays> = {
    showKeyBackupSetupModal,
    onCancelKeyBackupSetup: cancelKeyBackupSetup,
    onConfirmKeyBackupSetup: confirmKeyBackupSetup,
    showUploadDiscardWarning,
    dontShowUploadDiscardWarningAgain,
    onToggleDontShowUploadDiscardWarningAgain: () => {
      setDontShowUploadDiscardWarningAgain(prev => !prev);
    },
    onCloseUploadDiscardWarning: () => {
      setShowUploadDiscardWarning(false);
    },
    onConfirmDiscardUploadDraft: confirmDiscardUploadDraft,
    showVaultPassphrasePrompt,
    vaultPassphrasePromptInput,
    vaultPassphrasePromptAttemptsLeft,
    isVaultPassphrasePromptSubmitting,
    vaultPassphrasePromptError,
    onVaultPassphraseInputChange: setVaultPassphrasePromptInput,
    onVaultPassphraseSubmit: handleVaultPassphraseSubmit,
    onVaultPassphrasePromptDismiss: () => setShowVaultPassphrasePrompt(false),
  };

  return {
    showVaultShell,
    transitionOpacity,
    transitionTranslateY,
    appScreenRouterProps,
    headerControllerProps,
    overlaysProps,
  };
}
