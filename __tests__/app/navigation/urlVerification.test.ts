import { isVerificationCallbackUrl, resolveVerificationLink } from '../../../src/app/navigation/urlVerification';

describe('urlVerification', () => {
  it('returns decoded link from app deep link callback', () => {
    const encoded = encodeURIComponent('https://project.firebaseapp.com/auth/email-link?oobCode=abc');
    const deepLink = `secdocvault://auth/email-link?link=${encoded}`;

    expect(resolveVerificationLink(deepLink)).toBe('https://project.firebaseapp.com/auth/email-link?oobCode=abc');
  });

  it('returns original url when it is not app deep link format', () => {
    const normalUrl = 'https://example.com/auth/email-link?oobCode=abc';
    expect(resolveVerificationLink(normalUrl)).toBe(normalUrl);
  });

  it('identifies callback urls across supported formats', () => {
    expect(isVerificationCallbackUrl('secdocvault://auth/email-link?link=abc')).toBe(true);
    expect(isVerificationCallbackUrl('https://example.com/auth/email-link?mode=signIn')).toBe(true);
    expect(isVerificationCallbackUrl('https://example.com/?oobCode=abc')).toBe(true);
    expect(isVerificationCallbackUrl('https://example.com/home')).toBe(false);
    expect(isVerificationCallbackUrl('')).toBe(false);
  });
});
