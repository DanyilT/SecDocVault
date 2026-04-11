import { useAuthFeatureFlows } from '../../../src/app/controllers/useAuthFeatureFlows';
import { resolveVerificationLink } from '../../../src/app/navigation/urlVerification';

const mockUseAuthLinkingFlow = jest.fn();
const mockUseAuthGateFlow = jest.fn(_props => ({
  canSubmitAuth: true,
  handleAuth: jest.fn(async () => undefined),
}));

jest.mock('../../../src/app/hooks', () => ({
  useAuthLinkingFlow: (params: any) => mockUseAuthLinkingFlow(params),
  useAuthGateFlow: (params: any) => mockUseAuthGateFlow(params),
}));

function baseParams(overrides: Record<string, unknown> = {}) {
  return {
    completeAuthPendingKey: 'pending.key',
    authMode: 'login',
    accessMode: 'login',
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
    user: {email: 'user@example.com', uid: 'u1'},
    preferredProtection: 'passkey',
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
    ...overrides,
  } as any;
}

describe('useAuthFeatureFlows', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('wires auth linking flow with verification helpers and account status setters', () => {
    const params = baseParams();
    useAuthFeatureFlows(params);

    expect(mockUseAuthLinkingFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        accessMode: 'login',
        authMode: 'login',
        email: 'user@example.com',
        isVerificationCallbackUrl: expect.any(Function),
        resolveVerificationLink: expect.any(Function),
        completeEmailLinkRegistration: params.completeEmailLinkRegistration,
        setEmailVerifiedForRegistration: params.setEmailVerifiedForRegistration,
        setAccountStatus: params.setAccountStatus,
        setAuthNotice: params.setAuthNotice,
      }),
    );
  });

  it('forwards all auth gate dependencies and returns auth gate flow API', () => {
    const params = baseParams();
    const result = useAuthFeatureFlows(params);

    expect(mockUseAuthGateFlow).toHaveBeenCalledWith(
      expect.objectContaining({
        completeAuthPendingKey: 'pending.key',
        authMode: 'login',
        accessMode: 'login',
        signIn: params.signIn,
        signOut: params.signOut,
        resolveVerificationLink,
      }),
    );
    expect(result).toEqual({
      canSubmitAuth: true,
      handleAuth: expect.any(Function),
    });
  });
});
