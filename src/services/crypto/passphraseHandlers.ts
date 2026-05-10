/**
 * services/crypto/passphraseHandlers.ts
 *
 * Shared UI handlers for managing recovery passphrase input across auth and
 * settings screens. Centralizes sanitize/validate/generate logic with
 * consistent error messages so both screens behave identically.
 */

import {
  generateRecoveryPassphrase,
  sanitizeRecoveryPassphrase,
  validateRecoveryPassphrase,
} from './documentCrypto';

export type PassphraseChangeHandlers = {
  setPassphrase: (value: string) => void;
  setError: (value: string) => void;
};

export type PassphraseGenerateHandlers = {
  setPassphrase: (value: string) => void;
  setError: (value: string) => void;
  setConfirmPassphrase?: (value: string) => void;
  setActionFeedback?: (value: string) => void;
};

/**
 * Builds a passphrase change handler that sanitizes input and reports
 * validation errors via the supplied setters.
 *
 * @param handlers - State setters for passphrase value and error text
 * @returns A function suitable for `onChangeText`
 */
export function buildPassphraseChangeHandler({
  setPassphrase,
  setError,
}: PassphraseChangeHandlers) {
  return (value: string) => {
    const sanitized = sanitizeRecoveryPassphrase(value);
    setPassphrase(sanitized);

    if (!sanitized) {
      setError('');
      return;
    }

    if (!validateRecoveryPassphrase(sanitized)) {
      const words = sanitized.split('-').filter(w => w.length > 0).length;
      if (words !== 0 && words !== 5) {
        setError(
          `Passphrase must be exactly 5 words separated by hyphens (currently ${words}/5).`,
        );
      } else {
        setError(
          'Passphrase can only contain lowercase letters, numbers, and hyphens.',
        );
      }
      return;
    }

    setError('');
  };
}

/**
 * Builds a passphrase generation handler that fills the field with a freshly
 * generated random passphrase and clears any previous error/confirmation.
 *
 * @param handlers - State setters for passphrase, error and optional UI feedback
 * @returns A function with no arguments suitable for a button `onPress`
 */
export function buildPassphraseGenerateHandler({
  setPassphrase,
  setError,
  setConfirmPassphrase,
  setActionFeedback,
}: PassphraseGenerateHandlers) {
  return () => {
    try {
      const generated = generateRecoveryPassphrase();
      setPassphrase(generated);
      setConfirmPassphrase?.('');
      setError('');
      if (setActionFeedback) {
        setActionFeedback('Generated');
        setTimeout(() => setActionFeedback(''), 2000);
      }
    } catch {
      setError('Failed to generate passphrase.');
    }
  };
}
