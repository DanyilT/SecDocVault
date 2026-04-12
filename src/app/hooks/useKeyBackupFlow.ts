/**
 * app/hooks/useKeyBackupFlow.ts
 *
 * Implements key backup flows exposed to the settings UI: request setup,
 * confirm setup, backup keys, restore keys, export passphrase file, etc.
 * This hook delegates to `services/keyBackup` and keeps UI-facing status
 * messages and dialogs in one place.
 */

import React, { useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';

import { VaultDocument } from '../../types/vault';

type UseKeyBackupFlowParams = {
  isGuest: boolean;
  userUid?: string;
  documents: VaultDocument[];
  saveOfflineByDefault: boolean;
  recoverableByDefault: boolean;
  keyBackupEnabled: boolean;
  recoveryPassphraseForSettings: string | null;
  setKeyBackupEnabled: (value: boolean) => void;
  setAutoSyncKeys: (value: boolean) => void;
  setRecoveryPassphraseForSettings: (value: string | null) => void;
  setDocuments: React.Dispatch<React.SetStateAction<VaultDocument[]>>;
  setSelectedDoc: React.Dispatch<React.SetStateAction<VaultDocument | null>>;
  setUploadStatus: (value: string) => void;
  setAccountStatus: (value: string) => void;
  saveVaultPreferences: (input: {
    saveOfflineByDefault: boolean;
    recoverableByDefault: boolean;
    autoSyncKeys: boolean;
    keyBackupEnabled: boolean;
  }) => Promise<void>;
  setAutoKeySyncEnabled: (value: boolean) => Promise<void>;
  ensureRecoveryPassphrase: () => Promise<string>;
  resetRecoveryPassphraseForSettings: () => Promise<string>;
  deleteKeyBackupFromFirebase: (uid: string) => Promise<void>;
  backupKeysToFirebase: (
    uid: string,
    docs: VaultDocument[],
    passphrase: string,
  ) => Promise<{passphrase: string; backedUpCount: number}>;
  updateDocumentRecoveryPreference: (docMeta: VaultDocument, enabled: boolean) => Promise<VaultDocument>;
  generateRecoveryPassphrase: () => string;
  restoreKeysFromFirebase: (uid: string, passphrase: string) => Promise<number>;
  downloadPassphraseFile: (passphrase: string, uid: string) => Promise<string>;
  downloadKeyBackupFile: (uid: string, passphrase: string) => Promise<string>;
};

/**
 * useKeyBackupFlow
 *
 * Hook exposing UI state and handlers for key-backup related flows used by
 * settings and account screens. Responsibilities:
 * - Present and manage the key-backup setup modal
 * - Coordinate generation/reset of the recovery passphrase
 * - Toggle and persist per-document recovery preferences
 * - Trigger backup/restore operations via injected service functions
 *
 * The hook is UI-focused and receives side-effecting functions (network,
 * storage) as parameters so it remains testable and free of direct platform
 * calls. It returns small, well-typed handlers and status strings intended
 * to be shown in the UI.
 *
 * @param params - dependency injection and setters required by the hook
 */
export function useKeyBackupFlow({
  isGuest,
  userUid,
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
  resetRecoveryPassphraseForSettings,
  deleteKeyBackupFromFirebase,
  backupKeysToFirebase,
  updateDocumentRecoveryPreference,
  generateRecoveryPassphrase,
  restoreKeysFromFirebase,
  downloadPassphraseFile,
  downloadKeyBackupFile,
}: UseKeyBackupFlowParams) {
  const [displayPassphrase, setDisplayPassphrase] = useState<string | null>(null);
  const [keyBackupStatus, setKeyBackupStatus] = useState('');
  const [showKeyBackupSetupModal, setShowKeyBackupSetupModal] = useState(false);
  const pendingEnableKeyBackupActionRef = useRef<(() => void) | null>(null);
  const keyBackupEnabledRef = useRef(keyBackupEnabled);
  const keyBackupSetupModalOpenRef = useRef(false);

  keyBackupEnabledRef.current = keyBackupEnabled;
  keyBackupSetupModalOpenRef.current = showKeyBackupSetupModal;

  const recoverableDocsCount = useMemo(
    () => documents.filter(item => item.recoverable !== false).length,
    [documents],
  );

  /**
   * requestKeyBackupSetup
   *
   * Show the key-backup setup modal and remember a pending callback to run
   * after the user confirms setup. Useful when an action (for example
   * enabling per-document recovery) requires key backup to be configured
   * first.
   *
   * @param onEnabled - callback executed after key backup has been enabled
   */
  const requestKeyBackupSetup = (onEnabled: () => void) => {
    if (keyBackupSetupModalOpenRef.current) {
      return;
    }

    pendingEnableKeyBackupActionRef.current = onEnabled;
    keyBackupSetupModalOpenRef.current = true;
    setShowKeyBackupSetupModal(true);
  };

  /**
   * confirmKeyBackupSetup
   *
   * Called when the user confirms key backup setup in the modal. Ensures a
   * recovery passphrase exists, enables auto-sync, persists preferences, and
   * runs any pending action that required key backup.
   */
  const confirmKeyBackupSetup = async () => {
    try {
      const passphrase = await ensureRecoveryPassphrase();
      setRecoveryPassphraseForSettings(passphrase);
      setKeyBackupEnabled(true);
      keyBackupEnabledRef.current = true;
      setAutoSyncKeys(true);
      await setAutoKeySyncEnabled(true);
      await saveVaultPreferences({
        saveOfflineByDefault,
        recoverableByDefault,
        autoSyncKeys: true,
        keyBackupEnabled: true,
      });
      keyBackupSetupModalOpenRef.current = false;
      setShowKeyBackupSetupModal(false);
      const pendingAction = pendingEnableKeyBackupActionRef.current;
      pendingEnableKeyBackupActionRef.current = null;
      pendingAction?.();
      setUploadStatus('Key backup enabled. You can now enable recovery per document.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to set up key backup.';
      setUploadStatus(message);
    }
  };

  /**
   * cancelKeyBackupSetup
   *
   * Close the setup modal and clear any pending post-setup action.
   */
  const cancelKeyBackupSetup = () => {
    keyBackupSetupModalOpenRef.current = false;
    setShowKeyBackupSetupModal(false);
    pendingEnableKeyBackupActionRef.current = null;
  };

  /**
   * handleToggleDocumentRecovery
   *
   * Toggle whether a document should be included in cloud key recovery. If
   * enabling recovery while key backup is not configured, this function will
   * prompt the user to configure key backup first and then retry the toggle.
   *
   * @param docMeta - metadata of the document to update
   * @param enabled - desired recoverable state
   */
  const handleToggleDocumentRecovery = async (docMeta: VaultDocument, enabled: boolean) => {
    if (enabled && !keyBackupEnabledRef.current) {
      requestKeyBackupSetup(() => {
        void handleToggleDocumentRecovery(docMeta, true);
      });
      return;
    }

    try {
      const updated = await updateDocumentRecoveryPreference(docMeta, enabled);
      const nextDocuments = documents.map(item => (item.id === updated.id ? updated : item));
      setDocuments(nextDocuments);
      setSelectedDoc(prev => (prev?.id === updated.id ? updated : prev));
      setUploadStatus(enabled ? `${docMeta.name} added to key backup.` : `${docMeta.name} removed from key backup.`);

      if (!isGuest && userUid && keyBackupEnabledRef.current) {
        const recoverableCloudDocs = nextDocuments.filter(item => {
          const hasCloudCopy = Boolean(item.references?.some(reference => reference.source === 'firebase'));
          return item.recoverable !== false && hasCloudCopy;
        });

        if (recoverableCloudDocs.length === 0) {
          setKeyBackupStatus('No cloud documents are marked recoverable yet.');
          return;
        }

        try {
          setKeyBackupStatus('Syncing key backup to Firebase...');
          const passphrase = await ensureRecoveryPassphrase();
          setRecoveryPassphraseForSettings(passphrase);
          const result = await backupKeysToFirebase(userUid, nextDocuments, passphrase);
          setKeyBackupStatus(`Key backup synced (${result.backedUpCount} keys).`);
        } catch (syncError) {
          const syncMessage = syncError instanceof Error ? syncError.message : 'Failed to sync key backup.';
          setKeyBackupStatus(`Backup sync failed: ${syncMessage}`);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update document backup setting.';
      setUploadStatus(message);
    }
  };

  /**
   * handleSetKeyBackupEnabled
   *
   * Enable or disable key backup globally. When enabling, ensure a
   * recovery passphrase exists and persist auto-sync preferences.
   *
   * @param enabled - next enabled state
   */
  const handleSetKeyBackupEnabled = async (enabled: boolean) => {
    try {
      let nextPassphrase = recoveryPassphraseForSettings;
      if (enabled) {
        nextPassphrase = await ensureRecoveryPassphrase();
      }

      setKeyBackupEnabled(enabled);
      setAutoSyncKeys(enabled);
      setRecoveryPassphraseForSettings(nextPassphrase);
      await setAutoKeySyncEnabled(enabled);
      await saveVaultPreferences({
        saveOfflineByDefault,
        recoverableByDefault,
        autoSyncKeys: enabled,
        keyBackupEnabled: enabled,
      });
      setAccountStatus(enabled ? 'Key backup enabled.' : 'Key backup disabled.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update key backup setting.';
      setAccountStatus(message);
    }
  };

  /**
   * handleResetBackupPassphrase
   *
   * Generate a new recovery passphrase and delete any existing cloud
   * backups. This is destructive for the cloud backup and therefore prompts
   * the user for confirmation via an alert.
   */
  const handleResetBackupPassphrase = async () => {
    const confirmed = await new Promise<boolean>(resolve => {
      Alert.alert(
        'Generate new recovery passphrase?',
        'This will permanently remove your current cloud key backup (vaultKeyBackups). You must create a new key backup after generating the passphrase.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve(false),
          },
          {
            text: 'Generate New',
            style: 'destructive',
            onPress: () => resolve(true),
          },
        ],
      );
    });

    if (!confirmed) {
      return;
    }

    try {
      if (isGuest || !userUid) {
        setAccountStatus('Sign in with a cloud account to reset and sync key backups.');
        return;
      }

      await deleteKeyBackupFromFirebase(userUid);
      const passphrase = await resetRecoveryPassphraseForSettings();
      setRecoveryPassphraseForSettings(passphrase);

      const recoverableCloudDocs = documents.filter(item => {
        const hasCloudCopy = Boolean(item.references?.some(reference => reference.source === 'firebase'));
        return item.recoverable !== false && hasCloudCopy;
      });

      if (recoverableCloudDocs.length === 0) {
        setKeyBackupStatus('Passphrase reset. No recoverable cloud documents found, so no new backup was created.');
        setAccountStatus('Backup passphrase reset and previous cloud key backup deleted.');
        return;
      }

      setKeyBackupStatus('Generating new cloud key backup...');
      const result = await backupKeysToFirebase(userUid, recoverableCloudDocs, passphrase);
      setKeyBackupStatus(`New cloud key backup created (${result.backedUpCount} keys).`);
      setAccountStatus('Backup passphrase reset, old backup deleted, and new cloud key backup created.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset backup passphrase.';
      setAccountStatus(message);
    }
  };

  /**
   * handleBackupKeys
   *
   * Create a new cloud key backup using a freshly generated passphrase.
   * Returns UI-oriented status updates via `keyBackupStatus` and displays
   * the generated passphrase for user to save.
   */
  const handleBackupKeys = async () => {
    if (isGuest) {
      setKeyBackupStatus('Key backup is not available in guest mode.');
      return;
    }

    if (!userUid) {
      setKeyBackupStatus('You must be logged in to backup keys.');
      return;
    }

    if (recoverableDocsCount === 0) {
      setKeyBackupStatus('No recoverable documents found. Enable recovery per document during upload.');
      return;
    }

    try {
      setKeyBackupStatus('Generating passphrase and backing up keys...');
      const passphrase = generateRecoveryPassphrase();
      const result = await backupKeysToFirebase(userUid, documents, passphrase);
      setDisplayPassphrase(result.passphrase);
      setKeyBackupStatus(
        `Key backup created successfully (${result.backedUpCount} keys). Save your passphrase in a secure location.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to backup keys.';
      setKeyBackupStatus(`Error: ${message}`);
    }
  };

  /**
   * handleRestoreKeys
   *
   * Restore keys from a cloud backup using the provided passphrase. Reports
   * progress and errors via `keyBackupStatus`.
   *
   * @param passphrase - recovery passphrase for the backup
   */
  const handleRestoreKeys = async (passphrase: string) => {
    if (isGuest || !userUid) {
      setKeyBackupStatus('You must be logged in to restore keys from Firebase.');
      return;
    }

    if (!passphrase.trim()) {
      setKeyBackupStatus('Please provide the recovery passphrase.');
      return;
    }

    try {
      setKeyBackupStatus('Restoring keys from Firebase backup...');
      const restored = await restoreKeysFromFirebase(userUid, passphrase.trim());
      setKeyBackupStatus(`Restore complete: ${restored} keys restored to this device.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to restore keys.';
      setKeyBackupStatus(`Error: ${message}`);
    }
  };

  /**
   * handleDownloadPassphrase
   *
   * Persist the provided passphrase to a platform file using
   * `downloadPassphraseFile` and report the saved path via UI state.
   *
   * @param passphrase - the passphrase to save on disk
   */
  const handleDownloadPassphrase = async (passphrase: string) => {
    try {
      if (!userUid) {
        setKeyBackupStatus('You must be logged in to download the passphrase file.');
        return;
      }
      const path = await downloadPassphraseFile(passphrase, userUid);
      setKeyBackupStatus(`Passphrase file saved to ${path}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download passphrase.';
      setKeyBackupStatus(`Error: ${message}`);
    }
  };

  /**
   * handleDownloadBackupFile
   *
   * Download the encrypted key backup JSON file for offline transfer or
   * archival. Reports the destination path via `keyBackupStatus`.
   *
   * @param passphrase - passphrase used to decrypt/encrypt the downloaded file
   */
  const handleDownloadBackupFile = async (passphrase: string) => {
    try {
      if (!userUid) {
        setKeyBackupStatus('You must be logged in to download backup JSON.');
        return;
      }
      const path = await downloadKeyBackupFile(userUid, passphrase);
      setKeyBackupStatus(`Encrypted key backup saved to ${path}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to download backup file.';
      setKeyBackupStatus(`Error: ${message}`);
    }
  };

  /**
   * handleCopyPassphrase
   *
   * Copy the passphrase using the provided platform copy function and
   * update `keyBackupStatus` to provide immediate feedback to the user.
   *
   * @param passphrase - passphrase to copy
   * @param copyFn - platform copy function (e.g., clipboard setString)
   */
  const handleCopyPassphrase = (passphrase: string, copyFn: (value: string) => void) => {
    try {
      copyFn(passphrase);
      setKeyBackupStatus('Passphrase copied.');
    } catch {
      // no-op: keep current status
    }
  };

  return {
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
    handleResetBackupPassphrase,
    handleBackupKeys,
    handleRestoreKeys,
    handleDownloadPassphrase,
    handleDownloadBackupFile,
    handleCopyPassphrase,
  };
}
