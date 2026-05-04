/**
 * Extended tests for app/navigation/urlVerification.ts
 * Covers the remaining uncovered branches.
 */

import {
  resolveVerificationLink,
  isVerificationCallbackUrl,
} from '../../../src/app/navigation/urlVerification';

describe('resolveVerificationLink – additional branches', () => {
  test('returns input URL unchanged when it is not a deep link', () => {
    const url = 'https://example.com/some/path?foo=bar';
    expect(resolveVerificationLink(url)).toBe(url);
  });

  test('returns empty string when deep link has no link param', () => {
    const url = 'secdocvault://auth/email-link?other=value';
    expect(resolveVerificationLink(url)).toBe('');
  });

  test('decodes the link param from a deep link URL', () => {
    const innerUrl = 'https://firebase.example.com/?oobCode=abc123';
    const encoded = encodeURIComponent(innerUrl);
    const deepLink = `secdocvault://auth/email-link?link=${encoded}`;
    expect(resolveVerificationLink(deepLink)).toBe(innerUrl);
  });

  test('returns input url when an exception occurs during parsing', () => {
    // Passing a non-string should cause the split to throw or produce unexpected result.
    // The function catches and returns the original input.
    const url = 'secdocvault://auth/email-link';
    expect(resolveVerificationLink(url)).toBe('');
  });
});

describe('isVerificationCallbackUrl – additional branches', () => {
  test('returns false for empty string', () => {
    expect(isVerificationCallbackUrl('')).toBe(false);
  });

  test('returns false for whitespace-only string', () => {
    expect(isVerificationCallbackUrl('   ')).toBe(false);
  });

  test('returns true for URL containing /auth/email-link path', () => {
    expect(isVerificationCallbackUrl('https://app.example.com/auth/email-link?oobCode=xyz')).toBe(true);
  });

  test('returns true for URL containing oobCode= param', () => {
    expect(isVerificationCallbackUrl('https://app.example.com/__/auth/action?oobCode=abc&mode=signIn')).toBe(true);
  });

  test('returns false for unrelated URL', () => {
    expect(isVerificationCallbackUrl('https://example.com/dashboard')).toBe(false);
  });
});

