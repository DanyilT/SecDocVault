import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.mock('../../../src/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('react-native', () => {
  let storedCb: ((s: string) => void) | null = null;
  return {
    AppState: {
      currentState: 'active',
      addEventListener: (_: string, cb: (s: string) => void) => {
        storedCb = cb;
        return { remove: jest.fn() };
      },
      __trigger: (next: string) => {
        if (storedCb) storedCb(next);
      },
    },
  };
});

import { VaultLockProvider, useVaultLock } from '../../../src/context/VaultLockContext';
import { useAuth } from '../../../src/context/AuthContext';
import { AppState } from 'react-native';

type AppStateWithTrigger = typeof AppState & { __trigger: (next: string) => void };

describe('VaultLockContext', () => {
  afterEach(() => jest.resetAllMocks());

  function Probe() {
    const ctx = useVaultLock();
    // @ts-ignore
    (Probe as any).latest = ctx;
    return null;
  }

  test('lock/unlock and setup flows when authenticated', async () => {
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    await act(async () => {
      TestRenderer.create(
        <VaultLockProvider>
          <Probe />
        </VaultLockProvider>,
      );
    });

    expect((Probe as any).latest.isVaultLocked).toBe(true); // authenticated but not unlocked yet

    act(() => (Probe as any).latest.unlockVault());
    expect((Probe as any).latest.hasUnlockedThisLaunch).toBe(true);
    expect((Probe as any).latest.isVaultLocked).toBe(false);

    act(() => (Probe as any).latest.lockVault());
    expect((Probe as any).latest.hasUnlockedThisLaunch).toBe(false);
    expect((Probe as any).latest.isVaultLocked).toBe(true);

    // start/finish auth setup
    act(() => (Probe as any).latest.startAuthSetup());
    expect((Probe as any).latest.isCompletingAuthSetup).toBe(true);
    act(() => (Probe as any).latest.finishAuthSetup());
    expect((Probe as any).latest.isCompletingAuthSetup).toBe(false);
    expect((Probe as any).latest.hasUnlockedThisLaunch).toBe(true);
  });

  test('app state backgrounding locks vault when picking not in progress', async () => {
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: true });

    await act(async () => {
      TestRenderer.create(
        <VaultLockProvider>
          <Probe />
        </VaultLockProvider>,
      );
    });

    act(() => (Probe as any).latest.unlockVault());
    expect((Probe as any).latest.hasUnlockedThisLaunch).toBe(true);

    // trigger app state change to background
    await act(async () => {
      (AppState as AppStateWithTrigger).__trigger('background');
    });
    // effect runs synchronously within act, so value should update
    expect((Probe as any).latest.hasUnlockedThisLaunch).toBe(false);
  });

  test('when not authenticated vault remains locked=false', async () => {
    (useAuth as jest.Mock).mockReturnValue({ isAuthenticated: false });

    await act(async () => {
      TestRenderer.create(
        <VaultLockProvider>
          <Probe />
        </VaultLockProvider>,
      );
    });

    expect((Probe as any).latest.isVaultLocked).toBe(false);
    act(() => (Probe as any).latest.unlockVault());
    expect((Probe as any).latest.hasUnlockedThisLaunch).toBe(true);
    // still not considered locked because not authenticated
    expect((Probe as any).latest.isVaultLocked).toBe(false);
  });
});
