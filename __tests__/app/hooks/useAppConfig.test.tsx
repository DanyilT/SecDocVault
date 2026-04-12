import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
}));

jest.mock('../../../src/storage/localVault', () => ({
  getIncomingShareDecisionStore: jest.fn(async () => ({})),
  getVaultPreferences: jest.fn(async () => ({
    saveOfflineByDefault: false,
    autoSyncKeys: false,
    keyBackupEnabled: false,
    recoverableByDefault: false,
  })),
}));

jest.mock('../../../src/services/keyBackup', () => ({
  getRecoveryPassphraseForSettings: jest.fn(async () => null),
  setAutoKeySyncEnabled: jest.fn(async () => undefined),
}));

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getIncomingShareDecisionStore, getVaultPreferences } from '../../../src/storage/localVault';
import { getRecoveryPassphraseForSettings, setAutoKeySyncEnabled } from '../../../src/services/keyBackup';
import { useAppConfig } from '../../../src/app/hooks';

type UseAppConfigResult = {
  incomingShareDecisionStore: Record<string, Record<string, 'accepted' | 'declined'>>;
  saveOfflineByDefault: boolean;
  recoverableByDefault: boolean;
  autoSyncKeys: boolean;
  keyBackupEnabled: boolean;
  recoveryPassphraseForSettings: string | null;
  skipUploadDiscardWarning: boolean;
};

const initialConfig: UseAppConfigResult = {
  incomingShareDecisionStore: {},
  saveOfflineByDefault: false,
  recoverableByDefault: false,
  autoSyncKeys: false,
  keyBackupEnabled: false,
  recoveryPassphraseForSettings: null,
  skipUploadDiscardWarning: false,
};

function HookHarness({
  params,
  onValue,
}: {
  params: Parameters<typeof useAppConfig>[0];
  onValue: (value: UseAppConfigResult) => void;
}) {
  const value = useAppConfig(params) as UseAppConfigResult;
  onValue(value);
  return null;
}

describe('useAppConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads persisted preferences and notifies guest account state', async () => {
    (getVaultPreferences as jest.Mock).mockResolvedValue({
      saveOfflineByDefault: true,
      autoSyncKeys: false,
      keyBackupEnabled: true,
      recoverableByDefault: true,
    });
    (getIncomingShareDecisionStore as jest.Mock).mockResolvedValue({u1: {doc1: 'accepted'}});
    (getRecoveryPassphraseForSettings as jest.Mock).mockResolvedValue('alpha beta');
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('1');

    const onGuestAccountChange = jest.fn();
    const hasGuestAccount = jest.fn(async () => true);
    let latest: UseAppConfigResult = initialConfig;

    await act(async () => {
      TestRenderer.create(
        <HookHarness
          params={{
            uploadDiscardWarningPrefKey: 'upload.warn.key',
            hasGuestAccount,
            onGuestAccountChange,
          }}
          onValue={value => {
            latest = value;
          }}
        />,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(setAutoKeySyncEnabled).toHaveBeenCalledWith(true);
    expect(onGuestAccountChange).toHaveBeenCalledWith(true);
    expect(latest.saveOfflineByDefault).toBe(true);
    expect(latest.recoverableByDefault).toBe(true);
    expect(latest.keyBackupEnabled).toBe(true);
    expect(latest.autoSyncKeys).toBe(true);
    expect(latest.skipUploadDiscardWarning).toBe(true);
    expect(latest.recoveryPassphraseForSettings).toBe('alpha beta');
    expect(latest.incomingShareDecisionStore).toEqual({u1: {doc1: 'accepted'}});
  });

  it('keeps skip warning disabled when storage flag is absent', async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    let latest: UseAppConfigResult = initialConfig;

    await act(async () => {
      TestRenderer.create(
        <HookHarness
          params={{
            uploadDiscardWarningPrefKey: 'upload.warn.key',
            hasGuestAccount: async () => false,
            onGuestAccountChange: jest.fn(),
          }}
          onValue={value => {
            latest = value;
          }}
        />,
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(latest.skipUploadDiscardWarning).toBe(false);
  });
});
