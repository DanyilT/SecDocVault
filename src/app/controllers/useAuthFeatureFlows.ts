/**
 * app/controllers/useAuthFeatureFlows.ts
 *
 * Encapsulates authentication related flows (email-link handling, verification,
 * passkey setup, basic validation) separating them from the main controller.
 * Provides helpers that `useAppController` consumes to implement the auth UI.
 */

import { useAuthGateFlow, useAuthLinkingFlow } from '../hooks';
import { isVerificationCallbackUrl, resolveVerificationLink } from '../navigation/urlVerification';
import { AuthMode, AuthProtection } from '../../types/vault';
import { AppScreen } from '../navigation/constants';

type UseAuthFeatureFlowsParams = {
  completeAuthPendingKey: string;
  authMode: AuthMode;
  accessMode: 'login' | 'guest';
  email: string;
  password: string;
  confirmPassword: string;
  emailVerifiedForRegistration: boolean;
  verificationLinkInput: string;
  verificationCooldown: number;
  authCredentialSnapshot: { email: string; password: string } | null;
  isTransitioningToAuth: boolean;
  setAuthMode: (mode: AuthMode) => void;
  setAccessMode: (mode: 'login' | 'guest') => void;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setConfirmPassword: (value: string) => void;
  setEmailVerifiedForRegistration: (value: boolean) => void;
  setVerificationLinkInput: (value: string) => void;
  setVerificationCooldown: (value: number) => void;
  setAuthNotice: (value: string | null) => void;
  setShowCompleteAuthSetup: (value: boolean) => void;
  setIsCompletingAuthFlow: (value: boolean) => void;
  setAuthCredentialSnapshot: (value: { email: string; password: string } | null) => void;
  setIsTransitioningToAuth: (value: boolean) => void;
  setHasUnlockedThisLaunch: (value: boolean) => void;
  setIsVaultLocked: (value: boolean) => void;
  setScreen: (screen: AppScreen) => void;
  setAuthReturnStage: (stage: 'hero' | 'unlock') => void;
  routeToAuth: (returnStage: 'hero' | 'unlock') => void;
  returnFromAuthGate: () => void;
  resetAuthForm: () => void;
  clearError: () => void;
  isGuest: boolean;
  user: { email?: string | null; uid?: string | null } | null;
  preferredProtection: AuthProtection | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  resendVerificationEmail: (email: string) => Promise<boolean>;
  completeEmailLinkRegistration: (verificationLink: string, email: string) => Promise<boolean>;
  sendPasswordResetEmail: (email: string) => Promise<boolean>;
  registerGuestAccount: (password: string, overwriteExisting?: boolean) => Promise<boolean>;
  loginGuestAccount: (password: string) => Promise<boolean>;
  unlockWithSavedPasskey: () => Promise<boolean>;
  unlockWithPin: (pin: string) => Promise<boolean>;
  unlockWithBiometric: () => Promise<boolean>;
  updateUnlockMethod: (
    protection: AuthProtection,
    options?: {
      pin?: string;
      pinBiometricEnabled?: boolean;
      firebaseEmail?: string;
      firebasePassword?: string;
    },
  ) => Promise<boolean>;
  signOut: () => Promise<void>;
  guestAccountExists: boolean;
  setGuestAccountExists: (value: boolean) => void;
  setAccountStatus: (value: string) => void;
};

/**
 * useAuthFeatureFlows
 *
 * Composes authentication-related feature flows by wiring `useAuthLinkingFlow`
 * and `useAuthGateFlow`. This helper centralizes auth logic so the main
 * controller stays focused on orchestration.
 *
 * @param params - collection of state setters and auth functions required to run auth flows
 * @returns the API returned by `useAuthGateFlow` (handlers and flags used by the controller)
 */
export function useAuthFeatureFlows({
  completeAuthPendingKey,
  authMode,
  accessMode,
  email,
  password,
  confirmPassword,
  emailVerifiedForRegistration,
  verificationLinkInput,
  verificationCooldown,
  authCredentialSnapshot,
  isTransitioningToAuth,
  setAuthMode,
  setAccessMode,
  setEmail,
  setPassword,
  setConfirmPassword,
  setEmailVerifiedForRegistration,
  setVerificationLinkInput,
  setVerificationCooldown,
  setAuthNotice,
  setShowCompleteAuthSetup,
  setIsCompletingAuthFlow,
  setAuthCredentialSnapshot,
  setIsTransitioningToAuth,
  setHasUnlockedThisLaunch,
  setIsVaultLocked,
  setScreen,
  setAuthReturnStage,
  routeToAuth,
  returnFromAuthGate,
  resetAuthForm,
  clearError,
  isGuest,
  user,
  preferredProtection,
  signIn,
  signUp,
  resendVerificationEmail,
  completeEmailLinkRegistration,
  sendPasswordResetEmail,
  registerGuestAccount,
  loginGuestAccount,
  unlockWithSavedPasskey,
  unlockWithPin,
  unlockWithBiometric,
  updateUnlockMethod,
  signOut,
  guestAccountExists,
  setGuestAccountExists,
  setAccountStatus,
}: UseAuthFeatureFlowsParams) {
  useAuthLinkingFlow({
    accessMode,
    authMode,
    email,
    isVerificationCallbackUrl,
    resolveVerificationLink,
    completeEmailLinkRegistration,
    setEmailVerifiedForRegistration,
    setAccountStatus,
    setAuthNotice,
  });

  return useAuthGateFlow({
    completeAuthPendingKey,
    authMode,
    accessMode,
    email,
    password,
    confirmPassword,
    emailVerifiedForRegistration,
    verificationLinkInput,
    verificationCooldown,
    authCredentialSnapshot,
    isTransitioningToAuth,
    setAuthMode,
    setAccessMode,
    setEmail,
    setPassword,
    setConfirmPassword,
    setEmailVerifiedForRegistration,
    setVerificationLinkInput,
    setVerificationCooldown,
    setAuthNotice,
    setShowCompleteAuthSetup,
    setIsCompletingAuthFlow,
    setAuthCredentialSnapshot,
    setIsTransitioningToAuth,
    setHasUnlockedThisLaunch,
    setIsVaultLocked,
    setScreen,
    setAuthReturnStage,
    routeToAuth,
    returnFromAuthGate,
    resetAuthForm,
    clearError,
    isGuest,
    user,
    preferredProtection,
    signIn,
    signUp,
    resendVerificationEmail,
    completeEmailLinkRegistration,
    sendPasswordResetEmail,
    registerGuestAccount,
    loginGuestAccount,
    unlockWithSavedPasskey,
    unlockWithPin,
    unlockWithBiometric,
    updateUnlockMethod,
    signOut,
    guestAccountExists,
    setGuestAccountExists,
    setAccountStatus,
    resolveVerificationLink,
  });
}
