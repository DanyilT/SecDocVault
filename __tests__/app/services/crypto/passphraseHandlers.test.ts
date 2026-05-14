/**
 * Tests for services/crypto/passphraseHandlers.ts
 */

import {
  buildPassphraseChangeHandler,
  buildPassphraseGenerateHandler,
} from '../../../../src/services/crypto/passphraseHandlers';

jest.mock('../../../../src/services/crypto/documentCrypto.ts', () => ({
  generateRecoveryPassphrase: jest.fn(() => 'test-pass-phrase-one-two'),
  sanitizeRecoveryPassphrase: jest.fn((x: string) => {
    // Keep the input as-is for testing, but lowercase it
    // The actual implementation would remove invalid chars, but we want to test validation
    return x.toLowerCase().trim();
  }),
  validateRecoveryPassphrase: jest.fn((x: string) => {
    const normalized = String(x).trim();
    if (!normalized) return false;
    if (!/^[a-z0-9-]+$/.test(normalized)) return false;
    const words = normalized.split('-');
    if (words.length !== 5) return false;
    return words.every(word => word.length > 0);
  }),
}));

describe('passphraseHandlers', () => {
  describe('buildPassphraseChangeHandler', () => {
    test('clears error when passphrase is empty', () => {
      const setPassphrase = jest.fn();
      const setError = jest.fn();

      const handler = buildPassphraseChangeHandler({
        setPassphrase,
        setError,
      });

      handler('');

      expect(setPassphrase).toHaveBeenCalledWith('');
      expect(setError).toHaveBeenCalledWith('');
    });

    test('clears error for valid passphrase', () => {
      const setPassphrase = jest.fn();
      const setError = jest.fn();

      const handler = buildPassphraseChangeHandler({
        setPassphrase,
        setError,
      });

      handler('test-pass-phrase-one-two');

      expect(setPassphrase).toHaveBeenCalledWith('test-pass-phrase-one-two');
      expect(setError).toHaveBeenCalledWith('');
    });

    test('sets error for passphrase with wrong character count', () => {
      const setPassphrase = jest.fn();
      const setError = jest.fn();

      const handler = buildPassphraseChangeHandler({
        setPassphrase,
        setError,
      });

      handler('test-pass-phrase-one');

      expect(setPassphrase).toHaveBeenCalled();
      expect(setError).toHaveBeenCalledWith(
        expect.stringContaining('exactly 5 words'),
      );
    });

    test('sets error for passphrase with invalid characters', () => {
      const setPassphrase = jest.fn();
      const setError = jest.fn();

      const handler = buildPassphraseChangeHandler({
        setPassphrase,
        setError,
      });

      handler('test!pass-phrase-one-two');

      expect(setPassphrase).toHaveBeenCalled();
      // Since the input splits to 4 words with the hyphen, it reports word count first
      expect(setError).toHaveBeenCalledWith(
        'Passphrase must be exactly 5 words separated by hyphens (currently 4/5).',
      );
    });

    test('sets error for 5-word passphrase with invalid characters', () => {
      const setPassphrase = jest.fn();
      const setError = jest.fn();

      const handler = buildPassphraseChangeHandler({
        setPassphrase,
        setError,
      });

      handler('test-pass-phrase-one-two!');

      expect(setPassphrase).toHaveBeenCalled();
      // 5 words but invalid character (exclamation mark) triggers character validation error
      expect(setError).toHaveBeenCalledWith(
        'Passphrase can only contain lowercase letters, numbers, and hyphens.',
      );
    });

    test('counts words correctly in error message', () => {
      const setPassphrase = jest.fn();
      const setError = jest.fn();

      const handler = buildPassphraseChangeHandler({
        setPassphrase,
        setError,
      });

      handler('one-two-three');

      expect(setError).toHaveBeenCalledWith(
        'Passphrase must be exactly 5 words separated by hyphens (currently 3/5).',
      );
    });

    test('handles consecutive hyphens correctly', () => {
      const setPassphrase = jest.fn();
      const setError = jest.fn();

      const handler = buildPassphraseChangeHandler({
        setPassphrase,
        setError,
      });

      handler('test--pass-phrase-one-two');

      expect(setPassphrase).toHaveBeenCalled();
      // Double hyphens fail validation due to regex pattern [a-z0-9-]+ not allowing empty segments
      expect(setError).toHaveBeenCalledWith(
        'Passphrase can only contain lowercase letters, numbers, and hyphens.',
      );
    });
  });

  describe('buildPassphraseGenerateHandler', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('generates and sets passphrase', () => {
      const setPassphrase = jest.fn();
      const setError = jest.fn();

      const handler = buildPassphraseGenerateHandler({
        setPassphrase,
        setError,
      });

      handler();

      expect(setPassphrase).toHaveBeenCalledWith('test-pass-phrase-one-two');
      expect(setError).toHaveBeenCalledWith('');
    });

    test('clears confirm passphrase if provided', () => {
      const setPassphrase = jest.fn();
      const setError = jest.fn();
      const setConfirmPassphrase = jest.fn();

      const handler = buildPassphraseGenerateHandler({
        setPassphrase,
        setError,
        setConfirmPassphrase,
      });

      handler();

      expect(setConfirmPassphrase).toHaveBeenCalledWith('');
    });

    test('sets action feedback if provided', () => {
      const setPassphrase = jest.fn();
      const setError = jest.fn();
      const setActionFeedback = jest.fn();

      const handler = buildPassphraseGenerateHandler({
        setPassphrase,
        setError,
        setActionFeedback,
      });

      handler();

      expect(setActionFeedback).toHaveBeenCalledWith('Generated');
    });

    test('clears action feedback after 2 seconds', () => {
      const setPassphrase = jest.fn();
      const setError = jest.fn();
      const setActionFeedback = jest.fn();

      const handler = buildPassphraseGenerateHandler({
        setPassphrase,
        setError,
        setActionFeedback,
      });

      handler();

      expect(setActionFeedback).toHaveBeenCalledWith('Generated');

      jest.advanceTimersByTime(2000);

      expect(setActionFeedback).toHaveBeenCalledWith('');
    });

    test('handles generation errors gracefully', () => {
      const crypto = require('../../../../src/services/crypto/documentCrypto.ts');
      (crypto.generateRecoveryPassphrase as jest.Mock).mockImplementationOnce(
        () => {
          throw new Error('Generation failed');
        },
      );

      const setPassphrase = jest.fn();
      const setError = jest.fn();

      const handler = buildPassphraseGenerateHandler({
        setPassphrase,
        setError,
      });

      handler();

      expect(setError).toHaveBeenCalledWith('Failed to generate passphrase.');
      expect(setPassphrase).not.toHaveBeenCalled();
    });

    test('does not require setConfirmPassphrase handler', () => {
      const setPassphrase = jest.fn();
      const setError = jest.fn();

      const handler = buildPassphraseGenerateHandler({
        setPassphrase,
        setError,
      });

      // Should not throw
      expect(() => handler()).not.toThrow();
      expect(setPassphrase).toHaveBeenCalled();
    });

    test('does not require setActionFeedback handler', () => {
      const setPassphrase = jest.fn();
      const setError = jest.fn();

      const handler = buildPassphraseGenerateHandler({
        setPassphrase,
        setError,
      });

      // Should not throw
      expect(() => handler()).not.toThrow();
      expect(setPassphrase).toHaveBeenCalled();
    });
  });
});
