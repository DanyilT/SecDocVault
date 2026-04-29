/**
 * app/components/AuthGateRouter.tsx
 *
 * Small controller component that renders auth-related screens (hero, auth,
 * unlock) based on `authGateStage`. Keeps the boot/login UX decoupled from
 * the rest of the app so tests can exercise different entry points easily.
 */

import React from 'react';
import { ActivityIndicator, Animated, Text, View } from 'react-native';

import {
  AuthScreen,
  CompleteAuthScreen,
  IntroHeroScreen,
  UnlockScreen,
} from '../../screens';
import { styles } from '../../theme/styles';
import { AuthMode, AuthProtection } from '../../types/vault';
import { AuthGateStage } from '../navigation/routingReducer';

type AuthGateRouterProps = {
  isInitializing: boolean;
  firebaseProjectId: string;
  shouldShowCompleteAuthSetup: boolean;
  isAuthenticated: boolean;
  isVaultLocked: boolean;
  authGateStage: AuthGateStage;
  transitionOpacity: Animated.Value;
  transitionTranslateY: Animated.Value;
  preferredProtection: AuthProtection | null;
  pinBiometricEnabled: boolean;
  canUseUnlockButton: boolean;
  isSubmitting: boolean;
  isTransitioningToAuth: boolean;
  authError: string | null;
  onUnlock: () => Promise<void>;
  onUnlockWithPin: (pin: string) => Promise<void>;
  onGoToAuthFromUnlock: () => void;
  onGoToAuthFromLocked: () => void;
  onLogin: () => void;
  onGuest: () => void;
  authMode: AuthMode;
  email: string;
  password: string;
  confirmPassword: string;
  vaultPassphrase: string;
  confirmVaultPassphrase: string;
  canSubmitAuth: boolean;
  authNotice: string | null;
  emailVerifiedForRegistration: boolean;
  verificationCooldown: number;
  verificationLinkInput: string;
  accessMode: 'login' | 'guest';
  setAccessMode: (mode: 'login' | 'guest') => void;
  setAuthMode: (mode: AuthMode) => void;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setConfirmPassword: (value: string) => void;
  setVaultPassphrase: (value: string) => void;
  setConfirmVaultPassphrase: (value: string) => void;
  setVerificationLinkInput: (value: string) => void;
  onResendVerificationEmail: () => Promise<void>;
  onVerifyEmailLinkManually: () => Promise<void>;
  onResetPassword: () => Promise<void>;
  onAuth: () => Promise<void>;
  onBackToHero: () => void;
  onCompleteAuthSetup: (payload: {
    method: AuthProtection;
    pin?: string;
    useBiometricForPin: boolean;
  }) => Promise<void>;
};

/**
 * AuthGateRouter
 *
 * A router component that renders the appropriate AuthGate screen
 * based on the current `authGateStage` prop.
 *
 * It handles the flow between the intro hero, authentication, and unlock screens,
 * as well as the complete auth setup screen if needed.
 *
 * The router also handles the transition animation styles
 * and passes down necessary props and handlers to each screen.
 *
 * @param props - controlled props described by `AuthGateRouterProps`
 */
export function AuthGateRouter({
  isInitializing,
  firebaseProjectId,
  shouldShowCompleteAuthSetup,
  isAuthenticated,
  isVaultLocked,
  authGateStage,
  transitionOpacity,
  transitionTranslateY,
  preferredProtection,
  pinBiometricEnabled,
  canUseUnlockButton,
  isSubmitting,
  isTransitioningToAuth,
  authError,
  onUnlock,
  onUnlockWithPin,
  onGoToAuthFromUnlock,
  onGoToAuthFromLocked,
  onLogin,
  onGuest,
  authMode,
  email,
  password,
  confirmPassword,
  vaultPassphrase,
  confirmVaultPassphrase,
  canSubmitAuth,
  authNotice,
  emailVerifiedForRegistration,
  verificationCooldown,
  verificationLinkInput,
  accessMode,
  setAccessMode,
  setAuthMode,
  setEmail,
  setPassword,
  setConfirmPassword,
  setVaultPassphrase,
  setConfirmVaultPassphrase,
  setVerificationLinkInput,
  onResendVerificationEmail,
  onVerifyEmailLinkManually,
  onResetPassword,
  onAuth,
  onBackToHero,
  onCompleteAuthSetup,
}: AuthGateRouterProps) {
  const transitionContainerStyle = {
    flex: 1,
    opacity: transitionOpacity,
    transform: [{ translateY: transitionTranslateY }],
  };

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#60a5fa" />
        <Text style={styles.subtitle}>Connecting to Firebase project {firebaseProjectId}...</Text>
      </View>
    );
  }

  if (shouldShowCompleteAuthSetup) {
    return (
      <Animated.View style={transitionContainerStyle}>
        <CompleteAuthScreen
          isSubmitting={isSubmitting}
          authError={authError}
          onComplete={onCompleteAuthSetup}
        />
      </Animated.View>
    );
  }

  if (!isAuthenticated) {
    if (authGateStage === 'unlock') {
      return (
        <Animated.View style={transitionContainerStyle}>
          <UnlockScreen
            preferredProtection={preferredProtection}
            pinBiometricEnabled={pinBiometricEnabled}
            canUnlock={canUseUnlockButton}
            isSubmitting={isSubmitting}
            authError={authError}
            onUnlock={onUnlock}
            onUnlockWithPin={onUnlockWithPin}
            onGoToAuth={onGoToAuthFromUnlock}
          />
        </Animated.View>
      );
    }

    if (authGateStage === 'hero') {
      return (
        <Animated.View style={transitionContainerStyle}>
          <IntroHeroScreen onLogin={onLogin} onGuest={onGuest} />
        </Animated.View>
      );
    }

    return (
      <Animated.View style={transitionContainerStyle}>
        <AuthScreen
          authMode={authMode}
          email={email}
          password={password}
          confirmPassword={confirmPassword}
          vaultPassphrase={vaultPassphrase}
          confirmVaultPassphrase={confirmVaultPassphrase}
          canSubmitAuth={canSubmitAuth}
          isSubmitting={isSubmitting}
          authError={authError}
          authNotice={authNotice}
          emailVerifiedForRegistration={emailVerifiedForRegistration}
          verificationCooldown={verificationCooldown}
          verificationLinkInput={verificationLinkInput}
          accessMode={accessMode}
          setAccessMode={setAccessMode}
          setAuthMode={setAuthMode}
          setEmail={setEmail}
          setPassword={setPassword}
          setConfirmPassword={setConfirmPassword}
          setVaultPassphrase={setVaultPassphrase}
          setConfirmVaultPassphrase={setConfirmVaultPassphrase}
          setVerificationLinkInput={setVerificationLinkInput}
          onResendVerificationEmail={onResendVerificationEmail}
          onVerifyEmailLinkManually={onVerifyEmailLinkManually}
          onResetPassword={onResetPassword}
          handleAuth={onAuth}
          onBackToHero={onBackToHero}
        />
      </Animated.View>
    );
  }

  if (isVaultLocked) {
    return (
      <Animated.View style={transitionContainerStyle}>
        <UnlockScreen
          preferredProtection={preferredProtection}
          pinBiometricEnabled={pinBiometricEnabled}
          canUnlock={canUseUnlockButton}
          isSubmitting={isSubmitting || isTransitioningToAuth}
          authError={authError}
          onUnlock={onUnlock}
          onUnlockWithPin={onUnlockWithPin}
          onGoToAuth={onGoToAuthFromLocked}
        />
      </Animated.View>
    );
  }

  return null;
}
