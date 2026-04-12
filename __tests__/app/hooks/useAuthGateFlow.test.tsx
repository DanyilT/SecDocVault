import React, { forwardRef, useImperativeHandle } from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { useAuthGateFlow } from '../../../src/app/hooks';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

type HarnessRef = {
  getCanSubmitAuth: () => boolean;
  getCanUseUnlockButton: () => boolean;
  handleGoToAuth: (mode: 'login' | 'guest') => void;
  handleManualVerificationLink: () => Promise<void>;
  handleGoToAuthFromLocked: () => void;
};

function buildParams(overrides: Record<string, unknown> = {}) {
  const base = {
    completeAuthPendingKey: 'pending.key',
    authMode: 'login' as const,
    accessMode: 'login' as const,
    email: 'user@example.com',
    password: 'secret123',
    confirmPassword: 'secret123',
    emailVerifiedForRegistration: false,
    verificationLinkInput: '',
    verificationCooldown: 0,
    authCredentialSnapshot: null,
    isTransitioningToAuth: false,
    setAuthMode: jest.fn(),
    setAccessMode: jest.fn(),
    setEmail: jest.fn(),
    setPassword: jest.fn(),
    setConfirmPassword: jest.fn(),
    setEmailVerifiedForRegistration: jest.fn(),
    setVerificationLinkInput: jest.fn(),
    setVerificationCooldown: jest.fn(),
    setAuthNotice: jest.fn(),
    setShowCompleteAuthSetup: jest.fn(),
    setIsCompletingAuthFlow: jest.fn(),
    setAuthCredentialSnapshot: jest.fn(),
    setIsTransitioningToAuth: jest.fn(),
    setHasUnlockedThisLaunch: jest.fn(),
    setIsVaultLocked: jest.fn(),
    setScreen: jest.fn(),
    setAuthReturnStage: jest.fn(),
    routeToAuth: jest.fn(),
    returnFromAuthGate: jest.fn(),
    resetAuthForm: jest.fn(),
    clearError: jest.fn(),
    isGuest: false,
    user: {email: 'user@example.com'},
    preferredProtection: 'pin' as const,
    signIn: jest.fn(async () => true),
    signUp: jest.fn(async () => true),
    resendVerificationEmail: jest.fn(async () => true),
    completeEmailLinkRegistration: jest.fn(async () => true),
    sendPasswordResetEmail: jest.fn(async () => true),
    registerGuestAccount: jest.fn(async () => true),
    loginGuestAccount: jest.fn(async () => true),
    unlockWithSavedPasskey: jest.fn(async () => true),
    unlockWithPin: jest.fn(async () => true),
    unlockWithBiometric: jest.fn(async () => true),
    updateUnlockMethod: jest.fn(async () => true),
    signOut: jest.fn(async () => undefined),
    guestAccountExists: false,
    setGuestAccountExists: jest.fn(),
    setAccountStatus: jest.fn(),
    resolveVerificationLink: jest.fn((value: string) => value),
  };

  return {
    ...base,
    ...overrides,
  };
}

const Harness = forwardRef<HarnessRef, {params: ReturnType<typeof buildParams>}>(({params}, ref) => {
  const api = useAuthGateFlow(params);

  useImperativeHandle(ref, () => ({
    getCanSubmitAuth: () => api.canSubmitAuth,
    getCanUseUnlockButton: () => api.canUseUnlockButton,
    handleGoToAuth: api.handleGoToAuth,
    handleManualVerificationLink: api.handleManualVerificationLink,
    handleGoToAuthFromLocked: api.handleGoToAuthFromLocked,
  }));

  return null;
});

describe('useAuthGateFlow', () => {
  it('computes canSubmitAuth for login mode', () => {
    const params = buildParams();
    const ref = React.createRef<HarnessRef>();

    act(() => {
      ReactTestRenderer.create(<Harness ref={ref} params={params} />);
    });

    expect(ref.current?.getCanSubmitAuth()).toBe(true);
    expect(ref.current?.getCanUseUnlockButton()).toBe(true);
  });

  it('navigates to auth hero and clears errors', () => {
    const params = buildParams();
    const ref = React.createRef<HarnessRef>();

    act(() => {
      ReactTestRenderer.create(<Harness ref={ref} params={params} />);
    });

    act(() => {
      ref.current?.handleGoToAuth('guest');
    });

    expect(params.routeToAuth).toHaveBeenCalledWith('hero');
    expect(params.clearError).toHaveBeenCalled();
  });

  it('sets auth notice when manual verification link is empty', async () => {
    const params = buildParams({verificationLinkInput: ''});
    const ref = React.createRef<HarnessRef>();

    act(() => {
      ReactTestRenderer.create(<Harness ref={ref} params={params} />);
    });

    await act(async () => {
      await ref.current?.handleManualVerificationLink();
    });

    expect(params.setAuthNotice).toHaveBeenCalledWith('Paste the verification link from your email first.');
  });
});
