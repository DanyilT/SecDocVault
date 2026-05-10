/**
 * app/controllers/buildAppScreenRouterProps.ts
 *
 * Small helper that composes screen router props object from controller state.
 * Keeps mapping logic central so tests can assert mapping behavior.
 */

import React from 'react';

import { AppScreenRouter } from '../components/AppScreenRouter';
import { AppScreen, ScreenParams } from '../navigation/constants';
import { UploadableDocumentDraft } from '../../services/documentVault';
import { VaultDocument } from '../../types/vault';

type RouterProps = React.ComponentProps<typeof AppScreenRouter>;

type BuildAppScreenRouterPropsInput = Omit<
  RouterProps,
  | 'onUnlock'
  | 'onLogin'
  | 'onGuest'
  | 'onExportFromMain'
  | 'onOpenRecoverKeys'
  | 'onOpenDocumentRecovery'
  | 'onConfirmUpload'
  | 'onOpenShareOptions'
  | 'onRevokeShareForRecipient'
> & {
  handleBiometricUnlock: RouterProps['onUnlock'];
  handlePasskeyUnlock: RouterProps['onUnlock'];
  handleGoToAuth: (mode: 'login' | 'guest') => void;
  preparePreviewForDocument: (doc: VaultDocument) => void;
  handleExportDocument: () => Promise<void>;
  pendingUploadDraft: UploadableDocumentDraft | null;
  commitUploadDocument: (draft: UploadableDocumentDraft) => Promise<void>;
  setPendingUploadRecoverable: (value: boolean) => void;
  setScreen: (screen: AppScreen) => void;
  handleRevokeShareForRecipient: (recipient: string) => Promise<void>;
  screenParams: ScreenParams;
};

/**
 * buildAppScreenRouterProps
 *
 * Compose the props object consumed by `AppScreenRouter` from the controller
 * state and a set of handler dependencies. This helper centralizes mapping
 * logic so tests and the controller can remain small.
 *
 * @param input - collection of controller state and handler functions used to build router props
 * @returns the `RouterProps` object that can be spread into `AppScreenRouter` or `VaultRouter`
 */
export function buildAppScreenRouterProps(input: BuildAppScreenRouterPropsInput): RouterProps {
  const {
    preferredProtection,
    pinBiometricEnabled,
    handleBiometricUnlock,
    handlePasskeyUnlock,
    handleGoToAuth,
    preparePreviewForDocument,
    handleExportDocument,
    pendingUploadDraft,
    commitUploadDocument,
    setPendingUploadRecoverable,
    setKeyBackupStatus,
    setScreen,
    setShareTarget,
    handleRevokeShareForRecipient,
    screenParams,
    ...rest
  } = input;

  return {
    ...rest,
    preferredProtection,
    pinBiometricEnabled,
    pendingUploadDraft,
    setPendingUploadRecoverable,
    setShareTarget,
    onUnlock:
      preferredProtection === 'pin' && pinBiometricEnabled
        ? handleBiometricUnlock
        : preferredProtection === 'biometric'
          ? handleBiometricUnlock
          : handlePasskeyUnlock,
    onLogin: () => handleGoToAuth('login'),
    onGuest: () => handleGoToAuth('guest'),
    onExportFromMain: async (doc: VaultDocument) => {
      preparePreviewForDocument(doc);
      await handleExportDocument();
    },
    onOpenRecoverKeys: () => {
      setKeyBackupStatus('');
      setScreen('recoverkeys');
    },
    onOpenDocumentRecovery: () => setScreen('recoverydocs'),
    onSkipForNow: screenParams.recoverkeys?.onSkipForNow,
    onConfirmUpload: async () => {
      if (pendingUploadDraft) {
        await commitUploadDocument(pendingUploadDraft);
      }
    },
    onOpenShareOptions: () => setScreen('share'),
    onRevokeShareForRecipient: (recipient: string) => {
      setShareTarget(recipient);
      void handleRevokeShareForRecipient(recipient);
    },
  };
}
