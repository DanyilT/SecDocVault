jest.mock('react-native-get-random-values', () => ({}));

jest.mock('react-native-quick-crypto', () => ({
  default: {
    randomBytes: jest.fn(() => Buffer.alloc(12, 1)),
    createCipheriv: jest.fn(() => ({
      update: jest.fn((input: any) => input),
      final: jest.fn(() => Buffer.from('final')),
      getAuthTag: jest.fn(() => Buffer.from('auth-tag')),
    })),
  },
}), {virtual: true});

jest.mock('@react-native-firebase/app', () => ({
  getApp: jest.fn(() => ({})),
}));

jest.mock('@react-native-firebase/firestore', () => ({
  getFirestore: jest.fn(),
  collection: jest.fn(),
  doc: jest.fn(() => ({ id: 'doc-quick' })),
  query: jest.fn(),
  where: jest.fn(),
  getDocs: jest.fn(),
  setDoc: jest.fn(),
  serverTimestamp: jest.fn(() => 'mock-ts'),
}));

jest.mock('@react-native-firebase/storage', () => ({
  getStorage: jest.fn(),
  ref: jest.fn(() => 'storage-ref'),
  uploadString: jest.fn(async () => undefined),
  deleteObject: jest.fn(async () => undefined),
}));

jest.mock('react-native-keychain', () => ({
  setGenericPassword: jest.fn(async () => true),
  resetGenericPassword: jest.fn(async () => true),
  ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'mock-accessible' },
}));

jest.mock('react-native-fs', () => ({
  readFile: jest.fn(),
  stat: jest.fn(),
  read: jest.fn(),
  mkdir: jest.fn(async () => undefined),
  writeFile: jest.fn(async () => undefined),
  exists: jest.fn(async () => false),
  unlink: jest.fn(async () => undefined),
  DocumentDirectoryPath: '/tmp',
}));

jest.mock('../../../../src/services/crypto/documentCrypto', () => ({
  getOrCreateKdfMaterial: jest.fn(async () => ({ passphrase: 'pass', salt: 'salt' })),
  wrapDocumentKey: jest.fn(async () => ({ cipher: 'wrapped', iv: 'iv', salt: 'salt', wrapMode: 'device' })),
  getRecoveryPassphrase: jest.fn(async () => null),
  MissingKdfPassphraseError: class MissingKdfPassphraseError extends Error {},
  randomWordArray: jest.fn(() => []),
  toBase64: jest.fn(() => Buffer.alloc(32, 7).toString('base64')),
  encryptBase64Payload: jest.fn(async () => ({
    version: 1,
    algorithm: 'AES-256-GCM',
    iv: 'iv',
    cipher: 'cipher',
    authTag: 'tag',
    key: Buffer.alloc(32, 9).toString('base64'),
  })),
}));

import RNFS from 'react-native-fs';
import { getDocs, setDoc } from '@react-native-firebase/firestore';
import { uploadString } from '@react-native-firebase/storage';
import { uploadDocumentToFirebase } from '../../../../src/services/documentVault';

describe('uploadDocumentToFirebase quick-crypto path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getDocs as jest.Mock).mockResolvedValue({ size: 0 });
    (RNFS.stat as jest.Mock).mockResolvedValue({ size: 300000 });
    (RNFS.read as jest.Mock)
      .mockResolvedValueOnce(Buffer.from('chunk-a').toString('base64'))
      .mockResolvedValueOnce(Buffer.from('chunk-b').toString('base64'));
  });

  it('uses chunked encryption runtime for large files and uploads metadata', async () => {
    const onProgress = jest.fn();
    const result = await uploadDocumentToFirebase(
      'user-quick',
      {
        name: 'Large Doc',
        description: 'desc',
        files: [{ name: 'large.bin', uri: 'file://large.bin', size: 6 * 1024 * 1024, type: 'application/octet-stream' }],
      },
      { onProgress },
    );

    expect(uploadString).toHaveBeenCalled();
    expect(setDoc).toHaveBeenCalled();
    expect(onProgress).toHaveBeenCalled();
    expect(result.document.id).toBe('doc-quick');
  });
});
