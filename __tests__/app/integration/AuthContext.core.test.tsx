// Tests for core AuthContext behaviors and branches.
import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

// Mock native/storage/firebase dependencies before requiring the context module
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('@react-native-firebase/app', () => ({
  getApp: jest.fn(() => ({ name: '[DEFAULT]' })),
}));

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({})),
  onAuthStateChanged: jest.fn((_auth: unknown, callback: (user: null) => void) => {
    callback(null);
    return () => undefined;
  }),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('react-native-keychain', () => ({
  ACCESS_CONTROL: { BIOMETRY_ANY: 'BIOMETRY_ANY', USER_PRESENCE: 'USER_PRESENCE' },
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY' },
  getGenericPassword: jest.fn(async () => false),
  setGenericPassword: jest.fn(async () => true),
  resetGenericPassword: jest.fn(async () => true),
}));

// Mock services used by some flows to avoid side effects
jest.mock('../../../src/services/documentVault', () => ({
  clearDocumentKeychainEntries: jest.fn(async () => undefined),
  deleteDocumentFromFirebase: jest.fn(async () => undefined),
  listVaultDocumentsFromFirebase: jest.fn(async () => []),
  deleteUserShareProfile: jest.fn(async () => undefined),
  listVaultDocumentsSharedWithUser: jest.fn(async () => []),
  enforceExpiredShareRevocations: jest.fn(async (d: any) => d),
}));

jest.mock('../../../src/services/keyBackup', () => ({
  clearKeyBackupData: jest.fn(async () => undefined),
  deleteKeyBackupFromFirebase: jest.fn(async () => undefined),
}));

// Provide a default modular auth implementation for dynamic import path used
jest.mock('@react-native-firebase/auth/lib/modular/index', () => ({
  isSignInWithEmailLink: async () => true,
}));

describe('AuthContext core flows', () => {
  afterEach(() => jest.resetAllMocks());

  let latest: any = null;
  function Probe() {
    const { useAuth } = require('../../../src/context/AuthContext');
    latest = useAuth();
    return null;
  }

  test('signIn success sets sessionMode cloud', async () => {
    const auth = require('@react-native-firebase/auth');
    (auth.signInWithEmailAndPassword as jest.Mock).mockImplementation(async (_auth: any, email: string, password: string) => {
      return { user: { uid: 'uid1', email, reload: async () => undefined } };
    });

    const AuthProvider = require('../../../src/context/AuthContext').AuthProvider;
    act(() => {
      TestRenderer.create(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
    });

    let result = false;
    await act(async () => {
      result = await latest.signIn('user@example.com', 'secret');
    });

    expect(result).toBe(true);
    expect(latest.sessionMode).toBe('cloud');
    expect(latest.authError).toBeNull();
  });

  test('signIn failure maps firebase error', async () => {
    const auth = require('@react-native-firebase/auth');
    (auth.signInWithEmailAndPassword as jest.Mock).mockImplementation(async () => {
      throw { code: 'auth/wrong-password' };
    });

    const AuthProvider = require('../../../src/context/AuthContext').AuthProvider;
    act(() => {
      TestRenderer.create(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
    });

    let result = true;
    await act(async () => {
      result = await latest.signIn('user@example.com', 'bad');
    });

    expect(result).toBe(false);
    expect(latest.authError).toBe('Invalid email or password.');
  });

  test('signUp fails when no pending registration', async () => {
    // Ensure pending registration key is absent
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (k: string) => null);

    const AuthProvider = require('../../../src/context/AuthContext').AuthProvider;
    act(() => {
      TestRenderer.create(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
    });

    let result = true;
    await act(async () => {
      result = await latest.signUp('new@example.com', 'password');
    });

    expect(result).toBe(false);
    expect(latest.authError).toContain('Verify your email first');
  });

  test('resendVerificationEmail rejects empty email', async () => {
    const AuthProvider = require('../../../src/context/AuthContext').AuthProvider;
    act(() => {
      TestRenderer.create(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
    });

    let result = true;
    await act(async () => {
      result = await latest.resendVerificationEmail('');
    });

    expect(result).toBe(false);
    expect(latest.authError).toBe('Enter your email address first.');
  });

  test('completeEmailLinkRegistration rejects empty link', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const pending = { email: 'me@example.com', requestToken: 'rtoken123' };
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (k: string) => {
      if (k === 'secdocvault.auth.pendingEmailLinkRegistration') return JSON.stringify(pending);
      return null;
    });

    const AuthProvider = require('../../../src/context/AuthContext').AuthProvider;
    act(() => {
      TestRenderer.create(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
    });

    let result = false;
    await act(async () => {
      result = await latest.completeEmailLinkRegistration('', 'me@example.com');
    });

    expect(result).toBe(false);
    expect(latest.authError).toBe('Open the verification link from your email.');
  });

  test('completeEmailLinkRegistration rejects when tokens mismatch', async () => {
    const AsyncStorage = require('@react-native-async-storage/async-storage');
    const pending = { email: 'me@example.com', requestToken: 'rtoken123' };
    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (k: string) => {
      if (k === 'secdocvault.auth.pendingEmailLinkRegistration') return JSON.stringify(pending);
      return null;
    });

    const AuthProvider = require('../../../src/context/AuthContext').AuthProvider;
    act(() => {
      TestRenderer.create(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
    });

    const fakeLink = `https://example.com/?regToken=${encodeURIComponent('different')}`;
    let result = false;
    await act(async () => {
      result = await latest.completeEmailLinkRegistration(fakeLink, 'me@example.com');
    });

    expect(result).toBe(false);
    expect(latest.authError).toContain('does not match your current email request');
  });
});
