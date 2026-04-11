export function resolveVerificationLink(incomingUrl: string): string {
  try {
    const isAppDeepLink = incomingUrl.startsWith('secdocvault://auth/email-link');

    if (!isAppDeepLink) {
      return incomingUrl;
    }

    const queryString = incomingUrl.split('?')[1] ?? '';
    const encodedLink = queryString
      .split('&')
      .map(item => item.split('='))
      .find(([key]) => decodeURIComponent(key) === 'link')?.[1];

    if (!encodedLink) {
      return '';
    }

    return decodeURIComponent(encodedLink);
  } catch {
    return incomingUrl;
  }
}

export function isVerificationCallbackUrl(incomingUrl: string): boolean {
  if (!incomingUrl.trim()) {
    return false;
  }

  if (incomingUrl.startsWith('secdocvault://auth/email-link')) {
    return true;
  }

  return incomingUrl.includes('/auth/email-link') || incomingUrl.includes('oobCode=');
}
