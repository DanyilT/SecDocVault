/**
 * app/hooks/useAuthGateFlow.ts
 *
 * Low-level hook implementing the unlock/auth gate flow used by the app.
 * Handles transition flags and coordinates when to show passkey / pin unlock
 * screens vs full authentication screens.
 */

import { useMemo } from 'react';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppScreen } from '../navigation/constants';
import { AuthMode, AuthProtection } from '../../types/vault.ts';

type UseAuthGateFlowParams = {
  completeAuthPendingKey: string;
  authMode: AuthMode;
  accessMode: 'login' | 'guest';
  email: string;
  password: string;
  confirmPassword: string;
  emailVerifiedForRegistration: boolean;
  verificationLinkInput: string;
  verificationCooldown: number;
  authCredentialSnapshot: {email: string; password: string} | null;
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
  setAuthCredentialSnapshot: (value: {email: string; password: string} | null) => void;
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
  user: {email?: string | null} | null;
  preferredProtection: AuthProtection | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  resendVerificationEmail: (email: string) => Promise<boolean>;
  completeEmailLinkRegistration: (emailLink: string, expectedEmail: string) => Promise<boolean>;
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
  resolveVerificationLink: (value: string) => string;
};

export function useAuthGateFlow({
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
}: UseAuthGateFlowParams) {
  const canSubmitAuth = useMemo(() => {
    if (accessMode === 'guest') {
      const hasPassword = password.trim().length > 5;
      return authMode === 'register' ? hasPassword && password === confirmPassword : hasPassword;
    }

    const hasEmail = email.trim().length > 4;
    const hasPassword = password.trim().length > 5;
    return authMode === 'register'
      ? hasEmail && hasPassword && password === confirmPassword && emailVerifiedForRegistration
      : hasEmail && hasPassword;
  }, [accessMode, authMode, confirmPassword, email, emailVerifiedForRegistration, password]);

  const canUseUnlockButton =
    preferredProtection === 'passkey' ||
    preferredProtection === 'pin' ||
    preferredProtection === 'biometric';

  const requestGuestOverwriteConfirmation = () =>
    new Promise<boolean>(resolve => {
      Alert.alert(
        'Replace existing guest account?',
        'A guest account already exists on this device. Creating a new guest account will erase the previous guest vault data from this device.',
        [
          {text: 'Cancel', style: 'cancel', onPress: () => resolve(false)},
          {text: 'Erase & Create New', style: 'destructive', onPress: () => resolve(true)},
        ],
      );
    });

  const handleAuth = async () => {
    if (!canSubmitAuth) {
      return;
    }

    setIsCompletingAuthFlow(true);

    if (accessMode === 'login' && (user || isGuest)) {
      await signOut();
    }

    const isSuccess =
      accessMode === 'guest'
        ? authMode === 'register'
          ? await (async () => {
              if (guestAccountExists) {
                const confirm = await requestGuestOverwriteConfirmation();
                if (!confirm) {
                  return false;
                }
              }
              const created = await registerGuestAccount(password, guestAccountExists);
              if (created) {
                setGuestAccountExists(true);
              }
              return created;
            })()
          : await loginGuestAccount(password)
        : authMode === 'login'
          ? await signIn(email, password)
          : await signUp(email, password);

    if (!isSuccess) {
      setIsCompletingAuthFlow(false);
      return;
    }

    setAuthCredentialSnapshot({email: email.trim(), password});
    setShowCompleteAuthSetup(true);
    setHasUnlockedThisLaunch(true);
    setIsVaultLocked(false);
    void AsyncStorage.setItem(completeAuthPendingKey, '1');
  };

  const handleCompleteAuthSetup = async ({
    method,
    pin,
    useBiometricForPin,
  }: {
    method: AuthProtection;
    pin?: string;
    useBiometricForPin: boolean;
  }) => {
    const success = await updateUnlockMethod(method, {
      pin,
      pinBiometricEnabled: useBiometricForPin,
      firebaseEmail: authCredentialSnapshot?.email,
      firebasePassword: authCredentialSnapshot?.password,
    });
    if (!success) {
      return;
    }

    await AsyncStorage.removeItem(completeAuthPendingKey);
    setShowCompleteAuthSetup(false);
    setIsCompletingAuthFlow(false);
    resetAuthForm();
    setAuthCredentialSnapshot(null);
    setScreen('main');
    setHasUnlockedThisLaunch(true);
    setIsVaultLocked(false);
  };

  const handlePasskeyUnlock = async () => {
    if (isTransitioningToAuth) {
      return;
    }
    const success = await unlockWithSavedPasskey();
    if (success) {
      setHasUnlockedThisLaunch(true);
      setIsVaultLocked(false);
    }
  };

  const handleBiometricUnlock = async () => {
    if (isTransitioningToAuth) {
      return;
    }
    const success = await unlockWithBiometric();
    if (success) {
      setHasUnlockedThisLaunch(true);
      setIsVaultLocked(false);
    }
  };

  const handlePinUnlock = async (pin: string) => {
    if (isTransitioningToAuth) {
      return;
    }
    const success = await unlockWithPin(pin);
    if (success) {
      setHasUnlockedThisLaunch(true);
      setIsVaultLocked(false);
    }
  };

  const goToAuthForm = () => {
    setAccessMode('login');
    routeToAuth('unlock');
    clearError();
  };

  const switchAuthMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setEmailVerifiedForRegistration(false);
    setVerificationLinkInput('');
    setVerificationCooldown(0);
    setAuthNotice(null);
    clearError();
  };

  const handleGoToAuth = (mode: 'login' | 'guest') => {
    setAccessMode(mode);
    setEmailVerifiedForRegistration(false);
    setVerificationLinkInput('');
    setVerificationCooldown(0);
    setAuthNotice(null);
    routeToAuth('hero');
    clearError();
  };

  const returnFromAuth = () => {
    returnFromAuthGate();
    clearError();
  };

  const handleGoToAuthFromLocked = () => {
    if (isTransitioningToAuth) {
      return;
    }

    void (async () => {
      setIsTransitioningToAuth(true);
      setAuthReturnStage('unlock');
      clearError();
      try {
        await signOut();
        await AsyncStorage.removeItem(completeAuthPendingKey);
        setIsCompletingAuthFlow(false);
        resetAuthForm();
        setShowCompleteAuthSetup(false);
        setAuthCredentialSnapshot(null);
        setHasUnlockedThisLaunch(false);
        routeToAuth('unlock');
      } finally {
        setIsTransitioningToAuth(false);
      }
    })();
  };

  const handleUpgradeGuestToCloud = () => {
    if (!isGuest) {
      return;
    }

    void (async () => {
      await signOut();
      setScreen('main');
      setAuthReturnStage('hero');
      setAccessMode('login');
      setAuthMode('register');
      setAuthNotice('Upgrade to cloud by creating or signing in to a Cloud (Firebase) account.');
      setHasUnlockedThisLaunch(false);
      setIsVaultLocked(false);
      routeToAuth('hero');
    })();
  };

  const updateEmail = (value: string) => {
    setEmail(value);
    setEmailVerifiedForRegistration(false);
    setVerificationLinkInput('');
    setAuthNotice(null);
    clearError();
  };

  const updatePassword = (value: string) => {
    setPassword(value);
    setAuthNotice(null);
    clearError();
  };

  const updateConfirmPassword = (value: string) => {
    setConfirmPassword(value);
    setAuthNotice(null);
    clearError();
  };

  const handleResendVerificationEmail = async () => {
    if (verificationCooldown > 0) {
      return;
    }
    const success = await resendVerificationEmail(email);
    if (success) {
      setVerificationCooldown(60);
      setAuthNotice(null);
    }
  };

  const handleManualVerificationLink = async () => {
    const trimmedLink = verificationLinkInput.trim();
    if (!trimmedLink) {
      setAuthNotice('Paste the verification link from your email first.');
      return;
    }

    const resolved = resolveVerificationLink(trimmedLink);
    const success = await completeEmailLinkRegistration(resolved, email);
    if (!success) {
      return;
    }
    setEmailVerifiedForRegistration(true);
    setAccountStatus('Email verified. Continue by setting your password and tapping Create Account.');
    setAuthNotice(null);
  };

  const handleResetPassword = async () => {
    const targetEmail = user?.email ?? email.trim();
    if (!targetEmail) {
      setAccountStatus('Enter your email address first.');
      setAuthNotice('Enter your email address first.');
      return;
    }

    const success = await sendPasswordResetEmail(targetEmail);
    if (success) {
      setAccountStatus('Password reset email sent. Check your inbox.');
      setAuthNotice('Password reset email sent. Check your inbox.');
      return;
    }

    setAccountStatus('Unable to send password reset email. Try again after re-login.');
    setAuthNotice('Unable to send password reset email.');
  };

  return {
    canSubmitAuth,
    canUseUnlockButton,
    handleAuth,
    handleCompleteAuthSetup,
    handlePasskeyUnlock,
    handleBiometricUnlock,
    handlePinUnlock,
    goToAuthForm,
    switchAuthMode,
    handleGoToAuth,
    returnFromAuth,
    handleGoToAuthFromLocked,
    handleUpgradeGuestToCloud,
    updateEmail,
    updatePassword,
    updateConfirmPassword,
    handleResendVerificationEmail,
    handleManualVerificationLink,
    handleResetPassword,
  };
}
