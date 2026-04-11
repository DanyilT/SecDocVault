import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';

import AsyncStorage from '@react-native-async-storage/async-storage';

import {AuthProvider, useAuth} from '../../../src/context/AuthContext';

type AuthProbe = ReturnType<typeof useAuth>;

const mockKeychainGet = jest.fn();
const mockKeychain = jest.requireMock('react-native-keychain') as {
  setGenericPassword: jest.Mock;
};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('@react-native-firebase/app', () => ({
  getApp: jest.fn(() => ({name: '[DEFAULT]'})),
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

jest.mock('@react-native-firebase/firestore/lib/modular', () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(() => ({})),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  getDocs: jest.fn(async () => ({forEach: () => undefined, docs: [], size: 0})),
  setDoc: jest.fn(async () => undefined),
  getDoc: jest.fn(async () => ({exists: () => false, data: () => ({})})),
  doc: jest.fn(() => ({})),
  deleteDoc: jest.fn(async () => undefined),
  collectionGroup: jest.fn(() => ({})),
}));

jest.mock('@react-native-firebase/firestore/lib/modular/FieldValue', () => ({
  serverTimestamp: jest.fn(() => 'mock-timestamp'),
}));

jest.mock('../../../src/services/documentUpload', () => ({
  clearDocumentKeychainEntries: jest.fn(async () => undefined),
  deleteDocumentFromFirebase: jest.fn(async () => undefined),
  listVaultDocumentsFromFirebase: jest.fn(async () => []),
}));

jest.mock('../../../src/services/keyBackup', () => ({
  clearKeyBackupData: jest.fn(async () => undefined),
  deleteKeyBackupFromFirebase: jest.fn(async () => undefined),
}));

jest.mock('react-native-keychain', () => ({
  ACCESS_CONTROL: {
    BIOMETRY_ANY: 'BIOMETRY_ANY',
    USER_PRESENCE: 'USER_PRESENCE',
  },
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  },
  getGenericPassword: (...args: unknown[]) => mockKeychainGet(...args),
  setGenericPassword: jest.fn(async () => true),
  resetGenericPassword: jest.fn(async () => true),
}));

jest.mock('react-native-fs', () => ({
  DocumentDirectoryPath: '/tmp',
  exists: jest.fn(async () => false),
  unlink: jest.fn(async () => undefined),
}));

describe('AuthContext guest login', () => {
  let latestAuth: AuthProbe | null = null;

  function Probe() {
    latestAuth = useAuth();
    return null;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    latestAuth = null;

    (AsyncStorage.getItem as jest.Mock).mockImplementation(async (key: string) => {
      if (key === 'secdocvault.guest.account.meta') {
        return JSON.stringify({
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        });
      }
      return null;
    });

    mockKeychainGet.mockImplementation(async (options?: {service?: string}) => {
      if (options?.service === 'secdocvault.guest.account.credentials') {
        return {
          username: 'guest',
          password: 'correct-password',
        };
      }
      return false;
    });
  });

  test('rejects guest login when password is incorrect', async () => {
    await act(async () => {
      ReactTestRenderer.create(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
    });

    let result = true;
    await act(async () => {
      result = await latestAuth!.loginGuestAccount('wrong-password');
    });

    expect(result).toBe(false);
    expect(latestAuth?.authError).toBe('Incorrect guest password.');
    expect(mockKeychainGet).toHaveBeenCalledWith({
      service: 'secdocvault.guest.account.credentials',
    });
  });

  test('changes guest password when the current password matches', async () => {
    await act(async () => {
      ReactTestRenderer.create(
        <AuthProvider>
          <Probe />
        </AuthProvider>,
      );
    });

    let result = false;
    await act(async () => {
      result = await latestAuth!.changeGuestPassword('correct-password', 'new-secret');
    });

    expect(result).toBe(true);
    expect(mockKeychainGet).toHaveBeenCalledWith({
      service: 'secdocvault.guest.account.credentials',
    });
    expect(mockKeychain.setGenericPassword).toHaveBeenCalledWith(
      'guest',
      'new-secret',
      expect.objectContaining({service: 'secdocvault.guest.account.credentials'}),
    );
    expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      'secdocvault.guest.account.meta',
      expect.stringContaining('updatedAt'),
    );
  });
});
