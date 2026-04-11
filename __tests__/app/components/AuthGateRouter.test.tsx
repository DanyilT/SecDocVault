import React from 'react';
import TestRenderer from 'react-test-renderer';
const { act } = TestRenderer;

import { AuthGateRouter } from '../../../src/app/components/AuthGateRouter';

const mockAuthScreen = jest.fn(_props => null);
const mockCompleteAuthScreen = jest.fn(_props => null);
const mockIntroHeroScreen = jest.fn(_props => null);
const mockUnlockScreen = jest.fn(_props => null);

jest.mock('../../../src/screens', () => ({
  AuthScreen: (props: any) => mockAuthScreen(props),
  CompleteAuthScreen: (props: any) => mockCompleteAuthScreen(props),
  IntroHeroScreen: (props: any) => mockIntroHeroScreen(props),
  UnlockScreen: (props: any) => mockUnlockScreen(props),
}));

function baseProps(overrides: Record<string, unknown> = {}) {
  return {
    isInitializing: false,
    firebaseProjectId: 'demo-project',
    shouldShowCompleteAuthSetup: false,
    isAuthenticated: false,
    isVaultLocked: false,
    authGateStage: 'hero',
    transitionOpacity: {setValue: jest.fn()},
    transitionTranslateY: {setValue: jest.fn()},
    preferredProtection: 'passkey',
    pinBiometricEnabled: false,
    canUseUnlockButton: true,
    isSubmitting: false,
    isTransitioningToAuth: false,
    authError: null,
    onUnlock: jest.fn(async () => undefined),
    onUnlockWithPin: jest.fn(async () => undefined),
    onGoToAuthFromUnlock: jest.fn(),
    onGoToAuthFromLocked: jest.fn(),
    onLogin: jest.fn(),
    onGuest: jest.fn(),
    authMode: 'login',
    email: '',
    password: '',
    confirmPassword: '',
    canSubmitAuth: false,
    authNotice: null,
    emailVerifiedForRegistration: false,
    verificationCooldown: 0,
    verificationLinkInput: '',
    accessMode: 'login',
    setAccessMode: jest.fn(),
    setAuthMode: jest.fn(),
    setEmail: jest.fn(),
    setPassword: jest.fn(),
    setConfirmPassword: jest.fn(),
    setVerificationLinkInput: jest.fn(),
    onResendVerificationEmail: jest.fn(async () => undefined),
    onVerifyEmailLinkManually: jest.fn(async () => undefined),
    onResetPassword: jest.fn(async () => undefined),
    onAuth: jest.fn(async () => undefined),
    onBackToHero: jest.fn(),
    onCompleteAuthSetup: jest.fn(async () => undefined),
    ...overrides,
  } as any;
}

describe('AuthGateRouter', () => {
  const renderRouter = (props: any) => {
    act(() => {
      TestRenderer.create(<AuthGateRouter {...props} />);
    });
  };

  beforeEach(() => {
    mockAuthScreen.mockClear();
    mockCompleteAuthScreen.mockClear();
    mockIntroHeroScreen.mockClear();
    mockUnlockScreen.mockClear();
  });

  it('renders complete setup screen when setup is required', () => {
    renderRouter(
      baseProps({
        shouldShowCompleteAuthSetup: true,
      }),
    );

    expect(mockCompleteAuthScreen).toHaveBeenCalledTimes(1);
    expect(mockAuthScreen).not.toHaveBeenCalled();
  });

  it('renders hero screen when unauthenticated and gate stage is hero', () => {
    renderRouter(
      baseProps({
        isAuthenticated: false,
        authGateStage: 'hero',
      }),
    );

    expect(mockIntroHeroScreen).toHaveBeenCalledTimes(1);
    expect(mockUnlockScreen).not.toHaveBeenCalled();
  });

  it('renders unlock screen with locked-auth handler when authenticated and vault locked', () => {
    const props = baseProps({
      isAuthenticated: true,
      isVaultLocked: true,
      isSubmitting: false,
      isTransitioningToAuth: true,
    });

    renderRouter(props);

    expect(mockUnlockScreen).toHaveBeenCalledTimes(1);
    expect(mockUnlockScreen.mock.calls[0][0].onGoToAuth).toBe(props.onGoToAuthFromLocked);
    expect(mockUnlockScreen.mock.calls[0][0].isSubmitting).toBe(true);
  });
});
