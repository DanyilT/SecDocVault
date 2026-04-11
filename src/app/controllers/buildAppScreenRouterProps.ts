import React from 'react';

import { AppScreenRouter } from '../components/AppScreenRouter';
import { AppScreen } from '../navigation/constants';
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
  | 'onRequestEnableKeyBackup'
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
  requestKeyBackupSetup: (onEnabled: () => void) => void;
  setPendingUploadRecoverable: (value: boolean) => void;
  setKeyBackupStatus: (value: string) => void;
  setScreen: (screen: AppScreen) => void;
  handleRevokeShareForRecipient: (recipient: string) => Promise<void>;
};

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
    requestKeyBackupSetup,
    setPendingUploadRecoverable,
    setKeyBackupStatus,
    setScreen,
    setShareTarget,
    handleRevokeShareForRecipient,
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
    onConfirmUpload: async () => {
      if (pendingUploadDraft) {
        await commitUploadDocument(pendingUploadDraft);
      }
    },
    onRequestEnableKeyBackup: () => {
      requestKeyBackupSetup(() => {
        setPendingUploadRecoverable(true);
      });
    },
    onOpenShareOptions: () => setScreen('share'),
    onRevokeShareForRecipient: (recipient: string) => {
      setShareTarget(recipient);
      void handleRevokeShareForRecipient(recipient);
    },
  };
}
