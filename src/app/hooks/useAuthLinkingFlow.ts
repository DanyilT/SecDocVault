import { useEffect } from 'react';
import { Linking } from 'react-native';

type UseAuthLinkingFlowParams = {
  accessMode: 'login' | 'guest';
  authMode: 'login' | 'register';
  email: string;
  isVerificationCallbackUrl: (url: string) => boolean;
  resolveVerificationLink: (incomingUrl: string) => string;
  completeEmailLinkRegistration: (verificationLink: string, email: string) => Promise<boolean>;
  setEmailVerifiedForRegistration: (value: boolean) => void;
  setAccountStatus: (value: string) => void;
  setAuthNotice: (value: string | null) => void;
};

export function useAuthLinkingFlow({
  accessMode,
  authMode,
  email,
  isVerificationCallbackUrl,
  resolveVerificationLink,
  completeEmailLinkRegistration,
  setEmailVerifiedForRegistration,
  setAccountStatus,
  setAuthNotice,
}: UseAuthLinkingFlowParams) {
  useEffect(() => {
    if (accessMode !== 'login') {
      return;
    }

    const handlePotentialVerificationLink = async (url: string) => {
      if (!isVerificationCallbackUrl(url)) {
        return;
      }

      const verificationLink = resolveVerificationLink(url);
      if (!verificationLink) {
        return;
      }

      const success = await completeEmailLinkRegistration(verificationLink, email);
      if (!success) {
        return;
      }

      setEmailVerifiedForRegistration(true);
      setAccountStatus('Email verified. Continue by setting your password and tapping Create Account.');
      setAuthNotice(null);
    };

    void (async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        void handlePotentialVerificationLink(initialUrl);
      }
    })();

    const subscription = Linking.addEventListener('url', event => {
      void handlePotentialVerificationLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, [
    accessMode,
    authMode,
    completeEmailLinkRegistration,
    email,
    isVerificationCallbackUrl,
    resolveVerificationLink,
    setAccountStatus,
    setAuthNotice,
    setEmailVerifiedForRegistration,
  ]);
}
