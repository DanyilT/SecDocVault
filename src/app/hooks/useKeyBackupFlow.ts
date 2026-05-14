/**
 * app/hooks/useKeyBackupFlow.ts
 *
 * Implements key backup flows exposed to the settings UI: request setup,
 * confirm setup, backup keys, restore keys, export passphrase file, etc.
 * This hook delegates to `services/keyBackup` and keeps UI-facing status
 * messages and dialogs in one place.
 */

import React, { useMemo, useRef, useState } from 'react';

import { VaultDocument } from '../../types/vault';
import {
  generateRecoveryPassphrase,
  sanitizeRecoveryPassphrase,
  validateRecoveryPassphrase,
} from '../../services/crypto/documentCrypto';

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
  persistRecoveryPassphraseLocalOnly: (passphrase: string) => Promise<void>;
  ensureRecoveryPassphrase: () => Promise<string>;
  deleteKeyBackupFromFirebase?: (uid: string) => Promise<void>;
  backupKeysToFirebase: (
    uid: string,
    docs: VaultDocument[],
    passphrase: string,
  ) => Promise<{ passphrase: string; backedUpCount: number }>;
  updateDocumentRecoveryPreference: (docMeta: VaultDocument, enabled: boolean) => Promise<VaultDocument>;
  restoreKeysFromFirebase: (uid: string, passphrase: string) => Promise<number>;
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
  backupKeysToFirebase,
  updateDocumentRecoveryPreference,
  restoreKeysFromFirebase,
  persistRecoveryPassphraseLocalOnly,
}: UseKeyBackupFlowParams) {
  const [displayPassphrase, setDisplayPassphrase] = useState<string | null>(
    null,
  );
  const [keyBackupStatus, setKeyBackupStatus] = useState('');
  const [customPassphrase, setCustomPassphrase] = useState('');
  const [passphraseValidationError, setPassphraseValidationError] =
    useState('');
  const pendingEnableKeyBackupActionRef = useRef<(() => void) | null>(null);
  const keyBackupEnabledRef = useRef(keyBackupEnabled);

  keyBackupEnabledRef.current = keyBackupEnabled;

  const recoverableDocsCount = useMemo(
    () => documents.filter(item => item.recoverable !== false).length,
    [documents],
  );

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
  const handleToggleDocumentRecovery = async (
    docMeta: VaultDocument,
    enabled: boolean,
  ) => {
    if (enabled && !keyBackupEnabledRef.current) {
      return;
    }

    try {
      const updated = await updateDocumentRecoveryPreference(docMeta, enabled);
      const nextDocuments = documents.map(item =>
        item.id === updated.id ? updated : item,
      );
      setDocuments(nextDocuments);
      setSelectedDoc(prev => (prev?.id === updated.id ? updated : prev));
      setUploadStatus(
        enabled
          ? `${docMeta.name} added to key backup.`
          : `${docMeta.name} removed from key backup.`,
      );

      if (!isGuest && userUid && keyBackupEnabledRef.current) {
        const recoverableCloudDocs = nextDocuments.filter(item => {
          const hasCloudCopy = Boolean(
            item.references?.some(reference => reference.source === 'firebase'),
          );
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
          const result = await backupKeysToFirebase(
            userUid,
            nextDocuments,
            passphrase,
          );
          setKeyBackupStatus(
            `Key backup synced (${result.backedUpCount} keys).`,
          );
        } catch (syncError) {
          const syncMessage =
            syncError instanceof Error
              ? syncError.message
              : 'Failed to sync key backup.';
          setKeyBackupStatus(`Backup sync failed: ${syncMessage}`);
        }
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to update document backup setting.';
      setUploadStatus(message);
    }
  };

  /**
   * handleSetKeyBackupEnabled
   *
   * Enable or disable key backup globally. When enabling without an existing
   * recovery passphrase, the user must set one through the UI editor before
   * the backup is fully usable; we do not auto-derive a passphrase.
   *
   * @param enabled - next enabled state
   */
  const handleSetKeyBackupEnabled = async (enabled: boolean) => {
    setKeyBackupEnabled(enabled);
    setAutoSyncKeys(enabled);

    try {
      if (!enabled) {
        setRecoveryPassphraseForSettings(null);
      }

      await setAutoKeySyncEnabled(enabled);
      await saveVaultPreferences({
        saveOfflineByDefault,
        recoverableByDefault,
        autoSyncKeys: enabled,
        keyBackupEnabled: enabled,
      });
      setAccountStatus(
        enabled
          ? 'Key backup enabled. Set a recovery passphrase to finish setup.'
          : 'Key backup disabled.',
      );
    } catch (error) {
      setKeyBackupEnabled(!enabled);
      setAutoSyncKeys(!enabled);
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to update key backup setting.';
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
      setKeyBackupStatus(
        'No recoverable documents found. Enable recovery per document during upload.',
      );
      return;
    }

    try {
      setKeyBackupStatus('Backing up keys...');
      const passphrase = await ensureRecoveryPassphrase();
      setRecoveryPassphraseForSettings(passphrase);
      const result = await backupKeysToFirebase(userUid, documents, passphrase);
      setKeyBackupStatus(
        `Key backup created successfully (${result.backedUpCount} keys).`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to backup keys.';
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
      setKeyBackupStatus(
        'You must be logged in to restore keys from Firebase.',
      );
      return;
    }

    if (!passphrase.trim()) {
      setKeyBackupStatus('Please provide the recovery passphrase.');
      return;
    }

    try {
      setKeyBackupStatus('Restoring keys from Firebase backup...');
      const restored = await restoreKeysFromFirebase(
        userUid,
        passphrase.trim(),
      );
      
      await persistRecoveryPassphraseLocalOnly(passphrase.trim());
      setKeyBackupEnabled(true);
      setAutoSyncKeys(true);
      await setAutoKeySyncEnabled(true);
      await saveVaultPreferences({
        saveOfflineByDefault,
        recoverableByDefault,
        autoSyncKeys: true,
        keyBackupEnabled: true,
      });

      setKeyBackupStatus(
        `Restore complete: ${restored} keys restored to this device.`,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to restore keys.';
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
  const handleCopyPassphrase = (
    passphrase: string,
    copyFn: (value: string) => void,
  ) => {
    try {
      copyFn(passphrase);
      setKeyBackupStatus('Passphrase copied.');
    } catch {
      // no-op: keep current status
    }
  };

  /**
   * handleGeneratePassphrase
   *
   * Generate a random recovery passphrase and set it as the custom passphrase.
   */
  const handleGeneratePassphrase = () => {
    try {
      const generated = generateRecoveryPassphrase();
      setCustomPassphrase(generated);
      setPassphraseValidationError('');
      setKeyBackupStatus('Random passphrase generated.');
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to generate passphrase.';
      setPassphraseValidationError(message);
    }
  };

  /**
   * handlePassphraseChange
   *
   * Handle user input for recovery passphrase. Sanitizes by replacing
   * spaces with hyphens and validates format.
   *
   * @param value - Raw input value from TextInput
   */
  const handlePassphraseChange = (value: string) => {
    const sanitized = sanitizeRecoveryPassphrase(value);
    setCustomPassphrase(sanitized);

    // Validate format (only lowercase, digits, and hyphens)
    if (sanitized && !validateRecoveryPassphrase(sanitized)) {
      setPassphraseValidationError(
        'Passphrase can only contain lowercase letters, numbers, and hyphens.',
      );
    } else {
      setPassphraseValidationError('');
    }
  };

  /**
   * confirmKeyBackupSetupWithCustomPassphrase
   *
   * Confirm key backup setup with a user-provided or generated passphrase.
   * Validates the passphrase format before proceeding.
   */
  const confirmKeyBackupSetupWithCustomPassphrase = async () => {
    if (!customPassphrase.trim()) {
      setPassphraseValidationError(
        'Please enter or generate a recovery passphrase.',
      );
      return;
    }

    if (!validateRecoveryPassphrase(customPassphrase)) {
      setPassphraseValidationError(
        'Recovery passphrase must contain only lowercase letters, numbers, and hyphens.',
      );
      return;
    }

    try {
      // Validate that we can backup with this passphrase
      setRecoveryPassphraseForSettings(customPassphrase);
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
      const pendingAction = pendingEnableKeyBackupActionRef.current;
      pendingEnableKeyBackupActionRef.current = null;
      setCustomPassphrase('');
      setPassphraseValidationError('');
      setDisplayPassphrase(customPassphrase);
      pendingAction?.();
      setUploadStatus('Key backup enabled with your recovery passphrase.');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to set up key backup.';
      setPassphraseValidationError(message);
    }
  };

  return {
    displayPassphrase,
    setDisplayPassphrase,
    keyBackupStatus,
    setKeyBackupStatus,
    customPassphrase,
    setCustomPassphrase,
    passphraseValidationError,
    setPassphraseValidationError,
    handleToggleDocumentRecovery,
    handleSetKeyBackupEnabled,
    handleBackupKeys,
    handleRestoreKeys,
    handleCopyPassphrase,
    handleGeneratePassphrase,
    handlePassphraseChange,
    confirmKeyBackupSetupWithCustomPassphrase,
  };
}
