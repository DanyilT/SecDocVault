/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../../../App';

const mockAuth = {};

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
  removeItem: jest.fn(async () => undefined),
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

jest.mock('react-native-keychain', () => ({
  ACCESS_CONTROL: {
    BIOMETRY_ANY: 'BIOMETRY_ANY',
    USER_PRESENCE: 'USER_PRESENCE',
  },
  AUTHENTICATION_TYPE: {
    BIOMETRICS: 'BIOMETRICS',
    DEVICE_PASSCODE_OR_BIOMETRICS: 'DEVICE_PASSCODE_OR_BIOMETRICS',
  },
  ACCESSIBLE: {
    WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'WHEN_UNLOCKED_THIS_DEVICE_ONLY',
  },
  getGenericPassword: jest.fn(async () => false),
  setGenericPassword: jest.fn(async () => true),
}));

jest.mock('@react-native-firebase/app', () => ({
  getApp: jest.fn(() => ({name: '[DEFAULT]'})),
}));

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => mockAuth),
  onAuthStateChanged: jest.fn((_auth: unknown, callback: (user: null) => void) => {
      callback(null);
      return () => undefined;
  }),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('@react-native-firebase/firestore', () => {
  const doc = {
    id: 'mock-doc-id',
    set: jest.fn(async () => undefined),
  };
  const collection = {
    doc: jest.fn(() => doc),
  };

  return () => ({
    collection: jest.fn(() => collection),
  });
});

jest.mock('@react-native-firebase/firestore/lib/modular', () => {
  const docRef = {id: 'mock-doc-id'};
  const snapshot = {
    exists: jest.fn(() => false),
    data: jest.fn(() => ({})),
    id: 'mock-doc-id',
  };

  return {
    getFirestore: jest.fn(() => ({})),
    collection: jest.fn(() => ({})),
    doc: jest.fn(() => docRef),
    setDoc: jest.fn(async () => undefined),
    getDoc: jest.fn(async () => snapshot),
  };
});

jest.mock('@react-native-firebase/firestore/lib/modular/FieldValue', () => ({
  serverTimestamp: jest.fn(() => 'mock-timestamp'),
}));

jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/tmp',
  readFile: jest.fn(async () => 'ZmFrZUJhc2U2NA=='),
  writeFile: jest.fn(async () => undefined),
  unlink: jest.fn(async () => undefined),
}));

jest.mock('@react-native-firebase/storage', () => {
  const ref = {
    putFile: jest.fn(async () => undefined),
    getDownloadURL: jest.fn(async () => 'https://example.com/mock-file'),
  };

  return () => ({
    ref: jest.fn(() => ref),
  });
});

jest.mock('@react-native-firebase/storage/lib/modular', () => ({
  getStorage: jest.fn(() => ({})),
  ref: jest.fn(() => ({})),
  uploadString: jest.fn(async () => ({metadata: {}})),
  getDownloadURL: jest.fn(async () => 'https://example.com/mock-file'),
}));

jest.mock('react-native-get-random-values', () => ({}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(async () => ({didCancel: true})),
  launchImageLibrary: jest.fn(async () => ({didCancel: true})),
}));

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
