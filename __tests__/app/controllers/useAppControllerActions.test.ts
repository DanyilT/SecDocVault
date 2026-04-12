import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Clipboard from '@react-native-clipboard/clipboard';

import { useAppControllerActions } from '../../../src/app/controllers/useAppControllerActions';

jest.mock('@react-native-async-storage/async-storage', () => ({
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

function buildParams(overrides: Record<string, unknown> = {}) {
  return {
    completeAuthPendingKey: 'pending.key',
    isGuest: false,
    backupCloud: true,
    backupLocal: false,
    pendingNewEmail: ' next@example.com ',
    recoverableByDefault: false,
    saveOfflineByDefault: true,
    keyBackupEnabled: true,
    uploadCanUseCloud: true,
    pendingUploadToCloud: false,
    pendingUploadAlsoSaveLocal: false,
    userEmail: 'user@example.com',
    setAccountStatus: jest.fn(),
    setPendingNewEmail: jest.fn(),
    setBackupStatus: jest.fn(),
    setSaveOfflineByDefault: jest.fn(),
    setRecoverableByDefault: jest.fn(),
    setPendingUploadToCloud: jest.fn(),
    setPendingUploadAlsoSaveLocal: jest.fn(),
    setIsVaultLocked: jest.fn(),
    setHasUnlockedThisLaunch: jest.fn(),
    setScreen: jest.fn(),
    resetToHero: jest.fn(),
    resetAuthForm: jest.fn(),
    requestEmailChange: jest.fn(async () => true),
    changeGuestPassword: jest.fn(async () => true),
    deleteAccountAndData: jest.fn(async () => true),
    signOut: jest.fn(async () => undefined),
    saveVaultPreferences: jest.fn(async () => undefined),
    updateUnlockMethod: jest.fn(async () => true),
    handleCopyPassphrase: jest.fn(),
    ...overrides,
  } as any;
}

describe('useAppControllerActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('queues backup status text based on selected targets', () => {
    const params = buildParams({backupCloud: true, backupLocal: true});
    const api = useAppControllerActions(params);

    api.runBackup();

    expect(params.setBackupStatus).toHaveBeenCalledWith('Backup queued to Cloud Vault + Local Encrypted File');
  });

  it('copies passphrase using Clipboard bridge', async () => {
    const params = buildParams();
    const api = useAppControllerActions(params);

    await api.onCopyPassphrase('alpha beta');

    expect(params.handleCopyPassphrase).toHaveBeenCalledWith('alpha beta', Clipboard.setString);
  });

  it('requests email change and clears pending field on success', async () => {
    const params = buildParams();
    const api = useAppControllerActions(params);

    await api.handleRequestEmailChange();

    expect(params.requestEmailChange).toHaveBeenCalledWith('next@example.com');
    expect(params.setPendingNewEmail).toHaveBeenCalledWith('');
  });

  it('toggles upload destination fallback when cloud is unavailable', () => {
    const params = buildParams({uploadCanUseCloud: false});
    const api = useAppControllerActions(params);

    api.handleSetPendingUploadToCloud(true);

    expect(params.setPendingUploadToCloud).toHaveBeenCalledWith(false);
    expect(params.setPendingUploadAlsoSaveLocal).toHaveBeenCalledWith(true);
  });

  it('forwards cloud passkey password when updating unlock method', async () => {
    const params = buildParams();
    const api = useAppControllerActions(params);

    await api.handleUpdateUnlockMethod({
      method: 'passkey',
      firebasePassword: 'top-secret-password',
    });

    expect(params.updateUnlockMethod).toHaveBeenCalledWith('passkey', {
      pin: undefined,
      pinBiometricEnabled: undefined,
      firebaseEmail: 'user@example.com',
      firebasePassword: 'top-secret-password',
    });
  });

  it('logs out from header and resets local session state', () => {
    const params = buildParams();
    const api = useAppControllerActions(params);

    api.handleHeaderLogout();

    expect(params.signOut).toHaveBeenCalled();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('pending.key');
    expect(params.resetAuthForm).toHaveBeenCalled();
    expect(params.setScreen).toHaveBeenCalledWith('main');
    expect(params.resetToHero).toHaveBeenCalled();
  });

  it('confirms account deletion flow and executes destructive action', async () => {
    const params = buildParams();
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      const deleteBtn = (buttons ?? []).find(button => button.text === 'Delete');
      deleteBtn?.onPress?.();
    });

    const api = useAppControllerActions(params);
    api.handleDeleteAccountAndData();

    await Promise.resolve();
    await Promise.resolve();

    expect(params.deleteAccountAndData).toHaveBeenCalled();
    expect(params.setAccountStatus).toHaveBeenCalledWith('Account and all data deleted.');
    expect(params.setScreen).toHaveBeenCalledWith('main');
    alertSpy.mockRestore();
  });
});
