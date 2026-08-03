/* global jest */

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
  getString: jest.fn(async () => ''),
  hasString: jest.fn(async () => true),
}));

jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/tmp',
  DocumentDirectoryPath: '/tmp',
  TemporaryDirectoryPath: '/tmp',
  DownloadDirectoryPath: '/tmp',
  readFile: jest.fn(async () => 'ZmFrZUJhc2U2NA=='),
  writeFile: jest.fn(async () => undefined),
  exists: jest.fn(async () => false),
  mkdir: jest.fn(async () => undefined),
  unlink: jest.fn(async () => undefined),
}));

jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(async () => ({didCancel: true})),
  launchImageLibrary: jest.fn(async () => ({didCancel: true})),
}));

jest.mock('@react-native-documents/picker', () => ({
  pick: jest.fn(async () => {
    throw new Error('user cancelled the picker');
  }),
  keepLocalCopy: jest.fn(async () => [{status: 'success', sourceUri: 'content://mock', localUri: 'file:///tmp/mock'}]),
  types: {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    plainText: 'text/plain',
    csv: ['text/csv', 'text/comma-separated-values'],
    images: 'image/*',
    audio: 'audio/*',
    video: 'video/*',
  },
}));

jest.mock('react-native-pdf', () => 'Pdf');

jest.mock('react-native-video', () => 'Video');

jest.mock('react-native-blob-util', () => ({}));

jest.mock('react-native-get-random-values', () => ({}));

jest.mock('@react-native-firebase/app', () => ({
  getApp: jest.fn(() => ({name: '[DEFAULT]'})),
}));

jest.mock('@react-native-firebase/auth', () => ({
  getAuth: jest.fn(() => ({currentUser: null})),
  onAuthStateChanged: jest.fn((_auth, cb) => {
    cb(null);
    return () => undefined;
  }),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}));

jest.mock('@react-native-firebase/firestore', () => {
  const snapshot = {
    exists: jest.fn(() => false),
    data: jest.fn(() => ({})),
    id: 'mock-doc-id',
  };

  return {
    getFirestore: jest.fn(() => ({})),
    collection: jest.fn(() => ({})),
    collectionGroup: jest.fn(() => ({})),
    query: jest.fn(() => ({})),
    where: jest.fn(() => ({})),
    doc: jest.fn(() => ({id: 'mock-doc-id'})),
    getDoc: jest.fn(async () => snapshot),
    getDocs: jest.fn(async () => ({docs: []})),
    setDoc: jest.fn(async () => undefined),
    deleteDoc: jest.fn(async () => undefined),
    serverTimestamp: jest.fn(() => 'mock-timestamp'),
  };
});

jest.mock('@react-native-firebase/storage', () => {
  const storageApi = {
    getStorage: jest.fn(() => ({})),
    ref: jest.fn(() => ({})),
    uploadString: jest.fn(async () => ({metadata: {}})),
    getDownloadURL: jest.fn(async () => 'https://example.com/mock-file'),
    deleteObject: jest.fn(async () => undefined),
  };

  return {
    __esModule: true,
    default: jest.fn(() => ({ref: storageApi.ref})),
    ...storageApi,
  };
});

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
  resetGenericPassword: jest.fn(async () => true),
  getSupportedBiometryType: jest.fn(async () => null),
}));

jest.mock('react-native-view-shot', () => ({
  captureRef: jest.fn(async () => 'bW9ja0Jhc2U2NA=='),
  captureScreen: jest.fn(async () => 'bW9ja0Jhc2U2NA=='),
}));
