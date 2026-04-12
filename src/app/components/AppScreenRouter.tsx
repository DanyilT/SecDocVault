/**
 * app/components/AppScreenRouter.tsx
 *
 * Simplified in-memory router that renders one screen at a time based on the
 * `routing` prop. Kept intentionally lightweight for the example app - tests
 * can directly set the `routing.screen` prop to change views.
 */

import React from 'react';

import { AppScreen } from '../navigation/constants';
import { AuthGateStage } from '../navigation/routingReducer';
import { AuthGateRouter } from './AuthGateRouter';
import { VaultRouter } from './VaultRouter';

type AppScreenRouterProps = {
  screen: AppScreen;
  authGateStage: AuthGateStage;
  isInitializing: boolean;
  isAuthenticated: boolean;
  isVaultLocked: boolean;
  shouldShowCompleteAuthSetup: boolean;
  firebaseProjectId: string;
} & React.ComponentProps<typeof AuthGateRouter>
  & React.ComponentProps<typeof VaultRouter>;

/**
 * AppScreenRouter
 *
 * Choose which top-level router to render based on initialization, authentication
 * and vault lock state. While the app is initializing, requires auth setup, a
 * user is not authenticated, or the vault is locked, the authentication gate
 * (`AuthGateRouter`) is rendered and receives most of the forwarded props.
 * Otherwise, the authenticated vault UI (`VaultRouter`) is rendered and receives
 * the same forwarded props via spread.
 *
 * @param props - controlled props described by `AppScreenRouterProps`
 */
export function AppScreenRouter(props: AppScreenRouterProps) {
  const authGate = (
    <AuthGateRouter
      isInitializing={props.isInitializing}
      firebaseProjectId={props.firebaseProjectId}
      shouldShowCompleteAuthSetup={props.shouldShowCompleteAuthSetup}
      isAuthenticated={props.isAuthenticated}
      isVaultLocked={props.isVaultLocked}
      authGateStage={props.authGateStage}
      transitionOpacity={props.transitionOpacity}
      transitionTranslateY={props.transitionTranslateY}
      preferredProtection={props.preferredProtection}
      pinBiometricEnabled={props.pinBiometricEnabled}
      canUseUnlockButton={props.canUseUnlockButton}
      isSubmitting={props.isSubmitting}
      isTransitioningToAuth={props.isTransitioningToAuth}
      authError={props.authError}
      onUnlock={props.onUnlock}
      onUnlockWithPin={props.onUnlockWithPin}
      onGoToAuthFromUnlock={props.onGoToAuthFromUnlock}
      onGoToAuthFromLocked={props.onGoToAuthFromLocked}
      onLogin={props.onLogin}
      onGuest={props.onGuest}
      authMode={props.authMode}
      email={props.email}
      password={props.password}
      confirmPassword={props.confirmPassword}
      canSubmitAuth={props.canSubmitAuth}
      authNotice={props.authNotice}
      emailVerifiedForRegistration={props.emailVerifiedForRegistration}
      verificationCooldown={props.verificationCooldown}
      verificationLinkInput={props.verificationLinkInput}
      accessMode={props.accessMode}
      setAccessMode={props.setAccessMode}
      setAuthMode={props.setAuthMode}
      setEmail={props.setEmail}
      setPassword={props.setPassword}
      setConfirmPassword={props.setConfirmPassword}
      setVerificationLinkInput={props.setVerificationLinkInput}
      onResendVerificationEmail={props.onResendVerificationEmail}
      onVerifyEmailLinkManually={props.onVerifyEmailLinkManually}
      onResetPassword={props.onResetPassword}
      onAuth={props.onAuth}
      onBackToHero={props.onBackToHero}
      onCompleteAuthSetup={props.onCompleteAuthSetup}
    />
  );

  if (props.isInitializing || props.shouldShowCompleteAuthSetup || !props.isAuthenticated || props.isVaultLocked) {
    return authGate;
  }

  return <VaultRouter {...props} />;
}
