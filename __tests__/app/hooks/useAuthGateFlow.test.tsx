import React, { forwardRef, useImperativeHandle } from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import { useAuthGateFlow } from '../../../src/app/hooks';
import { getAuth } from '@react-native-firebase/auth';

jest.mock('../../../src/services/crypto/documentCrypto', () => ({
  initUserKdfPassphrase: jest.fn(async () => undefined),
  validateRecoveryPassphrase: jest.fn(() => true),
}));

jest.mock('../../../src/services/keyBackup.ts', () => ({
  initRecoveryBackupOnFirebase: jest.fn(async () => undefined),
  checkIfKeyBackupExistsInFirebase: jest.fn(async () => false),
  getRecoveryPassphraseForSettings: jest.fn(async () => null),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

type HarnessRef = {
  getCanSubmitAuth: () => boolean;
  getCanUseUnlockButton: () => boolean;
  handleGoToAuth: (mode: 'login' | 'guest') => void;
  handleAuth: () => Promise<void>;
  handleCompleteAuthSetup: (payload: {method: 'passkey' | 'pin' | 'biometric'; pin?: string; useBiometricForPin: boolean}) => Promise<void>;
  handlePasskeyUnlock: () => Promise<void>;
  handleBiometricUnlock: () => Promise<void>;
  handlePinUnlock: (pin: string) => Promise<void>;
  handleManualVerificationLink: () => Promise<void>;
  handleResendVerificationEmail: () => Promise<void>;
  handleResetPassword: () => Promise<void>;
  handleUpgradeGuestToCloud: () => void;
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
    vaultPassphrase: 'vaultpass1',
    setVaultPassphrase: jest.fn(),
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
    setIsFromRegistration: jest.fn(),
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
    persistRecoveryPassphraseLocalOnly: jest.fn(async () => undefined),
    setKeyBackupEnabled: jest.fn(),
    setAutoSyncKeys: jest.fn(),
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
    handleAuth: api.handleAuth,
    handleCompleteAuthSetup: api.handleCompleteAuthSetup,
    handlePasskeyUnlock: api.handlePasskeyUnlock,
    handleBiometricUnlock: api.handleBiometricUnlock,
    handlePinUnlock: api.handlePinUnlock,
    handleManualVerificationLink: api.handleManualVerificationLink,
    handleResendVerificationEmail: api.handleResendVerificationEmail,
    handleResetPassword: api.handleResetPassword,
    handleUpgradeGuestToCloud: api.handleUpgradeGuestToCloud,
    handleGoToAuthFromLocked: api.handleGoToAuthFromLocked,
  }));

  return null;
});

describe('useAuthGateFlow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getAuth as unknown as jest.Mock).mockReturnValue({currentUser: null});
  });

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

  it('accepts a valid manual verification link', async () => {
    const params = buildParams({
      verificationLinkInput: '  https://example.com/link  ',
      resolveVerificationLink: jest.fn((value: string) => `${value}?resolved=1`),
      completeEmailLinkRegistration: jest.fn(async () => true),
    });
    const ref = React.createRef<HarnessRef>();

    act(() => {
      ReactTestRenderer.create(<Harness ref={ref} params={params} />);
    });

    await act(async () => {
      await ref.current?.handleManualVerificationLink();
    });

    expect(params.resolveVerificationLink).toHaveBeenCalledWith('https://example.com/link');
    expect(params.completeEmailLinkRegistration).toHaveBeenCalledWith('https://example.com/link?resolved=1', 'user@example.com');
    expect(params.setEmailVerifiedForRegistration).toHaveBeenCalledWith(true);
    expect(params.setAccountStatus).toHaveBeenCalledWith(
      'Email verified. Continue by setting your password and tapping Create Account.',
    );
  });

  it('supports guest account overwrite confirmation before registering', async () => {
    const alertSpy = jest.spyOn(require('react-native').Alert, 'alert').mockImplementation((_title, _message, buttons) => {
      const destructive = ((buttons ?? []) as Array<{style?: string; onPress?: () => void}>).find(
        button => button.style === 'destructive',
      );
      destructive?.onPress?.();
    });
    const params = buildParams({
      accessMode: 'guest',
      authMode: 'register',
      guestAccountExists: true,
      password: 'guestpw',
      confirmPassword: 'guestpw',
      signOut: jest.fn(async () => undefined),
      registerGuestAccount: jest.fn(async () => true),
    });
    const ref = React.createRef<HarnessRef>();

    act(() => {
      ReactTestRenderer.create(<Harness ref={ref} params={params} />);
    });

    await act(async () => {
      await ref.current?.handleAuth();
    });

    expect(alertSpy).toHaveBeenCalled();
    expect(params.registerGuestAccount).toHaveBeenCalledWith('guestpw', true);
    expect(params.setGuestAccountExists).toHaveBeenCalledWith(true);
  });

  it('initializes key-recovery state during cloud registration', async () => {
    const crypto = require('../../../src/services/crypto/documentCrypto');
    const keyBackup = require('../../../src/services/keyBackup.ts');
    (getAuth as unknown as jest.Mock).mockReturnValue({currentUser: {uid: 'uid-1'}});
    const params = buildParams({
      authMode: 'register',
      accessMode: 'login',
      enableKeyRecovery: true,
      vaultPassphrase: 'alpha beta gamma',
      password: 'secret1234',
      confirmPassword: 'secret1234',
      emailVerifiedForRegistration: true,
      persistRecoveryPassphraseLocalOnly: jest.fn(async () => undefined),
      setKeyBackupEnabled: jest.fn(),
      setAutoSyncKeys: jest.fn(),
      setAutoKeySyncEnabled: jest.fn(async () => undefined),
      saveVaultPreferences: jest.fn(async () => undefined),
      signUp: jest.fn(async () => true),
    });
    const ref = React.createRef<HarnessRef>();

    act(() => {
      ReactTestRenderer.create(<Harness ref={ref} params={params} />);
    });

    await act(async () => {
      await ref.current?.handleAuth();
    });

    expect(crypto.initUserKdfPassphrase).toHaveBeenCalledWith('alpha beta gamma');
    expect(params.persistRecoveryPassphraseLocalOnly).toHaveBeenCalledWith('alpha beta gamma');
    expect(params.setKeyBackupEnabled).toHaveBeenCalledWith(true);
    expect(params.setAutoSyncKeys).toHaveBeenCalledWith(true);
    expect(params.setAccountStatus).toHaveBeenCalledWith('Key backup enabled with your recovery passphrase.');
    expect(keyBackup.initRecoveryBackupOnFirebase).toHaveBeenCalledWith('uid-1', 'alpha beta gamma');
  });

  it('handles lock-screen auth routing and unlock actions', async () => {
    const params = buildParams({
      isTransitioningToAuth: false,
      preferredProtection: 'biometric',
      unlockWithSavedPasskey: jest.fn(async () => true),
      unlockWithBiometric: jest.fn(async () => true),
      unlockWithPin: jest.fn(async () => true),
      signOut: jest.fn(async () => undefined),
      isGuest: true,
    });
    const ref = React.createRef<HarnessRef>();

    act(() => {
      ReactTestRenderer.create(<Harness ref={ref} params={params} />);
    });

    await act(async () => {
      await ref.current?.handlePasskeyUnlock();
      await ref.current?.handleBiometricUnlock();
      await ref.current?.handlePinUnlock('1234');
    });

    expect(params.unlockWithSavedPasskey).toHaveBeenCalledTimes(1);
    expect(params.unlockWithBiometric).toHaveBeenCalledTimes(1);
    expect(params.unlockWithPin).toHaveBeenCalledWith('1234');
  });

  it('supports resend verification, reset password, and guest upgrade flows', async () => {
    const params = buildParams({
      verificationCooldown: 0,
      resendVerificationEmail: jest.fn(async () => true),
      sendPasswordResetEmail: jest.fn(async () => true),
      signOut: jest.fn(async () => undefined),
      isGuest: true,
      email: 'user@example.com',
      user: {email: null},
    });
    const ref = React.createRef<HarnessRef>();

    act(() => {
      ReactTestRenderer.create(<Harness ref={ref} params={params} />);
    });

    await act(async () => {
      await ref.current?.handleResendVerificationEmail();
      await ref.current?.handleResetPassword();
      ref.current?.handleUpgradeGuestToCloud();
    });

    expect(params.resendVerificationEmail).toHaveBeenCalledWith('user@example.com');
    expect(params.setVerificationCooldown).toHaveBeenCalledWith(60);
    expect(params.sendPasswordResetEmail).toHaveBeenCalledWith('user@example.com');
    expect(params.setAccountStatus).toHaveBeenCalledWith('Password reset email sent. Check your inbox.');
    expect(params.setAuthMode).toHaveBeenCalledWith('register');
    expect(params.setAccessMode).toHaveBeenCalledWith('login');
    expect(params.setAuthNotice).toHaveBeenCalledWith(
      'Upgrade to cloud by creating or signing in to a Cloud (Firebase) account.',
    );
  });
});
