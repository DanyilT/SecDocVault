import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Animated, AppState, BackHandler } from 'react-native';

const backPressHandlers: Array<() => boolean> = [];
const appStateHandlers: Array<(nextState: string) => void> = [];

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  removeItem: jest.fn(async () => undefined),
}));

import { useVaultLockLifecycle } from '../../../src/app/controllers/useVaultLockLifecycle';

function buildParams(overrides: Record<string, unknown> = {}) {
  return {
    completeAuthPendingKey: 'pending.key',
    isInitializing: false,
    transitionOpacity: {setValue: jest.fn()} as any,
    authGateStage: 'hero' as const,
    screen: 'main' as const,
    shareOriginScreen: 'main' as const,
    isAuthenticated: true,
    isVaultLocked: false,
    isCompletingAuthFlow: false,
    isTransitioningToAuth: false,
    shouldRequireUnlock: true,
    preferredProtection: 'passkey' as const,
    pendingUploadDraft: null,
    recoverableByDefault: false,
    uploadCanUseCloud: true,
    skipUploadDiscardWarning: false,
    setIsVaultLocked: jest.fn(),
    setIsTransitioningToAuth: jest.fn(),
    setIsCompletingAuthFlow: jest.fn(),
    setShowCompleteAuthSetup: jest.fn(),
    setAuthCredentialSnapshot: jest.fn(),
    setHasUnlockedThisLaunch: jest.fn(),
    setScreen: jest.fn(),
    setPendingUploadDraft: jest.fn(),
    setPendingUploadName: jest.fn(),
    setPendingUploadDescription: jest.fn(),
    setPendingUploadRecoverable: jest.fn(),
    setPendingUploadToCloud: jest.fn(),
    setPendingUploadAlsoSaveLocal: jest.fn(),
    setPendingUploadPreviewIndex: jest.fn(),
    setDontShowUploadDiscardWarningAgain: jest.fn(),
    setShowUploadDiscardWarning: jest.fn(),
    returnFromAuthGate: jest.fn(),
    routeToAuth: jest.fn(),
    resetAuthForm: jest.fn(),
    signOut: jest.fn(async () => undefined),
    updateUnlockMethod: jest.fn(async () => true),
    ...overrides,
  } as any;
}

function HookHarness({params}: {params: any}) {
  useVaultLockLifecycle(params);
  return null;
}

describe('useVaultLockLifecycle', () => {
  beforeEach(() => {
    backPressHandlers.length = 0;
    appStateHandlers.length = 0;
    jest.clearAllMocks();

    jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_event: any, handler: any) => {
      backPressHandlers.push(handler);
      return {remove: jest.fn()} as any;
    });

    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event: any, handler: any) => {
      appStateHandlers.push(handler);
      return {remove: jest.fn()} as any;
    });

    jest.spyOn(Animated, 'timing').mockImplementation(() => ({
      start: (callback?: () => void) => callback?.(),
    }) as any);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns from auth gate on hardware back when unauthenticated and auth stage active', () => {
    const params = buildParams({
      isAuthenticated: false,
      authGateStage: 'auth',
    });

    act(() => {
      TestRenderer.create(<HookHarness params={params} />);
    });

    const handled = backPressHandlers.at(-1)?.() ?? false;

    expect(handled).toBe(true);
    expect(params.returnFromAuthGate).toHaveBeenCalledTimes(1);
  });

  it('goes back to main from upload when no draft exists', () => {
    const params = buildParams({
      screen: 'upload',
      pendingUploadDraft: null,
    });

    act(() => {
      TestRenderer.create(<HookHarness params={params} />);
    });

    const handled = backPressHandlers.at(-1)?.() ?? false;

    expect(handled).toBe(true);
    expect(params.setScreen).toHaveBeenCalledWith('main');
  });

  it('shows discard warning from upload when draft exists and skip warning is disabled', () => {
    const params = buildParams({
      screen: 'upload',
      pendingUploadDraft: {name: 'Draft', description: '', files: [{name: 'a'}]},
      skipUploadDiscardWarning: false,
    });

    act(() => {
      TestRenderer.create(<HookHarness params={params} />);
    });

    const handled = backPressHandlers.at(-1)?.() ?? false;

    expect(handled).toBe(true);
    expect(params.setDontShowUploadDiscardWarningAgain).toHaveBeenCalledWith(false);
    expect(params.setShowUploadDiscardWarning).toHaveBeenCalledWith(true);
  });

  it('clears upload draft and returns to main when skip warning is enabled', () => {
    const params = buildParams({
      screen: 'upload',
      pendingUploadDraft: {name: 'Draft', description: '', files: [{name: 'a'}]},
      skipUploadDiscardWarning: true,
      recoverableByDefault: true,
      uploadCanUseCloud: true,
    });

    act(() => {
      TestRenderer.create(<HookHarness params={params} />);
    });

    const handled = backPressHandlers.at(-1)?.() ?? false;

    expect(handled).toBe(true);
    expect(params.setPendingUploadDraft).toHaveBeenCalledWith(null);
    expect(params.setPendingUploadName).toHaveBeenCalledWith('Document');
    expect(params.setPendingUploadDescription).toHaveBeenCalledWith('');
    expect(params.setPendingUploadRecoverable).toHaveBeenCalledWith(true);
    expect(params.setPendingUploadToCloud).toHaveBeenCalledWith(false);
    expect(params.setPendingUploadAlsoSaveLocal).toHaveBeenCalledWith(true);
    expect(params.setPendingUploadPreviewIndex).toHaveBeenCalledWith(0);
    expect(params.setScreen).toHaveBeenCalledWith('main');
  });
});
