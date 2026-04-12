import { decryptDocumentPayload } from '../../../../src/services/documentVault';
jest.mock('react-native-quick-crypto', () => ({
  randomBytes: jest.fn(() => require('buffer').Buffer.from('01234567890123456789012345678901')),
  createCipheriv: jest.fn(() => ({
    update: jest.fn(() => require('buffer').Buffer.from('cipher')),
    final: jest.fn(() => require('buffer').Buffer.from('')),
    getAuthTag: jest.fn(() => require('buffer').Buffer.from('tag')),
  })),
  createDecipheriv: jest.fn(() => ({
    setAuthTag: jest.fn(),
    update: jest.fn(() => require('buffer').Buffer.from('plain')),
    final: jest.fn(() => require('buffer').Buffer.from('')),
  })),
  pbkdf2Sync: jest.fn(() => require('buffer').Buffer.from('derived-key')),
  constants: {RSA_PKCS1_OAEP_PADDING: 1},
}));

jest.mock('../../../../src/services/crypto/documentCrypto.ts', () => ({
  decryptBase64Payload: jest.fn(async () => 'decrypted-base64'),
  encryptBase64Payload: jest.fn(async () => ({
    cipher: 'cipher',
    iv: 'iv',
    authTag: 'tag',
    key: 'key',
    algorithm: 'AES-256-GCM',
    version: 2,
  })),
  getOrCreateKdfMaterial: jest.fn(async () => ({passphrase: 'pass', salt: 'salt'})),
  getRecoveryPassphrase: jest.fn(async () => null),
  unwrapDocumentKey: jest.fn(async () => 'wrapped-key'),
  unwrapDocumentKeyFromShareEnvelope: jest.fn(async () => 'shared-key'),
  wrapDocumentKey: jest.fn(async () => ({
    cipher: 'cipher',
    iv: 'iv',
    authTag: 'tag',
    salt: 'salt',
    iterations: 100000,
    algorithm: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    wrapMode: 'device',
  })),
  wrapDocumentKeyForRecipient: jest.fn(async () => ({
    wrappedKeyCipher: 'wrapped',
    keyWrapAlgorithm: 'RSA-OAEP-SHA256',
  })),
  getOrCreateSharingKeyPair: jest.fn(async () => ({publicKey: 'pub', privateKey: 'priv', algorithm: 'RSA-OAEP-SHA256'})),
}));

const firestore = jest.requireMock('@react-native-firebase/firestore');
const keychain = jest.requireMock('react-native-keychain');
const rnfs = jest.requireMock('react-native-fs');
const auth = jest.requireMock('@react-native-firebase/auth');

beforeEach(() => {
  jest.clearAllMocks();
  auth.getAuth.mockReturnValue({currentUser: {uid: 'recipient-uid', email: 'recipient@example.com'}});
  keychain.getGenericPassword.mockResolvedValue(false);
  rnfs.readFile.mockResolvedValue(JSON.stringify({iv: 'iv', cipher: 'cipher', algorithm: 'AES-256-GCM', authTag: 'tag'}));
});

test('decrypts a shared document using email-based grant fallback when local grant metadata is incomplete', async () => {
  firestore.getDoc
    .mockResolvedValueOnce({exists: () => false})
    .mockResolvedValueOnce({exists: () => true, data: () => ({})});
  firestore.getDocs.mockResolvedValueOnce({
    docs: [
      {
        data: () => ({
          recipientUid: 'recipient-uid',
          recipientEmail: 'recipient@example.com',
          allowExport: true,
          wrappedKeyCipher: 'wrapped-key-cipher',
          keyWrapAlgorithm: 'RSA-OAEP-SHA256',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
          revokedAt: null,
        }),
      },
    ],
  });

  const result = await decryptDocumentPayload(
    {
      id: 'doc-1',
      name: 'Shared Doc',
      hash: 'hash',
      size: '1 KB',
      uploadedAt: '2026-04-11',
      owner: 'owner-uid',
      sharedKeyGrants: [],
      references: [
        {
          name: 'file.jpg',
          size: 123,
          type: 'image/jpeg',
          source: 'local',
          localPath: '/tmp/file.enc',
          order: 0,
        },
      ],
    },
    0,
  );

  expect(result).toEqual({
    base64: 'decrypted-base64',
    mimeType: 'image/jpeg',
    fileName: 'file.jpg',
    fileHash: undefined,
    fileOrder: 0,
  });
  expect(firestore.getDocs).toHaveBeenCalled();
});



