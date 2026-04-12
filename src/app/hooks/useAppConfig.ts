/**
 * app/hooks/useAppConfig.ts
 *
 * Provides persisted app preferences and config helpers (e.g. backup defaults,
 * upload discard warning preferences). This hook reads/writes AsyncStorage and
 * exposes boolean flags used by the controller and settings screens.
 */

import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getIncomingShareDecisionStore,
  getVaultPreferences,
  IncomingShareDecisionStore,
} from '../../storage/localVault';
import { getRecoveryPassphraseForSettings, setAutoKeySyncEnabled } from '../../services/keyBackup';

type UseAppConfigParams = {
  uploadDiscardWarningPrefKey: string;
  hasGuestAccount: () => Promise<boolean>;
  onGuestAccountChange: (exists: boolean) => void;
};

export function useAppConfig({
  uploadDiscardWarningPrefKey,
  hasGuestAccount,
  onGuestAccountChange,
}: UseAppConfigParams) {
  const [incomingShareDecisionStore, setIncomingShareDecisionStore] = useState<IncomingShareDecisionStore>({});
  const [saveOfflineByDefault, setSaveOfflineByDefault] = useState(false);
  const [recoverableByDefault, setRecoverableByDefault] = useState(false);
  const [autoSyncKeys, setAutoSyncKeys] = useState(false);
  const [keyBackupEnabled, setKeyBackupEnabled] = useState(false);
  const [recoveryPassphraseForSettings, setRecoveryPassphraseForSettings] = useState<string | null>(null);
  const [skipUploadDiscardWarning, setSkipUploadDiscardWarning] = useState(false);

  // Initialize app config on mount
  useEffect(() => {
    void (async () => {
      const preferences = await getVaultPreferences();
      const incomingShareDecisions = await getIncomingShareDecisionStore();
      const derivedAutoSync = preferences.keyBackupEnabled;

      setIncomingShareDecisionStore(incomingShareDecisions);
      setSaveOfflineByDefault(preferences.saveOfflineByDefault);
      setRecoverableByDefault(preferences.recoverableByDefault);
      setAutoSyncKeys(derivedAutoSync);
      setKeyBackupEnabled(preferences.keyBackupEnabled);
      await setAutoKeySyncEnabled(derivedAutoSync);

      const recoveryPassphrase = await getRecoveryPassphraseForSettings();
      setRecoveryPassphraseForSettings(recoveryPassphrase);

      const skipDiscardWarning = await AsyncStorage.getItem(uploadDiscardWarningPrefKey);
      setSkipUploadDiscardWarning(skipDiscardWarning === '1');

      const guestExists = await hasGuestAccount();
      onGuestAccountChange(guestExists);
    })();
  }, [uploadDiscardWarningPrefKey, hasGuestAccount, onGuestAccountChange]);

  return {
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
  };
}
