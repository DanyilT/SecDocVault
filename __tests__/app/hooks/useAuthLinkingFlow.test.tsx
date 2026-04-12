import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';
import { Linking } from 'react-native';

import { useAuthLinkingFlow } from '../../../src/app/hooks';

type Params = Parameters<typeof useAuthLinkingFlow>[0];

type UrlListener = (event: {url: string}) => void;
let urlListener: UrlListener | null = null;

function buildParams(overrides: Record<string, unknown> = {}): Params {
  return {
    accessMode: 'login',
    authMode: 'register',
    email: 'user@example.com',
    isVerificationCallbackUrl: jest.fn(() => true),
    resolveVerificationLink: jest.fn(() => 'https://verified/link?oobCode=abc'),
    completeEmailLinkRegistration: jest.fn(async () => true),
    setEmailVerifiedForRegistration: jest.fn(),
    setAccountStatus: jest.fn(),
    setAuthNotice: jest.fn(),
    ...overrides,
  } as Params;
}

function HookHarness({params}: {params: Params}) {
  useAuthLinkingFlow(params);
  return null;
}

describe('useAuthLinkingFlow', () => {
  beforeEach(() => {
    urlListener = null;
    jest.clearAllMocks();

    jest.spyOn(Linking, 'getInitialURL').mockResolvedValue(null);
    jest.spyOn(Linking, 'addEventListener').mockImplementation((_type: any, cb: any) => {
      urlListener = cb;
      return {remove: jest.fn()} as any;
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('verifies and updates auth status from initial url callback', async () => {
    const params = buildParams();
    (Linking.getInitialURL as jest.Mock).mockResolvedValue('secdocvault://auth/email-link?link=x');

    await act(async () => {
      TestRenderer.create(<HookHarness params={params} />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(params.completeEmailLinkRegistration).toHaveBeenCalledWith('https://verified/link?oobCode=abc', 'user@example.com');
    expect(params.setEmailVerifiedForRegistration).toHaveBeenCalledWith(true);
    expect(params.setAuthNotice).toHaveBeenCalledWith(null);
  });

  it('ignores non-verification event urls', async () => {
    const params = buildParams({
      isVerificationCallbackUrl: jest.fn(() => false),
    });

    await act(async () => {
      TestRenderer.create(<HookHarness params={params} />);
    });

    await act(async () => {
      urlListener?.({url: 'https://example.com/not-auth'});
    });

    expect(params.completeEmailLinkRegistration).not.toHaveBeenCalled();
    expect(params.setEmailVerifiedForRegistration).not.toHaveBeenCalled();
  });
});
