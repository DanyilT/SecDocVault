/**
 * app/controllers/useAppControllerActions.ts
 *
 * Encapsulates higher-level actions that affect multiple subsystems (auth,
 * storage, key backup). These functions are invoked by controllers when a
 * user triggers actions from the UI and may orchestrate async flows.
 */

import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Clipboard from '@react-native-clipboard/clipboard';

import { AppScreen } from '../navigation/constants';

type UseAppControllerActionsParams = {
  completeAuthPendingKey: string;
  isGuest: boolean;
  backupCloud: boolean;
  backupLocal: boolean;
  pendingNewEmail: string;
  recoverableByDefault: boolean;
  saveOfflineByDefault: boolean;
  keyBackupEnabled: boolean;
  uploadCanUseCloud: boolean;
  pendingUploadToCloud: boolean;
  pendingUploadAlsoSaveLocal: boolean;
  userEmail?: string;
  setAccountStatus: (value: string) => void;
  setPendingNewEmail: (value: string) => void;
  setBackupStatus: (value: string) => void;
  setSaveOfflineByDefault: (value: boolean) => void;
  setRecoverableByDefault: (value: boolean) => void;
  setPendingUploadToCloud: (value: boolean) => void;
  setPendingUploadAlsoSaveLocal: (value: boolean) => void;
  setIsVaultLocked: (value: boolean) => void;
  setHasUnlockedThisLaunch: (value: boolean) => void;
  setScreen: (screen: AppScreen) => void;
  resetToHero: () => void;
  resetAuthForm: () => void;
  requestEmailChange: (email: string) => Promise<boolean>;
  changeGuestPassword: (currentPassword: string, nextPassword: string) => Promise<boolean>;
  deleteAccountAndData: () => Promise<boolean>;
  signOut: () => Promise<void>;
  saveVaultPreferences: (input: {
    saveOfflineByDefault: boolean;
    recoverableByDefault: boolean;
    autoSyncKeys: boolean;
    keyBackupEnabled: boolean;
  }) => Promise<void>;
  updateUnlockMethod: (
    method: 'pin' | 'passkey',
    options?: {
      pin?: string;
      pinBiometricEnabled?: boolean;
      firebaseEmail?: string;
      firebasePassword?: string;
    },
  ) => Promise<boolean>;
  handleCopyPassphrase: (passphrase: string, copyFn: (value: string) => void) => void;
};

/**
 * useAppControllerActions
 *
 * Provides high-level actions that touch multiple subsystems (auth, storage,
 * backups). These are convenient wrappers used by controllers to perform
 * multistep operations and report UI status.
 *
 * @param params - configuration and dependency functions required by actions
 * @returns an object of action handlers used by the controller
 */
export function useAppControllerActions({
  completeAuthPendingKey,
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
  userEmail,
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
}: UseAppControllerActionsParams) {
  /**
   * runBackup
   *
   * Queue a backup message describing selected targets (cloud/local). This
   * function only updates UI status and does not perform the actual backup.
   *
   * @returns void
   */
  const runBackup = () => {
    const targets = [backupCloud && !isGuest ? 'Cloud Vault' : '', backupLocal ? 'Local Encrypted File' : '']
      .filter(Boolean)
      .join(' + ');
    setBackupStatus(targets ? `Backup queued to ${targets}` : 'Select at least one backup target');
  };

  /**
   * onCopyPassphrase
   *
   * Copy the provided passphrase to the platform clipboard using the
   * injected copy function and update status via `handleCopyPassphrase`.
   *
   * @param passphrase - passphrase to copy
   * @returns Promise<void>
   */
  const onCopyPassphrase = async (passphrase: string) => {
    handleCopyPassphrase(passphrase, Clipboard.setString);
  };

  /**
   * handleChangeGuestPassword
   *
   * Change the guest account password and update UI status on success.
   *
   * @param currentPassword - current guest password
   * @param nextPassword - new guest password
   * @returns Promise<boolean> indicating success
   */
  const handleChangeGuestPassword = async (currentPassword: string, nextPassword: string) => {
    const success = await changeGuestPassword(currentPassword, nextPassword);
    if (success) {
      setAccountStatus('Guest password updated.');
    }
    return success;
  };

  /**
   * handleRequestEmailChange
   *
   * Initiate email change for the current account using the pending email
   * value and report success/failure via `setAccountStatus`.
   *
   * @returns Promise<void>
   */
  const handleRequestEmailChange = async () => {
    const nextEmail = pendingNewEmail.trim();
    if (!nextEmail) {
      setAccountStatus('Enter the new email address first.');
      return;
    }

    const success = await requestEmailChange(nextEmail);
    if (success) {
      setAccountStatus('Confirmation link sent to your new email. Open it to complete the email change.');
      setPendingNewEmail('');
      return;
    }

    setAccountStatus('Unable to start email change. You may need to sign in again.');
  };

  /**
   * handleDeleteAccountAndData
   *
   * Prompt the user and delete account and related data if confirmed. This
   * coordinates calling `deleteAccountAndData` and subsequent cleanup.
   *
   * @returns void
   */
  const handleDeleteAccountAndData = () => {
    Alert.alert(
      isGuest ? 'Delete local data?' : 'Delete account and all data?',
      isGuest
        ? 'This will remove all local vault documents and app data from this device.'
        : 'This will permanently remove your Cloud (Firebase) account, cloud documents, key backups, and local vault data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              const success = await deleteAccountAndData();
              if (success) {
                setAccountStatus(isGuest ? 'Local vault data deleted.' : 'Account and all data deleted.');
                void signOut();
                void AsyncStorage.removeItem(completeAuthPendingKey);
                resetAuthForm();
                setIsVaultLocked(false);
                setHasUnlockedThisLaunch(false);
                setScreen('main');
                resetToHero();
              }
            })();
          },
        },
      ],
    );
  };

  /**
   * handleHeaderLogout
   *
   * Perform a sign-out and local cleanup when the header logout action is
   * invoked.
   *
   * @returns void
   */
  const handleHeaderLogout = () => {
    void signOut();
    void AsyncStorage.removeItem(completeAuthPendingKey);
    resetAuthForm();
    setIsVaultLocked(false);
    setHasUnlockedThisLaunch(false);
    setScreen('main');
    resetToHero();
  };

  /**
   * handleSetSaveOfflineByDefault
   *
   * Update the 'save offline by default' preference and persist vault
   * preferences.
   *
   * @param value - next preference value
   * @returns void
   */
  const handleSetSaveOfflineByDefault = (value: boolean) => {
    setSaveOfflineByDefault(value);
    void saveVaultPreferences({
      saveOfflineByDefault: value,
      recoverableByDefault,
      autoSyncKeys: keyBackupEnabled,
      keyBackupEnabled,
    });
  };

  /**
   * handleSetRecoverableByDefault
   *
   * Update the default per-document recoverable preference and persist
   * vault preferences.
   *
   * @param value - next preference value
   * @returns void
   */
  const handleSetRecoverableByDefault = (value: boolean) => {
    setRecoverableByDefault(value);
    void saveVaultPreferences({
      saveOfflineByDefault,
      recoverableByDefault: value,
      autoSyncKeys: keyBackupEnabled,
      keyBackupEnabled,
    });
  };

  /**
   * handleSetPendingUploadToCloud
   *
   * Toggle the pending upload's cloud destination while ensuring at least
   * one destination remains selected.
   *
   * @param value - whether the pending upload should go to cloud
   * @returns void
   */
  const handleSetPendingUploadToCloud = (value: boolean) => {
    if (!uploadCanUseCloud) {
      setPendingUploadToCloud(false);
      setPendingUploadAlsoSaveLocal(true);
      return;
    }

    setPendingUploadToCloud(value);
    if (!value && !pendingUploadAlsoSaveLocal) {
      setPendingUploadAlsoSaveLocal(true);
    }
  };

  /**
   * handleSetPendingUploadAlsoSaveLocal
   *
   * Toggle whether the pending upload should also be saved locally and
   * enforce sensible defaults if cloud upload is not selected.
   *
   * @param value - whether to also save locally
   * @returns void
   */
  const handleSetPendingUploadAlsoSaveLocal = (value: boolean) => {
    if (!value && !pendingUploadToCloud) {
      if (uploadCanUseCloud) {
        setPendingUploadToCloud(true);
        setPendingUploadAlsoSaveLocal(false);
      }
      return;
    }

    setPendingUploadAlsoSaveLocal(value);
  };

  /**
   * handleUpdateUnlockMethod
   *
   * Update the account unlock method (PIN or passkey) and report result via
   * `setAccountStatus`.
   *
   * @param payload - unlock method and optional parameters
   * @returns Promise<void>
   */
  const handleUpdateUnlockMethod = async (payload: {
    method: 'pin' | 'passkey';
    pin?: string;
    pinBiometricEnabled?: boolean;
    firebasePassword?: string;
  }) => {
    const success = await updateUnlockMethod(payload.method, {
      pin: payload.pin,
      pinBiometricEnabled: payload.pinBiometricEnabled,
      firebaseEmail: userEmail,
      firebasePassword: payload.firebasePassword,
    });

    if (success) {
      setAccountStatus('Unlock method updated.');
      return;
    }

    if (payload.method === 'passkey' && !isGuest) {
      setAccountStatus('Passkey setup requires re-login to store credentials securely.');
      return;
    }

    setAccountStatus('Unable to update unlock method.');
  };

  return {
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
  };
}
