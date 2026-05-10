import React from 'react';
import { AuthScreen } from '../../../src/screens/AuthScreen';
import { create } from 'react-test-renderer';

describe('AuthScreen Debug', () => {
  it('logs render error', () => {
    try {
      create(<AuthScreen
        authMode="login"
        email=""
        password=""
        confirmPassword=""
        vaultPassphrase=""
        canSubmitAuth={true}
        isSubmitting={false}
        authError={null}
        authNotice={null}
        emailVerifiedForRegistration={false}
        verificationCooldown={0}
        verificationLinkInput=""
        accessMode="login"
        setAccessMode={() => {}}
        setAuthMode={() => {}}
        setEmail={() => {}}
        setPassword={() => {}}
        setConfirmPassword={() => {}}
        setVaultPassphrase={() => {}}
        setVerificationLinkInput={() => {}}
        onResendVerificationEmail={async () => {}}
        onVerifyEmailLinkManually={async () => {}}
        onResetPassword={async () => {}}
        handleAuth={async () => {}}
        onBackToHero={() => {}}
      />);
    } catch (e) {
      console.log('CATCHED ERROR:', e);
      throw e;
    }
  });
});
